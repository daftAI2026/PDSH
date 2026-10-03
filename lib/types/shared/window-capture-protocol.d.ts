/**
 * [INPUT]: 依赖 native helper 已校验的 owned-window PNG 元数据与 Host 固定阶段。
 * [OUTPUT]: 提供 Typert 生成器、Host 和 Client 共用的只读 capture 帧及硬预算。
 * [POS]: shared 跨进程协议；只含 JSON DTO，不携带 URL、窗口名、目录、像素源坐标或错误正文。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
/** 两端必须一致的取像硬上限；导出字节另由现存 capture-export 合同管辖。 */
export declare const CAPTURE_LIMITS: {
    readonly maxBytes: number;
    readonly pngChunkBytes: number;
    readonly maxChunks: 4096;
    readonly maxPixels: number;
};
/** 只公开稳定分类，不传播子进程 stderr、路径或内部异常。 */
export declare const CAPTURE_FAILURE_CODES: readonly ["permission-not-granted", "cancelled", "busy", "disposed", "capture-timeout", "helper-start-timeout", "helper-start-failed", "requires-macos-14", "api-unavailable", "process-changed", "window-changed", "no-ordinary-window-for-main-pid", "ambiguous-multiple-windows-refuse", "native-size-invalid-or-over-budget", "byte-budget-exceeded", "encoded-byte-budget-exceeded", "invalid-png", "metadata-mismatch", "helper-failed"];
export type CaptureFailureCode = typeof CAPTURE_FAILURE_CODES[number];
export type CapturePhase = 'authorization-required' | 'capture-ready';
/** Host 告知授权/采集阶段；仅在显式用户点击后出现。 */
export interface CapturePhaseFrame {
    readonly type: 'phase';
    readonly phase: CapturePhase;
}
/** Native screenshot 包含当前 PDSH 所属整窗及原生边框，不伪称页面视口。 */
export interface CaptureImageFrame {
    readonly type: 'image';
    readonly scope: 'owned-window';
    readonly width: number;
    readonly height: number;
    readonly pointPixelScale: number;
    readonly pngBytes: number;
    readonly chunkCount: number;
}
/** 有序、受限 PNG 片段；Client 在完成校验前不得打开编辑器。 */
export interface CaptureChunkFrame {
    readonly type: 'chunk';
    readonly index: number;
    readonly base64: string;
}
/** 一次 stream 只发一个固定终态，失败详情不得随 frame 外泄。 */
export interface CaptureTerminalFrame {
    readonly type: 'terminal';
    readonly status: 'captured' | CaptureFailureCode;
}
export type CaptureFrame = CapturePhaseFrame | CaptureImageFrame | CaptureChunkFrame | CaptureTerminalFrame;
