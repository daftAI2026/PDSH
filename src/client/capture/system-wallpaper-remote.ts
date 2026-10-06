/**
 * [INPUT]: 依赖同一官方 Host Remote、shared 壁纸 ID 语法/目录预算与浏览器 JPEG 解码能力。
 * [OUTPUT]: 提供当前Host目录顺序内 available/downloadable 项与显式单张 JPEG 流；验证有界语义名称、固定失败码、预算、分块顺序及实际像素尺寸。
 * [POS]: capture 的 Host→Client 壁纸信任边界；活动目录而非历史ID表授权加载，不接受路径/URL，临时 Blob URL 解码后立即撤销。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { RemoteStreamHandle } from '@deepseek-ai/dsh-typert-protocol';
import {
  isSystemWallpaperId as isSharedSystemWallpaperId,
  isSystemWallpaperName,
  isWallpaperStatus,
  WALLPAPER_LIMITS,
  type SystemWallpaperId,
  type WallpaperFrame,
  type WallpaperRequest,
  type WallpaperStatus,
} from '../../shared/system-wallpaper-protocol.ts';
import type { SystemWallpaperAdapter, SystemWallpaperEntry } from './system-wallpapers.ts';
import { captureWindowCopy } from './copy.ts';

export type SystemWallpaperRemote = {
  wallpaper: (request: WallpaperRequest, signal?: AbortSignal) => RemoteStreamHandle<WallpaperFrame, never>;
};

export type SystemWallpaperClientErrorCode = Exclude<WallpaperStatus, 'listed' | 'loaded'> | 'stream-failed';

/** 仅固定失败码可进入状态/提示；成功码和异常正文不是失败诊断。 */
export function isSystemWallpaperClientErrorCode(value: unknown): value is SystemWallpaperClientErrorCode {
  return value === 'stream-failed' || isWallpaperStatus(value) && value !== 'listed' && value !== 'loaded';
}

export class SystemWallpaperClientError extends Error {
  readonly code: SystemWallpaperClientErrorCode;

  constructor(code: SystemWallpaperClientErrorCode) {
    super(code);
    this.name = 'SystemWallpaperClientError';
    this.code = code;
  }
}

export type SystemWallpaperRemoteAdapterOptions = {
  beforeRequest?: (signal?: AbortSignal) => Promise<void>;
  locale?: () => string;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  decode?: (
    url: string,
    expected: { width: number; height: number },
    signal?: AbortSignal,
  ) => Promise<{ width: number; height: number }>;
};

type WallpaperRemoteFrameHandle = RemoteStreamHandle<WallpaperFrame, never>;
type WallpaperImageMetadata = Extract<WallpaperFrame, { type: 'image' }>;
type WallpaperCatalogFrame = Extract<WallpaperFrame, { type: 'catalog' }>;
type WallpaperSourceType = Extract<WallpaperFrame, { type: 'image' }>['sourceType'];

