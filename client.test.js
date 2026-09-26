/**
 * [INPUT]: 依赖生成 client.js 的真实 factory、jsdom 与严格的宿主装配合同桩。
 * [OUTPUT]: 验证共享库请求、keyed slot 注册、Host namespace 和停用/重启和卸载资源归属。
 * [POS]: PDSH 构建/装配回归门；样式和 Host 持久化另由真实 Web runtime 验证。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React from 'react';
import { JSDOM } from 'jsdom';
import { DEFAULTS } from './model.js';

test('lazy factory 装配到包的 keyed 设置页，并清理资源', () => {
  const dom = new JSDOM('<body><main>原生内容</main></body>');
  const document = dom.window.document;
  const before = document.body.outerHTML;
  let factory;
  runInNewContext(readFileSync(new URL('./client.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load(row) { assert.equal(row.id, '@daftai/pdsh'); factory = row.factory; } } },
    document, TextEncoder,
  });
  assert.equal(document.querySelector('style'), null, 'materialize 前不允许副作用');
  const requested = [];
  let unmounted = false;
  const entry = factory(id => {
    requested.push(id);
    if (id === 'react') return React;
    if (id === 'react-dom/client') return { createRoot: () => ({ render() {}, unmount() { unmounted = true; } }) };
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return { Input() {}, Button() {}, Switch() {} };
    throw new Error(`unexpected module ${id}`);
  });
  const disposers = [];
  const listeners = new Set();
  const scope = { status: 'ready', writable: true, revision: 0, value: DEFAULTS };
  const form = { getSnapshot: () => scope, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
  let registered = false;
  let activate;
  let deactivate;
  const ctx = {
    effect(fn) { const off = fn(); if (typeof off === 'function') disposers.push(off); return off; },
    locale: { register: () => () => {}, bind: () => key => key },
    configForms: { get(id) { assert.equal(id, 'pdsh'); return form; }, whileServed(ids, fn) {
      assert.equal(ids[0], 'pdsh'); activate = () => { deactivate = fn(); }; activate();
      return () => deactivate();
    } },
    slots: { inject(key, fn) { assert.equal(key, 'plugins.bundle.config'); return fn(); }, register(options) {
      assert.equal(options.key, '@daftai/pdsh', 'keyed slot 需要 key，不是 list slot 的 id');
      assert.equal(options.inject().preferencesForm, form); registered = true; return () => { registered = false; };
    } },
    logger: { warn() { assert.fail('valid config rejected'); } },
  };
  try {
    entry.apply(ctx);
    assert.equal(registered, true);
    assert.equal(document.body.hasAttribute('data-pdsh-frames'), true);
    assert.ok(requested.includes('react'));
    deactivate();
    assert.equal(document.querySelector('style'), null, 'Host 停用必须撤回 CSS');
    assert.equal(document.body.outerHTML, before, 'Host 停用必须撤回探针/标记');
    assert.equal(listeners.size, 0);
    assert.equal(registered, false);
    activate();
    assert.equal(registered, true);
    assert.equal(document.querySelectorAll('style').length, 1);
    assert.equal(document.querySelectorAll('[data-pdsh-probe]').length, 1);
    assert.equal(document.body.hasAttribute('data-pdsh-frames'), true);
  } finally {
    for (const off of disposers.reverse()) off();
  }
  assert.equal(unmounted, true);
  assert.equal(listeners.size, 0);
  assert.equal(registered, false);
  assert.equal(document.querySelector('style'), null);
  assert.equal(document.body.outerHTML, before);
  dom.window.close();
});
