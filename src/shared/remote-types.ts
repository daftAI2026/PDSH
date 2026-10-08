/**
 * [INPUT]: 依赖 Host/Client 共用的 capture/save/壁纸协议、几何能力 DTO 与编辑器格式 union。
 * [OUTPUT]: 为官方 Typert 生成的基础及内部能力 Remote 提供包公开 `./types` 类型边界。
 * [POS]: shared 协议类型门面；仅重导出 JSON DTO，不成为运行时依赖或第二个 bundle。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export type { CaptureFailureCode, CaptureFrame, CaptureImageFrame, CapturePhase, CapturePhaseFrame, CaptureChunkFrame, CaptureTerminalFrame } from './window-capture-protocol.ts'
export type { CaptureGeometry, CaptureGeometrySource } from './capture-geometry.ts'
export type { WindowSaveFailureCode, WindowSaveFrame, WindowSaveInputFrame, WindowSaveRequest } from './window-save-protocol.ts'
export type { CaptureSaveFormat } from './capture-export.ts'
export type { WallpaperRequest, WallpaperFrame, WallpaperCatalogEntry, WallpaperStatus } from './system-wallpaper-protocol.ts'
