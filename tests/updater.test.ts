/**
 * [INPUT]: 依赖版本标签选择与官方 pluginManager 适配器的可控桩。
 * [OUTPUT]: 验证仅高版本固定 SHA 可更新、显式确认、失败保留目标版本；第四参只有确认实现后才将 restart-required 标为 installed，旧三参与卸载围栏不变。
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

test('restart-required 只有 activation hook 确认目标实现已加载才升级为 installed', async () => {
  const events: string[] = [];
  const manager = {
    async listBundles() { return { ok: true, value: [{ name: '@daftai/pdsh', version: '0.1.0', installed: true, enabled: true }] }; },
    async installBundle() { events.push('install'); return { ok: true, value: { changed: true, application: 'restart-required' } }; },
  };
  const update = createUpdateController(manager, async () => [newer], '0.1.0', async targetVersion => {
    events.push(`activate:${targetVersion}`);
    return true;
  });
  await update.check(); await update.install();
  assert.deepEqual(events, ['install', 'activate:0.2.0']);
  assert.deepEqual(update.getSnapshot(), { phase: 'installed', version: '0.2.0' });
  update.dispose();
});

test('activation 未确认或抛错时保留 restart，不把已安装误报为已加载', async () => {
  const manager = {
    async listBundles() { return { ok: true, value: [{ name: '@daftai/pdsh', version: '0.1.0', installed: true, enabled: true }] }; },
    async installBundle() { return { ok: true, value: { changed: true, application: 'restart-required' } }; },
  };
  for (const activate of [async () => false, async () => { throw new Error('activation unavailable'); }]) {
    const update = createUpdateController(manager, async () => [newer], '0.1.0', activate);
    await update.check(); await update.install();
    assert.deepEqual(update.getSnapshot(), { phase: 'restart', version: '0.2.0' });
    update.dispose();
  }
});

test('卸载期间 activation hook 迟到不能发布 installed 状态', async () => {
  const manager = {
    async listBundles() { return { ok: true, value: [{ name: '@daftai/pdsh', version: '0.1.0', installed: true, enabled: true }] }; },
    async installBundle() { return { ok: true, value: { changed: true, application: 'restart-required' } }; },
  };
  let entered!: () => void, settle!: (value: boolean) => void;
  const activationStarted = new Promise<void>(resolve => { entered = resolve; });
  const activationResult = new Promise<boolean>(resolve => { settle = resolve; });
  const update = createUpdateController(manager, async () => [newer], '0.1.0', () => {
    entered();
    return activationResult;
  });
  await update.check();
  const installing = update.install();
  let hookStarted = false;
  await Promise.race([activationStarted.then(() => { hookStarted = true; }), installing]);
  if (!hookStarted) {
    update.dispose();
    assert.fail('restart-required install must await the activation hook');
  }
  assert.deepEqual(update.getSnapshot(), { phase: 'installing', version: '0.2.0' });
  update.dispose();
  settle(true);
  await installing;
  assert.deepEqual(update.getSnapshot(), { phase: 'installing', version: '0.2.0' });
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


test('官方明确回滚的网络失败保留白名单原因，未知或已变化的结果不猜测', async () => {
  const cases = [
    { value: { changed: false, application: 'failed', packageResult: { kind: 'timeout', output: '/private/path secret' } }, reason: 'timeout' },
    { value: { changed: false, application: 'failed', packageResult: { kind: 'network' } }, reason: 'network' },
    { value: { changed: true, application: 'failed', packageResult: { kind: 'timeout' } }, reason: undefined },
    { value: { changed: false, application: 'failed', packageResult: { kind: 'permission' } }, reason: 'permission' },
  ]
  for (const { value, reason } of cases) {
    let installs = 0
    const manager = {
      async listBundles() { return { ok: true, value: [{ name: '@daftai/pdsh', version: '0.1.0', installed: true, enabled: true }] } },
      async installBundle() { installs++; return { ok: true, value } },
    }
    const update = createUpdateController(manager, async () => [newer], '0.1.0')
    await update.check(); await update.install()
    assert.deepEqual(update.getSnapshot(), { phase: 'failed', operation: 'install', version: '0.2.0', ...(reason ? { reason } : {}) })
    assert.equal(installs, 1, '不把未知结果自动重装，也不自动重试网络失败')
    assert.ok(!JSON.stringify(update.getSnapshot()).includes('/private/path'))
    update.dispose()
  }
})


test('仅未改变安装状态的 Git 预检查超时自动重试同一固定提交一次', async () => {
  const calls: string[] = []
  const manager = {
    async listBundles() { return { ok: true, value: [{ name: '@daftai/pdsh', version: '0.1.0', installed: true, enabled: true }] } },
    async installBundle(spec: string) {
      calls.push(spec)
      return calls.length === 1
        ? { ok: true, value: { changed: false, application: 'failed', failedAt: 'spec-host', packageResult: { kind: 'timeout' } } }
        : { ok: true, value: { changed: true, application: 'applied' } }
    },
  }
  const update = createUpdateController(manager, async () => [newer], '0.1.0')
  await update.check(); await update.install()
  assert.deepEqual(calls, Array(2).fill(`github:daftAI2026/PDSH#${'b'.repeat(40)}`))
  assert.deepEqual(update.getSnapshot(), { phase: 'installed', version: '0.2.0' })
  update.dispose()
})

test('重试最多一次；PNPM超时、Remote未知结果、磁盘前移与取消均不自动重试', async () => {
  const values = [
    { changed: false, application: 'failed', failedAt: 'spec-host', packageResult: { kind: 'timeout' } },
    { changed: false, application: 'failed', failedAt: 'registry', packageResult: { kind: 'timeout' } },
    { changed: true, application: 'failed', failedAt: 'spec-host', packageResult: { kind: 'timeout' } },
    { changed: false, application: 'cancelled', failedAt: 'spec-host', packageResult: { kind: 'timeout' } },
  ]
  for (const [index, value] of values.entries()) {
    let calls = 0
    const manager = {
      async listBundles() { return { ok: true, value: [{ name: '@daftai/pdsh', version: '0.1.0', installed: true, enabled: true }] } },
      async installBundle() { calls++; return { ok: true, value } },
    }
    const update = createUpdateController(manager, async () => [newer], '0.1.0')
    await update.check(); await update.install()
    assert.equal(calls, index === 0 ? 2 : 1)
    assert.equal(update.getSnapshot().phase, 'failed')
    update.dispose()
  }
  for (const result of ['transport', 'dispose']) {
    let calls = 0
    const manager = {
      async listBundles() { return { ok: true, value: [{ name: '@daftai/pdsh', version: '0.1.0', installed: true, enabled: true }] } },
      async installBundle() {
        calls++
        if (result === 'transport') throw new Error('unknown transport result')
        update.dispose()
        return { ok: true, value: values[0] }
      },
    }
    const update = createUpdateController(manager, async () => [newer], '0.1.0')
    await update.check(); await update.install()
    assert.equal(calls, 1)
  }
})


test('所有已知失败只输出本地白名单，不输出 Host 原始诊断', async () => {
  for (const kind of ['network', 'timeout', 'integrity', 'disk-full', 'permission', 'pnpm-missing', 'build-blocked', 'not-found', 'no-matching-version']) {
    const manager = {
      async listBundles() { return {ok:true,value:[{name:'@daftai/pdsh',version:'0.1.0',installed:true,enabled:true}]} },
      async installBundle() { return {ok:true,value:{changed:false,application:'failed',packageResult:{kind, output:'/private/secret raw diagnostic'}}} },
    }
    const update = createUpdateController(manager, async () => [newer], '0.1.0')
    await update.check(); await update.install()
    assert.equal(update.getSnapshot().reason, kind)
    assert.ok(!JSON.stringify(update.getSnapshot()).includes('raw diagnostic'))
    update.dispose()
  }
})


test('首次安装前的清单等待中卸载，不再触发安装副作用', async () => {
  let release!: (value: any) => void
  let reads = 0, installs = 0
  const inventory = {ok:true,value:[{name:'@daftai/pdsh',version:'0.1.0',installed:true,enabled:true}]}
  const manager = {
    async listBundles() { return ++reads === 1 ? inventory : new Promise(resolve => {release = resolve}) },
    async installBundle() { installs++; return {ok:true,value:{changed:true,application:'applied'}} },
  }
  const update = createUpdateController(manager as any, async () => [newer], '0.1.0')
  await update.check()
  const pending = update.install()
  update.dispose(); release(inventory)
  await pending
  assert.equal(installs, 0)
})


test('首次 Git 超时重试后 PNPM 超时，不误报 GitHub 再次超时', async () => {
  let installs = 0
  const manager = {
    async listBundles() { return {ok:true,value:[{name:'@daftai/pdsh',version:'0.1.0',installed:true,enabled:true}]} },
    async installBundle() { return {ok:true,value:{changed:false,application:'failed',failedAt: ++installs === 1 ? 'spec-host' : 'registry',packageResult:{kind:'timeout'}}} },
  }
  const update = createUpdateController(manager, async () => [newer], '0.1.0')
  await update.check(); await update.install()
  assert.equal(installs, 2)
  assert.deepEqual(update.getSnapshot(), {phase:'failed',operation:'install',version:'0.2.0',reason:'timeout'})
  update.dispose()
})


test('重试进度通知触发卸载，不能继续第二次安装', async () => {
  let installs = 0
  const manager = {
    async listBundles() { return {ok:true,value:[{name:'@daftai/pdsh',version:'0.1.0',installed:true,enabled:true}]} },
    async installBundle() { installs++; return {ok:true,value:{changed:false,application:'failed',failedAt:'spec-host',packageResult:{kind:'timeout'}}} },
  }
  const update = createUpdateController(manager, async () => [newer], '0.1.0')
  update.subscribe(() => {if (update.getSnapshot().attempt === 2) update.dispose()})
  await update.check(); await update.install()
  assert.equal(installs, 1)
})