/** 创建纯内存适配器；list 仅列目录，只有 load 会请求 JPEG 媒体。 */
export function createSystemWallpaperRemoteAdapter(
  remote: SystemWallpaperRemote,
  options: SystemWallpaperRemoteAdapterOptions = {},
): SystemWallpaperAdapter {
  const knownCatalog = new Map<SystemWallpaperId, Pick<SystemWallpaperEntry, 'available' | 'downloadable'>>();
  const loadedSourceTypes = new Map<SystemWallpaperId, WallpaperSourceType>();
  let listOperation: Promise<SystemWallpaperEntry[]> | undefined;

  function localName(id: string): string | undefined {
    return captureWindowCopy(options.locale?.() ?? 'en').systemWallpaperNames[id as SystemWallpaperId];
  }

  function list(signal?: AbortSignal): Promise<SystemWallpaperEntry[]> {
    if (listOperation) return listOperation;
    knownCatalog.clear();
    const pending = consumeCatalog(remote, signal, options.beforeRequest).then((catalog) => {
      const validated = new Map<SystemWallpaperId, Pick<SystemWallpaperEntry, 'available' | 'downloadable' | 'name'>>();
      for (const entry of catalog.entries) {
        if (!entry || typeof entry !== 'object' || !isSystemWallpaperName(entry.name)) {
          throw new SystemWallpaperClientError('protocol-invalid');
        }
        if (!isSystemWallpaperId(entry.id) || validated.has(entry.id) ||
            typeof entry.available !== 'boolean' || typeof entry.downloadable !== 'boolean') {
          throw new SystemWallpaperClientError('protocol-invalid');
        }
        validated.set(entry.id, { name: entry.name, available: entry.available, downloadable: entry.downloadable });
      }

      // +--- Legacy copy 保持本地权威；动态条目使用已验证的 Host 语义名称。 ---+
      const entries: SystemWallpaperEntry[] = [];
      for (const [id, eligibility] of validated) {
        if (!eligibility.available && !eligibility.downloadable) continue;
        const name = localName(id) ?? eligibility.name;
        knownCatalog.set(id, { available: eligibility.available, downloadable: eligibility.downloadable });
        entries.push({
          id,
          name,
          thumbnail: '',
          available: eligibility.available,
          downloadable: eligibility.downloadable,
        });
      }
      return entries;
    }).catch((error: unknown) => {
      knownCatalog.clear();
      throw sanitizeWallpaperError(error, signal);
    }).finally(() => {
      if (listOperation === pending) listOperation = undefined;
    });
    listOperation = pending;
    return pending;
  }

  async function load(id: string, signal?: AbortSignal): Promise<string> {
    if (!isSystemWallpaperId(id)) throw new SystemWallpaperClientError('protocol-invalid');
    const entry = knownCatalog.get(id);
    if (!entry || (!entry.available && !entry.downloadable)) {
      throw new SystemWallpaperClientError('unavailable');
    }
    const payload = await consumeJpeg(remote, id, signal, options.beforeRequest);
    if (signal?.aborted) throw new SystemWallpaperClientError('cancelled');
    if (!hasJpegEnvelope(payload.bytes)) throw new SystemWallpaperClientError('decode-failed');
    const blobBytes = new Uint8Array(payload.bytes.byteLength);
    blobBytes.set(payload.bytes);
    const blob = new Blob([blobBytes.buffer], { type: 'image/jpeg' });
    const create = options.createObjectURL ?? ((value: Blob) => URL.createObjectURL(value));
    const revoke = options.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url));
    let url: string | undefined;
    try {
      url = create(blob);
      const dimensions = await awaitDecode(
        options.decode ?? decodeBrowserImage,
        url,
        { width: payload.width, height: payload.height },
        signal,
      );
      if (signal?.aborted) throw new SystemWallpaperClientError('cancelled');
      if (dimensions.width !== payload.width || dimensions.height !== payload.height) {
        throw new SystemWallpaperClientError('decode-failed');
      }
      const dataUrl = `data:image/jpeg;base64,${encodeBase64(payload.bytes)}`;
      loadedSourceTypes.set(id, payload.sourceType);
      return dataUrl;
    } catch (error) {
      throw sanitizeWallpaperError(error, signal);
    } finally {
      if (url !== undefined) {
        try { revoke(url); } catch { /* 临时 URL 归还不得覆盖主要结果。 */ }
      }
    }
  }

  return { list, load, getSourceType: id => isSystemWallpaperId(id) ? loadedSourceTypes.get(id) : undefined };
}

async function consumeCatalog(
  remote: SystemWallpaperRemote,
  signal?: AbortSignal,
  beforeRequest?: SystemWallpaperRemoteAdapterOptions['beforeRequest'],
): Promise<WallpaperCatalogFrame> {
  let catalog: WallpaperCatalogFrame | undefined;
  let terminal = false;
  return consumeOnce(remote, { kind: 'list' }, signal, beforeRequest, (frame) => {
    if (terminal) throw new SystemWallpaperClientError('protocol-invalid');
    if (frame.type === 'catalog') {
      if (catalog) throw new SystemWallpaperClientError('protocol-invalid');
      if (!Array.isArray(frame.entries) || frame.entries.length > WALLPAPER_LIMITS.maxCatalogEntries) {
        throw new SystemWallpaperClientError('protocol-invalid');
      }
      catalog = frame;
      return;
    }
    if (frame.type === 'terminal') {
      terminal = true;
      if (!catalog || frame.status !== 'listed') throw terminalError(frame.status);
      return;
    }
    throw new SystemWallpaperClientError('protocol-invalid');
  }, () => {
    if (!catalog || !terminal) throw new SystemWallpaperClientError('protocol-invalid');
    return catalog;
  });
}

