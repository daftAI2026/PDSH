/**
 * [INPUT]: 依赖动态/旧系统材料身份、JPEG 预算与截图像素预算；只描述显式获取或主动导入的背景素材。
 * [OUTPUT]: 提供本地媒体记录、稳定/RC分域与36项容量硬界；身份语法不是Host来源授权，不保存原始文件名/路径。
 * [POS]: Client IndexedDB媒体仓与编辑器的共同契约；不属于Host Config或Remote，不自动保存拍摄源，也不保存路径或原文件名。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { CAPTURE_EXPORT_MAX_PIXELS } from './capture-export.ts';
import { WALLPAPER_LIMITS, isSystemWallpaperId } from './system-wallpaper-protocol.ts';

export const WALLPAPER_GALLERY_LIMITS = Object.freeze({
  maxBytes: 256 * 1024 * 1024,
  maxUserBytes: 32 * 1024 * 1024,
  maxUserPixels: CAPTURE_EXPORT_MAX_PIXELS,
  maxUserEntries: 32,
  maxEntries: WALLPAPER_LIMITS.maxCatalogEntries + 32,
  maxThumbnailChars: 64 * 1024,
});

export interface WallpaperGalleryAsset {
  readonly id: string;
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
  readonly sourceType: 'image' | 'video';
  readonly thumbnail: string;
  readonly createdAt: number;
}

export type WallpaperGalleryErrorCode = 'invalid-asset' | 'gallery-full' | 'storage-unavailable' | 'disposed';
export class WallpaperGalleryError extends Error {
  readonly code: WallpaperGalleryErrorCode;
  constructor(code: WallpaperGalleryErrorCode) {
    super(code);
    this.name = 'WallpaperGalleryError';
    this.code = code;
  }
}

export function wallpaperGalleryDatabaseName(rootId: string): string {
  if (rootId !== 'pdsh' && rootId !== 'pdsh-rc') throw new WallpaperGalleryError('invalid-asset');
  return `@daftai/${rootId}.wallpaper-gallery.v1`;
}

export function isUserWallpaperId(value: unknown): value is string {
  return typeof value === 'string' && /^user-wallpaper-[a-f0-9]{64}$/u.test(value);
}
export function isGalleryWallpaperId(value: unknown): value is string {
  return isSystemWallpaperId(value) || isUserWallpaperId(value);
}

/** 媒体由已解码的背景输入产生；仓库重读时仍复核元数据与容量，拒绝漂移记录。 */
export function isWallpaperGalleryAsset(value: unknown): value is WallpaperGalleryAsset {
  if (!value || typeof value !== 'object') return false;
  const asset = value as Record<string, unknown>;
  if (Object.keys(asset).sort().join(',') !== 'blob,createdAt,height,id,sourceType,thumbnail,width') return false;
  if (!isGalleryWallpaperId(asset.id) || !(asset.blob instanceof Blob) || asset.blob.size < 1
    || !Number.isSafeInteger(asset.width) || !Number.isSafeInteger(asset.height)
    || (asset.width as number) < 1 || (asset.height as number) < 1
    || typeof asset.createdAt !== 'number' || !Number.isFinite(asset.createdAt) || asset.createdAt < 0
    || typeof asset.thumbnail !== 'string' || asset.thumbnail.length > WALLPAPER_GALLERY_LIMITS.maxThumbnailChars
    || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/u.test(asset.thumbnail)
    || (asset.sourceType !== 'image' && asset.sourceType !== 'video')) return false;
  if (isSystemWallpaperId(asset.id)) {
    return asset.blob.type === 'image/jpeg' && asset.blob.size <= WALLPAPER_LIMITS.maxBytes
      && (asset.width as number) <= WALLPAPER_LIMITS.maxDimension && (asset.height as number) <= WALLPAPER_LIMITS.maxDimension;
  }
  return asset.sourceType === 'image' && ['image/jpeg', 'image/png', 'image/webp'].includes(asset.blob.type)
    && asset.blob.size <= WALLPAPER_GALLERY_LIMITS.maxUserBytes
    && (asset.width as number) * (asset.height as number) <= WALLPAPER_GALLERY_LIMITS.maxUserPixels;
}
