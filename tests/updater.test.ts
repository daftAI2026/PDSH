/**
 * [INPUT]: 依赖版本标签选择与官方 pluginManager 适配器的可控桩。
 * [OUTPUT]: 验证仅高版本固定 SHA 可更新、显式确认、失败保留尝试的目标版本和卸载后不通知。
 * [POS]: 自更新合同；不以网络 fixture 充当 Desktop 远端安装证明。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateController, selectLatestTag } from '../src/client/updater.ts';

const old = { name: 'v0.1.0', commit: { sha: 'a'.repeat(40) } };
const newer = { name: 'v0.2.0', commit: { sha: 'b'.repeat(40) } };

test('只接受仓库稳定 semver tag 与40位 SHA，排序不信任 API 返回次序', () => {
  assert.deepEqual(selectLatestTag([newer, old, { name: 'v0.3.0-beta.1', commit: { sha: 'c'.repeat(40) } },
    { name: 'v0.9.0', commit: { sha: 'bad' } }], '0.1.0'), { version: '0.2.0', sha: 'b'.repeat(40) });
  assert.equal(selectLatestTag([old], '0.1.0'), null);
});

test('仅显式安装高版本，调用官方管理器固定 SHA，不自行重启或改配置', async () => {
  const installs: Array<{spec: string; options: unknown}> = [];
  const manager = {
    async listBundles() { return { ok: true, value: [{ name: '@daftai/pdsh', version: '0.1.0', installed: true, enabled: true }] }; },
    async installBundle(spec: string, options: unknown) {
      installs.push({ spec, options });
      return { ok: true, value: { changed: true, application: 'restart-required', stage: 'enable', bundle: '@daftai/pdsh' } };
    },
  };
  const update = createUpdateController(manager, async () => [newer, old], '0.1.0');
  await update.check();
  assert.deepEqual(update.getSnapshot(), { phase: 'available', version: '0.2.0' });
  assert.equal(installs.length, 0);
  await update.install();
  assert.deepEqual(installs, [{ spec: `github:daftAI2026/PDSH#${'b'.repeat(40)}`, options: { enabled: true } }]);
  assert.deepEqual(update.getSnapshot(), { phase: 'restart', version: '0.2.0' });
  update.dispose();
});

test('宿主没有唯一已安装自身时拒绝更新；失败不报告成功', async () => {
  let called = 0;
  const manager = { async listBundles() { return { ok: true, value: [] }; }, async installBundle() { ++called; return { ok: true, value: { changed: false } }; } };
  const update = createUpdateController(manager, async () => [newer], '0.1.0');
  await update.check();
  assert.equal(update.getSnapshot().phase, 'failed');
  assert.equal(update.getSnapshot().operation, 'check');
  await update.install();
  assert.equal(called, 0);
  update.dispose();
});

test('宿主即时应用、安装失败与卸载期间异步返回均不假报重启', async () => {
  const manager = {
    async listBundles() { return { ok: true, value: [{ name: '@daftai/pdsh', version: '0.1.0', installed: true, enabled: true }] }; },
    async installBundle() { return { ok: true, value: { changed: true, application: 'applied' } }; },
  };
  const update = createUpdateController(manager, async () => [newer], '0.1.0');
  await update.check(); await update.install();
  assert.deepEqual(update.getSnapshot(), { phase: 'installed', version: '0.2.0' });
  update.dispose();
  const failed = createUpdateController({ ...manager, async installBundle() { return { ok: true, value: { changed: false, application: 'failed' } }; } }, async () => [newer], '0.1.0');
  await failed.check(); await failed.install(); assert.deepEqual(failed.getSnapshot(), { phase: 'failed', operation: 'install', version: '0.2.0' }); failed.dispose();
  let finish: (value: (typeof newer)[]) => void;
  const held = new Promise<(typeof newer)[]>(resolve => { finish = resolve; });
  const pending = createUpdateController(manager, () => held, '0.1.0');
  const check = pending.check(); pending.dispose(); finish([newer]); await check;
  assert.equal(pending.getSnapshot().phase, 'checking');
});

test('安装配置应用失败但磁盘清单已前移时，failed 结果仍保留目标版本', async () => {
  let installedVersion = '0.1.0';
  const manager = {
    async listBundles() { return { ok: true, value: [{ name: '@daftai/pdsh', version: installedVersion, installed: true, enabled: true }] }; },
    async installBundle() {
      installedVersion = '0.2.0';
      return { ok: true, value: { changed: true, application: 'failed' } };
    },
  };
  const update = createUpdateController(manager, async () => [newer], '0.1.0');
  await update.check();
  await update.install();
  assert.deepEqual(update.getSnapshot(), { phase: 'failed', operation: 'install', version: '0.2.0' });
  update.dispose();
});

test('远端封套失败不能误判为已安装；不访问网络', async () => {
  const manager = { async listBundles() { return { ok: false, error: { message: 'offline' } }; }, async installBundle() { throw new Error('must not install'); } };
  const update = createUpdateController(manager, async () => { throw new Error('must not fetch'); }, '0.1.0');
  await update.check(); assert.equal(update.getSnapshot().phase, 'failed'); update.dispose();
});
