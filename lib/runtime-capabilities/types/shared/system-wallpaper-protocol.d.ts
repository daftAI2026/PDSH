/**
 * [INPUT]: 依赖 Host 从 Apple 元数据选出的四项活动目录、历史缓存 ID 和同一官方 Remote 的有界传输。
 * [OUTPUT]: 提供材料 ID 语法、四项目录预算及请求/帧 DTO；语法不是来源授权，Host 必须再核对当前目录，不接收路径/URL。
 * [POS]: shared 的壁纸能力合同；不接受路径或 URL，不改变已有 capture/save 协议。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
/** 仅用于旧缓存/偏好身份兼容；活动目录由 Host 的 Apple 元数据选择器决定。 */
export declare const SYSTEM_WALLPAPER_IDS: readonly ["system-wallpaper-golden-gate", "system-wallpaper-golden-gate-sunset", "system-wallpaper-tahoe", "system-wallpaper-tahoe-day"];
export type LegacySystemWallpaperId = typeof SYSTEM_WALLPAPER_IDS[number];
export type SystemWallpaperId = LegacySystemWallpaperId | `system-wallpaper-video-${string}` | `system-wallpaper-image-${string}`;
/** 远端电影 length 仅用于 Range 地址；实际下载与原生本地文件是独立预算，Remote 只传 JPEG。 */
export declare const WALLPAPER_LIMITS: {
    readonly maxCatalogEntries: 4;
    readonly maxBytes: number;
    readonly maxDimension: 2600;
    readonly chunkBytes: number;
    readonly maxChunks: 256;
    readonly maxSourceImageBytes: number;
    readonly maxVideoBytes: number;
    readonly maxVideoSourceLength: number;
    readonly videoHeaderBytes: 64;
    readonly maxVideoMetadataBytes: number;
    readonly maxVideoSampleBytes: number;
    readonly maxVideoDownloadBytes: number;
    readonly maxCatalogBytes: number;
    readonly helperStartMs: 5000;
    readonly helperMs: 20000;
    readonly downloadMs: 90000;
};
export declare const WALLPAPER_STATUSES: readonly ["listed", "loaded", "cancelled", "unsupported-platform", "not-enabled", "invalid-request", "unavailable", "download-failed", "download-certificate-failed", "decode-failed", "busy", "disposed", "protocol-invalid", "byte-budget-exceeded", "helper-failed"];
export type WallpaperStatus = typeof WALLPAPER_STATUSES[number];
export declare function isSystemWallpaperId(value: unknown): value is SystemWallpaperId;
export declare function isSystemWallpaperName(value: unknown): value is string;
export declare function isWallpaperStatus(value: unknown): value is WallpaperStatus;
export type WallpaperRequest = {
    kind: 'list';
} | {
    kind: 'load';
    id: string;
};
export interface WallpaperCatalogEntry {
    id: string;
    name: string;
    available: boolean;
    downloadable: boolean;
}
export type WallpaperFrame = {
    type: 'catalog';
    entries: WallpaperCatalogEntry[];
} | {
    type: 'phase';
    phase: 'downloading' | 'decoding';
} | {
    type: 'image';
    id: string;
    sourceType: 'image' | 'video';
    width: number;
    height: number;
    jpegBytes: number;
    chunkCount: number;
} | {
    type: 'chunk';
    index: number;
    base64: string;
} | {
    type: 'terminal';
    status: WallpaperStatus;
};
