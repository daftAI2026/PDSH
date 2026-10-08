/**
 * [INPUT]: 依赖 Host 的平台活动目录、历史缓存 ID 和同一官方 Remote 的有界传输。
 * [OUTPUT]: 提供材料 ID 语法、四项目录预算及请求/帧 DTO；语法不是来源授权，Host 必须再核对当前目录，不接收路径/URL。
 * [POS]: shared 的壁纸能力合同；不接受路径或 URL，不改变已有 capture/save 协议。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
/** 仅用于旧缓存/偏好身份兼容；活动目录由 Host 的平台来源授权决定。 */
export const SYSTEM_WALLPAPER_IDS = [
  'system-wallpaper-golden-gate',
  'system-wallpaper-golden-gate-sunset',
  'system-wallpaper-tahoe',
  'system-wallpaper-tahoe-day',
] as const;
export type LegacySystemWallpaperId = typeof SYSTEM_WALLPAPER_IDS[number];
export type SystemWallpaperId = LegacySystemWallpaperId
  | `system-wallpaper-video-${string}` | `system-wallpaper-image-${string}`;

/** 远端电影 length 仅用于 Range 地址；实际下载与原生本地文件是独立预算，Remote 只传 JPEG。 */
export const WALLPAPER_LIMITS = {
  maxCatalogEntries: 4,
  maxBytes: 8 * 1024 * 1024,
  maxDimension: 2600,
  chunkBytes: 32 * 1024,
  maxChunks: 256,
  maxSourceImageBytes: 64 * 1024 * 1024,
  maxVideoBytes: 256 * 1024 * 1024,
  maxVideoSourceLength: 1024 * 1024 * 1024,
  videoHeaderBytes: 64,
  maxVideoMetadataBytes: 2 * 1024 * 1024,
  maxVideoSampleBytes: 16 * 1024 * 1024,
  maxVideoDownloadBytes: 18 * 1024 * 1024 + 64,
  maxCatalogBytes: 16 * 1024,
  helperStartMs: 5000,
  helperMs: 20000,
  downloadMs: 90000,
} as const;

export const WALLPAPER_STATUSES = [
  'listed', 'loaded', 'cancelled', 'unsupported-platform', 'not-enabled', 'invalid-request',
  'unavailable', 'download-failed', 'download-certificate-failed', 'decode-failed', 'busy', 'disposed', 'protocol-invalid',
  'byte-budget-exceeded', 'helper-failed',
] as const;
export type WallpaperStatus = typeof WALLPAPER_STATUSES[number];

export function isSystemWallpaperId(value: unknown): value is SystemWallpaperId {
  return typeof value === 'string' && ((SYSTEM_WALLPAPER_IDS as readonly string[]).includes(value)
    || /^system-wallpaper-video-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(value)
    || /^system-wallpaper-image-[a-f0-9]{64}$/u.test(value));
}

export function isSystemWallpaperName(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 96 && !/\p{Cc}/u.test(value);
}

export function isWallpaperStatus(value: unknown): value is WallpaperStatus {
  return typeof value === 'string' && (WALLPAPER_STATUSES as readonly string[]).includes(value);
}

export type WallpaperRequest = { kind: 'list' } | { kind: 'load'; id: string };
export interface WallpaperCatalogEntry { id: string; name: string; available: boolean; downloadable: boolean }
export type WallpaperFrame =
  | { type: 'catalog'; entries: WallpaperCatalogEntry[] }
  | { type: 'phase'; phase: 'downloading' | 'decoding' }
  | { type: 'image'; id: string; sourceType: 'image' | 'video'; width: number; height: number; jpegBytes: number; chunkCount: number }
  | { type: 'chunk'; index: number; base64: string }
  | { type: 'terminal'; status: WallpaperStatus };
