/**
 * [INPUT]: 依赖真实共享包身份及真实 UpdateBadge JSX、React/jsdom 与可订阅的更新控制器桩。
 * [OUTPUT]: 验证仅自身 Bundle 自动探测、有新版才显示细线版本旁图标、二次确认才安装。
 * [POS]: 官方 detail.badge slot 的交互合同；不把 fixture 结果当成 Desktop 网络证明。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import * as identity from '../src/shared/components.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';

async function mountBadge(subject = { kind: 'bundle', pkg: { name: '@daftai/pdsh', version: '0.1.1', installed: true } }) {
  const dom = new JSDOM('<body><main></main></body>');
  const previous = new Map(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const source = readFileSync(new URL('../src/client/update-badge.tsx', import.meta.url), 'utf8');
  const module = { exports: {} };
  runInNewContext(transformSync(source, { loader: 'tsx', format: 'cjs' }).code, {
    module, exports: module.exports,
    require(id) {
      if (id === '../shared/components.ts') return identity;
      if (id === 'react') return React;
      if (id === 'react/jsx-runtime') return requireJsx;
      if (id === '@deepseek-ai/dsh-client-ui-primitives') return {
        Button: ({ children, variant, size, ...props }) => React.createElement('button', { type: 'button', ...props }, children),
        Tooltip: ({ children, label, side, delayMs, focusDelayMs, portal }) => React.cloneElement(children, { 'data-native-tooltip': label, 'data-side': side, 'data-delay-ms': delayMs, 'data-focus-delay-ms': focusDelayMs, 'data-portal': String(portal) }),
      };
      throw new Error(id);
    },
  });
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(dom.window.document.querySelector('main'));
  let state = { phase: 'idle' };
  let checks = 0, installs = 0;
  const listeners = new Set();
  const updater = {
    getSnapshot: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    check() { ++checks; },
    install() { ++installs; },
  };
  const doc = dom.window.document;
  return {
    doc, updater,
    async render() { await act(async () => root.render(React.createElement(module.exports.UpdateBadge, { subject, updater, version: '0.1.1', t: key => key }))); },
    async state(next) { await act(async () => { state = next; for (const listener of listeners) listener(); }); },
    checks: () => checks, installs: () => installs,
    async close() { await act(async () => root.unmount()); assert.equal(listeners.size, 0); dom.window.close();
      for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
    },
  };
}

const requireJsx = await import('react/jsx-runtime');

test('仅自身已安装 Bundle 自动探测；无更新或探测失败不显示按钮', async () => {
  const h = await mountBadge();
  try {
    await h.render(); assert.equal(h.checks(), 1); assert.equal(h.doc.querySelector('button'), null);
    await h.state({ phase: 'current' }); assert.equal(h.doc.querySelector('button'), null);
    await h.state({ phase: 'failed', operation: 'check' }); assert.equal(h.doc.querySelector('button'), null);
  } finally { await h.close(); }
  const other = await mountBadge({ kind: 'bundle', pkg: { name: '@other/plugin', version: '0.1.1', installed: true } });
  try { await other.render(); assert.equal(other.checks(), 0); assert.equal(other.doc.querySelector('button'), null); }
  finally { await other.close(); }
});

test('新版本图标只展开确认；确认按钮才安装固定提交，失败保留反馈', async () => {
  const h = await mountBadge();
  try {
    await h.render(); await h.state({ phase: 'available', version: '0.1.2' });
    const trigger = h.doc.querySelector('[data-pdsh-update-trigger]');
    assert.ok(trigger); assert.ok(trigger.querySelector('svg circle'));
    const icon = trigger.querySelector('svg');
    assert.equal(icon?.hasAttribute('stroke-width'), false, 'React 图标不固定回退至1.5笔画');
    assert.equal(icon?.style.strokeWidth, '', '原生尺寸和笔画由同一computed probe/CSS桥接');
    const component = readFileSync(new URL('../src/client/update-badge.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(component, /strokeWidth=["']1\.5["']/);
    const css = readFileSync(new URL('../src/client/styles.css', import.meta.url), 'utf8');
    const iconRule = css.match(/\.pdsh-update-trigger svg\s*\{[^}]*\}/)?.[0] ?? '';
    assert.match(iconRule, /stroke-width:\s*calc\(24 \* var\(--pdsh-native-icon-stroke-ratio\)\)/);
    assert.match(iconRule, /opacity:\s*var\(--pdsh-native-icon-opacity\)/);
    assert.match(iconRule, /width:\s*var\(--pdsh-native-icon-size\)/);
    assert.match(iconRule, /height:\s*var\(--pdsh-native-icon-size\)/);
    const probe = readFileSync(new URL('../src/client/native-style-probe.ts', import.meta.url), 'utf8');
    for (const variable of ['--pdsh-native-icon-stroke-ratio', '--pdsh-native-icon-opacity', '--pdsh-native-icon-size']) assert.ok(probe.includes(variable), variable);
    assert.equal(trigger.getAttribute('title'), null);
    assert.equal(trigger.getAttribute('data-native-tooltip'), 'update.available v0.1.2');
    assert.equal(trigger.getAttribute('data-delay-ms'), '500');
    assert.equal(trigger.querySelector('svg path')?.getAttribute('d'), 'm16 12-4-4-4 4');
    assert.equal(h.installs(), 0);
    await act(async () => trigger.click()); assert.equal(h.installs(), 0);
    assert.ok(h.doc.querySelector('[data-pdsh-update-confirm]'));
    assert.match(h.doc.querySelector('[data-pdsh-update-confirm]').textContent, /installSourceHint/);
    await act(async () => [...h.doc.querySelectorAll('button')].find(button => button.textContent === 'update.cancel').click());
    assert.equal(h.doc.querySelector('[data-pdsh-update-confirm]'), null);
    assert.equal(h.installs(), 0);
    await act(async () => trigger.click());
    await act(async () => h.doc.querySelector('[data-pdsh-update-install]').click()); assert.equal(h.installs(), 1);
    await h.state({ phase: 'failed', operation: 'install' });
    assert.ok(h.doc.querySelector('[role="alert"]'));
  } finally { await h.close(); }
});

test('安装后重启提示即使重新打开详情也保持可见', async () => {
  const h = await mountBadge();
  try {
    await h.render(); await h.state({ phase: 'restart', version: '0.1.2' });
    assert.match(h.doc.querySelector('[role="status"]')?.textContent ?? '', /update.restart 0.1.2/);
    assert.equal(h.doc.querySelector('[data-pdsh-update-trigger]'), null);
  } finally { await h.close(); }
});
