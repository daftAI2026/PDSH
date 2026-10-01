/**
 * [INPUT]: 依赖 capture.ts 的 root Config 字段与官方 Settings revision/mutate 接口桩。
 * [OUTPUT]: 验证旧导出默认只在 pdsh 主 namespace 中迁移，且并发/卸载围栏保留。
 * [POS]: Host 配置迁移契约；不访问用户 profile、不启动 Main bridge。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { normalizeLegacyCaptureExport } from '../src/host/capture.ts';

function fixture(value, revision = 9) {
  const writes = [];
  const ctx = {
    root: { loader: { await: async () => {} } },
    settings: {
      describe: () => [{ ns: 'pdsh', value, revision }],
      async mutate(...args) { writes.push(args); return false; },
    },
  };
  return { ctx, writes };
}

test('旧空目录和旧品牌默认在 pdsh root revision 下修正；保留 Host 接受/拒绝结果', async () => {
  const { ctx, writes } = fixture({ saveDirectory: '', fileNamePattern: 'DSH {date} at {time}' });
  await normalizeLegacyCaptureExport(ctx);
  assert.deepEqual(writes, [[
    'pdsh',
    [
      { op: 'set', path: ['saveDirectory'], value: join(homedir(), 'Downloads') },
      { op: 'set', path: ['fileNamePattern'], value: 'PDSH-screenshot-{date}-{time}' },
    ],
    9,
  ]]);
});

test('用户已有导出值、旧子 namespace 和迟到卸载不覆盖偏好', async () => {
  const { ctx, writes } = fixture({ saveDirectory: '/tmp/pdsh-chosen', fileNamePattern: 'custom-{title}' });
  await normalizeLegacyCaptureExport(ctx);
  assert.equal(writes.length, 0);

  ctx.settings.describe = () => [{ ns: 'pdsh-capture', value: { saveDirectory: '', fileNamePattern: 'DSH {date} at {time}' }, revision: 9 }];
  await normalizeLegacyCaptureExport(ctx);
  assert.equal(writes.length, 0, '已移除的独立 namespace 不再拥有导出偏好');

  ctx.settings.describe = () => [{ ns: 'pdsh', value: { saveDirectory: '', fileNamePattern: 'DSH {date} at {time}' }, revision: 10 }];
  await normalizeLegacyCaptureExport(ctx, () => true);
  assert.equal(writes.length, 0, 'Host fiber 卸载后不提交迟到写入');
});
