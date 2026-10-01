/**
 * [INPUT]: 依赖 node:test 与真实 Schemastery Config，不模拟校验结果。
 * [OUTPUT]: 验证持久化入口只接收合法本地显示配置和 volatile 字段。
 * [POS]: PDSH Host 合同，防止 Client 验证通过却绕过 Host 的保存边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import schema from '@deepseek-ai/schemastery';
import * as model from '../src/shared/model.ts';
import { Config, name } from '../src/host/index.ts';
test('Host 默认和 live 配置字段', () => {
  assert.equal(name, 'pdsh');
  const value = Config({});
  assert.equal(value.maskTitles.get(), false);
  assert.equal(Config({ frames: true }).maskTitles.get(), false);
  assert.throws(() => Config({ maskTitles: 'true' }));
  assert.equal(value.maskIdentity.get(), false);
  assert.equal(value.nickname.get(), '临时访客');
  assert.equal(value.avatar.get(), '');
  assert.equal(value.captureEnabled.get(), true);
  assert.equal(value.saveBehavior.get(), 'ask');
  assert.equal(value.saveDirectory.get().endsWith('/Downloads'), true);
  assert.equal(value.saveFormat.get(), 'png');
  assert.equal(value.fileNamePattern.get(), 'PDSH-screenshot-{date}-{time}');
  assert.equal(Config({ captureEnabled: false }).captureEnabled.get(), false);
  assert.throws(() => Config({ captureEnabled: 'false' }));
  assert.throws(() => Config({ saveBehavior: 'automatic' }));
  assert.throws(() => Config({ saveFormat: 'gif' }));
  assert.throws(() => Config({ saveDirectory: 'relative' }));
});
test('Host 拒绝控制字符、空白昵称与远端或 SVG 头像', () => {
  for (const nickname of ['', '   ', '\u0000', 'abc\n', 'a'.repeat(65)]) {
    assert.throws(() => Config({ nickname }));
  }
  for (const avatar of ['https://example.com/x.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'x']) {
    assert.throws(() => Config({ avatar }));
  }
  assert.equal(Config({ nickname: '林纳斯', avatar: 'data:image/png;base64,aGVsbG8=' }).nickname.get(), '林纳斯');
});

test('Host 接收账号头像来源开关，不接受隐式类型转换', () => {
  assert.equal(Config({}).useAccountAvatar.get(), false);
  assert.equal(Config({ useAccountAvatar: true }).useAccountAvatar.get(), true);
  assert.throws(() => Config({ useAccountAvatar: 'true' }));
});

test('单 Host apply 只配置一次官方 Settings，再将 root Config 交给拍照 Host effect', () => {
  const calls = [];
  const capture = { apply(ctx, config) { calls.push(['capture', ctx, config]); } };
  const source = readFileSync(new URL('../src/host/index.ts', import.meta.url), 'utf8');
  const module = { exports: {} };
  const context = {
    module, exports: module.exports,
    require(id) {
      if (id === '@deepseek-ai/schemastery') return schema;
      if (id === '../shared/model.ts') return model;
      if (id === './capture.ts') return capture;
      throw new Error(id);
    },
  };
  runInNewContext(transformSync(source, { loader: 'ts', format: 'cjs' }).code, context);
  const settings = { configure(options, fiber) { calls.push(['configure', options, fiber]); return () => {}; } };
  const child = { settings, effect(fn) { return fn(); } };
  const ctx = { fiber: {}, inject(keys, callback) { assert.equal(keys.length, 1); assert.equal(keys[0], 'settings'); callback(child); } };
  const config = Config({ captureEnabled: false });
  module.exports.apply(ctx, config);
  assert.equal(calls.filter(([kind]) => kind === 'configure').length, 1);
  assert.equal(calls[0][0], 'configure');
  assert.equal(calls[0][1].auto, false);
  assert.equal(calls[1][0], 'capture');
  assert.equal(calls[1][1], ctx);
  assert.equal(calls[1][2], config);
});
