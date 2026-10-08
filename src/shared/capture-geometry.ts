/**
 * [INPUT]: 依赖原生取像返回的物理像素 PNG 尺寸与点像素比例。
 * [OUTPUT]: 定义版本化能力使用的 PNG 相对视口 DTO、摘要语法、查询时限与闭集校验。
 * [POS]: shared Host/Client 纯协议；不进入固定 CaptureFrame，不携带屏幕坐标或图像。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export interface CaptureGeometry {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
  readonly pointPixelScale: number
}

export interface CaptureGeometrySource {
  readonly width: number
  readonly height: number
  readonly pointPixelScale: number
}

export const CAPTURE_GEOMETRY_QUERY_TIMEOUT_MS = 1_500

const GEOMETRY_KEYS = new Set(['x', 'y', 'width', 'height', 'pointPixelScale'])
const PNG_SHA256 = /^[0-9a-f]{64}$/u

// +--- 几何 DTO 只接受 PNG 相对矩形、原生比例与固定闭集字段。 ---+
export function isCaptureGeometry(value: unknown, source?: CaptureGeometrySource): value is CaptureGeometry {
  const fields = closedGeometryFields(value)
  if (!fields) return false
  const { x, y, width, height, pointPixelScale } = fields
  if (!Number.isSafeInteger(x) || x < 0 || !Number.isSafeInteger(y) || y < 0
    || !Number.isSafeInteger(width) || width <= 0
    || !Number.isSafeInteger(height) || height <= 0
    || typeof pointPixelScale !== 'number' || !Number.isFinite(pointPixelScale) || pointPixelScale <= 0) return false
  if (source === undefined) return true
  return Number.isSafeInteger(source.width) && source.width > 0
    && Number.isSafeInteger(source.height) && source.height > 0
    && Number.isFinite(source.pointPixelScale) && source.pointPixelScale > 0
    && pointPixelScale === source.pointPixelScale
    && x <= source.width && width <= source.width - x
    && y <= source.height && height <= source.height - y
}

export function isCapturePngSha256(value: unknown): value is string {
  return typeof value === 'string' && value.length === 64 && PNG_SHA256.test(value)
}

function closedGeometryFields(value: unknown): CaptureGeometry | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return undefined
  const keys = Reflect.ownKeys(value)
  if (keys.length !== GEOMETRY_KEYS.size || keys.some(key => typeof key !== 'string' || !GEOMETRY_KEYS.has(key))) return undefined
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor?.enumerable || !('value' in descriptor)) return undefined
  }
  return value as CaptureGeometry
}
