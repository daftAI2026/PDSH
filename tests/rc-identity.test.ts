/**
 * [INPUT]: 依赖实际共享身份、locale、编辑偏好与更新控制器，由 esbuild 注入候选包身份。
 * [OUTPUT]: 验证 RC 配置/浏览器偏好隔离及更新无网络、无安装；正式身份保持兼容。
 * [POS]: 临时 RC 的运行身份合同；不替代官方 manager 共存或 Desktop UI 验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';

async function runtime(name?: string) {
  const result = await build({ stdin: { contents: `
    export * from './src/shared/components.ts';
    export { NS } from './src/shared/locales.ts';
    export { CAPTURE_PREFERENCES_KEY } from './src/client/capture/preferences.ts';
    export { createUpdateController } from './src/client/updater.ts';
  `, resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'cjs',
    define: name ? { __PDSH_BUNDLE_NAME__: JSON.stringify(name) } : {} });
  const module = { exports: {} as any };
  runInNewContext(result.outputFiles[0].text, { module, exports: module.exports });
  return module.exports;
}

test('正式包默认身份保持兼容，RC 包配置与编辑偏好独立', async () => {
  for (const name of [undefined, '@daftai/pdsh', '@daftai/pdsh-rc']) {
    const value = await runtime(name);
    const rc = name === '@daftai/pdsh-rc';
    assert.equal(value.BUNDLE_NAME, name ?? '@daftai/pdsh');
    assert.equal(value.ROOT_ENTRY_ID, rc ? 'pdsh-rc' : 'pdsh');
    assert.equal(value.NS, value.ROOT_ENTRY_ID);
    assert.equal(value.CAPTURE_PREFERENCES_KEY, `${value.ROOT_ENTRY_ID}-window-capture-prefs`);
    assert.equal(value.IS_RC_BUNDLE, rc);
  }
});

test('RC 即使直接调用更新控制器也不探测正式版本、不安装或触碰正式包', async () => {
  const { createUpdateController } = await runtime('@daftai/pdsh-rc');
  let effects = 0;
  const forbidden = async () => { effects++; throw new Error('RC must not call this boundary'); };
  const controller = createUpdateController({ listBundles: forbidden, installBundle: forbidden }, forbidden, '0.3.0-rc.1');
  await controller.check();
  await controller.install();
  assert.equal(effects, 0);
  assert.equal(controller.getSnapshot().phase, 'idle');
  controller.dispose();
});

test('RC 原生能力只读取自身 accepted Settings，不误读停用的正式配置', async () => {
  const result = await build({ entryPoints: ['src/host/window-capture-service.ts'], bundle: true, write: false,
    platform: 'node', format: 'cjs', target: 'es2022', external: ['@deepseek-ai/dsh-typert-protocol'],
    define: { __PDSH_BUNDLE_NAME__: JSON.stringify('@daftai/pdsh-rc') }, logLevel: 'silent' });
  const module = { exports: {} as any };
  const requireNode = createRequire(import.meta.url);
  runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, AbortController, Buffer,
    require(id) {
      if (id === '@deepseek-ai/dsh-typert-protocol') return {
        TypertRemoteService: class { ctx: unknown; constructor(ctx: unknown) { this.ctx = ctx; } },
        Remote: () => () => {},
      };
      return requireNode(id);
    },
  });
  const accepted = { captureEnabled: true };
  const observations: unknown[] = [];
  const ctx = { settings: { describe: () => [
    { ns: 'pdsh', value: { captureEnabled: false } },
    { ns: 'pdsh-rc', value: accepted },
  ] }, effect() {}, logger: { info(_message: string, enabled: unknown) { observations.push(enabled); } } };
  const service = new module.exports.WindowCaptureService(ctx);
  assert.equal(observations.at(-1), true);
  accepted.captureEnabled = false;
  service.refreshCaptureEnabled();
  assert.equal(observations.at(-1), false);
  // +--- Host 可能先建 service 后公开 Settings；只构造 iterable，不拉流或启动 helper。 ---+
  let sections: unknown[] = [];
  ctx.settings.describe = () => sections as any;
  const lateService = new module.exports.WindowCaptureService(ctx);
  assert.equal(observations.at(-1), false);
  assert.equal(lateService.lifetime.signal.aborted, true);
  sections = [{ ns: 'pdsh-rc', value: { captureEnabled: true } }];
  lateService.capture(new AbortController().signal);
  assert.equal(lateService.lifetime.signal.aborted, false);
});
