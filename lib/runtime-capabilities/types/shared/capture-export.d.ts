/**
 * [INPUT]: 依赖 Host accepted 的完整截图配置、保存方式/目录/格式/文件名模板与本地 Date；不读取账号或截图。
 * [OUTPUT]: 提供截图配置完整性就绪判定、单slash POSIX与canonical Windows drive/UNC绝对目录语法（拒绝设备命名空间/控制字符）、保存合同、导出预算校验及 basename 生成。
 * [POS]: 拍照设置到编辑器的纯数据合同；配置就绪只判定已接受字段与其现有纯合同有效性，不推断权限或 Host 版本；跨端路径只判形状。
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
export declare function isCaptureConfigurationReady(value: unknown): boolean;
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
