/**
 * [INPUT]: 依赖 Host 已接受的保存方式/目录/格式/文件名模板与本地 Date；不读取账号或截图。
 * [OUTPUT]: 提供单slash POSIX与canonical Windows drive/UNC绝对目录语法（拒绝设备命名空间/控制字符）、询问/直接保存合同、独立导出预算与尺寸校验、PDSH 默认命名和 basename 生成。
 * [POS]: 拍照设置到编辑器的纯数据合同；跨端只验证绝对路径形状，Host 仍用本机 path 语义决定能否写入。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export declare const CAPTURE_SAVE_FORMATS: readonly ["png", "jpeg", "webp"];
export type CaptureSaveFormat = typeof CAPTURE_SAVE_FORMATS[number];
export declare const CAPTURE_SAVE_BEHAVIORS: readonly ["ask", "direct"];
export type CaptureSaveBehavior = typeof CAPTURE_SAVE_BEHAVIORS[number];
export declare const CAPTURE_SAVE_DIRECTORY_PATTERN: RegExp;
export declare function isCaptureSaveDirectory(value: unknown): value is string;
export declare const CAPTURE_FILE_NAME_TOKENS: readonly ["date", "time", "title", "width", "height"];
export declare const CAPTURE_FILE_NAME_MAX_BYTES = 220;
export declare const CAPTURE_EXPORT_MAX_PIXELS = 32000000;
export declare const CAPTURE_EXPORT_MAX_BYTES = 128000000;
export declare function isCaptureExportSizeAllowed(width: number, height: number): boolean;
export declare function assertCaptureExportSize(width: number, height: number): void;
export declare const CAPTURE_FILE_NAME_PATTERN: RegExp;
export declare const DEFAULT_CAPTURE_EXPORT: {
    saveBehavior: CaptureSaveBehavior;
    saveFormat: CaptureSaveFormat;
    fileNamePattern: string;
    saveDirectory: string;
};
export type CaptureExportPreferences = typeof DEFAULT_CAPTURE_EXPORT;
export declare function resolveCaptureExportPreferences(value: any): CaptureExportPreferences;
export declare function captureExportFileName(value: any, date?: Date, context?: {
    title?: string;
    width?: number;
    height?: number;
}): string;
