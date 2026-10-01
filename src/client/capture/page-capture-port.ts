/**
 * [INPUT]: 当前页面取像桥的版本/目标范围与 capturePng/cancel 能力，不获取像素或启动进程。
 * [OUTPUT]: 提供 PageCapturePort 窄接口、运行时验证与宿主能力读取；缺失/未知桥返回 null，不伪造能力。
 * [POS]: 拍照与连接桥的契约边界；viewport 负责 PNG 解码，桥提供方负责连接与资源生命周期。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
/** 不接受窗口 ID、URL、矩形或可执行代码，只授权当前页面与关联 ID。 */
export interface PageCapturePort {
  protocolVersion: 1;
  scope: 'current-page';
  capturePng(requestId: string): Promise<{ requestId: string; png: Uint8Array }>;
  cancel(requestId: string): Promise<void>;
}

export function isPageCapturePort(value: unknown): value is PageCapturePort {
  const port = value as Partial<PageCapturePort> | null;
  return port?.protocolVersion === 1 && port.scope === 'current-page'
    && typeof port.capturePng === 'function' && typeof port.cancel === 'function';
}

export function readPageCapturePort(doc: Document): PageCapturePort | null {
  const desktop = (doc.defaultView as any)?.dshDesktop;
  const port = desktop?.pageCapture;
  return desktop?.protocolVersion === 1 && isPageCapturePort(port) ? port : null;
}