async function consumeJpeg(
  remote: SystemWallpaperRemote,
  id: SystemWallpaperId,
  signal?: AbortSignal,
  beforeRequest?: SystemWallpaperRemoteAdapterOptions['beforeRequest'],
): Promise<{ bytes: Uint8Array; width: number; height: number; sourceType: WallpaperSourceType }> {
  let metadata: WallpaperImageMetadata | undefined;
  let bytes: Uint8Array | undefined;
  let received = 0;
  let phase = -1;
  let terminal = false;
  let nextChunk = 0;

  return consumeOnce(remote, { kind: 'load', id }, signal, beforeRequest, (frame) => {
    if (terminal) throw new SystemWallpaperClientError('protocol-invalid');
    if (frame.type === 'phase') {
      if (metadata || (frame.phase !== 'downloading' && frame.phase !== 'decoding')) {
        throw new SystemWallpaperClientError('protocol-invalid');
      }
      const nextPhase = frame.phase === 'downloading' ? 0 : 1;
      if (nextPhase <= phase) throw new SystemWallpaperClientError('protocol-invalid');
      phase = nextPhase;
      return;
    }
    if (frame.type === 'image') {
      if (metadata || !validImageMetadata(frame, id)) throw new SystemWallpaperClientError('protocol-invalid');
      metadata = frame;
      bytes = new Uint8Array(frame.jpegBytes);
      return;
    }
    if (frame.type === 'chunk') {
      if (!metadata || !bytes || nextChunk >= metadata.chunkCount || frame.index !== nextChunk) {
        throw new SystemWallpaperClientError('protocol-invalid');
      }
      const expectedSize = Math.min(WALLPAPER_LIMITS.chunkBytes, metadata.jpegBytes - received);
      const chunk = decodeBase64Chunk(frame.base64, expectedSize);
      bytes.set(chunk, received);
      received += chunk.length;
      nextChunk++;
      return;
    }
    if (frame.type === 'terminal') {
      terminal = true;
      if (frame.status !== 'loaded') throw terminalError(frame.status);
      if (!metadata || !bytes || nextChunk !== metadata.chunkCount || received !== metadata.jpegBytes) {
        throw new SystemWallpaperClientError('protocol-invalid');
      }
      return;
    }
    throw new SystemWallpaperClientError('protocol-invalid');
  }, () => {
    if (!terminal || !metadata || !bytes || received !== metadata.jpegBytes || !hasJpegEnvelope(bytes)) {
      throw new SystemWallpaperClientError('protocol-invalid');
    }
    return { bytes, width: metadata.width, height: metadata.height, sourceType: metadata.sourceType };
  });
}

async function consumeOnce<T>(
  remote: SystemWallpaperRemote,
  request: WallpaperRequest,
  signal: AbortSignal | undefined,
  beforeRequest: SystemWallpaperRemoteAdapterOptions['beforeRequest'],
  accept: (frame: WallpaperFrame) => void,
  finish: () => T,
): Promise<T> {
  if (signal?.aborted) throw new SystemWallpaperClientError('cancelled');
  let handle: WallpaperRemoteFrameHandle | undefined;
  let failure: SystemWallpaperClientError | undefined;
  try {
    await beforeRequest?.(signal);
    if (signal?.aborted) throw new SystemWallpaperClientError('cancelled');
    handle = remote.wallpaper(request, signal);
    for await (const frame of handle) {
      if (signal?.aborted) throw new SystemWallpaperClientError('cancelled');
      if (!frame || typeof frame !== 'object' || typeof frame.type !== 'string') {
        throw new SystemWallpaperClientError('protocol-invalid');
      }
      accept(frame);
    }
    if (signal?.aborted) throw new SystemWallpaperClientError('cancelled');
    return finish();
  } catch (error) {
    failure = sanitizeWallpaperError(error, signal);
    throw failure;
  } finally {
    if (handle) {
      try { await handle.dispose(); } catch {
        if (!failure) throw new SystemWallpaperClientError('stream-failed');
      }
    }
  }
}

