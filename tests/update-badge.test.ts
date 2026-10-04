/**
 * [INPUT]: 依赖真实 UpdateBadge JSX、React/jsdom 与可订阅的更新控制器桩。
 * [OUTPUT]: 验证仅当前 Client 探测、二次确认安装，以及清单前移后保留安装/重启结果；同 updater 详情重挂保留失败，失配不提供旧 Client 重试。
 * [POS]: 官方 detail.badge slot 的交互合同；不把 fixture 结果当成 Desktop 网络证明。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
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
      if (id === 'react') return React;
      if (id === 'react/jsx-runtime') return requireJsx;
      if (id === '@deepseek-ai/dsh-client-ui-primitives') return {
        Button: ({ children, variant, size, ...props }) => React.createElement('button', { type: 'button', ...props }, children),
        Tooltip: ({ children, label, side, delayMs, focusDelayMs, portal }) => React.cloneElement(children, { 'data-native-tooltip': label, 'data-side': side, 'data-delay-ms': delayMs, 'data-focus-delay-ms': focusDelayMs, 'data-portal': String(portal) }),
        Modal: ({ open, title, description, closeLabel, onClose, footer }) => open ? React.createElement('div', { role: 'dialog', 'aria-label': title }, description, React.createElement('button', { 'aria-label': closeLabel, onClick: onClose }, closeLabel), footer) : null,
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
    async remount() { await act(async () => root.render(null)); await this.render(); },
    async installedVersion(version) { subject = { ...subject, pkg: { ...subject.pkg, version } }; await this.render(); },
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

test('同一挂载中的 restart 结果显示行内重启状态', async () => {
  const h = await mountBadge();
  try {
    await h.render(); await h.state({ phase: 'restart', version: '0.1.2' });
    assert.match(h.doc.querySelector('[role="status"]')?.textContent ?? '', /update.restart 0.1.2/);
    assert.equal(h.doc.querySelector('[data-pdsh-update-trigger]'), null);
  } finally { await h.close(); }
});

test('安装清单先变成新版不能隐藏旧 Client 持有的重启提示', async () => {
  const h = await mountBadge();
  try {
    await h.render();
    await h.state({ phase: 'installing', version: '0.3.0' });
    await h.installedVersion('0.3.0');
    assert.match(h.doc.querySelector('[role="status"]')?.textContent ?? '', /update.installing 0.3.0/);
    assert.equal(h.doc.querySelector('[role="dialog"]'), null, '安装结果尚未确认，不提前要求重启');
    await h.state({ phase: 'restart', version: '0.3.0' });
    assert.match(h.doc.querySelector('[role="status"]')?.textContent ?? '', /update.restart 0.3.0/);
    assert.ok(h.doc.querySelector('[role="dialog"]'));
    assert.equal(h.checks(), 1, '新磁盘版本不能重新发起旧 Client 的更新探测');
    assert.equal(h.doc.querySelector('[data-pdsh-update-install]'), null);
  } finally { await h.close(); }
});

test('安装失败时清单版本已前移仍保留终态反馈且不再探测旧 Client', async () => {
  const h = await mountBadge();
  try {
    await h.render();
    await h.state({ phase: 'available', version: '0.3.0' });
    await act(async () => h.doc.querySelector('[data-pdsh-update-trigger]').click());
    await act(async () => h.doc.querySelector('[data-pdsh-update-install]').click());
    await h.state({ phase: 'installing', version: '0.3.0' });
    await h.installedVersion('0.3.0');
    await h.state({ phase: 'failed', operation: 'install', version: '0.3.0' });
    assert.match(h.doc.querySelector('[role="alert"]')?.textContent ?? '', /update.installFailed/);
    assert.equal(h.doc.querySelector('[data-pdsh-update-install]'), null);
    assert.equal([...h.doc.querySelectorAll('button')].some(button => button.textContent === 'update.retry'), false, '旧 Client 已不匹配磁盘清单，不提供无法兑现的重新检查');
    assert.equal(h.checks(), 1, '元数据版本已超过当前 Client，不能继续探测或重试旧代码');
  } finally { await h.close(); }
});

test('需要重启时自动显示宿主 Modal；稍后只关闭弹窗，不冒充一键重启或移除提醒', async () => {
  const h = await mountBadge();
  try {
    await h.render();
    await h.state({ phase: 'installed', version: '0.3.0' });
    assert.equal(h.doc.querySelector('[role="dialog"]'), null, '真正 applied 结果不要求重启');
    await h.state({ phase: 'restart', version: '0.3.0' });
    assert.ok(h.doc.querySelector('[role="dialog"]'), 'restart-required 不是易消失的行内提示');
    assert.match(h.doc.querySelector('[role="dialog"]').textContent, /update.restartDescription/);
    await h.installedVersion('0.3.0');
    assert.ok(h.doc.querySelector('[role="dialog"]'));
    await act(async () => [...h.doc.querySelectorAll('button')].find(button => button.textContent === 'update.later').click());
    assert.equal(h.doc.querySelector('[role="dialog"]'), null);
    assert.match(h.doc.querySelector('[role="status"]').textContent, /update.restart 0.3.0/);
    assert.equal(h.installs(), 0);
  } finally { await h.close(); }
});

test('同一 updater 存活时详情重挂保留安装失败，不自动重新检查覆盖结果', async () => {
  const h = await mountBadge();
  try {
    await h.render();
    await h.state({ phase: 'available', version: '0.1.2' });
    await act(async () => h.doc.querySelector('[data-pdsh-update-trigger]').click());
    await act(async () => h.doc.querySelector('[data-pdsh-update-install]').click());
    await h.state({ phase: 'failed', operation: 'install', version: '0.1.2' });
    await h.remount();
    assert.equal(h.checks(), 1, '自动探测不得覆盖已有安装失败；明确重试仍由用户触发');
    assert.match(h.doc.querySelector('[role="alert"]')?.textContent ?? '', /update.installFailed/);
    assert.ok([...h.doc.querySelectorAll('button')].find(button => button.textContent === 'update.retry'));
  } finally { await h.close(); }
});
