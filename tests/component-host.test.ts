/**
 * [INPUT]: 依赖单一 pdsh Config、Cordis 所属 Fiber volatile-update、capture-route 与可控 bridge stub。
 * [OUTPUT]: 验证单 Host route 的 owner-scoped 开关、同步停用/桥归还/重挂、Main 世代围栏及 root 相对 Main 解析。
 * [POS]: 跨 Host 边界回归；不写用户 profile、不启动 Main 调试接口或实际 socket。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';
import { runInNewContext } from 'node:vm';
import schema from '@deepseek-ai/schemastery';
import * as captureExport from '../src/shared/capture-export.ts';
import { createCaptureRoute } from '../src/host/capture-route.ts';
import { createCaptureTrace } from '../src/shared/capture-trace.ts';
import { Config } from '../src/host/index.ts';

const captureSource = readFileSync(new URL('../src/host/capture.ts', import.meta.url), 'utf8');
function loadCapture({ url = 'file:///fixture/pdsh/index.js', windows = false, identity = () => '/fixture/Main 2026', opener } = {}) {
  const module = { exports: {} };
  const context = {
    module, exports: module.exports, URL, Buffer,
    process: { ppid: 123 },
    require(id) {
      if (id === 'node:url') return { fileURLToPath(value) { return fileURLToPath(value, { windows }); } };
      if (id === 'node:os') return { homedir: () => '/fixture/home' };
      if (id === 'node:path') return { join };
      if (id === './capture-bootstrap.ts') return {
        readMainIdentity: identity,
        openCaptureBridge: opener ?? (() => Promise.resolve({ capture: async () => ({}), save: async () => ({ outcome: 'saved' }), cancel() {}, dispose: async () => {} })),
      };
      if (id === './capture-route.ts') return { createCaptureRoute };
      if (id === '@deepseek-ai/schemastery') return schema;
      if (id === '../shared/capture-export.ts') return captureExport;
      if (id === '../shared/capture-trace.ts') return { createCaptureTrace };
      throw new Error(`unexpected import ${id}`);
    },
  };
  context.exports = module.exports;
  runInNewContext(transformSync(captureSource, { loader: 'ts', format: 'cjs', define: { 'import.meta.url': JSON.stringify(url) } }).code, context);
  return { api: module.exports, context, guard() {
    runInNewContext('globalThis.__pdshGuardSnapshot = globalThis[Symbol.for("@daftai/pdsh.main-lifecycle-guard.v1")]', context);
    return context.__pdshGuardSnapshot;
  } };
}

function fixture() {
  const routes = new Map(), disposers = [], writes = [], listeners = new Set(), fiber = {};
  const ctx = {
    fiber, root: { loader: { await: async () => {} } },
    logger: { warn(message) { writes.push(['warn', message]); } },
    settings: {
      describe: () => [{ ns: 'pdsh', value: {}, revision: 3 }],
      async mutate(...args) { writes.push(args); return true; },
    },
    on(name, listener) {
      assert.equal(name, 'loader/volatile-update');
      const registration = { owner: fiber, listener };
      listeners.add(registration);
      const remove = () => listeners.delete(registration);
      disposers.push(remove);
      return remove;
    },
    inject(_keys, callback) { callback(ctx); },
    effect(effect) { const cleanup = effect(); if (typeof cleanup === 'function') disposers.push(cleanup); return cleanup; },
    connection: { fetch: { register(route) {
      return ctx.effect(() => {
        assert.equal(routes.has(route.path), false);
        routes.set(route.path, route);
        return async () => { routes.delete(route.path); };
      });
    } } },
  };
  return {
    ctx, routes, disposers, writes,
    emitVolatileUpdate(owner, paths) {
      for (const registration of listeners) {
        if (registration.owner === owner) registration.listener(paths);
      }
    },
  };
}

async function dispose(h) {
  for (const cleanup of h.disposers.splice(0).reverse()) await cleanup();
}

test('唯一 Host Config 保留 pdsh 地址和既有身份/标题字段，不引入子 namespace', () => {
  assert.equal(Config({}).maskTitles.get(), false);
  assert.equal(Config({}).maskIdentity.get(), false);
  assert.equal(Config({ nickname: '保留偏好', maskIdentity: false, useAccountAvatar: true }).nickname.get(), '保留偏好');
  assert.equal(Config({ maskTitles: true }).maskTitles.get(), true);
  assert.equal(Config({}).captureEnabled.get(), true);
});

test('Host capture effect 只在 root captureEnabled 为真时注册 route，Fiber 停用会取消并注销', async () => {
  let enabled = true, disposedBridge = false, bridgeSignal;
  const connections = [];
  const loaded = loadCapture({ opener: async (_path, signal) => {
    bridgeSignal = signal;
    const connection = {
      async capture() { return {}; }, async save() { return { outcome: 'saved' }; }, cancel() {},
      async dispose() { disposedBridge = true; },
    };
    connections.push(connection);
    return connection;
  } });
  const h = fixture();
  const config = Config({ captureEnabled: true });
  loaded.api.apply(h.ctx, { ...config, captureEnabled: { get: () => enabled } });
  await Promise.resolve();
  assert.deepEqual([...h.routes.keys()], ['/api/pdsh.capture']);

  const response = await h.routes.get('/api/pdsh.capture').fetch(new Request('http://localhost/api/pdsh.capture', {
    method: 'POST', body: JSON.stringify({ type: 'client-request', rpcId: 'fixture', method: 'pdsh.capture', payload: { op: 'capture', owner: '11111111-1111-4111-8111-111111111111', requestId: '22222222-2222-4222-8222-222222222222' } }),
  }));
  assert.equal((await response.json()).result.ok, true);
  assert.equal(connections.length, 1);

  enabled = false;
  await dispose(h);
  assert.equal(bridgeSignal.aborted, true, 'Fiber disposer must cancel an active route-owned session');
  assert.equal(disposedBridge, true);
  assert.equal(h.routes.size, 0);

  const restored = fixture();
  loaded.api.apply(restored.ctx, { ...config, captureEnabled: { get: () => true } });
  await Promise.resolve();
  assert.deepEqual([...restored.routes.keys()], ['/api/pdsh.capture'], '恢复 Host 后 route 可重新注册到原官方路径');
  await dispose(restored);

  const disabled = fixture();
  loaded.api.apply(disabled.ctx, { ...config, captureEnabled: { get: () => false } });
  await Promise.resolve();
  assert.equal(disabled.routes.size, 0, 'disabled Host must not register the exact route');
  await dispose(disabled);
});

test('Host capture follows only its owner-scoped captureEnabled volatile update', async () => {
  let enabled = true, disposedBridge = false, bridgeSignal;
  const connections = [];
  const loaded = loadCapture({ opener: async (_path, signal) => {
    bridgeSignal = signal;
    const connection = {
      async capture() { return {}; }, async save() { return { outcome: 'saved' }; }, cancel() {},
      async dispose() { disposedBridge = true; },
    };
    connections.push(connection);
    return connection;
  } });
  const h = fixture();
  const config = { ...Config({ captureEnabled: true }), captureEnabled: { get: () => enabled } };
  loaded.api.apply(h.ctx, config);
  assert.equal(h.routes.size, 1);
  const originalRoute = h.routes.get('/api/pdsh.capture');

  h.emitVolatileUpdate(h.ctx.fiber, [['maskIdentity']]);
  assert.equal(h.routes.get('/api/pdsh.capture'), originalRoute, 'identity changes must not recreate the camera route');

  const owner = '11111111-1111-4111-8111-111111111111';
  const requestId = '22222222-2222-4222-8222-222222222222';
  const request = () => new Request('http://localhost/api/pdsh.capture', {
    method: 'POST', body: JSON.stringify({ type: 'client-request', rpcId: 'volatile-update', method: 'pdsh.capture', payload: { op: 'capture', owner, requestId } }),
  });
  const opened = await originalRoute.fetch(request());
  assert.equal((await opened.json()).result.ok, true);
  assert.equal(connections.length, 1);

  enabled = false;
  h.emitVolatileUpdate({}, [['captureEnabled']]);
  assert.equal(h.routes.get('/api/pdsh.capture'), originalRoute, 'Loader volatile updates are scoped to their owner fiber');
  assert.equal(bridgeSignal.aborted, false, 'an unrelated fiber cannot cancel this Host bridge');

  h.emitVolatileUpdate(h.ctx.fiber, [['captureEnabled']]);
  assert.equal(h.routes.size, 0, 'the owning Host must synchronously withdraw its exact route');
  assert.equal(bridgeSignal.aborted, true, 'the same synchronous update must abort owned capture work');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(disposedBridge, true, 'route retirement must dispose its bridge before reopening');

  enabled = true;
  h.emitVolatileUpdate(h.ctx.fiber, [['captureEnabled']]);
  assert.equal(h.routes.size, 1, 'reenabling capture must restore the single exact route');
  const restoredRoute = h.routes.get('/api/pdsh.capture');
  assert.notEqual(restoredRoute, originalRoute, 'reenabling creates a fresh route owner');
  await new Promise(resolve => setImmediate(resolve));
  const reopened = await restoredRoute.fetch(request());
  assert.equal((await reopened.json()).result.ok, true, 'the restored route becomes usable after its dispose barrier');
  assert.equal(connections.length, 2);
  await dispose(h);
  assert.equal(h.routes.size, 0);
});

test('Main 身份首次读取失败后的关闭未知不会因 Host 重挂载被清除', async () => {
  let identity;
  const loaded = loadCapture({ identity: () => { if (!identity) throw Error('fixture identity unavailable'); return identity; } });
  const h = fixture(), config = Config({});
  loaded.api.apply(h.ctx, config);
  const guard = loaded.guard()?.guard;
  assert.ok(guard);
  guard.error = Error('PDSH_MAIN_INSPECTOR_CLOSE_UNCONFIRMED');
  identity = '/app/Main first-start';
  const h2 = fixture();
  loaded.api.apply(h2.ctx, config);
  assert.equal(loaded.guard().guard, guard);
  assert.ok(loaded.guard().guard.error);
  await dispose(h);
  await dispose(h2);
});

test('Host Main 模块按根入口相对 URL 解析，支持 POSIX、盘符、UNC、空格与中文', async () => {
  assert.match(captureSource, /new URL\('\.\/main\.cjs', import\.meta\.url\)/);
  for (const [url, windows, expected] of [
    ['file:///opt/DSH%20Plugins/%E4%B8%AD%E6%96%87/index.js', false, '/opt/DSH Plugins/中文/main.cjs'],
    ['file:///D:/Apps/DSH%20Plugins/%E4%B8%AD%E6%96%87/index.js', true, 'D:\\Apps\\DSH Plugins\\中文\\main.cjs'],
    ['file://server/share/PDSH%23test/index.js', true, '\\\\server\\share\\PDSH#test\\main.cjs'],
  ] as const) {
    let opened;
    const loaded = loadCapture({ url, windows, opener: async value => {
      opened = value;
      return { capture: async () => ({}), save: async () => ({ outcome: 'saved' }), cancel() {}, dispose: async () => {} };
    } });
    const h = fixture(), config = Config({});
    loaded.api.apply(h.ctx, config);
    await Promise.resolve();
    const control = [...h.routes.values()][0];
    const owner = '11111111-1111-4111-8111-111111111111';
    const requestId = '22222222-2222-4222-8222-222222222222';
    const response = await control.fetch(new Request('http://localhost/api/pdsh.capture', { method: 'POST',
      body: JSON.stringify({ type: 'client-request', rpcId: 'url-fixture', method: 'pdsh.capture', payload: { op: 'capture', owner, requestId } }),
    }));
    await response.json();
    assert.equal(opened, expected);
    await dispose(h);
  }
});
