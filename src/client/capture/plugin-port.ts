/**
 * [INPUT]: 依赖官方 connection.rpc 控制、Main 固定接收器、纯保存方式类型与固定阶段诊断。
 * [OUTPUT]: 提供插件自带 PageCapturePort/save/dispose；请求与 document nonce 关联，停用取消并拒绝迟到像素，端口冲突与关闭未知只保留安全错误码。
 * [POS]: Renderer 连接适配边界；不写 dshDesktop，不发像素 HTTP，不执行调用方代码。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { CAPTURE_ENDPOINT, CAPTURE_RECEIVER, MAX_PNG_BYTES, isCaptureId } from '../../shared/capture-bridge.ts';
import { createPageSavePort } from './save-port.ts';
import type { CaptureSaveBehavior } from '../../shared/capture-export.ts';
import type { PageCapturePort } from './page-capture-port.ts';
import type { CaptureTrace } from '../../shared/capture-trace.ts';
export function mountPluginCapturePort(doc: Document, rpc, trace: CaptureTrace = () => {}): { port: PageCapturePort; save(blob: Blob, fileName: string, directory?: string, behavior?: CaptureSaveBehavior, signal?: AbortSignal): Promise<'saved' | 'cancelled'>; dispose(): void } {
  const view = doc.defaultView!, key = Symbol.for(CAPTURE_RECEIVER), nonce = view.crypto.randomUUID();
  if ((view as any)[key]) throw new Error('PDSH capture receiver already owned');
  const pending = new Map<string, { resolve(value): void; reject(error): void }>();
  let disposed = false;
  const fail = () => new Error('PDSH current-page capture unavailable');
  async function control(op, requestId, signal?) {
    const result = await rpc.call('/api', CAPTURE_ENDPOINT, { op, requestId, owner: nonce }, ...(signal ? [signal] : []));
    if (result?.error?.code === 'pdsh/inspector-cleanup-unconfirmed') throw Object.assign(fail(), { code: 'bridge-cleanup-unconfirmed' });
    if (result?.error?.code === 'pdsh/control-cleanup-unconfirmed') throw Object.assign(fail(), { code: 'control-cleanup-unconfirmed' });
    if (result?.error?.code === 'pdsh/inspector-port-busy') throw Object.assign(fail(), { code: 'bridge-port-busy' });
    if (result?.ok !== true || result.value?.protocolVersion !== 1) throw fail();
    return result.value;
  }
  function probe(requestId) {
    if (disposed || !pending.has(requestId) || !doc.documentElement.isConnected) return null;
    const unsupportedEmbed = [...doc.querySelectorAll('webview, iframe')].some(element => {
      const box = element.getBoundingClientRect(), style = view.getComputedStyle(element);
      return box.width > 0 && box.height > 0 && box.right > 0 && box.bottom > 0 && box.left < view.innerWidth && box.top < view.innerHeight
        && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });
    return { nonce, unsupportedEmbed, width: view.innerWidth, height: view.innerHeight, dpr: view.devicePixelRatio,
      theme: Boolean(doc.querySelector('[data-ds-dark-theme]')), scrollX: view.scrollX, scrollY: view.scrollY };
  }
  const savePort = createPageSavePort(doc, nonce, control);
  const receiver = {
    exportData: savePort.exportData,
    probe,
    receive(requestId, documentNonce, base64) {
      const request = pending.get(requestId);
      if (!request || disposed || documentNonce !== nonce) return false;
      pending.delete(requestId);
      try {
        if (typeof base64 !== 'string' || !base64.length || base64.length > Math.ceil(MAX_PNG_BYTES / 3) * 4 || base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw fail();
        const binary = view.atob(base64), png = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index++) png[index] = binary.charCodeAt(index);
        trace('renderer-received', requestId);
        request.resolve({ requestId, png }); return true;
      } catch { request.reject(fail()); return false; }
    },
  };
  (view as any)[key] = receiver;
  const port: PageCapturePort = {
    protocolVersion: 1, scope: 'current-page',
    capturePng(requestId) {
      if (disposed || !isCaptureId(requestId) || pending.size) return Promise.reject(fail());
      return new Promise((resolve, reject) => {
        trace('renderer-requested', requestId);
        pending.set(requestId, { resolve, reject });
        void control('capture', requestId).catch(error => {
          trace('renderer-failed', requestId);
          if (pending.get(requestId)?.reject === reject) { pending.delete(requestId); reject(['bridge-cleanup-unconfirmed', 'bridge-port-busy', 'control-cleanup-unconfirmed'].includes(error?.code) ? error : fail()); }
        });
      });
    },
    async cancel(requestId) {
      const request = pending.get(requestId); pending.delete(requestId); request?.reject(fail());
      if (isCaptureId(requestId) && !disposed) await control('cancel', requestId);
    },
  };
  return { port, save: savePort.save, dispose() {
    if (disposed) return; disposed = true; savePort.dispose();
    for (const [id, request] of pending) { request.reject(fail()); void control('cancel', id).catch(() => {}); }
    pending.clear(); if ((view as any)[key] === receiver) delete (view as any)[key];
    // 只控制连接，不从 Renderer 选择 Main 进程或读取其他窗口。
    void rpc.call('/api', CAPTURE_ENDPOINT, { op: 'release', owner: nonce }).catch(() => {});
  } };
}
