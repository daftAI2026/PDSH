/**
 * [INPUT]: 依赖 shared/capture-export 的格式与32MP/128MB导出预算。
 * [OUTPUT]: 提供 Typert Remote uplink/downlink 的定型保存合同，不含路径或文件名。
 * [POS]: Host/Client 共同的纯 wire 面；Client只上传有界分块，目录与basename由Host接受配置决定。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { CaptureSaveFormat } from './capture-export.ts';
export declare const WINDOW_SAVE_CHUNK_BYTES: number;
export declare const WINDOW_SAVE_MAX_BYTES = 128000000;
export declare const WINDOW_SAVE_MAX_PIXELS = 32000000;
export declare const WINDOW_SAVE_MAX_CHUNKS: number;
export declare const WINDOW_SAVE_MAX_BASE64_CHARS: number;
/** 一次当前页面导出的业务元数据；路径与目标basename不由Renderer指定。 */
export interface WindowSaveRequest {
    readonly requestId: string;
    readonly format: CaptureSaveFormat;
    readonly width: number;
    readonly height: number;
    readonly title: string;
    readonly capturedAt: string;
}
/** 一条Client→Host uplink：逐块有序发送，finish同时承诺累积字节数与SHA-256。 */
export type WindowSaveInputFrame = {
    readonly type: 'chunk';
    readonly index: number;
    readonly base64: string;
} | {
    readonly type: 'finish';
    readonly chunkCount: number;
    readonly byteLength: number;
    readonly sha256: string;
};
/** 保存进度与结果；只有Host完成安全原子提交后才产生receipt。 */
export type WindowSaveFrame = {
    readonly type: 'ack';
    readonly requestId: string;
    readonly nextIndex: number;
} | {
    readonly type: 'receipt';
    readonly requestId: string;
    readonly outcome: 'saved';
    readonly format: CaptureSaveFormat;
    readonly byteLength: number;
    readonly width: number;
    readonly height: number;
} | {
    readonly type: 'terminal';
    readonly requestId: string;
    readonly code: WindowSaveFailureCode;
};
/** 不携带系统错误正文、路径、图像字节或用户数据的有限失败词汇。 */
export type WindowSaveFailureCode = 'cancelled' | 'busy' | 'disposed' | 'invalid-request' | 'invalid-input' | 'invalid-image' | 'save-failed';
