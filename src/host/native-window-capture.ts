/**
 * [INPUT]: 依赖显式 Host Remote 点击、Node 子进程与 native/window-capture.mm 输出的 PNG/固定状态文本。
 * [OUTPUT]: 提供有类型的 helper 启动/取消、PNG封套与可选视口元数据校验及 fixed Failure code；坏几何不丢弃有效 PNG。
 * [POS]: src/host 的原生采集适配器，被唯一 window-capture-service.ts 调用；不启动 Main/Inspector/HTTP。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { spawn, type SpawnOptionsWithStdioTuple } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import type { Readable } from 'node:stream';
import { CAPTURE_LIMITS } from '../shared/window-capture-protocol.ts';
import type { CaptureFailureCode, CapturePhase } from '../shared/window-capture-protocol.ts';
import type { NativeCaptureResult, NativeCaptureViewport } from './window-capture-stream.ts';

const MAX_BYTES = CAPTURE_LIMITS.maxBytes;
const MAX_PIXELS = CAPTURE_LIMITS.maxPixels;
const START_TIMEOUT = 5_000;
const CAPTURE_TIMEOUT = 30_000;
const FORCE_TIMEOUT = 2_000;
const MAX_DIAGNOSTIC_LINE = 1_024;
const MAX_PNG_CHUNKS = 65_536;

/** 固定传递给 helper 的失败分类；未识别的子进程状态不会穿过该边界。 */
export type NativeCaptureFailureCode = CaptureFailureCode
  | 'invalid-arguments'
  | 'invalid-pid'
  | 'caller-is-not-own-host-parent'
  | 'host-parent-mismatch'
  | 'main-process-unavailable'
  | 'own-main-is-not-dsh'
  | 'shareable-content-timeout'
  | 'shareable-content-unavailable'
  | 'native-pixel-scale-unavailable'
  | 'native-size-invalid-or-over-budget'
  | 'capture-failed'
  | 'pixel-budget-exceeded'
  | 'png-destination-failed'
  | 'png-encode-failed'
  | 'output-pipe-failed'
  | 'helper-protocol-invalid'
  | 'gesture-required';

export class CaptureFailure extends Error {
  readonly code: NativeCaptureFailureCode;

  constructor(code: NativeCaptureFailureCode) {
    super(code);
    this.code = code;
    this.name = 'CaptureFailure';
  }
}

export interface PngSize {
  readonly width: number;
  readonly height: number;
}

