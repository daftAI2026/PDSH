/**
 * [INPUT]: 依赖 IndexedDB 媒体仓、材料身份/容量契约、可取消解码与 Host 当前系统目录 adapter。
 * [OUTPUT]: 提供显式获取系统静帧、纯本地系统/用户素材选择与恢复、静态图片导入/移除及连接释放；显式目录失败保真，选择缓存缺失不偷跑Host获取。
 * [POS]: capture-window 本地媒体语义层；用户原始图与显式获取的系统JPEG进入 IndexedDB，批获取成功以持久小缩略图证明；五个固定预设不是图库增长源，偏好只存 opaque ID。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  isGalleryWallpaperId,
  isUserWallpaperId,
  isWallpaperGalleryAsset,
  WallpaperGalleryError,
  WALLPAPER_GALLERY_LIMITS,
  type WallpaperGalleryAsset,
} from '../../shared/wallpaper-gallery.ts';
import { WALLPAPER_LIMITS, isSystemWallpaperId, type SystemWallpaperId } from '../../shared/system-wallpaper-protocol.ts';
import { captureWindowCopy } from './copy.ts';
import type { SystemWallpaperAdapter, SystemWallpaperEntry } from './system-wallpapers.ts';
import { loadCaptureImage } from './wallpaper.ts';

export type WallpaperGalleryStore = {
  close: () => void;
  get: (id: string) => Promise<WallpaperGalleryAsset | undefined>;
  list: () => Promise<WallpaperGalleryAsset[]>;
  put: (asset: WallpaperGalleryAsset) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export type DecodedWallpaper = { width: number; height: number; image?: CanvasImageSource };
type RasterHeader = { mediaType: 'image/png' | 'image/jpeg' | 'image/webp'; width: number; height: number };
export type WallpaperGallerySelection = { asset: WallpaperGalleryAsset; dataUrl: string };
export type WallpaperGallery = {
  close: () => void;
  import: (file: File, signal?: AbortSignal) => Promise<WallpaperGalleryAsset>;
  list: () => Promise<WallpaperGalleryAsset[]>;
  load: (id: string, signal?: AbortSignal) => Promise<WallpaperGallerySelection>;
  remove: (id: string) => Promise<void>;
  restore: (id: string, signal?: AbortSignal) => Promise<WallpaperGallerySelection | null>;
  systemAdapter?: SystemWallpaperAdapter;
};

export type WallpaperGalleryOptions = {
  createThumbnail?: (decoded: DecodedWallpaper, signal?: AbortSignal) => Promise<string>;
  crypto?: Pick<Crypto, 'subtle'>;
  decodeBlob?: (blob: Blob, signal?: AbortSignal) => Promise<DecodedWallpaper>;
  document?: Document;
  locale?: () => string;
  now?: () => number;
  store: WallpaperGalleryStore;
  systemAdapter?: SystemWallpaperAdapter;
};

export function createWallpaperGallery(options: WallpaperGalleryOptions): WallpaperGallery {
  const { store } = options;
  let disposed = false;
  let closeCalled = false;

  function ensureOpen(signal?: AbortSignal): void {
    if (disposed) throw new WallpaperGalleryError('disposed');
    if (signal?.aborted) throw abortError();
  }

  async function getValidAsset(id: string): Promise<WallpaperGalleryAsset | undefined> {
    if (!isGalleryWallpaperId(id)) throw new WallpaperGalleryError('invalid-asset');
    const asset = await store.get(id);
    if (disposed) throw new WallpaperGalleryError('disposed');
    if (asset === undefined) return undefined;
    if (!isWallpaperGalleryAsset(asset) || asset.id !== id) throw new WallpaperGalleryError('invalid-asset');
    return asset;
  }

  async function decode(
    blob: Blob,
    expected?: Pick<WallpaperGalleryAsset, 'width' | 'height'>,
    signal?: AbortSignal,
    limits: { maxDimension?: number; maxPixels?: number } = {},
    knownHeader?: RasterHeader,
    allowExifOrientationSwap = false,
  ): Promise<DecodedWallpaper> {
    ensureOpen(signal);
    const header = knownHeader ?? inspectStaticRaster(new Uint8Array(await blob.arrayBuffer()));
    ensureOpen(signal);
    if (!header || header.mediaType !== blob.type || header.width < 1 || header.height < 1 ||
        header.width * header.height > (limits.maxPixels ?? WALLPAPER_GALLERY_LIMITS.maxUserPixels) ||
        (limits.maxDimension !== undefined && (header.width > limits.maxDimension || header.height > limits.maxDimension)) ||
        (expected && !matchesDimensions(header, expected, allowExifOrientationSwap))) {
      throw new WallpaperGalleryError('invalid-asset');
    }
    const decoded = await (options.decodeBlob ?? decodeBrowserBlob)(blob, signal);
    ensureOpen(signal);
    if (!Number.isSafeInteger(decoded.width) || !Number.isSafeInteger(decoded.height) ||
        !matchesDimensions(header, decoded, allowExifOrientationSwap)) {
      throw new WallpaperGalleryError('invalid-asset');
    }
    return decoded;
  }

  async function thumbnail(decoded: DecodedWallpaper, signal?: AbortSignal): Promise<string> {
    ensureOpen(signal);
    const image = await (options.createThumbnail ?? ((value, abort) => createBrowserThumbnail(value, options.document, abort)))(decoded, signal);
    if (signal?.aborted) throw abortError();
    if (typeof image !== 'string' || image.length > WALLPAPER_GALLERY_LIMITS.maxThumbnailChars ||
        !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/u.test(image)) {
      throw new WallpaperGalleryError('invalid-asset');
    }
    return image;
  }

  async function selectionFromCached(asset: WallpaperGalleryAsset, signal?: AbortSignal): Promise<WallpaperGallerySelection> {
    const userImage = isUserWallpaperId(asset.id);
    await decode(asset.blob, asset, signal, isSystemWallpaperId(asset.id) ? systemImageLimits : undefined, undefined, userImage);
    const dataUrl = await blobToDataUrl(asset.blob, signal);
    ensureOpen(signal);
    return { asset, dataUrl };
  }

  async function saveSystemImage(id: string, dataUrl: string, sourceType: 'image' | 'video', signal?: AbortSignal): Promise<WallpaperGallerySelection> {
    ensureOpen(signal);
    const blob = jpegDataUrlToBlob(dataUrl);
    if (blob.size > WALLPAPER_LIMITS.maxBytes) throw new WallpaperGalleryError('invalid-asset');
    const decoded = await decode(blob, undefined, signal, systemImageLimits);
    const asset: WallpaperGalleryAsset = {
      id,
      blob,
      width: decoded.width,
      height: decoded.height,
      sourceType,
      thumbnail: await thumbnail(decoded, signal),
      createdAt: (options.now ?? Date.now)(),
    };
    if (!isWallpaperGalleryAsset(asset)) throw new WallpaperGalleryError('invalid-asset');
    ensureOpen(signal);
    await store.put(asset);
    ensureOpen(signal);
    return { asset, dataUrl };
  }

  async function cachedSelection(id: string, signal?: AbortSignal): Promise<WallpaperGallerySelection | undefined> {
    ensureOpen(signal);
    const cached = await getValidAsset(id);
    ensureOpen(signal);
    return cached ? selectionFromCached(cached, signal) : undefined;
  }

  async function load(id: string, signal?: AbortSignal): Promise<WallpaperGallerySelection> {
    const cached = await cachedSelection(id, signal);
    if (!cached) throw new WallpaperGalleryError('storage-unavailable');
    return cached;
  }

  async function acquireSystemImage(id: string, signal?: AbortSignal): Promise<WallpaperGallerySelection> {
    const cached = await cachedSelection(id, signal);
    if (cached) return cached;
    if (!isSystemWallpaperId(id) || !options.systemAdapter) throw new WallpaperGalleryError('storage-unavailable');
    const dataUrl = await options.systemAdapter.load(id, signal);
    ensureOpen(signal);
    const sourceType = options.systemAdapter.getSourceType?.(id) ?? 'image';
    if (sourceType !== 'image' && sourceType !== 'video') throw new WallpaperGalleryError('invalid-asset');
    return saveSystemImage(id, dataUrl, sourceType, signal);
  }

  async function list(): Promise<WallpaperGalleryAsset[]> {
    ensureOpen();
    const assets = await store.list();
    ensureOpen();
    if (!Array.isArray(assets) || assets.some(asset => !isWallpaperGalleryAsset(asset))) {
      throw new WallpaperGalleryError('invalid-asset');
    }
    return assets;
  }

  async function importFile(file: File, signal?: AbortSignal): Promise<WallpaperGalleryAsset> {
    ensureOpen(signal);
    if (!(file instanceof Blob) || file.size < 1 || file.size > WALLPAPER_GALLERY_LIMITS.maxUserBytes) {
      throw new WallpaperGalleryError('invalid-asset');
    }
    const bytes = await file.arrayBuffer();
    ensureOpen(signal);
    const header = inspectStaticRaster(new Uint8Array(bytes));
    if (!header || (file.type && file.type.toLowerCase() !== header.mediaType)) throw new WallpaperGalleryError('invalid-asset');
    const blob = new Blob([bytes], { type: header.mediaType });
    const decoded = await decode(blob, header, signal, undefined, header, true);
    const crypto = options.crypto ?? globalThis.crypto;
    if (!crypto?.subtle) throw new WallpaperGalleryError('storage-unavailable');
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    ensureOpen(signal);
    const id = `user-wallpaper-${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
    const existing = await getValidAsset(id);
    ensureOpen(signal);
    if (existing) return existing;
    const asset: WallpaperGalleryAsset = {
      id,
      blob,
      width: decoded.width,
      height: decoded.height,
      sourceType: 'image',
      thumbnail: await thumbnail(decoded, signal),
      createdAt: (options.now ?? Date.now)(),
    };
    if (!isWallpaperGalleryAsset(asset)) throw new WallpaperGalleryError('invalid-asset');
    ensureOpen(signal);
    await store.put(asset);
    ensureOpen(signal);
    return asset;
  }

  async function remove(id: string): Promise<void> {
    ensureOpen();
    if (!isUserWallpaperId(id)) throw new WallpaperGalleryError('invalid-asset');
    const asset = await getValidAsset(id);
    if (!asset) return;
    await store.remove(id);
    ensureOpen();
  }

  function close(): void {
    if (disposed) return;
    disposed = true;
    if (!closeCalled) {
      closeCalled = true;
      store.close();
    }
  }

  const systemAdapter = options.systemAdapter ? createCachedSystemAdapter(options.systemAdapter) : undefined;

  function createCachedSystemAdapter(adapter: SystemWallpaperAdapter): SystemWallpaperAdapter {
    const cachedSourceTypes = new Map<string, 'image' | 'video'>();
    return {
      list: async (signal, catalogOptions) => {
        ensureOpen(signal);
        const assets = await list();
        const cached = new Map(assets.filter(asset => isSystemWallpaperId(asset.id)).map(asset => [asset.id, asset]));
        let catalog: SystemWallpaperEntry[];
        try {
          catalog = await adapter.list(signal, catalogOptions);
        } catch (error) {
          ensureOpen(signal);
          // +--- 离线浏览保留缓存；显式补取不能把Host失败伪装成成功目录。 ---+
          if (catalogOptions?.requireSource || cached.size === 0) throw error;
          catalog = [];
        }
        ensureOpen(signal);
        const entries = new Map(catalog.map(entry => [entry.id, entry]));
        for (const [id, asset] of cached) {
          if (catalogOptions?.requireSource && !entries.has(id)) continue;
          cachedSourceTypes.set(id, asset.sourceType);
          const existing = entries.get(id);
          entries.set(id, {
            id,
            name: existing?.name ?? systemName(id),
            available: true,
            downloadable: false,
            sourceType: asset.sourceType,
            thumbnail: asset.thumbnail,
            loadStatus: 'ready',
          });
        }
        return [...entries.values()].filter(entry => isSystemWallpaperId(entry.id));
      },
      restore: async signal => {
        ensureOpen(signal);
        const assets = await list();
        ensureOpen(signal);
        const cached = new Map(assets.filter(asset => isSystemWallpaperId(asset.id)).map(asset => [asset.id, asset]));
        const entries: SystemWallpaperEntry[] = [];
        for (const [id, asset] of cached) {
          cachedSourceTypes.set(id, asset.sourceType);
          entries.push({
            id,
            name: systemName(id),
            available: true,
            downloadable: false,
            sourceType: asset.sourceType,
            thumbnail: asset.thumbnail,
            loadStatus: 'ready',
          });
        }
        return entries;
      },
      load: async (id, signal) => (await acquireSystemImage(id, signal)).dataUrl,
      getSourceType: id => {
        return cachedSourceTypes.get(id) ?? adapter.getSourceType?.(id);
      },
    };
  }

  function systemName(id: string): string {
    const copy = captureWindowCopy(options.locale?.() ?? 'en');
    return copy.systemWallpaperNames[id as SystemWallpaperId] ?? copy.systemImages;
  }

  return {
    close,
    import: importFile,
    list,
    load,
    remove,
    restore: async (id, signal) => {
      ensureOpen(signal);
      const asset = await getValidAsset(id);
      if (!asset) return null;
      return selectionFromCached(asset, signal);
    },
    systemAdapter,
  };
}

const systemImageLimits = {
  maxDimension: WALLPAPER_LIMITS.maxDimension,
  maxPixels: WALLPAPER_LIMITS.maxDimension * WALLPAPER_LIMITS.maxDimension,
};

function inspectStaticRaster(bytes: Uint8Array): RasterHeader | null {
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    let offset = 2;
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 0xff) { offset++; continue; }
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) return null;
      const length = (bytes[offset] << 8) | bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length) return null;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (length < 7) return null;
        return { mediaType: 'image/jpeg', height: (bytes[offset + 3] << 8) | bytes[offset + 4], width: (bytes[offset + 5] << 8) | bytes[offset + 6] };
      }
      offset += length;
    }
    return null;
  }
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && pngSignature.every((byte, index) => bytes[index] === byte)) {
    if (bytes.length < 33 || readUint32BE(bytes, 8) !== 13 || ascii(bytes, 12, 4) !== 'IHDR') return null;
    const width = readUint32BE(bytes, 16);
    const height = readUint32BE(bytes, 20);
    if (!width || !height) return null;
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const length = readUint32BE(bytes, offset);
      const type = ascii(bytes, offset + 4, 4);
      if (type === 'acTL') return null;
      if (length > bytes.length - offset - 12) return null;
      if (type === 'IDAT' || type === 'IEND') break;
      offset += 12 + length;
    }
    return { mediaType: 'image/png', width, height };
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    const riffLength = readUint32LE(bytes, 4);
    if (riffLength + 8 > bytes.length) return null;
    let dimensions: { width: number; height: number } | undefined;
    let offset = 12;
    while (offset + 8 <= Math.min(bytes.length, riffLength + 8)) {
      const length = readUint32LE(bytes, offset + 4);
      const type = ascii(bytes, offset, 4);
      if (type === 'ANIM' || type === 'ANMF') return null;
      const data = offset + 8;
      if (type === 'VP8X' && length >= 10) {
        if ((bytes[data] & 0x02) !== 0) return null;
        dimensions = { width: 1 + readUint24LE(bytes, data + 4), height: 1 + readUint24LE(bytes, data + 7) };
      } else if (type === 'VP8 ' && length >= 10 && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
        dimensions = { width: ((bytes[data + 7] & 0x3f) << 8) | bytes[data + 6], height: ((bytes[data + 9] & 0x3f) << 8) | bytes[data + 8] };
      } else if (type === 'VP8L' && length >= 5 && bytes[data] === 0x2f) {
        dimensions = {
          width: 1 + (((bytes[data + 2] & 0x3f) << 8) | bytes[data + 1]),
          height: 1 + (((bytes[data + 4] & 0x0f) << 10) | (bytes[data + 3] << 2) | ((bytes[data + 2] & 0xc0) >> 6)),
        };
      }
      if (length > bytes.length - offset - 8) return null;
      offset += 8 + length + (length & 1);
    }
    return dimensions ? { mediaType: 'image/webp', ...dimensions } : null;
  }
  return null;
}

async function decodeBrowserBlob(blob: Blob, signal?: AbortSignal): Promise<DecodedWallpaper> {
  if (signal?.aborted) throw abortError();
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadCaptureImage(url, signal);
    if (signal?.aborted) throw abortError();
    return { width: image.naturalWidth, height: image.naturalHeight, image };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function createBrowserThumbnail(decoded: DecodedWallpaper, doc = document, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw abortError();
  if (!decoded.image) throw new WallpaperGalleryError('invalid-asset');
  const maxDimension = 128;
  const scale = Math.min(1, maxDimension / Math.max(decoded.width, decoded.height));
  const canvas = doc.createElement('canvas');
  canvas.width = Math.max(1, Math.round(decoded.width * scale));
  canvas.height = Math.max(1, Math.round(decoded.height * scale));
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new WallpaperGalleryError('storage-unavailable');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(decoded.image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.72);
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

function jpegDataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/u.exec(dataUrl);
  if (!match) throw new WallpaperGalleryError('invalid-asset');
  const binary = atob(match[1]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes.buffer], { type: 'image/jpeg' });
}

async function blobToDataUrl(blob: Blob, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw abortError();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (signal?.aborted) throw abortError();
  let binary = '';
  const blockSize = 0x8000;
  for (let index = 0; index < bytes.length; index += blockSize) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + blockSize, bytes.length)));
  }
  return `data:${blob.type};base64,${btoa(binary)}`;
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] * 0x1000000) + ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])) >>> 0;
}

function matchesDimensions(
  encoded: Pick<WallpaperGalleryAsset, 'width' | 'height'>,
  actual: Pick<WallpaperGalleryAsset, 'width' | 'height'>,
  allowExifOrientationSwap: boolean,
): boolean {
  return (encoded.width === actual.width && encoded.height === actual.height) ||
    (allowExifOrientationSwap && encoded.width === actual.height && encoded.height === actual.width);
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  let value = '';
  for (let index = 0; index < length; index++) value += String.fromCharCode(bytes[offset + index]);
  return value;
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted', 'AbortError');
}
