/**
 * [INPUT]: 依赖 update-source.ts 单一公网请求边界与注入的 fetch 桩。
 * [OUTPUT]: 验证 GitHub tag 请求不携带凭据、拒绝非数组或错误响应。
 * [POS]: 更新网络合同；宿主 CSP/实际公网连通性需在 Desktop 独立验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadReleaseTags } from '../src/client/update-source.ts';

test('自动版本探测只访问固定公共 tags URL，不发送凭据', async () => {
  const tags = [{ name: 'v0.1.0', commit: { sha: 'a'.repeat(40) } }];
  const actual = await loadReleaseTags(async (url, options) => {
    assert.equal(url, 'https://api.github.com/repos/daftAI2026/PDSH/tags?per_page=100');
    assert.equal(options?.credentials, 'omit');
    assert.equal(options?.cache, 'no-store');
    return { ok: true, async json() { return tags; } } as Response;
  });
  assert.deepEqual(actual, tags);
});

test('网络失败或非数组响应不能假装最新', async () => {
  await assert.rejects(loadReleaseTags(async () => ({ ok: false } as Response)));
  await assert.rejects(loadReleaseTags(async () => ({ ok: true, async json() { return {}; } } as Response)));
});
