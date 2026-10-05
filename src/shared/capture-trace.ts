/**
 * [INPUT]: 依赖宿主 logger.info、UUID 校验与固定失败码白名单；不接收内容或异常对象。
 * [OUTPUT]: 提供运行侧、阶段、requestId 与失败码的脱敏诊断，日志失效不影响取像。
 * [POS]: Host/Renderer 共用的低噪声观测边界；不写配置、不保存像素，不记录路径或连接秘密，旧后台本地码不扩展 Host wire。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { isCaptureId } from './capture-bridge.ts';
import { CAPTURE_FAILURE_CODES } from './window-capture-protocol.ts';
export const CAPTURE_TRACE_PHASES = [
  'capture-click', 'request-received', 'bootstrap-start', 'bootstrap-unsupported',
  'bootstrap-identity-rejected', 'bootstrap-port-busy', 'inspector-signalled',
  'inspector-attached', 'main-verified', 'main-loaded', 'control-ready',
  'inspector-closed', 'inspector-close-unconfirmed', 'native-requested',
  'native-ready', 'native-failed', 'renderer-requested', 'renderer-received',
  'renderer-failed', 'pixels-start', 'pixels-validating', 'pixels-decoded',
  'pixels-ready', 'capture-failed', 'editor-ready', 'cleanup-finished',
] as const;
export type CaptureTracePhase = typeof CAPTURE_TRACE_PHASES[number];
export const CAPTURE_TRACE_FAILURE_CODES = [...CAPTURE_FAILURE_CODES, 'invalid-capture', 'stream-failed', 'runtime-not-current'] as const;
export type CaptureTraceFailureCode = typeof CAPTURE_TRACE_FAILURE_CODES[number];
export function captureTraceFailureCode(value: unknown): CaptureTraceFailureCode | undefined {
  return typeof value === 'string' && (CAPTURE_TRACE_FAILURE_CODES as readonly string[]).includes(value)
    ? value as CaptureTraceFailureCode : undefined;
}
export type CaptureTrace = (phase: CaptureTracePhase, requestId?: string, code?: CaptureTraceFailureCode) => void;
export function createCaptureTrace(logger, side: 'host' | 'renderer'): CaptureTrace {
  return (phase, requestId, code) => {
    if (!(CAPTURE_TRACE_PHASES as readonly string[]).includes(phase) || !['host', 'renderer'].includes(side)) return;
    try { logger?.info?.('PDSH capture side=%s phase=%s request=%s code=%s', side, phase, isCaptureId(requestId) ? requestId : '-', captureTraceFailureCode(code) ?? '-'); }
    catch { /* 诊断通道不得成为业务失败原因。 */ }
  };
}
