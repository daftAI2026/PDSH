/**
 * [INPUT]: 依赖唯一生成 Client、Cordis 4.0.4 真注册器、Mac/Win Navigator fixture、官方 Remote namespace 与遗留桥负例。
 * [OUTPUT]: 验证截图字段、两入口注册和 Remote 撤回。
 * [POS]: Client 服务图回归；不直调 apply 绕过注入，React root 仅作生命周期桩，不冒充界面或 Main 取像。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TextEncoder } from 'node:util';
import { runInNewContext } from 'node:vm';
import { Context } from '@deepseek-ai/cordis';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { JSDOM } from 'jsdom';
import { DEFAULTS } from '../src/shared/model.ts';
import { DEFAULT_CAPTURE_EXPORT } from '../src/shared/capture-export.ts';

function fixture(platform = 'MacIntel') {
  const dom = new JSDOM(`<body><main>原页面</main><div data-slot="settings.launcher"><button type="button" data-collapsed="false" data-signed-out="false" aria-haspopup="menu" aria-expanded="false"><span><img src="native.png"></span><span>原身份</span></button></div><div data-slot="sidebar.workspaces"><div><div><div><div><button type="button" class="native-search" aria-label="搜索会话" aria-expanded="false"><svg viewBox="0 0 16 16" style="width:14px;height:14px;stroke-width:1"><circle cx="7" cy="7" r="4"></circle><path d="m10 10 4 4"></path></svg></button><input type="text"></div></div></div><div role="tree" aria-label="工作区与会话"><div role="treeitem" data-row-key="session:one" aria-selected="false"><span><span>状态</span></span><span>秘密标题</span><span>现在</span><span>操作</span></div></div></div></div></body>`, { url: 'dsh-app://app/', pretendToBeVisual: true });
  const doc = dom.window.document, before = doc.body.outerHTML;
  Object.defineProperty(dom.window.navigator, 'platform', { value: platform });
  let factory;
  dom.window.__ModuleLoader__ = { load(row) { assert.equal(row.id, '@daftai/pdsh'); factory = row.factory; } };
  runInNewContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), { window: dom.window, document: doc, TextEncoder, URL, Blob, AbortController });
  delete dom.window.__ModuleLoader__;
  const roots = new Set();
  const plugin = factory(id => {
    if (id === 'react') return React;
    if (id === 'react/jsx-runtime') return jsx;
    if (id === 'react-dom/client') return { createRoot() {
      const root = { render() {}, unmount() { roots.delete(root); } }; roots.add(root); return root;
    } };
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return {};
    throw new Error(`unexpected external: ${id}`);
  });
  return { dom, doc, before, roots, plugin };
}

test('正式单根 Client 无取像服务也启动；官方 Remote namespace 加入/撤回仅改变相机所有权', async () => {
  const h = fixture(), ctx = new Context(), registrations = new Set();
  const value = { ...DEFAULTS, ...DEFAULT_CAPTURE_EXPORT, maskIdentity: true, maskTitles: true, captureEnabled: true, captureMaskIdentity: true };
  const form = { getSnapshot: () => ({ status: 'ready', writable: true, revision: 1, value }), subscribe: () => () => {} };
  let registeredLocale = false, served = 0;
  const calls: string[] = [];
  try {
    assert.deepEqual([...h.plugin.inject], ['slots', 'locale', 'configForms', 'remote', 'remote.pluginManager']);
    await ctx.plugin(child => {
      child.provide('slots', { inject: (_name, callback) => callback(), register(options) {
        const key = options.name; assert.ok(!registrations.has(key)); registrations.add(key); return () => registrations.delete(key);
      } });
      child.provide('locale', { register() { registeredLocale = true; return () => { registeredLocale = false; }; }, bind: () => key => key, subscribe: () => () => {}, getSnapshot: () => ({ active: 'zh' }) });
      child.provide('configForms', { get(id) { assert.equal(id, 'pdsh'); return form; }, whileServed(ids, callback) {
        assert.deepEqual([...ids], ['pdsh']); served++; const dispose = callback(); return () => { served--; dispose(); };
      } });
      const manager = { listBundles: async () => ({ ok: true, value: [] }) };
      child.provide('remote', { pluginManager: manager, async $mount(){return ()=>{};} }); child.provide('remote.pluginManager', manager);
    }).await();
    const bundle = ctx.plugin(h.plugin); await bundle.await();
    assert.equal(bundle.state, 2); assert.equal(registeredLocale, true); assert.equal(served, 1);
    assert.equal(h.doc.querySelectorAll('[data-pdsh-name]').length, 1);
    assert.equal(h.doc.querySelectorAll('[data-pdsh-redacted-title="session"]').length, 1);
    assert.equal(h.doc.querySelector('[data-pdsh-capture-entry]'), null);
    const namespace = { capture(){calls.push('capture');assert.fail('挂载不取像');}, save(){calls.push('save');assert.fail('挂载不保存');} };
    const connection = ctx.plugin({ inject: ['remote'], apply(child) {
      child.remote.pdshNativeWindowCapture = namespace;
      child.provide('remote.pdshNativeWindowCapture', namespace);
      child.effect(() => () => { delete child.remote.pdshNativeWindowCapture; });
    } });
    await connection.await(); await bundle.await();
    assert.equal(ctx.get('connection.rpc'), undefined);
    assert.equal(h.doc.querySelectorAll('[data-pdsh-capture-entry]').length, 1);
    assert.deepEqual(calls, [], '启用相机不能自动触发取像');
    await connection.dispose(); await bundle.await();
    assert.equal(bundle.state, 2); assert.equal(served, 1); assert.deepEqual(calls, [], '撤回 namespace 不拍摄、不发旧桥 release');
    assert.equal(h.doc.querySelector('[data-pdsh-capture-entry]'), null);
    assert.equal(h.doc.querySelectorAll('[data-pdsh-name]').length, 1);
    assert.equal(h.doc.querySelectorAll('[data-pdsh-redacted-title="session"]').length, 1);
    assert.deepEqual([...registrations].sort(), [
      'conversation.session.header.utilities', 'plugins.bundle.config',
      'plugins.detail.badge', 'plugins.row.config',
    ]);
    await bundle.dispose();
    assert.equal(registeredLocale, false); assert.equal(served, 0); assert.equal(registrations.size, 0); assert.equal(h.roots.size, 0);
    assert.equal(h.doc.body.outerHTML, h.before);
  } finally { await ctx.fiber.dispose(); h.dom.window.close(); }
});

test('旧 ready Host config 保留身份/标题但不装相机；完整 accepted snapshot 到达后恢复', async () => {
  const h = fixture(), ctx = new Context(), listeners = new Set<() => void>();
  let value = { ...DEFAULTS, maskIdentity: true, maskTitles: true }, revision = 1;
  const form = {
    getSnapshot: () => ({ status: 'ready', writable: true, revision, value }),
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  };
  const manager = { listBundles: async () => ({ ok: true, value: [] }) };
  const namespace = { capture() { assert.fail('安装完成不能自动取像'); }, save() { assert.fail('安装完成不能自动保存'); } };
  let bundle;
  try {
    await ctx.plugin(child => {
      child.provide('slots', { inject: (_name, callback) => callback(), register: () => () => {} });
      child.provide('locale', { register: () => () => {}, bind: () => key => key, subscribe: () => () => {}, getSnapshot: () => ({ active: 'zh' }) });
      child.provide('configForms', { get: () => form, whileServed: (_ids, callback) => callback() });
      child.provide('remote', { pluginManager: manager, async $mount() { return () => {}; } });
      child.provide('remote.pluginManager', manager);
    }).await();
    bundle = ctx.plugin(h.plugin); await bundle.await();
    assert.equal(h.doc.querySelector('[data-pdsh-name]')?.textContent, '临时访客');
    assert.equal(h.doc.querySelectorAll('[data-pdsh-redacted-title="session"]').length, 1);

    const provider = ctx.plugin({ inject: ['remote'], apply(child) {
      child.remote.pdshNativeWindowCapture = namespace;
      child.provide('remote.pdshNativeWindowCapture', namespace);
      child.effect(() => () => { delete child.remote.pdshNativeWindowCapture; });
    } });
    await provider.await(); await bundle.await();
    assert.equal(h.doc.querySelector('[data-pdsh-capture-entry]'), null, 'old Host 缺失六个 accepted 截图字段时必须关闸');
    assert.equal(h.doc.querySelector('[data-pdsh-name]')?.textContent, '临时访客', '身份功能不依赖截图配置');
    assert.equal(h.doc.querySelectorAll('[data-pdsh-redacted-title="session"]').length, 1, '标题功能不依赖截图配置');

    value = { ...value, ...DEFAULT_CAPTURE_EXPORT, captureEnabled: true, captureMaskIdentity: true }; revision++;
    for (const listener of listeners) listener(); await bundle.await();
    assert.ok(h.doc.querySelector('[data-pdsh-capture-entry]'), '完整 accepted snapshot 后截图入口恢复');
    assert.equal(h.doc.querySelector('[data-pdsh-name]')?.textContent, '临时访客');
    assert.equal(h.doc.querySelectorAll('[data-pdsh-redacted-title="session"]').length, 1);
    await provider.dispose(); await bundle.await();
    await bundle.dispose();
    assert.equal(h.doc.body.outerHTML, h.before);
  } finally { await ctx.fiber.dispose(); h.dom.window.close(); }
});

test('Windows Client camera requires both a Win navigator and the actual Host Remote provider', async () => {
  const h = fixture('Win32'), ctx = new Context();
  const value = { ...DEFAULTS, ...DEFAULT_CAPTURE_EXPORT, captureEnabled: true, captureMaskIdentity: true };
  const form = { getSnapshot: () => ({ status: 'ready', writable: true, revision: 1, value }), subscribe: () => () => {} };
  const calls: string[] = [];
  try {
    await ctx.plugin(child => {
      child.provide('slots', { inject: (_name, callback) => callback(), register: () => () => {} });
      child.provide('locale', { register: () => () => {}, bind: () => key => key, subscribe: () => () => {}, getSnapshot: () => ({ active: 'zh' }) });
      child.provide('configForms', { get: () => form, whileServed: (_ids, callback) => callback() });
      const manager = { listBundles: async () => ({ ok: true, value: [] }) };
      child.provide('remote', { pluginManager: manager, async $mount(){return ()=>{};} });
      child.provide('remote.pluginManager', manager);
    }).await();
    const bundle = ctx.plugin(h.plugin);
    await bundle.await();
    assert.equal(h.doc.querySelector('[data-pdsh-capture-entry]'), null,
      'Windows platform alone is not proof that Host packaged a usable helper');

    const namespace = { capture(){calls.push('capture');assert.fail('mount must not capture');}, save(){calls.push('save');assert.fail('mount must not save');} };
    const connection = ctx.plugin({ inject: ['remote'], apply(child) {
      child.remote.pdshNativeWindowCapture = namespace;
      child.provide('remote.pdshNativeWindowCapture', namespace);
      child.effect(() => () => { delete child.remote.pdshNativeWindowCapture; });
    } });
    await connection.await(); await bundle.await();
    assert.ok(h.doc.querySelector('[data-pdsh-capture-entry]'));
    assert.deepEqual(calls, []);
    await connection.dispose(); await bundle.await();
    assert.equal(h.doc.querySelector('[data-pdsh-capture-entry]'), null);
    await bundle.dispose();
    assert.equal(h.doc.body.outerHTML, h.before);
  } finally { await ctx.fiber.dispose(); h.dom.window.close(); }
});

test('坏声明负例：Connection.rpc 对象不满足虚构的 connection.rpc 服务', async () => {
  const ctx = new Context(); let started = false;
  try {
    ctx.provide('connection', { rpc: { call() {} } });
    const fiber = ctx.plugin({ inject: ['connection.rpc'], apply() { started = true; } });
    await fiber.await(); assert.equal(started, false); assert.equal(ctx.get('connection.rpc'), undefined);
  } finally { await ctx.fiber.dispose(); }
});

test('生成 Client 仅使用官方取像流；旧 pageCapture/Connection 不影响其独立设置与生命周期', async () => {
  const h = fixture(), ctx = new Context(), listeners = new Set<() => void>();
  let value = { ...DEFAULTS, ...DEFAULT_CAPTURE_EXPORT, maskIdentity: true, maskTitles: true, captureEnabled: true, captureMaskIdentity: true }, revision = 1;
  const calls: string[] = [];
  Object.defineProperty(h.dom.window, 'dshDesktop', { value: Object.freeze({
    protocolVersion: 1,
    pageCapture: Object.freeze({ protocolVersion: 1, scope: 'current-page',
      async capturePng() { calls.push('capture'); throw new Error('此测试不获取像素'); },
      async cancel() { calls.push('cancel'); },
    }),
  }) });
  const form = {
    getSnapshot: () => ({ status: 'ready', writable: true, revision, value }),
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
  };
  const update = (patch: Partial<typeof value>) => {
    value = { ...value, ...patch }; revision++;
    for (const listener of listeners) listener();
  };
  try {
    await ctx.plugin(child => {
      child.provide('slots', { inject: (_name, callback) => callback(), register: () => () => {} });
      child.provide('locale', { register: () => () => {}, bind: () => key => key, subscribe: () => () => {}, getSnapshot: () => ({ active: 'zh' }) });
      child.provide('configForms', { get: () => form, whileServed: (_ids, callback) => callback() });
      const manager = { listBundles: async () => ({ ok: true, value: [] }) };
      child.provide('remote', { pluginManager: manager, async $mount(){return ()=>{};} }); child.provide('remote.pluginManager', manager);
      const namespace = {capture(){calls.push('stream');assert.fail('挂载不取像');},save(){calls.push('save');assert.fail('挂载不保存');}};
      child.remote.pdshNativeWindowCapture = namespace;
      child.provide('remote.pdshNativeWindowCapture', namespace);
    }).await();
    const bundle = ctx.plugin(h.plugin); await bundle.await();
    const camera = h.doc.querySelector('[data-pdsh-capture-entry]');
    assert.ok(camera); assert.equal(bundle.state, 2); assert.equal(ctx.get('connection'), undefined);
    const connection = ctx.plugin(child => child.provide('connection', { rpc: { async call() {
      calls.push('plugin-rpc'); throw new Error('原生接口不应进入插件调试桥');
    } } }));
    await connection.await(); await bundle.await();
    assert.equal(h.doc.querySelector('[data-pdsh-capture-entry]'), camera);
    await connection.dispose(); await bundle.await();
    assert.equal(h.doc.querySelector('[data-pdsh-capture-entry]'), camera);
    update({ maskIdentity: false });
    assert.equal(h.doc.querySelector('[data-pdsh-name]'), null);
    assert.equal(h.doc.querySelectorAll('[data-pdsh-redacted-title="session"]').length, 1);
    assert.equal(h.doc.querySelector('[data-pdsh-capture-entry]'), camera);
    update({ maskTitles: false });
    assert.equal(h.doc.querySelector('[data-pdsh-redacted-title="session"]'), null);
    assert.equal(h.doc.querySelector('[data-pdsh-capture-entry]'), camera);
    update({ captureEnabled: false });
    assert.equal(h.doc.querySelector('[data-pdsh-capture-entry]'), null);
    update({ captureEnabled: true, maskIdentity: true, maskTitles: true });
    assert.ok(h.doc.querySelector('[data-pdsh-capture-entry]'));
    assert.equal(h.doc.querySelectorAll('[data-pdsh-name]').length, 1);
    assert.equal(h.doc.querySelectorAll('[data-pdsh-redacted-title="session"]').length, 1);
    assert.deepEqual(calls, [], '挂载、切换设置与撤回 Connection 均不拍摄、不发插件 RPC');
    await bundle.dispose();
    assert.equal(listeners.size, 0); assert.equal(h.roots.size, 0);
    assert.equal(h.doc.body.outerHTML, h.before);
  } finally { await ctx.fiber.dispose(); h.dom.window.close(); }
});