/** 子进程只将独立 PNG/状态管道交给 Host；测试以假进程实现同一窄接口。 */
export interface NativeCaptureChild {
  readonly stdout: Readable;
  readonly stderr: Readable;
  kill(signal: NodeJS.Signals): boolean;
  on(event: 'error', listener: (error: Error) => void): unknown;
  on(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
  off(event: 'error', listener: (error: Error) => void): unknown;
  off(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
}

export type NativeCaptureSpawnOptions = SpawnOptionsWithStdioTuple<'ignore', 'pipe', 'pipe'> & {
  readonly shell: false;
};

export type NativeCaptureSpawner = (
  command: string,
  args: readonly string[],
  options: NativeCaptureSpawnOptions,
) => NativeCaptureChild;

export interface NativeCaptureTimerHandle {
  readonly timer: ReturnType<typeof setTimeout> | number;
}

export interface NativeCaptureScheduler {
  set(callback: () => void, delay: number): NativeCaptureTimerHandle;
  clear(handle: NativeCaptureTimerHandle): void;
}

export interface RunNativeCaptureOptions {
  readonly signal?: AbortSignal;
  readonly requestPermission?: boolean;
  readonly helperPath?: string;
  readonly platform?: NodeJS.Platform;
  readonly arch?: string;
  readonly spawnProcess?: NativeCaptureSpawner;
  readonly scheduler?: NativeCaptureScheduler;
  readonly onPhase?: (phase: CapturePhase) => void;
}

export interface NativeCaptureTarget {
  readonly relativePath: string;
  readonly windowsHide: boolean;
}

export interface CaptureRunnerOptions {
  readonly signal: AbortSignal;
  readonly requestPermission: true;
}

export type CaptureRunner = (options: CaptureRunnerOptions) => Promise<NativeCaptureResult>;

export interface ClickCaptureController {
  capture(signal?: AbortSignal): Promise<NativeCaptureResult>;
  dispose(): Promise<void>;
}

export interface CreateClickCaptureOptions {
  readonly runner?: CaptureRunner;
}

interface CapturedMetadata {
  readonly status: 'captured';
  readonly width: unknown;
  readonly height: unknown;
  readonly pointPixelScale: unknown;
  readonly pngBytes: unknown;
  readonly viewport?: unknown;
}

type HelperMetadata = CapturedMetadata | { readonly status: NativeCaptureFailureCode };

interface ActiveCapture {
  readonly aborter: AbortController;
  readonly done: Promise<void>;
}

const FIXED_FAILURES: ReadonlySet<NativeCaptureFailureCode> = new Set([
  'permission-not-granted', 'requires-macos-14', 'api-unavailable', 'invalid-arguments',
  'invalid-pid', 'caller-is-not-own-host-parent', 'host-parent-mismatch',
  'main-process-unavailable', 'own-main-is-not-dsh', 'process-changed',
  'shareable-content-timeout', 'shareable-content-unavailable',
  'no-ordinary-window-for-main-pid', 'ambiguous-multiple-windows-refuse',
  'window-changed', 'native-pixel-scale-unavailable', 'native-size-invalid-or-over-budget',
  'capture-timeout', 'capture-failed', 'pixel-budget-exceeded', 'byte-budget-exceeded',
  'encoded-byte-budget-exceeded', 'png-destination-failed', 'png-encode-failed', 'output-pipe-failed',
  'invalid-png', 'metadata-mismatch', 'helper-start-failed', 'helper-start-timeout',
  'helper-protocol-invalid', 'helper-failed', 'gesture-required', 'cancelled', 'disposed', 'busy',
]);

const defaultScheduler: NativeCaptureScheduler = {
  set: (callback, delay) => ({ timer: setTimeout(callback, delay) }),
  clear: handle => clearTimeout(handle.timer),
};

const defaultSpawner: NativeCaptureSpawner = (command, args, options) => spawn(command, args, options);

/** 将运行时限制到实际随包分发的 helper；Windows 暂仅支持 x64。 */
export function nativeCaptureTarget(platform: string, arch: string): NativeCaptureTarget | undefined {
  if (platform === 'darwin') return { relativePath: './native/window-capture', windowsHide: false };
  if (platform === 'win32' && arch === 'x64') {
    return { relativePath: './native/windows/window-capture-x64.exe', windowsHide: true };
  }
  return undefined;
}

/** 以 Bundle 入口 URL 为锚点解析归档内 helper，不依赖工作目录。 */
export function resolveNativeCaptureHelperPath(
  platform: string,
  arch: string,
  bundleUrl: string | URL = import.meta.url,
): string | undefined {
  const target = nativeCaptureTarget(platform, arch);
  return target ? fileURLToPath(new URL(target.relativePath, bundleUrl)) : undefined;
}

/** macOS 延续旧注册行为；Windows 仅当 x64 helper 确实在包内时暴露 provider。 */
export function shouldRegisterNativeCaptureProvider(
  platform: string,
  arch: string,
  isPackagedFile: (path: string) => boolean,
  bundleUrl: string | URL = import.meta.url,
): boolean {
  if (platform === 'darwin') return true;
  if (platform !== 'win32' || arch !== 'x64') return false;
  const helperPath = resolveNativeCaptureHelperPath(platform, arch, bundleUrl);
  if (!helperPath) return false;
  try { return isPackagedFile(helperPath); } catch { return false; }
}

/** 从经过最小头部验证的 PNG 读取尺寸；完整封套与 CRC 在交付前另行校验。 */
export function readPngSize(png: Buffer): PngSize {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!Buffer.isBuffer(png) || png.length < 33 || !png.subarray(0, 8).equals(signature)
    || png.readUInt32BE(8) !== 13 || !png.subarray(12, 16).equals(Buffer.from('IHDR'))) {
    throw new CaptureFailure('invalid-png');
  }
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (!width || !height || width > MAX_PIXELS / height) throw new CaptureFailure('pixel-budget-exceeded');
  return { width, height };
}

// +--- ImageIO 负责编码；Host 验证完整封套/CRC，不另造通用像素解码器 ---+
function validatePngEnvelope(png: Buffer): PngSize {
  const size = readPngSize(png);
  const fail = (): never => { throw new CaptureFailure('invalid-png'); };
  const depths: Readonly<Record<number, readonly number[]>> = {
    0: [1, 2, 4, 8, 16],
    2: [8, 16],
    3: [1, 2, 4, 8],
    4: [8, 16],
    6: [8, 16],
  };
  if (!depths[png[25]]?.includes(png[24]!) || png[26] !== 0 || png[27] !== 0
    || ![0, 1].includes(png[28]!)) fail();

  let offset = 8;
  let count = 0;
  let palette = false;
  let seenData = false;
  let dataEnded = false;
  let dataBytes = 0;
  while (offset < png.length) {
    if (++count > MAX_PNG_CHUNKS || png.length - offset < 12) fail();
    const length = png.readUInt32BE(offset);
    const end = offset + length + 12;
    if (end > png.length) fail();
    const typeBytes = png.subarray(offset + 4, offset + 8);
    if (!typeBytes.every(byte => (byte >= 65 && byte <= 90) || (byte >= 97 && byte <= 122))
      || (typeBytes[2]! & 32) !== 0
      || crc32(png.subarray(offset + 4, end - 4)) !== png.readUInt32BE(end - 4)) fail();

    const type = typeBytes.toString('ascii');
    if (count === 1) {
      if (type !== 'IHDR' || length !== 13) fail();
    } else if (type === 'IHDR') fail();
    else if (type === 'PLTE') {
      if (palette || seenData || length < 3 || length > 768 || length % 3) fail();
      palette = true;
    } else if (type === 'IDAT') {
      if (dataEnded) fail();
      seenData = true;
      dataBytes += length;
    } else if (type === 'IEND') {
      if (length || !seenData || !dataBytes || end !== png.length || (png[25] === 3 && !palette)) fail();
      return size;
    } else {
      if (seenData) dataEnded = true;
      if (/^[A-Z]/.test(type) || ['acTL', 'fcTL', 'fdAT'].includes(type)) fail();
    }
    offset = end;
  }
  return fail();
}

/** 仅显式 capture 请求启动 helper；构造和 Host mount 不接触权限或像素。 */
export function runNativeCapture(options: RunNativeCaptureOptions = {}): Promise<NativeCaptureResult> {
  const { signal, requestPermission, onPhase } = options;
  if (signal?.aborted) return Promise.reject(new CaptureFailure('cancelled'));
  if (requestPermission !== true) return Promise.reject(new CaptureFailure('gesture-required'));

  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const target = nativeCaptureTarget(platform, arch);
  if (!target) return Promise.reject(new CaptureFailure('api-unavailable'));
  const helperPath = options.helperPath ?? resolveNativeCaptureHelperPath(platform, arch);
  if (!helperPath) return Promise.reject(new CaptureFailure('api-unavailable'));
  const spawnProcess = options.spawnProcess ?? defaultSpawner;
  const scheduler = options.scheduler ?? defaultScheduler;
  return new Promise<NativeCaptureResult>((resolve, reject) => {
    let child: NativeCaptureChild;
    try {
      child = spawnProcess(helperPath, [
        '--capture', String(process.pid), String(process.ppid), '--request-permission',
      ], { stdio: ['ignore', 'pipe', 'pipe'], shell: false, ...(target.windowsHide ? { windowsHide: true } : {}) });
    } catch {
      reject(new CaptureFailure('helper-start-failed'));
      return;
    }

    let chunks: Buffer[] = [];
    let bytes = 0;
    let diagnosticLine = '';
    let droppingLine = false;
    let phase: CapturePhase | undefined;
    let metadata: HelperMetadata | undefined;
    let failure: CaptureFailure | undefined;
    let settled = false;
    let timer: NativeCaptureTimerHandle | undefined;
    let forceTimer: NativeCaptureTimerHandle | undefined;

    const clearBudget = (): void => {
      if (timer !== undefined) scheduler.clear(timer);
      timer = undefined;
    };
    const killOwned = (kind: NodeJS.Signals): void => {
      try { child.kill(kind); } catch { /* 等真实 close，不假装已关闭。 */ }
    };
    const fail = (code: NativeCaptureFailureCode): void => {
      if (failure || settled) return;
      failure = new CaptureFailure(code);
      chunks = [];
      clearBudget();
      killOwned('SIGTERM');
      forceTimer = scheduler.set(() => {
        if (!settled) killOwned('SIGKILL');
      }, FORCE_TIMEOUT);
    };
    const startBudget = (delay: number, code: NativeCaptureFailureCode): void => {
      clearBudget();
      timer = scheduler.set(() => fail(code), delay);
    };
    const abort = (): void => fail('cancelled');
    const receivePhase = (value: CapturePhase): void => {
      if (value === 'authorization-required' && phase === undefined) {
        phase = value;
        clearBudget();
      } else if (value === 'capture-ready' && phase !== 'capture-ready') {
        phase = value;
        startBudget(CAPTURE_TIMEOUT, 'capture-timeout');
      } else {
        fail('helper-protocol-invalid');
        return;
      }
      try { onPhase?.(value); } catch { fail('helper-protocol-invalid'); }
    };
    const receiveLine = (line: string): void => {
      if (failure) return;
      if (line === 'phase=authorization-required' || line === 'phase=capture-ready') {
        receivePhase(line.slice(6) as CapturePhase);
        return;
      }

      let value: unknown;
      try { value = JSON.parse(line) as unknown; } catch { return; }
      if (!isRecord(value)) return;
      if (value.status === 'captured') {
        if (metadata || phase !== 'capture-ready') {
          fail('helper-protocol-invalid');
          return;
        }
        metadata = {
          status: 'captured',
          width: value.width,
          height: value.height,
          pointPixelScale: value.pointPixelScale,
          pngBytes: value.pngBytes,
          viewport: value.viewport,
        };
      } else if (isNativeCaptureFailureCode(value.status)) {
        metadata = { status: value.status };
      }
      // 未知文本/字段绝不进入错误、日志、回执或配置。
    };
    const stdout = (chunk: Buffer): void => {
      if (failure || settled) return;
      // stdout/stderr 跨管道无序：有界暂存，close 后再确认阶段和结果，绝不提前交付。
      bytes += chunk.length;
      if (bytes > MAX_BYTES) {
        fail('byte-budget-exceeded');
        return;
      }
      chunks.push(chunk);
    };
    const stderr = (chunk: Buffer): void => {
      if (failure || settled) return;
      for (const char of chunk.toString()) {
        if (char === '\n') {
          if (!droppingLine) receiveLine(diagnosticLine.trim());
          diagnosticLine = '';
          droppingLine = false;
        } else if (!droppingLine) {
          if (diagnosticLine.length >= MAX_DIAGNOSTIC_LINE) {
            diagnosticLine = '';
            droppingLine = true;
          } else {
            diagnosticLine += char;
          }
        }
      }
    };
    const error = (): void => fail('helper-start-failed');
    const close = (code: number | null): void => {
      if (settled) return;
      if (diagnosticLine && !droppingLine) receiveLine(diagnosticLine.trim());
      settled = true;
      clearBudget();
      if (forceTimer !== undefined) scheduler.clear(forceTimer);
      signal?.removeEventListener('abort', abort);
      child.stdout.off('data', stdout);
      child.stderr.off('data', stderr);
      child.off('error', error);
      child.off('close', close);
      diagnosticLine = '';

      try {
        if (failure) throw failure;
        if (code !== 0) {
          const helperFailure = metadata?.status !== 'captured' ? metadata?.status : undefined;
          throw new CaptureFailure(helperFailure ?? 'helper-failed');
        }
        if (phase !== 'capture-ready') throw new CaptureFailure('helper-protocol-invalid');
        const png = Buffer.concat(chunks, bytes);
        const size = validatePngEnvelope(png);
        if (metadata?.status !== 'captured'
          || metadata.width !== size.width
          || metadata.height !== size.height
          || metadata.pngBytes !== bytes
          || typeof metadata.pointPixelScale !== 'number'
          || !Number.isFinite(metadata.pointPixelScale)
          || metadata.pointPixelScale <= 0) {
          throw new CaptureFailure('metadata-mismatch');
        }
        const viewport = nativeViewport(metadata.viewport, size);
        const result: NativeCaptureResult = {
          png,
          ...size,
          scope: 'owned-window',
          pointPixelScale: metadata.pointPixelScale,
          ...(viewport ? { viewport } : {}),
        };
        resolve(result);
      } catch (problem: unknown) {
        reject(problem);
      } finally {
        chunks = [];
      }
    };

    child.stdout.on('data', stdout);
    child.stderr.on('data', stderr);
    child.on('error', error);
    child.on('close', close);
    startBudget(START_TIMEOUT, 'helper-start-timeout');
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
  });
}

// +--- 取消不提前解锁：即使晚到 PNG，也只在进程真正 close 后允许下一次点击 ---+
export function createClickCapture({ runner = runNativeCapture }: CreateClickCaptureOptions = {}): ClickCaptureController {
  let disposed = false;
  let flight: ActiveCapture | undefined;
  return {
    async capture(signal?: AbortSignal): Promise<NativeCaptureResult> {
      if (disposed) throw new CaptureFailure('disposed');
      if (signal?.aborted) throw new CaptureFailure('cancelled');
      if (flight) throw new CaptureFailure('busy');

      const aborter = new AbortController();
      let finish!: () => void;
      const done = new Promise<void>(resolve => { finish = resolve; });
      const current: ActiveCapture = { aborter, done };
      flight = current;
      const abort = (): void => aborter.abort();
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) abort();

      try {
        await Promise.resolve();
        if (aborter.signal.aborted) throw new CaptureFailure('cancelled');
        const image = await runner({ signal: aborter.signal, requestPermission: true });
        if (aborter.signal.aborted || disposed) throw new CaptureFailure('cancelled');
        return image;
      } catch (problem: unknown) {
        if (aborter.signal.aborted) throw new CaptureFailure('cancelled');
        const code = errorCode(problem);
        throw new CaptureFailure(code && FIXED_FAILURES.has(code) ? code : 'helper-failed');
      } finally {
        signal?.removeEventListener('abort', abort);
        if (flight === current) flight = undefined;
        finish();
      }
    },
    dispose(): Promise<void> {
      disposed = true;
      flight?.aborter.abort();
      return flight?.done ?? Promise.resolve();
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nativeViewport(value: unknown, source: PngSize): NativeCaptureViewport | undefined {
  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) return undefined;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 4 || keys.some(key => !['x', 'y', 'width', 'height'].includes(String(key)))) return undefined;
  if (keys.some(key => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return !descriptor?.enumerable || !('value' in descriptor);
  })) return undefined;
  const { x, y, width, height } = value;
  if (!Number.isSafeInteger(x) || (x as number) < 0
    || !Number.isSafeInteger(y) || (y as number) < 0
    || !Number.isSafeInteger(width) || (width as number) <= 0
    || !Number.isSafeInteger(height) || (height as number) <= 0
    || (x as number) > source.width || (width as number) > source.width - (x as number)
    || (y as number) > source.height || (height as number) > source.height - (y as number)) return undefined;
  return { x: x as number, y: y as number, width: width as number, height: height as number };
}

export function isNativeCaptureFailureCode(value: unknown): value is NativeCaptureFailureCode {
  return typeof value === 'string' && FIXED_FAILURES.has(value as NativeCaptureFailureCode);
}

function errorCode(value: unknown): NativeCaptureFailureCode | undefined {
  if (!isRecord(value)) return undefined;
  return isNativeCaptureFailureCode(value.code) ? value.code : undefined;
}
