/**
 * [INPUT]: 依赖 capture.ts 的真实 Schemastery 字段及 Settings revision/mutate 接口桩。
 * [OUTPUT]: 验证旧模板原样保留及官方表单投影后的 JSON 校验。保留自定义值与卸载围栏。
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

test('Config 保留旧模板与未知来源，不通过 schema callback 推断意图', () => {
  for (const fileNamePattern of ['DSH {date} at {time}', 'PDSH-screenshot-{date}-{time}']) {
    const raw = { fileNamePattern };
    const value = z.object(CAPTURE_CONFIG_FIELDS)(raw);
    assert.equal(value.fileNamePattern.get(), fileNamePattern);
    assert.equal(value.fileNamePatternSource.get(), 'legacy');
    assert.equal(raw.fileNamePattern, fileNamePattern);
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

// +--- 官方 Settings 先克隆并移除 volatile，再把表单作为 JSON 发给 Client。 ---+
test('默认模板 schema 经官方表单投影与 JSON 传输后仍可验证', () => {
  const projected = new z(CAPTURE_CONFIG_FIELDS.fileNamePattern.toJSON());
  delete projected.meta.volatile;
  const received = new z(JSON.parse(JSON.stringify(projected.toJSON())));
  for (const value of ['PDSH-{date}-{time}', 'PDSH-screenshot-{date}-{time}', 'custom-{title}']) {
    assert.equal(received(value), value);
  }
});

test('来源 schema 拒绝缺少默认快照字段或非法模板的对象', () => {
  for (const source of [{}, { defaultPattern: '' }, { defaultPattern: '../unsafe' }]) {
    assert.throws(() => CAPTURE_CONFIG_FIELDS.fileNamePatternSource(source));
  }
  const projected = new z(CAPTURE_CONFIG_FIELDS.fileNamePatternSource.toJSON());
  delete projected.meta.volatile;
  const received = new z(JSON.parse(JSON.stringify(projected.toJSON())));
  for (const source of ['legacy', 'custom', { defaultPattern: 'PDSH-{date}-{time}' }]) {
    assert.deepEqual(JSON.parse(JSON.stringify(received(source))), source);
  }
});
