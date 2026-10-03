/**
 * [INPUT]: 依赖 Client 保存状态机和官方 Remote handle 的内存接缝。
 * [OUTPUT]: 验证每块 ACK、finish 半关闭、真实回执、目录取消与 revision 围栏，不走调试桥。
 * [POS]: 保存 Client 合同；本地 mock 不证明 DSH 实机文件保存。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { saveWindowImage, prepareWindowSaveDirectory } from '../src/client/capture/window-save.ts';
import { WINDOW_SAVE_CHUNK_BYTES } from '../src/shared/window-save-protocol.ts';
const request = { requestId: '5c404bd3-5555-4555-8555-aaaaaaaaaaaa', format: 'png', width: 1, height: 1, title: 'title', capturedAt: '2026-10-03T00:00:00.000Z' };
function carrier(blob, { trailing = false, receipt = true } = {}) {
  const frames = [], sent = [];
  let ended = 0, disposed = 0;
  const handle = { send(frame) { sent.push(frame); if (frame.type === 'chunk')
      frames.push({ type: 'ack', requestId: request.requestId, nextIndex: frame.index + 1 }); }, end() { ended++; }, dispose() { disposed++; }, async *[Symbol.asyncIterator]() {
      while (frames.length)
        yield frames.shift();
      if (receipt)
        yield { type: 'receipt', requestId: request.requestId, outcome: 'saved', format: 'png', width: 1, height: 1, byteLength: blob.size };
      if (trailing)
        yield { type: 'ack', requestId: request.requestId, nextIndex: 99 };
    } };
  return { handle, sent, get ended() { return ended; }, get disposed() { return disposed; } };
}
test('分块只在前块ACK后推进，finish/end后仍须真实receipt', async () => {
  const blob = new Blob([new Uint8Array(WINDOW_SAVE_CHUNK_BYTES + 1)], { type: 'image/png' }), h = carrier(blob);
  assert.equal(await saveWindowImage(blob, request, () => h.handle, { crypto: webcrypto }), 'saved');
  assert.deepEqual(h.sent.map(f => f.type), ['chunk', 'chunk', 'finish']);
  assert.equal(h.sent[2].chunkCount, 2);
  assert.equal(h.sent[2].sha256.length, 64);
  assert.equal(h.ended, 1);
  assert.equal(h.disposed, 1);
});
test('EOF和receipt后尾帧均不冒称保存成功', async () => {
  for (const options of [{ receipt: false }, { trailing: true }]) {
    const blob = new Blob([new Uint8Array(1)], { type: 'image/png' }), h = carrier(blob, options);
    await assert.rejects(saveWindowImage(blob, request, () => h.handle, { crypto: webcrypto }), /save-unconfirmed/);
    assert.equal(h.disposed, 1);
  }
});
test('取消目录不写配置；目录选择期间revision对应字段变化不覆盖', async () => {
  let value = { saveDirectory: '/before', saveFormat: 'png', saveBehavior: 'ask', fileNamePattern: '{date}' }, writes = 0;
  const form = { getSnapshot: () => ({ status: 'ready', writable: true, revision: 1, value }), mutate: async () => { writes++; return true; } };
  assert.equal(await prepareWindowSaveDirectory(form, async () => null, 'ask'), null);
  assert.equal(writes, 0);
  await assert.rejects(prepareWindowSaveDirectory(form, async () => { value = { ...value, saveDirectory: '/other' }; return '/chosen'; }, 'ask'), /save-failed/);
  assert.equal(writes, 0);
});
