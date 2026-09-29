/**
 * [INPUT]: 依赖生成 client.js 的真实 factory、jsdom 与严格的宿主装配合同桩。
 * [OUTPUT]: 验证共享库请求、keyed slot、搜索入口导航和 Host 停用/重启的资源归属。
 * [POS]: PDSH 构建/装配回归门；样式和 Host 持久化另由真实 Web runtime 验证。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { JSDOM } from 'jsdom';
import { DEFAULTS } from '../src/shared/model.ts';

test('lazy factory 装配标题开关与keyed设置页，并清理资源', async () => {
  const dom = new JSDOM(`<body><main>原生内容</main><div data-slot="sidebar.workspaces"><div><div><span>工作区</span><div><div><button type="button" class="native-search" aria-label="搜索会话" aria-expanded="false"><svg style="width:14px;height:14px"></svg></button><input type="text" /></div></div><div></div></div></div></div></body>`);
  const document = dom.window.document;
  const before = document.body.outerHTML;
  let factory;
  runInNewContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load(row) { assert.equal(row.id, '@daftai/pdsh'); factory = row.factory; } } },
    document, TextEncoder,
  });
  assert.equal(document.querySelector('style'), null, 'materialize 前不允许副作用');
  const requested = [];
  let unmounted = false;
  const entry = factory(id => {
    requested.push(id);
    if (id === 'react') return React;
    if (id === 'react/jsx-runtime') return jsxRuntime;
    if (id === 'react-dom/client') return { createRoot: () => ({ render() {}, unmount() { unmounted = true; } }) };
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return { Input() {}, Button() {}, Switch() {} };
    throw new Error(`unexpected module ${id}`);
  });
  const disposers = [];
  const listeners = new Set();
  const scope = { status: 'ready', writable: true, revision: 0, value: DEFAULTS };
  let mutations = [];
  const form = { getSnapshot: () => scope, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, async mutate(ops, revision) { mutations.push({ops,revision}); scope.value = {...scope.value, maskTitles: ops[0].value}; ++scope.revision; for(const fn of listeners) fn(); return true; } };
  let registered = false;
  let dictionaries, language = 'zh';
  const localeListeners = new Set();
  let opened;
  let activate;
  let deactivate;
  const ctx = {
    effect(fn) { const off = fn(); if (typeof off === 'function') disposers.push(off); return off; },
    locale: { register(ns, values) { assert.equal(ns, 'pdsh'); dictionaries = values; return () => { dictionaries = undefined; }; }, bind: () => key => dictionaries[language][key], subscribe(fn) { localeListeners.add(fn); return () => localeListeners.delete(fn); } },
    pluginNavigation: { openBundle(name) { opened = name; } },
    remote: { pluginManager: { async listBundles() { return { ok: true, value: [{ name: '@daftai/pdsh', version: '0.1.0', installed: true, enabled: true }] }; }, async installBundle() { assert.fail('更新只能由用户确认触发'); } } },
    configForms: { get(id) { assert.equal(id, 'pdsh'); return form; }, whileServed(ids, fn) {
      assert.equal(ids[0], 'pdsh'); activate = () => { deactivate = fn(); }; activate();
      return () => deactivate();
    } },
    slots: { inject(key, fn) { assert.equal(key, 'plugins.bundle.config'); return fn(); }, register(options) {
      assert.equal(options.key, '@daftai/pdsh', 'keyed slot 需要 key，不是 list slot 的 id');
      assert.equal(options.inject().preferencesForm, form); assert.ok(options.inject().updater); registered = true; return () => { registered = false; };
    } },
    logger: { warn() { assert.fail('valid config rejected'); } },
  };
  try {
    entry.apply(ctx);
    assert.equal(registered, true);
    assert.equal(document.body.hasAttribute('data-pdsh-frames'), false);
    const searchEntry = document.querySelector('[data-pdsh-search-entry]');
    assert.ok(searchEntry, '启用后应在搜索旁装配入口，而不是只贡献设置页');
    assert.equal(searchEntry.getAttribute('aria-label'), '遮挡侧栏标题');
    language = 'en'; for (const notify of localeListeners) notify();
    assert.equal(searchEntry.getAttribute('aria-label'), 'Mask sidebar titles');
    assert.equal(document.querySelectorAll('[data-pdsh-search-entry]').length, 1);
    searchEntry.click();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(opened, undefined, '帽子不导航设置');
    assert.equal(mutations.length, 1); assert.equal(mutations[0].ops[0].path[0], 'maskTitles');
    assert.equal(searchEntry.getAttribute('aria-pressed'), 'true');
    assert.ok(requested.includes('react'));
    deactivate();
    assert.equal(document.querySelector('style'), null, 'Host 停用必须撤回 CSS');
    assert.equal(document.body.outerHTML, before, 'Host 停用必须撤回探针/标记');
    assert.equal(listeners.size, 0);
    assert.equal(registered, false);
    assert.equal(localeListeners.size, 0);
    activate();
    assert.equal(registered, true);
    assert.equal(document.querySelectorAll('style').length, 1);
    assert.equal(document.querySelectorAll('[data-pdsh-probe]').length, 1);
    assert.equal(document.body.hasAttribute('data-pdsh-frames'), false);
  } finally {
    for (const off of disposers.reverse()) off();
  }
  assert.equal(unmounted, true);
  assert.equal(localeListeners.size, 0);
  assert.equal(dictionaries, undefined);
  assert.equal(listeners.size, 0);
  assert.equal(registered, false);
  assert.equal(document.querySelector('style'), null);
  assert.equal(document.body.outerHTML, before);
  dom.window.close();
});
