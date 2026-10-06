/**
 * [INPUT]: 依赖实际共享身份、locale、编辑偏好、更新控制器与版本化 capture 业务闭包，由 esbuild 注入候选包身份。
 * [OUTPUT]: 验证 RC 配置/浏览器偏好隔离、更新无副作用及业务闭包只读自身 accepted Settings。
 * [POS]: 临时 RC 的运行身份与设置隔离合同；不替代官方 Manager 共存或 Desktop UI 验收。
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

async function captureBusiness() {
  const result = await build({ entryPoints: ['src/host/capture-runtime.ts'], bundle: true, write: false,
    platform: 'node', format: 'cjs', target: 'es2022', logLevel: 'silent',
    define: {
      __PDSH_BUNDLE_NAME__: JSON.stringify('@daftai/pdsh-rc'),
      __PDSH_VERSION__: JSON.stringify('0.3.5-rc.1'),
    } });
  const module = { exports: {} as any };
  runInNewContext(result.outputFiles[0].text, {
    module, exports: module.exports, AbortController, Buffer, URL, process,
    require: createRequire(import.meta.url),
  });
  return module.exports;
}

async function captureTerminal(instance: any): Promise<string | undefined> {
  // +--- 预先取消；enabled 时只证明业务合同，不启动原生 helper 或申请系统权限。 ---+
  const signal = new AbortController();
  signal.abort();
  const frames: Array<{ readonly status?: string }> = [];
  for await (const frame of instance.capture(signal.signal)) frames.push(frame);
  return frames.at(-1)?.status;
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

test('RC 版本化业务闭包只读自身 accepted Settings，并按调用切换 capture lifetime', async () => {
  const business = await captureBusiness();
  assert.equal(business.version, '0.3.5-rc.1');
  assert.equal(business.contract, 'pdsh-capture-runtime-v2');
  const accepted = { captureEnabled: true };
  const ctx = { settings: { describe: () => [
    { ns: 'pdsh', value: { captureEnabled: false } },
    { ns: 'pdsh-rc', value: accepted },
  ] }, logger: { info() {} } };
  const instance = business.create(ctx);
  try {
    // +--- 读错 stable namespace 会得到 disposed；正确 RC 值启用后因调用方预取消而返回 cancelled。 ---+
    assert.equal(await captureTerminal(instance), 'cancelled');
    accepted.captureEnabled = false;
    assert.equal(await captureTerminal(instance), 'disposed');
    accepted.captureEnabled = true;
    assert.equal(await captureTerminal(instance), 'cancelled');
  } finally { await instance.dispose(); }
});

test('RC 业务闭包在 Settings 迟挂载后按调用恢复，缺失或 stable 值均不启用', async () => {
  const business = await captureBusiness();
  let sections: Array<{ ns: string; value: { captureEnabled: boolean } }> = [
    { ns: 'pdsh', value: { captureEnabled: true } },
  ];
  const instance = business.create({ settings: { describe: () => sections }, logger: { info() {} } });
  try {
    assert.equal(await captureTerminal(instance), 'disposed');
    // +--- stable Config 后到也不能代替 RC；只有当前 root namespace 的 accepted 投影恢复能力。 ---+
    sections = [
      { ns: 'pdsh', value: { captureEnabled: true } },
      { ns: 'pdsh-rc', value: { captureEnabled: true } },
    ];
    assert.equal(await captureTerminal(instance), 'cancelled');
    sections = [{ ns: 'pdsh', value: { captureEnabled: true } }];
    assert.equal(await captureTerminal(instance), 'disposed');
  } finally { await instance.dispose(); }
});
