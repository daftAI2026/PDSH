/**
 * [INPUT]: 依赖当前 Document、AbortSignal、viewport-fonts/viewport-forms 快照适配与 modern-screenshot 的 DOM→Canvas 能力；仅同源获取资源。
 * [OUTPUT]: 对外提供 captureViewport、可替换渲染引擎及稳定的采集错误码。
 * [POS]: 截图像素来源边界；使用 documentElement 与视口几何，不触达 Electron Main 或系统截图接口。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

import { collectViewportFontCSS } from './viewport-fonts.ts';
import { prepareViewportForms } from './viewport-forms.ts';

const CAPTURE_TIMEOUT_MS = 8_000;
const MAX_CAPTURE_PIXELS = 16_000_000;

export type CaptureViewportErrorCode =
  | 'aborted'
  | 'timeout'
  | 'oversize'
  | 'viewport-changed'
  | 'embedded-content'
  | 'resource-warning'
  | 'capture-failed';

export class CaptureViewportError extends Error {
  readonly code: CaptureViewportErrorCode;

  constructor(code: CaptureViewportErrorCode) {
    super(messageFor(code));
    this.name = 'CaptureViewportError';
    this.code = code;
  }
}

export interface ViewportContext {
  log: { warn: (...args: unknown[]) => void };
}

export interface ViewportEngineOptions {
  width: number;
  height: number;
  scale: number;
  timeout: number;
  debug: false;
  autoDestruct: false;
  onCloneEachNode: (cloned: Node) => void;
  features: { restoreScrollPosition: true };
  font: { cssText: string };
  filter: (node: Node) => boolean;
  fetchFn: (url: string) => Promise<string | false>;
  fetch: { requestInit: RequestInit };
}

/**
 * 只暴露采集器真正使用的三步，以便合同测试替换像素引擎。
 */
export interface CaptureViewportEngine {
  createContext(root: HTMLElement, options: ViewportEngineOptions): Promise<ViewportContext>;
  domToCanvas(context: ViewportContext): Promise<HTMLCanvasElement>;
  destroyContext(context: ViewportContext): void | Promise<void>;
}

export interface CaptureViewportOptions {
  signal?: AbortSignal;
  engine?: CaptureViewportEngine;
}

interface ViewportSnapshot {
  width: number;
  height: number;
  scale: number;
  scrollX: number;
  scrollY: number;
  pixelWidth: number;
  pixelHeight: number;
}

interface InterruptState {
  controller: AbortController;
  reason: CaptureViewportError | null;
  guard<T>(promise: Promise<T>): Promise<T>;
  dispose(): void;
}

const OMIT_SELECTORS = [
  '[data-pdsh-capture-hide]',
  '[data-pdsh-capture-host]',
  '[data-pdsh-capture-notice]',
  '[data-pdsh-probe]',
  '[data-pdsh-capture-entry]',
  '[data-pdsh-search-entry]',
  '.pdsh-native-tooltip',
  '[role="tooltip"]',
].join(',');

/** 只有这页自己或内联/本地对象资源进入资源内嵌流程。 */
function createFetchFn(doc: Document, signal: AbortSignal): ViewportEngineOptions['fetchFn'] {
  const view = doc.defaultView;
  const page = new URL(doc.baseURI);
  const fetcher = view?.fetch?.bind(view) ?? globalThis.fetch?.bind(globalThis);

  return async (rawUrl) => {
    if (signal.aborted) throw new CaptureViewportError('aborted');
    let url: URL;
    try {
      url = new URL(rawUrl, doc.baseURI);
    } catch {
      throw new CaptureViewportError('resource-warning');
    }

    if (url.protocol === 'data:') return rawUrl;
    if (url.protocol === 'blob:') {
      if (url.origin !== 'null' && url.origin !== page.origin) throw new CaptureViewportError('resource-warning');
    } else if (url.protocol !== page.protocol || url.host !== page.host || url.username || url.password) {
      throw new CaptureViewportError('resource-warning');
    }
    if (!fetcher) throw new CaptureViewportError('resource-warning');

    try {
      const response = await fetcher(url.href, {
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        mode: 'same-origin',
        signal,
      });
      if (!response.ok) throw new CaptureViewportError('resource-warning');
      const bytes = new Uint8Array(await response.arrayBuffer());
      const encode = view?.btoa?.bind(view) ?? globalThis.btoa?.bind(globalThis);
      if (!encode) throw new CaptureViewportError('resource-warning');
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim() || 'application/octet-stream';
      return `data:${contentType};base64,${encode(binary)}`;
    } catch (error) {
      if (error instanceof CaptureViewportError) throw error;
      if (signal.aborted) throw new CaptureViewportError('aborted');
      throw new CaptureViewportError('resource-warning');
    }
  };
}

