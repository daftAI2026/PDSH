/**
 * [INPUT]: 依赖唯一生成 Client、Cordis 4.0.4 真注册器、最小 DOM 与 rc.2 Connection 服务形状。
 * [OUTPUT]: 验证正式 apply 在无桥时启动，桥加入/撤回只改变相机，RPC 属性不是独立服务。
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

function fixture() {
  const dom = new JSDOM(`<body><main>原页面</main><div data-slot="settings.launcher"><button type="button" data-collapsed="false" data-signed-out="false" aria-haspopup="menu" aria-expanded="false"><span><img src="native.png"></span><span>原身份</span></button></div><div data-slot="sidebar.workspaces"><div><div><div><div><button type="button" class="native-search" aria-label="搜索会话" aria-expanded="false"><svg viewBox="0 0 16 16" style="width:14px;height:14px;stroke-width:1"><circle cx="7" cy="7" r="4"></circle><path d="m10 10 4 4"></path></svg></button><input type="text"></div></div></div><div role="tree" aria-label="工作区与会话"><div role="treeitem" data-row-key="session:one" aria-selected="false"><span><span>状态</span></span><span>秘密标题</span><span>现在</span><span>操作</span></div></div></div></div></body>`, { url: 'dsh-app://app/', pretendToBeVisual: true });
  const doc = dom.window.document, before = doc.body.outerHTML;
  Object.defineProperty(dom.window.navigator, 'platform', { value: 'MacIntel' });
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

test('正式单根 Client 无桥也启动；真实 Connection 加入/撤回仅改变相机所有权', async () => {
  const h = fixture(), ctx = new Context(), registrations = new Set();
  const value = { ...DEFAULTS, maskIdentity: true, maskTitles: true, captureEnabled: true };
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
      child.provide('remote', { pluginManager: manager }); child.provide('remote.pluginManager', manager);
    }).await();
    const bundle = ctx.plugin(h.plugin); await bundle.await();
    assert.equal(bundle.state, 2); assert.equal(registeredLocale, true); assert.equal(served, 1);
    assert.equal(h.doc.querySelectorAll('[data-pdsh-name]').length, 1);
    assert.equal(h.doc.querySelectorAll('[data-pdsh-redacted-title="session"]').length, 1);
    assert.equal(h.doc.querySelector('[data-pdsh-capture-entry]'), null);
    const connection = ctx.plugin(child => child.provide('connection', { rpc: { async call(_channel, _endpoint, request) { calls.push(request.op); return { ok: true, value: { protocolVersion: 1 } }; } } }));
    await connection.await(); await bundle.await();
    assert.equal(ctx.get('connection.rpc'), undefined);
    assert.equal(h.doc.querySelectorAll('[data-pdsh-capture-entry]').length, 1);
    assert.deepEqual(calls, [], '启用相机不能自动触发取像');
    await connection.dispose(); await bundle.await();
    assert.equal(bundle.state, 2); assert.equal(served, 1); assert.deepEqual(calls, ['release'], '撤回 Connection 仅归还桥，不拍摄');
    assert.equal(h.doc.querySelector('[data-pdsh-capture-entry]'), null);
    assert.equal(h.doc.querySelectorAll('[data-pdsh-name]').length, 1);
    assert.equal(h.doc.querySelectorAll('[data-pdsh-redacted-title="session"]').length, 1);
    assert.equal(registrations.size, 3);
    await bundle.dispose();
    assert.equal(registeredLocale, false); assert.equal(served, 0); assert.equal(registrations.size, 0); assert.equal(h.roots.size, 0);
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
