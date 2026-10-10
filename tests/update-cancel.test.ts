/**
 * [INPUT]: 依赖生产更新控制器、官方 requestId 取消回包与阶段事件的可控桩。
 * [OUTPUT]: 验证真实取消确认、注册抢跑、终态竞态与重试围栏。
 * [POS]: 更新取消合同；不替代官方管理器和 Desktop 验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateController } from '../src/client/updater.ts';

function deferred<T = any>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const inventory = { ok: true, value: [{ name: '@daftai/pdsh', version: '0.1.0', installed: true, enabled: true }] };
const cancelled = { ok: true, value: { changed: false, application: 'cancelled' } };
const applied = { ok: true, value: { changed: true, application: 'applied' } };
const timeout = { ok: true, value: { changed: false, application: 'failed', failedAt: 'spec-host', packageResult: { kind: 'timeout' } } };
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

async function harness() {
  const installs: Array<{ options: any; reply: ReturnType<typeof deferred> }> = [];
  const cancellations: Array<{ id: string; reply: ReturnType<typeof deferred> }> = [];
  const manager = {
    async listBundles() { return inventory; },
    installBundle(_spec: string, options: any) {
      const reply = deferred(); installs.push({ options, reply }); return reply.promise;
    },
    cancelInstall(id: string) {
      const reply = deferred(); cancellations.push({ id, reply }); return reply.promise;
    },
  };
  const update = createUpdateController(manager, async () => [{ name: 'v0.2.0', commit: { sha: 'b'.repeat(40) } }], '0.1.0', undefined, () => () => {});
  await update.check();
  assert.equal(typeof update.cancel, 'function', '生产控制器必须提供真实取消');
  assert.equal(typeof update.installProgress, 'function', '官方阶段事件拥有注册确认');
  return { update, manager, installs, cancellations };
}

test('唯一 requestId 绑定安装和取消，重复点击不重发；确认后迟到安装回复不覆盖下一次操作', async () => {
  const h = await harness(); const installing = h.update.install(); await tick();
  const id = h.installs[0].options.requestId;
  assert.match(id, /^[a-f0-9-]{36}$/);
  assert.equal(h.update.getSnapshot().canCancel, true);
  const stopping = h.update.cancel(); void h.update.cancel();
  assert.equal(h.update.getSnapshot().phase, 'cancelling');
  assert.equal(h.cancellations.length, 1); assert.equal(h.cancellations[0].id, id);
  h.cancellations[0].reply.resolve({ ok: true, value: { status: 'cancelled' } }); await stopping;
  assert.equal(h.update.getSnapshot().phase, 'cancelled');
  await h.update.check(); const next = h.update.install(); await tick();
  assert.notEqual(h.installs[1].options.requestId, id);
  h.installs[0].reply.resolve(applied); await installing;
  assert.equal(h.update.getSnapshot().phase, 'installing');
  h.installs[1].reply.resolve(applied); await next;
  assert.equal(h.update.getSnapshot().phase, 'installed'); h.update.dispose();
});

test('not-running 不等于已取消；只在匹配的 Host 注册确认后重发一次', async () => {
  const h = await harness(); const installing = h.update.install(); await tick();
  const stopping = h.update.cancel();
  h.cancellations[0].reply.resolve({ ok: true, value: { status: 'not-running' } }); await stopping;
  assert.equal(h.update.getSnapshot().phase, 'cancelling');
  h.update.installProgress({ requestId: 'unrelated', phase: 'installing' }); await tick();
  assert.equal(h.cancellations.length, 1);
  h.update.installProgress({ requestId: h.installs[0].options.requestId, phase: 'installing' }); await tick();
  assert.equal(h.cancellations.length, 2);
  h.update.installProgress({ requestId: h.installs[0].options.requestId, phase: 'installing' }); await tick();
  assert.equal(h.cancellations.length, 2);
  h.cancellations[1].reply.resolve({ ok: true, value: { status: 'cancelled' } }); await tick();
  h.installs[0].reply.resolve(cancelled); await installing;
  assert.equal(h.update.getSnapshot().phase, 'cancelled'); h.update.dispose();
});

test('注册确认先于 not-running 回包也只补发一次，第二次 not-running 保留未知', async () => {
  const h = await harness(); const installing = h.update.install(); await tick();
  const stopping = h.update.cancel();
  h.update.installProgress({ requestId: h.installs[0].options.requestId, phase: 'installing' });
  h.cancellations[0].reply.resolve({ ok: true, value: { status: 'not-running' } }); await stopping; await tick();
  assert.equal(h.cancellations.length, 2);
  h.cancellations[1].reply.resolve({ ok: true, value: { status: 'not-running' } }); await tick();
  assert.equal(h.update.getSnapshot().cancelUnconfirmed, true);
  assert.notEqual(h.update.getSnapshot().phase, 'cancelled');
  h.update.installProgress({ requestId: h.installs[0].options.requestId, phase: 'installing' }); await tick();
  assert.equal(h.cancellations.length, 2);
  h.installs[0].reply.resolve(applied); await installing;
  assert.equal(h.update.getSnapshot().phase, 'installed'); h.update.dispose();
});

test('too-late 或 applying 撤回取消入口，真实安装结果继续结算', async () => {
  for (const viaEvent of [false, true]) {
    const h = await harness(); const installing = h.update.install(); await tick();
    if (viaEvent) {
      h.update.installProgress({ requestId: h.installs[0].options.requestId, phase: 'applying' });
      await h.update.cancel(); assert.equal(h.cancellations.length, 0);
    } else {
      const stopping = h.update.cancel();
      h.cancellations[0].reply.resolve({ ok: true, value: { status: 'too-late' } }); await stopping;
    }
    assert.equal(h.update.getSnapshot().phase, 'applying'); assert.ok(!h.update.getSnapshot().canCancel);
    h.installs[0].reply.resolve({ ok: true, value: { changed: true, application: 'restart-required' } }); await installing;
    assert.equal(h.update.getSnapshot().phase, 'restart'); h.update.dispose();
  }
});

test('取消异常不冒充取消成功，也不自动重发安装或取消', async () => {
  for (const rejects of [false, true]) {
    const h = await harness(); const installing = h.update.install(); await tick();
    const stopping = h.update.cancel();
    if (rejects) h.cancellations[0].reply.reject(new Error('private raw error'));
    else h.cancellations[0].reply.resolve({ ok: false, error: { message: 'private raw error' } });
    await stopping;
    assert.equal(h.update.getSnapshot().cancelUnconfirmed, true);
    assert.equal(h.update.getSnapshot().phase, 'installing');
    assert.ok(!JSON.stringify(h.update.getSnapshot()).includes('private'));
    h.installs[0].reply.resolve(timeout); await installing;
    assert.equal(h.installs.length, 1); assert.equal(h.cancellations.length, 1);
    assert.equal(h.update.getSnapshot().phase, 'failed'); h.update.dispose();
  }
});

test('清单前置检查尚未完成时取消，不向 Host 提交安装', async () => {
  const h = await harness(); const inventoryReply = deferred();
  h.manager.listBundles = () => inventoryReply.promise;
  const installing = h.update.install(); await h.update.cancel();
  assert.equal(h.update.getSnapshot().phase, 'cancelled');
  inventoryReply.resolve(inventory); await installing;
  assert.equal(h.installs.length, 0); assert.equal(h.cancellations.length, 0);
  assert.equal(h.update.getSnapshot().phase, 'cancelled'); h.update.dispose();
});

test('已经结算的成功不被迟到取消覆盖；dispose 不新增状态或重试', async () => {
  for (const dispose of [false, true]) {
    const h = await harness(); const installing = h.update.install(); await tick();
    const stopping = h.update.cancel();
    if (dispose) h.update.dispose();
    h.installs[0].reply.resolve(applied); await installing;
    h.cancellations[0].reply.resolve({ ok: true, value: { status: 'cancelled' } }); await stopping;
    assert.equal(h.update.getSnapshot().phase, dispose ? 'cancelling' : 'installed');
    assert.equal(h.installs.length, 1); h.update.dispose();
  }
});

test('没有取消意图时保留原有一次超时重试，每次使用不同 requestId', async () => {
  const h = await harness(); const installing = h.update.install(); await tick();
  h.installs[0].reply.resolve(timeout); await tick();
  assert.equal(h.installs.length, 2); assert.notEqual(h.installs[0].options.requestId, h.installs[1].options.requestId);
  const stopping = h.update.cancel(); assert.equal(h.cancellations[0].id, h.installs[1].options.requestId);
  h.installs[1].reply.resolve(cancelled); await installing;
  h.cancellations[0].reply.resolve({ ok: true, value: { status: 'not-running' } }); await stopping;
  assert.equal(h.update.getSnapshot().phase, 'cancelled'); h.update.dispose();
});


test('收到 Host installing 后才发取消，not-running 不重发', async () => {
  const h = await harness(); const installing = h.update.install(); await tick();
  h.update.installProgress({ requestId: h.installs[0].options.requestId, phase: 'installing' });
  const stopping = h.update.cancel(); h.cancellations[0].reply.resolve({ ok: true, value: { status: 'not-running' } }); await stopping;
  assert.equal(h.cancellations.length, 1); assert.equal(h.update.getSnapshot().cancelUnconfirmed, true);
  h.installs[0].reply.resolve(applied); await installing; h.update.dispose();
});

test('缺少事件或取消能力整组退让，订阅只创建一次并在 dispose 释放', async () => {
  for (const withCancel of [false, true]) for (const withEvents of [false, true]) {
    let installs = 0, subscribed = 0, released = 0, options;
    const manager = { async listBundles() { return inventory; },
      async installBundle(_spec, value) { installs++; options = value; return applied; },
      ...(withCancel ? { async cancelInstall() { assert.fail('dispose不自动取消'); } } : {}),
    };
    const update = createUpdateController(manager, async () => [{ name: 'v0.2.0', commit: { sha: 'b'.repeat(40) } }], '0.1.0', undefined,
      withEvents ? () => { subscribed++; return () => { released++; }; } : undefined);
    await update.check(); await update.install();
    assert.equal(installs, 1);
    if (withCancel && withEvents) { assert.equal(subscribed, 1); assert.match(options.requestId, /^[a-f0-9-]{36}$/); }
    else { assert.equal(subscribed, 0); assert.deepEqual(options, { enabled: true }); }
    update.dispose(); update.dispose(); assert.equal(released, withCancel && withEvents ? 1 : 0);
  }
});

test('初次清单挂起时本地取消立即释放 busy，迟到清单不能启动安装', async () => {
  const h = await harness(); const held = deferred(); h.manager.listBundles = () => held.promise;
  const installing = h.update.install(); await h.update.cancel();
  assert.equal(h.update.getSnapshot().phase, 'cancelled');
  assert.equal(h.installs.length, 0); assert.equal(h.cancellations.length, 0);
  h.manager.listBundles = async () => inventory; await h.update.check();
  assert.equal(h.update.getSnapshot().phase, 'available');
  held.resolve(inventory); await installing; assert.equal(h.installs.length, 0); h.update.dispose();
});

test('重试清单挂起时取消不发旧 ID，也不启动第二次安装', async () => {
  const h = await harness(); const installing = h.update.install(); await tick();
  const held = deferred(); h.manager.listBundles = () => held.promise;
  h.installs[0].reply.resolve(timeout); await tick();
  const stopping = h.update.cancel();
  if (h.cancellations[0]) h.cancellations[0].reply.resolve({ ok: true, value: { status: 'not-running' } });
  await stopping; assert.equal(h.cancellations.length, 0);
  assert.equal(h.update.getSnapshot().phase, 'cancelled');
  held.resolve(inventory); await installing; assert.equal(h.installs.length, 1); h.update.dispose();
});

test('applying 已确认时迟到取消失败不再误报取消未知', async () => {
  const h = await harness(); const installing = h.update.install(); await tick();
  const stopping = h.update.cancel();
  h.update.installProgress({ requestId: h.installs[0].options.requestId, phase: 'applying' });
  h.cancellations[0].reply.reject(new Error('synthetic')); await stopping;
  assert.equal(h.update.getSnapshot().phase, 'applying'); assert.ok(!h.update.getSnapshot().cancelUnconfirmed);
  h.installs[0].reply.resolve(applied); await installing; h.update.dispose();
});
