/**
 * [INPUT]: 依赖宿主 logger.info 和 capture-bridge 的 UUID 校验；不接收内容、异常对象或任意字段。
 * [OUTPUT]: 提供固定阶段诊断函数；只输出运行侧、阶段和本次 requestId，日志失效不影响取像。
 * [POS]: Host/Renderer 共用的低噪声观测边界；不写配置、不保存像素，不记录路径或连接秘密。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { isCaptureId } from './capture-bridge.ts';
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
export type CaptureTrace = (phase: CaptureTracePhase, requestId?: string) => void;
export function createCaptureTrace(logger, side: 'host' | 'renderer'): CaptureTrace {
  return (phase, requestId) => {
    if (!(CAPTURE_TRACE_PHASES as readonly string[]).includes(phase) || !['host', 'renderer'].includes(side)) return;
    try { logger?.info?.('PDSH capture side=%s phase=%s request=%s', side, phase, isCaptureId(requestId) ? requestId : '-'); }
    catch { /* 诊断通道不得成为业务失败原因。 */ }
  };
}