function validImageMetadata(frame: WallpaperImageMetadata, id: SystemWallpaperId): boolean {
  return frame.id === id && (frame.sourceType === 'image' || frame.sourceType === 'video') &&
    Number.isSafeInteger(frame.width) && frame.width > 0 && frame.width <= WALLPAPER_LIMITS.maxDimension &&
    Number.isSafeInteger(frame.height) && frame.height > 0 && frame.height <= WALLPAPER_LIMITS.maxDimension &&
    Number.isSafeInteger(frame.jpegBytes) && frame.jpegBytes >= 4 && frame.jpegBytes <= WALLPAPER_LIMITS.maxBytes &&
    Number.isSafeInteger(frame.chunkCount) && frame.chunkCount > 0 &&
    frame.chunkCount === Math.ceil(frame.jpegBytes / WALLPAPER_LIMITS.chunkBytes);
}

function decodeBase64Chunk(value: string, expectedBytes: number): Uint8Array {
  const expectedChars = 4 * Math.ceil(expectedBytes / 3);
  if (typeof value !== 'string' || value.length !== expectedChars ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    throw new SystemWallpaperClientError('protocol-invalid');
  }
  let binary: string;
  try { binary = atob(value); } catch { throw new SystemWallpaperClientError('protocol-invalid'); }
  if (binary.length !== expectedBytes || encodeBase64(Uint8Array.from(binary, character => character.charCodeAt(0))) !== value) {
    throw new SystemWallpaperClientError('protocol-invalid');
  }
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function encodeBase64(bytes: Uint8Array): string {
  let result = '';
  const blockBytes = 0x6000;
  for (let offset = 0; offset < bytes.length; offset += blockBytes) {
    const block = bytes.subarray(offset, Math.min(bytes.length, offset + blockBytes));
    let binary = '';
    for (let index = 0; index < block.length; index++) binary += String.fromCharCode(block[index]);
    result += btoa(binary);
  }
  return result;
}

function hasJpegEnvelope(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 &&
    bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
}

async function awaitDecode(
  decode: NonNullable<SystemWallpaperRemoteAdapterOptions['decode']>,
  url: string,
  expected: { width: number; height: number },
  signal?: AbortSignal,
): Promise<{ width: number; height: number }> {
  if (signal?.aborted) throw new SystemWallpaperClientError('cancelled');
  if (!signal) return decode(url, expected);
  let abort: (() => void) | undefined;
  const cancelled = new Promise<never>((_, reject) => {
    abort = () => reject(new SystemWallpaperClientError('cancelled'));
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    const dimensions = await Promise.race([decode(url, expected, signal), cancelled]);
    if (signal.aborted) throw new SystemWallpaperClientError('cancelled');
    return dimensions;
  } finally {
    if (abort) signal.removeEventListener('abort', abort);
  }
}

async function decodeBrowserImage(
  url: string,
  _expected: { width: number; height: number },
  signal?: AbortSignal,
): Promise<{ width: number; height: number }> {
  const image = new Image();
  const clear = () => { image.src = ''; };
  signal?.addEventListener('abort', clear, { once: true });
  try {
    image.src = url;
    await image.decode();
    if (signal?.aborted) throw new SystemWallpaperClientError('cancelled');
    return { width: image.naturalWidth, height: image.naturalHeight };
  } catch (error) {
    throw sanitizeWallpaperError(error, signal, 'decode-failed');
  } finally {
    signal?.removeEventListener('abort', clear);
    clear();
  }
}

function isSystemWallpaperId(value: unknown): value is SystemWallpaperId {
  return isSharedSystemWallpaperId(value);
}

function terminalError(status: WallpaperStatus): SystemWallpaperClientError {
  return new SystemWallpaperClientError(isSystemWallpaperClientErrorCode(status) ? status : 'protocol-invalid');
}

function sanitizeWallpaperError(
  error: unknown,
  signal?: AbortSignal,
  fallback: SystemWallpaperClientErrorCode = 'stream-failed',
): SystemWallpaperClientError {
  if (signal?.aborted) return new SystemWallpaperClientError('cancelled');
  if (error instanceof SystemWallpaperClientError) return error;
  return new SystemWallpaperClientError(fallback);
}
