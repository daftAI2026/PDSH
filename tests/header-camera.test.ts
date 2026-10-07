/**
 * [INPUT]: 依赖真实侧栏适配器、相机 JSX 和 React/jsdom。
 * [OUTPUT]: 验证收起态、点击围栏、语言及资源归还。
 * [POS]: 会话入口合同。控件桩不证明 Desktop 排版。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import { createSidebarState } from '../src/client/sidebar-state.ts';

function frameMarkup(collapsed = false) {
  return `<div data-slot="root"><div ${collapsed ? 'data-sidebar-collapsed="true"' : ''}>
    <div><div data-slot="sidebar"><button aria-expanded="false">搜索会话</button></div></div>
    <div><div data-slot="main"><div data-slot="conversation.session.header.utilities"></div></div></div>
  </div></div>`;
}

function loadHeaderCamera() {
  const module = { exports: {} };
  const source = readFileSync(new URL('../src/client/header-camera.tsx', import.meta.url), 'utf8');
  const code = transformSync(source, { loader: 'tsx', format: 'cjs' }).code;
  const primitives = {
    Button: ({ children, variant, size, ...props }) => React.createElement('button', { type: 'button', 'data-variant': variant, 'data-size': size, ...props }, children),
    Tooltip: ({ children, label, side, delayMs, focusDelayMs, portal }) => React.cloneElement(children, {
      'data-native-tooltip': label, 'data-side': side, 'data-delay-ms': delayMs,
      'data-focus-delay-ms': focusDelayMs, 'data-portal': String(portal),
    }),
  };
  runInNewContext(code, { module, exports: module.exports, require(id) {
    if (id === 'react') return React;
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return primitives;
    if (id === './camera-icon.svg') return readFileSync(new URL('../src/client/camera-icon.svg', import.meta.url), 'utf8');
    throw new Error(`unexpected header import: ${id}`);
  } });
  return module.exports.HeaderCamera;
}

async function fixture({ collapsed = false } = {}) {
  const dom = new JSDOM(`<body>${frameMarkup(collapsed)}</body>`, { pretendToBeVisual: true });
  const doc = dom.window.document;
  const descriptors = new Map(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, { window: dom.window, document: doc, IS_REACT_ACT_ENVIRONMENT: true });
  const sidebar = createSidebarState(doc), listeners = new Set<() => void>(), calls = [];
  let language = 'zh', busy = false, disabled = false;
  const controller = { state: () => ({ busy, disabled }), activate() { calls.push(controller); } };
  let capture = controller;
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(doc.querySelector('[data-slot="conversation.session.header.utilities"]'));
  const HeaderCamera = loadHeaderCamera();
  const flush = () => new Promise(resolve => dom.window.setTimeout(resolve, 0));
  const notify = async () => { await act(async () => { for (const listener of [...listeners]) listener(); }); };
  await act(async () => root.render(React.createElement(HeaderCamera, {
    sidebar, readCapture: () => capture,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    snapshot: () => `${language}:${capture ? 1 : 0}:${busy}:${disabled}`,
    t: () => language === 'zh' ? '截图' : 'Capture screenshot',
  })));
  return {
    dom, doc, sidebar, controller, calls, listeners,
    button: () => doc.querySelector('[data-pdsh-header-capture-entry]'),
    frame: () => doc.querySelector('[data-slot="root"]').firstElementChild,
    async collapse(value) { await act(async () => {
      const frame = doc.querySelector('[data-slot="root"]').firstElementChild;
      if (value) frame.setAttribute('data-sidebar-collapsed', 'true'); else frame.removeAttribute('data-sidebar-collapsed');
      await flush();
    }); },
    async state(value) { busy = value.busy ?? busy; disabled = value.disabled ?? disabled; await notify(); },
    async locale(value) { language = value; await notify(); },
    async setCapture(value) { capture = value; await notify(); },
    async click() { await act(async () => this.button()?.click()); },
    async mutate(action) { await act(async () => { action(); await flush(); }); },
    withdrawWithoutRender() { capture = undefined; },
    async close() {
      await act(async () => root.unmount());
      sidebar.dispose();
      assert.equal(listeners.size, 0);
      dom.window.close();
      for (const [key, descriptor] of descriptors) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
      }
    },
  };
}

test('真实相机视图只在唯一 AppFrame 收起时呈现，展开撤回', async () => {
  const h = await fixture();
  try {
    assert.equal(h.sidebar.getSnapshot(), false);
    assert.equal(h.button(), null);
    assert.equal(h.calls.length, 0, '挂载不取像');
    await h.collapse(true);
    assert.equal(h.sidebar.getSnapshot(), true);
    assert.equal(h.button().getAttribute('data-size'), 'sm');
    assert.equal(h.button().getAttribute('data-variant'), 'ghost');
    assert.equal(h.button().getAttribute('data-side'), 'bottom');
    assert.equal(h.button().getAttribute('data-delay-ms'), '500');
    assert.equal(h.button().getAttribute('data-focus-delay-ms'), '0');
    assert.equal(h.button().getAttribute('data-portal'), 'true');
    assert.equal(h.button().querySelector('svg').getAttribute('viewBox'), '0 0 24 24');
    assert.equal(h.button().getAttribute('title'), null);
    await h.click();
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0], h.controller, '复用已有 controller，不构造第二取像链');
    await h.collapse(false);
    assert.equal(h.button(), null);
    assert.equal(h.calls.length, 1, '展开和收起本身均不取像');
  } finally { await h.close(); }
});

test('截图忙碌、工作台打开及 provider 撤回同步锁住会话入口', async () => {
  const h = await fixture({ collapsed: true });
  try {
    await h.state({ busy: true });
    assert.equal(h.button().disabled, true);
    assert.equal(h.button().getAttribute('aria-busy'), 'true');
    await h.click(); assert.equal(h.calls.length, 0);
    await h.state({ busy: false, disabled: true });
    assert.equal(h.button().disabled, true);
    await h.click(); assert.equal(h.calls.length, 0);
    await h.state({ disabled: false });
    await h.click(); assert.equal(h.calls.length, 1);
    await h.setCapture(undefined); assert.equal(h.button(), null);
    await h.setCapture(h.controller); assert.ok(h.button());
    assert.equal(h.calls.length, 1, '恢复 provider 不自动取像');
  } finally { await h.close(); }
});

test('Host 语言更新名称和 Tooltip，不新增独立设置', async () => {
  const h = await fixture({ collapsed: true });
  try {
    assert.equal(h.button().getAttribute('aria-label'), '截图');
    await h.locale('en');
    assert.equal(h.button().getAttribute('aria-label'), 'Capture screenshot');
    assert.equal(h.button().getAttribute('data-native-tooltip'), 'Capture screenshot');
    assert.equal(h.calls.length, 0);
  } finally { await h.close(); }
});

test('迟到点击重读侧栏和 controller，不能使用旧 render 的入口', async () => {
  const h = await fixture({ collapsed: true });
  try {
    h.frame().removeAttribute('data-sidebar-collapsed');
    await h.click(); assert.equal(h.calls.length, 0, 'MutationObserver 结算前也禁止展开态点击');
    await h.collapse(true);
    h.withdrawWithoutRender();
    await h.click(); assert.equal(h.calls.length, 0, '撤回 provider 后禁止陈旧 controller');
  } finally { await h.close(); }
});

test('根卸载或语义锚点失配隐藏相机，重新装配恢复', async () => {
  const h = await fixture({ collapsed: true });
  try {
    const anchor = h.doc.querySelector('[data-slot="main"]');
    await h.mutate(() => anchor.setAttribute('data-slot', 'unknown-main'));
    assert.equal(h.sidebar.getSnapshot(), undefined);
    assert.equal(h.button(), null);
    await h.mutate(() => anchor.setAttribute('data-slot', 'main'));
    assert.ok(h.button());
    const nativeRoot = h.doc.querySelector('[data-slot="root"]');
    await h.mutate(() => nativeRoot.remove());
    assert.equal(h.sidebar.getSnapshot(), undefined);
    await h.mutate(() => h.doc.body.append(nativeRoot));
    assert.ok(h.button());
    assert.equal(h.calls.length, 0);
  } finally { await h.close(); }
});

test('侧栏适配拒绝多根、畸形和 search 展开态，卸载不写宿主 DOM', async () => {
  const dom = new JSDOM(`<body>${frameMarkup()}</body>`), doc = dom.window.document;
  const state = createSidebarState(doc), seen = [];
  const off = state.subscribe(() => seen.push(state.getSnapshot()));
  const flush = () => new Promise(resolve => dom.window.setTimeout(resolve, 0));
  try {
    const before = doc.body.outerHTML;
    doc.querySelector('button').setAttribute('aria-expanded', 'true');
    await flush(); assert.equal(state.getSnapshot(), false); assert.deepEqual(seen, []);
    doc.body.insertAdjacentHTML('beforeend', frameMarkup(true));
    await flush(); assert.equal(state.getSnapshot(), undefined);
    doc.body.lastElementChild.remove();
    await flush(); assert.equal(state.getSnapshot(), false);
    const frame = doc.querySelector('[data-slot="root"]').firstElementChild;
    const duplicate = doc.createElement('div');
    duplicate.setAttribute('data-slot', 'main'); frame.append(duplicate);
    await flush(); assert.equal(state.getSnapshot(), undefined);
    frame.lastElementChild.remove();
    await flush(); assert.equal(state.getSnapshot(), false);
    doc.querySelector('button').setAttribute('aria-expanded', 'false');
    assert.equal(doc.body.outerHTML, before, '状态适配器不修改宿主');
    const count = seen.length;
    off(); state.dispose(); state.dispose();
    frame.setAttribute('data-sidebar-collapsed', 'true');
    await flush(); assert.equal(seen.length, count);
    assert.equal(state.getSnapshot(), undefined);
  } finally { off(); state.dispose(); dom.window.close(); }
});

test('无关聊天增删不扫描全局锚点，真实收起变化仍发布', async () => {
  const dom = new JSDOM(`<body>${frameMarkup()}</body>`), doc = dom.window.document;
  const state = createSidebarState(doc), seen = [];
  const off = state.subscribe(() => seen.push(state.getSnapshot()));
  const main = doc.querySelector('[data-slot="main"]');
  const original = doc.querySelectorAll.bind(doc);
  let scans = 0;
  doc.querySelectorAll = (...args) => { scans++; return original(...args); };
  try {
    for (let index = 0; index < 100; index++) {
      const span = doc.createElement('span'); span.textContent = '合成消息'; main.append(span);
    }
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));
    assert.equal(scans, 0, 'chat childList 不得触发文档级查询');
    main.replaceChildren();
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));
    assert.equal(scans, 0, 'chat 移除不得触发文档级查询');
    main.parentElement.parentElement.setAttribute('data-sidebar-collapsed', 'true');
    await new Promise(resolve => dom.window.setTimeout(resolve, 0));
    assert.deepEqual(seen, [true]); assert.ok(scans > 0);
  } finally { doc.querySelectorAll = original; off(); state.dispose(); dom.window.close(); }
});

for (const name of ['root', 'sidebar', 'main']) test(`歧义 ${name} 锚点改名后恢复相机，不依赖其它 DOM 变化`, async () => {
  const h = await fixture({ collapsed: true });
  try {
    const duplicate = h.doc.createElement('div'); duplicate.setAttribute('data-slot', name);
    await h.mutate(() => (name === 'root' ? h.doc.body : h.frame()).append(duplicate));
    assert.equal(h.sidebar.getSnapshot(), undefined);
    assert.equal(h.button(), null);
    await h.mutate(() => duplicate.setAttribute('data-slot', `unknown-${name}`));
    assert.equal(h.sidebar.getSnapshot(), true);
    assert.ok(h.button(), '属性改名消歧后必须发布恢复，不等下一次聊天刷新');
    assert.equal(h.calls.length, 0);
  } finally { await h.close(); }
});