function messageFor(code: CaptureViewportErrorCode): string {
  switch (code) {
    case 'aborted': return '视口采集已取消';
    case 'timeout': return '视口采集超时';
    case 'oversize': return '视口像素超过采集上限';
    case 'viewport-changed': return '采集期间视口尺寸、缩放或滚动位置发生变化';
    case 'embedded-content': return '窗口包含暂不支持的嵌入内容';
    case 'resource-warning': return '截图资源加载不完整';
    default: return '视口截图失败';
  }
}

function snapshotViewport(doc: Document): ViewportSnapshot {
  const view = doc.defaultView;
  if (!view || !doc.documentElement) throw new CaptureViewportError('capture-failed');
  const width = view.innerWidth;
  const height = view.innerHeight;
  const scale = view.devicePixelRatio;
  if (![width, height, scale].every((value) => Number.isFinite(value) && value > 0)) {
    throw new CaptureViewportError('capture-failed');
  }
  const pixelWidth = Math.floor(width * scale);
  const pixelHeight = Math.floor(height * scale);
  if (pixelWidth < 1 || pixelHeight < 1 || pixelWidth * pixelHeight > MAX_CAPTURE_PIXELS) {
    throw new CaptureViewportError('oversize');
  }
  return { width, height, scale, scrollX: view.scrollX, scrollY: view.scrollY, pixelWidth, pixelHeight };
}

function isVisible(element: Element, doc: Document, width: number, height: number): boolean {
  if (element.closest(OMIT_SELECTORS) || (element as HTMLElement).hidden) return false;
  const view = doc.defaultView;
  if (!view) return false;
  for (let current: Element | null = element; current; current = current.parentElement) {
    const style = view.getComputedStyle(current);
    const opacity = style.opacity.trim();
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || (opacity !== '' && Number(opacity) === 0)) {
      return false;
    }
  }
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < width && rect.top < height;
}

function hasVisibleBrokenImage(doc: Document, snapshot: ViewportSnapshot): boolean {
  return Array.from(doc.documentElement.querySelectorAll('img')).some((image) =>
    image.getAttribute('src') !== null && image.complete && image.naturalWidth === 0 &&
    isVisible(image, doc, snapshot.width, snapshot.height));
}

function rejectUnsupportedEmbeddedContent(doc: Document, snapshot: ViewportSnapshot): void {
  for (const element of doc.documentElement.querySelectorAll('iframe, webview, video')) {
    if (isVisible(element, doc, snapshot.width, snapshot.height)) {
      throw new CaptureViewportError('embedded-content');
    }
  }
}

function createFilter(doc: Document, signal: AbortSignal): ViewportEngineOptions['filter'] {
  return (node) => {
    if (signal.aborted) throw new CaptureViewportError('aborted');
    if (node === doc.documentElement || node.nodeType !== 1) return true;
    const element = node as Element;
    return !(element.id.startsWith('__SANDBOX__') || element.matches(OMIT_SELECTORS));
  };
}

