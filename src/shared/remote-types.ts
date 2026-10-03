/**
 * [INPUT]: 依赖 Host/Client 共用的 capture/save 协议与编辑器格式 union。
 * [OUTPUT]: 为官方 Typert 生成的 Remote 声明提供包公开 `./types` 类型边界。
 * [POS]: shared 协议类型门面；仅重导出 JSON DTO，不成为运行时依赖或第二个 bundle。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export type { CaptureFailureCode, CaptureFrame, CaptureImageFrame, CapturePhase, CapturePhaseFrame, CaptureChunkFrame, CaptureTerminalFrame } from './window-capture-protocol.ts'
export type { WindowSaveFailureCode, WindowSaveFrame, WindowSaveInputFrame, WindowSaveRequest } from './window-save-protocol.ts'
export type { CaptureSaveFormat } from './capture-export.ts'
