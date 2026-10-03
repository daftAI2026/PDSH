/**
 * [INPUT]: 依赖同一 Host ConfigForm 的接受值/修订围栏、官方目录 picker 和 Remote 双向保存流。
 * [OUTPUT]: 目录选择后按 ACK 背压上传 Blob；仅实际 commit 回执与自然流结束才返回 saved，取消/失败释放 handle。
 * [POS]: 编辑器导出 effect 边界；Host 决定目录与文件名，Client 不发路径、不走 HTTP/Main/调试桥，不重复保存。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { RemoteStreamHandle } from '@deepseek-ai/dsh-typert-protocol';
import { WINDOW_SAVE_CHUNK_BYTES, WINDOW_SAVE_MAX_BYTES, type WindowSaveRequest, type WindowSaveFrame, type WindowSaveInputFrame } from '../../shared/window-save-protocol.ts';
import { resolveCaptureExportPreferences } from '../../shared/capture-export.ts';
const failed = () => new Error('save-failed');
function check(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error('cancelled');
}
export async function prepareWindowSaveDirectory(form, chooseDirectory, behavior: 'ask' | 'direct', signal?: AbortSignal): Promise<string | null> {
  check(signal);
  const initial = form.getSnapshot();
  if (initial.status !== 'ready' || !initial.writable)
    throw failed();
  const base = resolveCaptureExportPreferences(initial.value);
  if (base.saveBehavior !== behavior)
    throw failed();
  if (behavior === 'direct') {
    if (!base.saveDirectory)
      throw failed();
    return base.saveDirectory;
  }
  if (!chooseDirectory)
    throw failed();
  const selected = await chooseDirectory();
  check(signal);
  if (selected === null)
    return null;
  const latest = form.getSnapshot();
  if (latest.status !== 'ready' || !latest.writable || JSON.stringify(resolveCaptureExportPreferences(latest.value)) !== JSON.stringify(base))
    throw failed();
  const accepted = await form.mutate([{ op: 'set', path: ['saveDirectory'], value: selected }], latest.revision);
  check(signal);
  const current = form.getSnapshot();
  if (!accepted || current.status !== 'ready' || !current.writable || current.value?.captureEnabled === false || resolveCaptureExportPreferences(current.value).saveDirectory !== selected)
    throw failed();
  return selected;
}
export async function saveWindowImage(blob: Blob, request: WindowSaveRequest, open: (request: WindowSaveRequest, signal?: AbortSignal) => RemoteStreamHandle<WindowSaveFrame, WindowSaveInputFrame>, { signal, crypto = globalThis.crypto }: {
  signal?: AbortSignal;
  crypto?: Pick<Crypto, 'subtle'>;
} = {}): Promise<'saved'> {
  let handle: RemoteStreamHandle<WindowSaveFrame, WindowSaveInputFrame>;
  let commitRequested = false, rejected = false;
  try {
    check(signal);
    if (!blob.size || blob.size > WINDOW_SAVE_MAX_BYTES)
      throw failed();
    const mime = request.format === 'jpeg' ? 'image/jpeg' : `image/${request.format}`;
    if (blob.type !== mime)
      throw failed();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    check(signal);
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
    check(signal);
    const chunkCount = Math.ceil(bytes.length / WINDOW_SAVE_CHUNK_BYTES);
    handle = open(request, signal);
    let sent = 0, acknowledged = 0, finished = false, receipt = false;
    function sendChunk() {
      const chunk = bytes.subarray(sent * WINDOW_SAVE_CHUNK_BYTES, (sent + 1) * WINDOW_SAVE_CHUNK_BYTES);
      let binary = '';
      for (const byte of chunk)
        binary += String.fromCharCode(byte);
      handle.send({ type: 'chunk', index: sent, base64: btoa(binary) });
      sent++;
    }
    sendChunk();
    for await (const frame of handle) {
      check(signal);
      if (receipt || frame.requestId !== request.requestId)
        throw failed();
      if (frame.type === 'ack') {
        if (finished || frame.nextIndex !== sent || acknowledged + 1 !== sent)
          throw failed();
        acknowledged = sent;
        if (sent < chunkCount)
          sendChunk();
        else {
          commitRequested = true;
          handle.send({ type: 'finish', chunkCount, byteLength: bytes.length, sha256: hash });
          finished = true;
          handle.end();
        }
      }
      else if (frame.type === 'receipt') {
        if (!finished || frame.outcome !== 'saved' || frame.byteLength !== bytes.length || frame.width !== request.width || frame.height !== request.height || frame.format !== request.format)
          throw failed();
        receipt = true;
      }
      else if (frame.type === 'terminal') {
        rejected = true;
        throw frame.code === 'cancelled' ? new Error('cancelled') : failed();
      }
      else
        throw failed();
    }
    check(signal);
    if (!receipt)
      throw failed();
    return 'saved';
  }
  catch (error) {
    if (signal?.aborted)
      throw new Error('cancelled');
    throw new Error(commitRequested && !rejected ? 'save-unconfirmed' : 'save-failed');
  }
  finally {
    if (handle) {
      try { await handle.dispose(); }
      catch { throw new Error(commitRequested ? 'save-unconfirmed' : 'save-failed'); }
    }
  }
}
