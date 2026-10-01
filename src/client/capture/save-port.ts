/**
 * [INPUT]: 依赖页面 Blob/FileReader、已冻结的保存方式/目录、既有控制端口和 document nonce；不向 RPC 传图片或路径。
 * [OUTPUT]: 提供保存请求/固定 exportData 接收器/停用；冻结编码只向已绑定 Main 交付一次，保存结果必须有明确回执。
 * [POS]: Renderer 导出效果边界；系统面板由用户决策，不用机器截止时间伪造取消；取消保留编辑器，关闭编辑器只取消所属请求，停用拒绝迟到结果并撤回未交付内容。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { isCaptureId } from '../../shared/capture-bridge.ts';
import { CAPTURE_EXPORT_MAX_BYTES, type CaptureSaveBehavior } from '../../shared/capture-export.ts';
export function createPageSavePort(doc: Document, nonce: string, control) {
  const view = doc.defaultView!;
  let disposed = false, current = null;
  const unavailable = () => new Error('PDSH current-page save unavailable');
  function cleanup(request) {
    request.detach?.(); request.reader?.abort();
    if (current === request) current = null;
  }
  function abort(request) {
    if (request.settled || request.abort.signal.aborted) return;
    cleanup(request);
    request.abort.abort(); request.reader?.abort(); request.reject(unavailable());
    void control('cancel', request.id).catch(() => {});
  }
  return {
    async exportData(id, owner) {
      const request = current;
      if (disposed || !request || request.id !== id || owner !== nonce || request.delivered || !doc.documentElement.isConnected) return null;
      request.delivered = true;
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = request.reader = new view.FileReader();
        reader.onload = () => {
          const result = reader.result, prefix = `data:${request.blob.type};base64,`;
          if (typeof result !== 'string' || !result.startsWith(prefix)) reject(unavailable());
          else resolve(result.slice(prefix.length));
        };
        reader.onerror = reader.onabort = () => reject(unavailable());
        reader.readAsDataURL(request.blob);
      });
      request.reader = null;
      if (disposed || current !== request || request.abort.signal.aborted) return null;
      return { nonce, base64, mime: request.blob.type, fileName: request.fileName, directory: request.directory, saveBehavior: request.saveBehavior };
    },
    save(blob: Blob, fileName: string, directory = '', saveBehavior: CaptureSaveBehavior = 'ask', signal?: AbortSignal): Promise<'saved' | 'cancelled'> {
      if (disposed || current || signal?.aborted || !blob || !['image/png','image/jpeg','image/webp'].includes(blob.type) || !blob.size || blob.size > CAPTURE_EXPORT_MAX_BYTES) return Promise.reject(unavailable());
      return new Promise((resolve, reject) => {
        const request = { id: view.crypto.randomUUID(), blob, fileName, directory, saveBehavior, abort: new view.AbortController(), reader: null, delivered: false, settled: false, detach: undefined, reject };
        if (!isCaptureId(request.id)) { reject(unavailable()); return; }
        current = request;
        const cancel = () => abort(request);
        signal?.addEventListener('abort', cancel, { once: true });
        request.detach = () => signal?.removeEventListener('abort', cancel);
        void control('save', request.id, request.abort.signal).then(value => {
          if (disposed || current !== request || request.abort.signal.aborted || !['saved','cancelled'].includes(value?.outcome)) throw unavailable();
          request.settled = true; cleanup(request); resolve(value.outcome);
        }).catch(() => { abort(request); }).finally(() => {
          cleanup(request);
        });
      });
    },
    dispose() { if (disposed) return; disposed = true; if (current) { const request = current; current = null; abort(request); } },
  };
}
