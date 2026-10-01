/**
 * [INPUT]: 依赖固定 rc.2 的官方 Connection 传输；不包含截图或窗口选择参数。
 * [OUTPUT]: 提供取像控制路径、页面接收器标识、预算、UUID 验证与控制帧 record 校验。
 * [POS]: Host/Main/Renderer 的共同协议边界；像素只由 Main 交付原调用页面。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export const CAPTURE_ROUTE = '/api/pdsh.capture';
export const CAPTURE_ENDPOINT = 'pdsh.capture';
export const CAPTURE_RECEIVER = '@daftai/pdsh.page-capture.receiver.v1';
export const MAX_PAGE_PIXELS = 16_000_000;
export const MAX_PNG_BYTES = MAX_PAGE_PIXELS * 8;
export const MAX_CONTROL_BYTES = 2048;
export const BRIDGE_TIMEOUT_MS = 30_000;
export function isCaptureId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function parseControlRecord(line: string): Record<string, any> {
  const value = JSON.parse(line);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid control record');
  return value;
}
