/**
 * [INPUT]: 依赖 node:test、node:os/node:path 的本机 Downloads 路径语义、真实 Schemastery root/capture Config 与平台 provider 注册谓词，不模拟校验结果。
 * [OUTPUT]: 验证唯一 Host Config 与平台能力分流；无 helper 平台仍配置 Settings 并保留独立功能。
 * [POS]: PDSH Host 合同，防止 Client 验证通过却绕过 Host 的保存边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import schema from '@deepseek-ai/schemastery';
import * as model from '../src/shared/model.ts';
import { CAPTURE_CONFIG_FIELDS } from '../src/host/capture.ts';
import { Config, name } from '../index.js';
import { shouldRegisterNativeCaptureProvider } from '../src/host/native-window-capture.ts';
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
  assert.equal(value.saveDirectory.get(), join(homedir(), 'Downloads'));
  assert.equal(value.saveFormat.get(), 'png');
  assert.equal(value.fileNamePattern.get(), 'PDSH-screenshot-{date}-{time}');
  assert.equal(Config({ captureEnabled: false }).captureEnabled.get(), false);
  assert.throws(() => Config({ captureEnabled: 'false' }));
  assert.throws(() => Config({ saveBehavior: 'automatic' }));
  assert.throws(() => Config({ saveFormat: 'gif' }));
  assert.throws(() => Config({ saveDirectory: 'relative' }));
});
test('截图身份遮挡保存在唯一 Host Config，默认开启且拒绝隐式类型转换', () => {
  const CaptureConfig = schema.object(CAPTURE_CONFIG_FIELDS);
  assert.equal(CaptureConfig({}).captureMaskIdentity.get(), true);
  assert.equal(CaptureConfig({ captureMaskIdentity: false }).captureMaskIdentity.get(), false);
  assert.throws(() => CaptureConfig({ captureMaskIdentity: 'false' }));
});
test('Host saveDirectory schema accepts native POSIX/Windows absolute paths, not relative or invalid Windows paths', () => {
  const CaptureConfig = schema.object(CAPTURE_CONFIG_FIELDS);
  for (const path of ['/Users/alice/Downloads', 'C:\\', 'C:\\Users\\alice\\Downloads', '\\\\server\\share', '\\\\server\\share\\exports']) {
    assert.equal(CaptureConfig({ saveDirectory: path }).saveDirectory.get(), path);
  }
  for (const path of ['relative', 'C:relative', 'C:', '\\Users\\alice', 'C:/Users/alice', 'C:\\bad?folder', 'C:\\bad\nfolder', '/tmp/bad\u0085folder', '//?/C:/Users/alice', '//./pipe/endpoint', '\\\\.\\pipe\\endpoint', '\\\\.\\GLOBALROOT\\Device\\HarddiskVolume1\\dir']) {
    assert.throws(() => CaptureConfig({ saveDirectory: path }));
  }
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

test('单 Host apply 按平台配置唯一 Remote service，Settings 与root owner订阅始终独立', () => {
 for (const [platform, arch, hasHelper, serviceCount] of [
   ['darwin', 'arm64', false, 1], ['darwin', 'x64', false, 1],
   ['win32', 'x64', true, 1], ['win32', 'x64', false, 0],
   ['win32', 'arm64', true, 0], ['linux', 'x64', true, 0],
 ] as const) {
  const calls = [];
  const capture = { CAPTURE_CONFIG_FIELDS, apply(ctx) { calls.push(['capture', ctx]); }, observeCaptureEnabled(ctx){calls.push(['observe',ctx]);} };
  const source = readFileSync(new URL('../src/host/index.ts', import.meta.url), 'utf8');
  const module = { exports: {} };
  const context = {
    module, exports: module.exports, process: { platform, arch },
    require(id) {
      if (id === '@deepseek-ai/schemastery') return schema;
      if (id === '../shared/model.ts') return model;
      if (id === './capture.ts') return capture;
      if (id === './context.ts') return {};
      if (id === 'node:fs') return { lstatSync() { if (!hasHelper) throw new Error('ENOENT'); return { isFile: () => true }; } };
      if (id === './native-window-capture.ts') return { shouldRegisterNativeCaptureProvider };
      if (id === './window-capture-service.ts') return {WindowCaptureService: class {}};
      throw new Error(id);
    },
  };
  runInNewContext(transformSync(source, { loader: 'ts', format: 'cjs' }).code, context);
  assert.equal(module.exports.Config({}).captureMaskIdentity.get(), true, 'root Config 必须原位合并截图遮挡字段');
  assert.equal(module.exports.Config({ captureMaskIdentity: false }).captureMaskIdentity.get(), false);
  const settings = { configure(options, fiber) { calls.push(['configure', options, fiber]); return () => {}; } };
  const child = { settings, effect(fn) { return fn(); } };
  const ctx = { fiber: {}, plugin(service){calls.push(['service',service]);}, on(){calls.push(['observe']);}, inject(keys, callback) { assert.equal(keys.length, 1); assert.equal(keys[0], 'settings'); callback(child); } };
  const config = Config({ captureEnabled: false });
  module.exports.apply(ctx, config);
  assert.equal(calls.filter(([kind]) => kind === 'configure').length, 1);
  assert.equal(calls[0][0], 'configure');
  assert.equal(calls[0][1].auto, false);
  assert.equal(calls[1][0], 'capture');
  assert.equal(calls[1][1], ctx);
  assert.equal(calls.filter(([kind])=>kind==='service').length,serviceCount, `${platform}/${arch}/${hasHelper}`);
  assert.equal(calls.filter(([kind])=>kind==='observe').length,1);
 }
});
