/**
 * [INPUT]: 依赖原生取像返回的物理像素 PNG 尺寸与点像素比例。
 * [OUTPUT]: 定义版本化能力使用的 PNG 相对视口 DTO、摘要语法、查询时限与闭集校验。
 * [POS]: shared Host/Client 纯协议；不进入固定 CaptureFrame，不携带屏幕坐标或图像。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export interface CaptureGeometry {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly pointPixelScale: number;
}
export interface CaptureGeometrySource {
    readonly width: number;
    readonly height: number;
    readonly pointPixelScale: number;
}
export declare const CAPTURE_GEOMETRY_QUERY_TIMEOUT_MS = 1500;
export declare function isCaptureGeometry(value: unknown, source?: CaptureGeometrySource): value is CaptureGeometry;
export declare function isCapturePngSha256(value: unknown): value is string;
