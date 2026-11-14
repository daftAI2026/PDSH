/**
 * [INPUT]: 依赖 capture.ts 的真实 Schemastery 字段及 Settings revision/mutate 接口桩。
 * [OUTPUT]: 验证旧默认模板归一化与序列化。不写 override，保留自定义值与卸载围栏。
 * [POS]: Host 配置迁移契约；不访问用户 profile、不启动 Main bridge。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import z from '@deepseek-ai/schemastery';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CAPTURE_CONFIG_FIELDS, normalizeLegacyCaptureExport } from '../src/host/capture.ts';

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

test('旧空目录在 pdsh root revision 下修正；模板不发起写入', async () => {
  const { ctx, writes } = fixture({ saveDirectory: '', fileNamePattern: 'DSH {date} at {time}' });
  await normalizeLegacyCaptureExport(ctx);
  assert.deepEqual(writes, [[
    'pdsh',
    [
      { op: 'set', path: ['saveDirectory'], value: join(homedir(), 'Downloads') },
    ],
    9,
  ]]);
});

test('Config 原位归一化两代默认模板，不写原始 override', () => {
  for (const fileNamePattern of ['DSH {date} at {time}', 'PDSH-screenshot-{date}-{time}']) {
    const raw = { fileNamePattern };
    const value = z.object({ fileNamePattern: CAPTURE_CONFIG_FIELDS.fileNamePattern })(raw);
    assert.equal(value.fileNamePattern.get(), 'PDSH-{date}-{time}');
    const serialized = new z(CAPTURE_CONFIG_FIELDS.fileNamePattern.toJSON());
    assert.equal(serialized(fileNamePattern).get(), 'PDSH-{date}-{time}');
    assert.deepEqual(raw, { fileNamePattern });
  }
});

test('默认模板归一化不通过 Settings 发起嵌套配置事务', async () => {
  const { ctx, writes } = fixture({ saveDirectory: '/tmp/pdsh-chosen', fileNamePattern: 'PDSH-screenshot-{date}-{time}' });
  await normalizeLegacyCaptureExport(ctx);
  assert.deepEqual(writes, []);
});

test('自定义模板即使含 screenshot 也不迁移', async () => {
  for (const fileNamePattern of ['custom-screenshot-{date}-{time}', 'PDSH-screenshot-{title}', 'PDSH-{date}-{time}']) {
    assert.equal(CAPTURE_CONFIG_FIELDS.fileNamePattern(fileNamePattern).get(), fileNamePattern);
    const { ctx, writes } = fixture({ saveDirectory: '/tmp/pdsh-chosen', fileNamePattern });
    await normalizeLegacyCaptureExport(ctx);
    assert.deepEqual(writes, []);
  }
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
