/**
 * [INPUT]: 依赖 page-capture-port 的窄桥接口、shared/capture-bridge 的统一预算、AbortSignal、共同请求诊断与浏览器解码；不管理连接或读取 DOM 样式/资源。
 * [OUTPUT]: 提供 captureViewport 与固定错误分类；验证原生像素，不缩放或重绘，取消丢弃迟到结果，不将原生忙碌误报为调试端口冲突。
 * [POS]: controller 的唯一取像边界；装配层选择正式宿主桥或明确接受的内部桥，均需独立安装件能力验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { CAPTURE_TIMEOUT_MS } from './capture-lifecycle.ts';
import { isPageCapturePort, readPageCapturePort, type PageCapturePort } from './page-capture-port.ts';
export { readPageCapturePort, type PageCapturePort } from './page-capture-port.ts';

import { MAX_PAGE_PIXELS as MAX_CAPTURE_PIXELS, MAX_PNG_BYTES as MAX_CAPTURE_BYTES, isCaptureId } from '../../shared/capture-bridge.ts';
import type { CaptureTrace } from '../../shared/capture-trace.ts';
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export type CaptureViewportErrorCode = 'host-unavailable' | 'aborted' | 'timeout' | 'oversize' | 'viewport-changed' | 'invalid-pixels' | 'capture-failed' | 'capture-busy' | 'unsupported-content' | 'bridge-cleanup-unconfirmed' | 'bridge-port-busy' | 'control-cleanup-unconfirmed';
export class CaptureViewportError extends Error {
  readonly code: CaptureViewportErrorCode;
  constructor(code: CaptureViewportErrorCode) {
    super({
      'bridge-port-busy': '取像桥预设调试端口已被占用',
      'control-cleanup-unconfirmed': '取像连接释放尚未确认',
      'bridge-cleanup-unconfirmed': '无法确认插件调试接口已关闭，请停用拍照并保留工作后确认重启 DSH。',
      'host-unavailable': '宿主尚未提供当前页面像素采集接口',
      'capture-busy': '宿主仍有原生取像操作未完成', 'unsupported-content': '当前页面包含不能完整捕获的独立视图',
      aborted: '页面取像已取消', timeout: '页面取像超时', oversize: '截图超过像素或字节上限',
      'viewport-changed': '取像期间视口发生变化', 'invalid-pixels': '宿主返回的截图无效', 'capture-failed': '当前页面取像失败',
    }[code]);
    this.name = 'CaptureViewportError'; this.code = code;
  }
}

const NATIVE_FAILURES: Record<string, CaptureViewportErrorCode> = {
  'invalid-request': 'capture-failed', unavailable: 'host-unavailable', busy: 'capture-busy',
  cancelled: 'aborted', stale: 'viewport-changed', 'unsupported-content': 'unsupported-content',
  'too-large': 'oversize', 'capture-failed': 'capture-failed',
};
function captureError(error: unknown): CaptureViewportError {
  if (error instanceof CaptureViewportError) return error;
  const wire = typeof error === 'object' && error !== null ? error as { code?: unknown; message?: unknown } : null;
  if (wire?.code === 'bridge-cleanup-unconfirmed' || wire?.code === 'bridge-port-busy' || wire?.code === 'control-cleanup-unconfirmed') {
    return new CaptureViewportError(wire.code);
  }
  // Electron invoke 仅保留 Main Error.message；只解析本取像通道的固定错误，不透传原生诊断。
  const match = typeof wire?.message === 'string'
    ? /^(?:Error invoking remote method 'dsh-desktop:page-capture': Error: )?dsh desktop page capture: ([a-z-]+)$/.exec(wire.message)
    : null;
  const code = match && Object.hasOwn(NATIVE_FAILURES, match[1]) ? NATIVE_FAILURES[match[1]] : 'capture-failed';
  return new CaptureViewportError(code);
}
function viewport(doc: Document) {
  const view = doc.defaultView;
  if (!view || !doc.documentElement.isConnected) throw new CaptureViewportError('capture-failed');
  const values = [view.innerWidth, view.innerHeight, view.devicePixelRatio, view.scrollX, view.scrollY];
  if (view.visualViewport) {
    const { width, height, scale, offsetLeft, offsetTop } = view.visualViewport;
    if ([width, height, scale].some(value => !(value > 0))) throw new CaptureViewportError('capture-failed');
    values.push(width, height, scale, offsetLeft, offsetTop);
  }
  if (!values.every(Number.isFinite) || values.slice(0, 3).some(value => value <= 0)) throw new CaptureViewportError('capture-failed');
  return values;
}
function pngDimensions(value: unknown): { png: Uint8Array; width: number; height: number } {
  if (!ArrayBuffer.isView(value) || Object.prototype.toString.call(value) !== '[object Uint8Array]') throw new CaptureViewportError('invalid-pixels');
  const png = value as Uint8Array;
  if (png.byteLength > MAX_CAPTURE_BYTES) throw new CaptureViewportError('oversize');
  if (png.byteLength < 33 || PNG_SIGNATURE.some((byte, index) => png[index] !== byte)
    || png[8] !== 0 || png[9] !== 0 || png[10] !== 0 || png[11] !== 13
    || String.fromCharCode(...png.subarray(12, 16)) !== 'IHDR') throw new CaptureViewportError('invalid-pixels');
  const data = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const width = data.getUint32(16), height = data.getUint32(20);
  if (!width || !height) throw new CaptureViewportError('invalid-pixels');
  if (width * height > MAX_CAPTURE_PIXELS) throw new CaptureViewportError('oversize');
  return { png, width, height };
}
function matchesNativeDimension(pixels: number, cssSize: number, ratio: number): boolean {
  // innerWidth/Height 是整数 CSS 尺寸；缩放后的真实视口可能含小数。
  // 由一 CSS 单位的量化区间推导物理像素边界，不猜固定像素偏移、不重采样。
  return pixels >= Math.floor(cssSize * ratio) && pixels <= Math.ceil((cssSize + 1) * ratio);
}

export async function captureViewport(doc: Document, { signal, port = readPageCapturePort(doc), trace = () => {}, requestId = doc.defaultView?.crypto.randomUUID() }: { signal?: AbortSignal; port?: PageCapturePort | null; trace?: CaptureTrace; requestId?: string } = {}): Promise<HTMLCanvasElement> {
  if (signal?.aborted) throw new CaptureViewportError('aborted');
  if (!isPageCapturePort(port)) throw new CaptureViewportError('host-unavailable');
  const view = doc.defaultView!, before = viewport(doc), root = doc.documentElement;
  if (before[0] * before[1] * before[2] ** 2 > MAX_CAPTURE_PIXELS) throw new CaptureViewportError('oversize');
  if (!isCaptureId(requestId)) throw new CaptureViewportError('capture-failed');
  let stopped: CaptureViewportError | null = null;
  let rejectStop: (error: CaptureViewportError) => void;
  const interrupted = new Promise<never>((_resolve, reject) => { rejectStop = reject; });
  function stop(code: CaptureViewportErrorCode) {
    if (stopped) return;
    stopped = new CaptureViewportError(code);
    // Electron capturePage 不能强制中断；宿主必须按 ID 丢弃迟到像素。
    Promise.resolve().then(() => port.cancel(requestId)).catch(() => {});
    rejectStop(stopped);
  }
  const abort = () => stop('aborted');
  const changed = () => stop('viewport-changed');
  signal?.addEventListener('abort', abort, { once: true });
  doc.addEventListener('scroll', changed, true);
  view.addEventListener('resize', changed);
  const visual = view.visualViewport;
  visual?.addEventListener('resize', changed);
  visual?.addEventListener('scroll', changed);
  const timeout = view.setTimeout(() => stop('timeout'), CAPTURE_TIMEOUT_MS);
  function assertViewport() {
    if (stopped) throw stopped;
    const after = viewport(doc);
    if (root !== doc.documentElement || before.length !== after.length || before.some((value, index) => value !== after[index])) throw new CaptureViewportError('viewport-changed');
  }
  let bitmap: ImageBitmap | undefined, canvas: HTMLCanvasElement | undefined;
  try {
    const response = await Promise.race([Promise.resolve().then(() => {
      if (stopped) throw stopped;
      return port.capturePng(requestId);
    }), interrupted]);
    assertViewport();
    if (!response || response.requestId !== requestId) throw new CaptureViewportError('invalid-pixels');
    trace('pixels-validating', requestId);
    const pixels = pngDimensions(response.png);
    if (!matchesNativeDimension(pixels.width, before[0], before[2]) || !matchesNativeDimension(pixels.height, before[1], before[2])) throw new CaptureViewportError('invalid-pixels');
    if (typeof view.createImageBitmap !== 'function') throw new CaptureViewportError('capture-failed');
    // 复制的是已冻结 PNG 字节，不重新请求图片、字体或网页内容。
    const blob = new view.Blob([new Uint8Array(pixels.png)], { type: 'image/png' });
    const decoding = view.createImageBitmap(blob).then(image => {
      if (stopped) image.close();
      return image;
    });
    bitmap = await Promise.race([decoding, interrupted]);
    assertViewport();
    if (bitmap.width !== pixels.width || bitmap.height !== pixels.height) throw new CaptureViewportError('invalid-pixels');
    canvas = doc.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new CaptureViewportError('capture-failed');
    // 等尺寸复制冻结像素：无 DOM、无布局计算、无缩放或裁剪。
    context.drawImage(bitmap, 0, 0);
    trace('pixels-decoded', requestId);
    return canvas;
  } catch (error) {
    if (canvas) { canvas.width = 0; canvas.height = 0; }
    throw captureError(error);
  } finally {
    bitmap?.close(); view.clearTimeout(timeout); signal?.removeEventListener('abort', abort);
    doc.removeEventListener('scroll', changed, true); view.removeEventListener('resize', changed);
    visual?.removeEventListener('resize', changed); visual?.removeEventListener('scroll', changed);
  }
}