function createInterrupt(signal?: AbortSignal): InterruptState {
  const controller = new AbortController();
  let rejectStop!: (error: CaptureViewportError) => void;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reason: CaptureViewportError | null = null;
  const stop = new Promise<never>((_resolve, reject) => { rejectStop = reject; });
  const stopWith = (code: 'aborted' | 'timeout') => {
    if (reason) return;
    reason = new CaptureViewportError(code);
    controller.abort();
    rejectStop(reason);
  };
  const onAbort = () => stopWith('aborted');
  if (signal?.aborted) onAbort();
  else signal?.addEventListener('abort', onAbort, { once: true });
  if (!reason) timer = setTimeout(() => stopWith('timeout'), CAPTURE_TIMEOUT_MS);

  return {
    controller,
    get reason() { return reason; },
    guard: <T>(promise: Promise<T>) => Promise.race([promise, stop]),
    dispose: () => {
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

async function loadEngine(): Promise<CaptureViewportEngine> {
  const library = await import('modern-screenshot');
  return {
    createContext: (root, options) => library.createContext(root, options),
    domToCanvas: (context) => library.domToCanvas(context as Parameters<typeof library.domToCanvas>[0]),
    destroyContext: (context) => library.destroyContext(context as Parameters<typeof library.destroyContext>[0]),
  };
}

/** 从当前 HTML 视口生成像素；成功结果仅在资源无警告且几何稳定时返回。 */
export async function captureViewport(doc: Document, options: CaptureViewportOptions = {}): Promise<HTMLCanvasElement> {
  if (options.signal?.aborted) throw new CaptureViewportError('aborted');
  const root = doc.documentElement;
  const before = snapshotViewport(doc);
  rejectUnsupportedEmbeddedContent(doc, before);

  const interrupt = createInterrupt(options.signal);
  let context: ViewportContext | undefined;
  let warning = false;
  let result: HTMLCanvasElement | undefined;
  let failure: CaptureViewportError | undefined;
  let engine: CaptureViewportEngine | undefined;
  let rendering: Promise<HTMLCanvasElement> | undefined;
  let renderingSettled = false;
  let forms: ReturnType<typeof prepareViewportForms> | undefined;
  try {
    engine = await interrupt.guard(options.engine ? Promise.resolve(options.engine) : loadEngine());
    const requestInit: RequestInit = {
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      mode: 'same-origin',
      signal: interrupt.controller.signal,
    };
    const loadAsset = createFetchFn(doc, interrupt.controller.signal);
    let fontCSS: string;
    try {
      fontCSS = await interrupt.guard(collectViewportFontCSS(doc, {
        signal: interrupt.controller.signal,
        loadAsset: async url => {
          const result = await loadAsset(url);
          if (!result) throw new CaptureViewportError('resource-warning');
          return result;
        },
      }));
    } catch {
      throw interrupt.reason ?? new CaptureViewportError('resource-warning');
    }
    forms = prepareViewportForms(doc, interrupt.controller.signal);
    const createContext = Promise.resolve().then(() => engine.createContext(root, {
      width: before.width,
      height: before.height,
      scale: before.scale,
      timeout: CAPTURE_TIMEOUT_MS,
      debug: false,
      autoDestruct: false,
      onCloneEachNode: forms.onCloneEachNode,
      features: { restoreScrollPosition: true },
      font: { cssText: fontCSS },
      filter: createFilter(doc, interrupt.controller.signal),
      fetchFn: loadAsset,
      fetch: { requestInit },
    }));
    try {
      context = await interrupt.guard(createContext);
    } catch (error) {
      void createContext.then((lateContext) => {
        lateContext.log.warn = () => { warning = true; };
        return engine!.destroyContext(lateContext);
      }).catch(() => {});
      throw error;
    }
    if (context.log) context.log.warn = () => { warning = true; };
    if (hasVisibleBrokenImage(doc, before)) throw new CaptureViewportError('resource-warning');

    rendering = Promise.resolve().then(() => engine.domToCanvas(context!));
    void rendering.then(() => { renderingSettled = true; }, () => { renderingSettled = true; });
    result = await interrupt.guard(rendering);
    if (warning) throw new CaptureViewportError('resource-warning');
    if (result.width !== before.pixelWidth || result.height !== before.pixelHeight) {
      throw new CaptureViewportError('capture-failed');
    }
    const after = snapshotViewport(doc);
    if (doc.documentElement !== root || after.width !== before.width || after.height !== before.height || after.scale !== before.scale || after.scrollX !== before.scrollX || after.scrollY !== before.scrollY) {
      throw new CaptureViewportError('viewport-changed');
    }
  } catch (error) {
    failure = error instanceof CaptureViewportError ? error : new CaptureViewportError('capture-failed');
  } finally {
    if (context && engine && rendering && !renderingSettled) {
      // +--- 先阻断新节点读取，旧渲染结算后再归还库的 context ---+
      const ownedContext = context, ownedEngine = engine;
      void rendering.then(
        () => ownedEngine.destroyContext(ownedContext),
        () => ownedEngine.destroyContext(ownedContext),
      ).catch(() => {});
    } else if (context && engine) {
      try {
        const destruction = Promise.resolve(engine.destroyContext(context));
        await interrupt.guard(destruction);
      } catch {
        if (!failure) failure = interrupt.reason ?? new CaptureViewportError('capture-failed');
      }
    }
    forms?.restore();
    interrupt.dispose();
  }

  if (interrupt.reason) throw interrupt.reason;
  if (failure) throw failure;
  if (warning) throw new CaptureViewportError('resource-warning');
  if (!result) throw new CaptureViewportError('capture-failed');
  return result;
}
