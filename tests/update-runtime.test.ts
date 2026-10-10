/**
 * [INPUT]: 依赖共享内存加载器、真实组合根及官方事件形状。
 * [OUTPUT]: 验证更新事件通过根 Remote 订阅，并在 Bundle 释放时解除。
 * [POS]: 更新装配合同；其余功能为桩，不重复业务验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { loadComponentRuntime } from './client-runtime-fixture.ts';

test('更新取消事件经真实组合根订阅官方面，Bundle 释放归还订阅', async () => {
  const dom = new JSDOM('<body></body>', { url: 'dsh-app://app/index.html' });
  const assemblies = { controllers: [], entries: [], adapters: [], typography: [] };
  const mountComponent = await loadComponentRuntime(assemblies);
  const lifetime = [], events = new Map(); let released = 0;
  const form = { getSnapshot: () => ({ status: 'loading', revision: 0 }), subscribe: () => () => {} };
  const ctx = {
    configForms: { get: () => form, whileServed: (_ids, fn) => fn() },
    locale: { register: () => () => {}, bind: () => key => key, subscribe: () => () => {}, getSnapshot: () => ({ active: 'zh' }) },
    slots: { inject: (_slot, fn) => fn(), register: () => () => {} },
    remote: { pluginManager: {}, $on(name, fn) { events.set(name, fn); return () => { released++; events.delete(name); }; } },
    logger: { info() {}, warn() {}, error() {} },
    effect(fn) { const off = fn(); if (typeof off === 'function') lifetime.push(off); return off; },
    inject: () => ({ dispose() {} }),
  };
  try {
    mountComponent(ctx, dom.window.document);
    assert.equal(events.size, 1); const event = { requestId: 'owned', phase: 'installing' };
    events.get('plugin-manager/install-state')(event); assert.equal(assemblies.updateProgress, event);
    for (const off of lifetime.reverse()) off();
    assert.equal(events.size, 0); assert.equal(released, 1);
  } finally { dom.window.close(); }
});
