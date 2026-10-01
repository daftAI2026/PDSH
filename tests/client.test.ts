/**
 * [INPUT]: 依赖三个真实 lazy factory、同一 jsdom 页面、严格 Host 注册桩及可选真实 ReactDOM/DOM-shape primitive fixture。
 * [OUTPUT]: 验证启停组合、身份原生节点遮蔽、完整样式 probe 隐藏/卸载；fixture 不冒充实际 Host primitives/CSP。
 * [POS]: 三运行时组件构建/装配门；DOM fixture 与桩桥都不是安装件或 Desktop 实窗验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import React, { act } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { createRoot as reactCreateRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { DEFAULTS } from '../src/shared/model.ts';
import { COMPONENTS } from '../src/shared/components.ts';

function harness({ bridge = true, failSlot = false, realReact = false } = {}) {
  const dom = new JSDOM(`<body><main>原生内容</main><div data-slot="settings.launcher"><button data-collapsed="false" data-signed-out="false" aria-haspopup="menu"><span><svg></svg></span><span>真实名称</span></button></div><div data-slot="sidebar.workspaces"><div><div><span>工作区</span><div><div><button type="button" class="native-search" aria-label="搜索会话" aria-expanded="false"><svg viewBox="0 0 16 16" style="width:14px;height:14px;stroke-width:1"></svg></button><input type="text" /></div></div><div></div></div></div></div></body>`);
  const document = dom.window.document, before = document.body.outerHTML;
  const globalDescriptors = realReact ? new Map(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])) : null;
  if (realReact) {
    Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: dom.window });
    Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: document });
    Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true });
  }
  Object.defineProperty(dom.window.navigator, 'platform', { value: 'MacIntel' });
  if (bridge) Object.defineProperty(dom.window, 'dshDesktop', { value: { protocolVersion: 1, pageCapture: { protocolVersion: 1, scope: 'current-page', capturePng() { assert.fail('未点击不请求像素'); }, async cancel() {} } } });
  const registrations = new Map(), dictionaries = new Map(), roots = new Set(), scopes = new Map();
  let language = 'zh';
  function load(kind) {
    const definition = COMPONENTS[kind], path = kind === 'identity' ? '../client.js' : `../components/${kind}/client.js`;
    let factory;
    runInNewContext(readFileSync(new URL(path, import.meta.url), 'utf8'), {
      window: { __ModuleLoader__: { load(row) { assert.equal(row.id, definition.module); factory = row.factory; } } }, document, TextEncoder,
    });
    return factory(id => {
      if (id === 'react') return React;
      if (id === 'react/jsx-runtime') return jsxRuntime;
      if (id === 'react-dom/client') return { createRoot: node => {
        if (realReact) {
          const mounted = reactCreateRoot(node);
          const root = { render(element) { act(() => mounted.render(element)); }, unmount() { act(() => mounted.unmount()); roots.delete(root); } };
          roots.add(root); return root;
        }
        const root = { render() {}, unmount() { roots.delete(root); } }; roots.add(root); return root;
      } };
      if (id === '@deepseek-ai/dsh-client-ui-primitives') {
        if (!realReact) return { Input() {}, Button() {}, Switch() {} };
        // 此桩只保留 DOM 包含关系契约，不是 Host primitive 的真实实现。
        return {
          Input: props => React.createElement('span', { className: 'fixture-input-wrap' }, React.createElement('input', props)),
          Button: props => React.createElement('button', props, props.children),
          Switch: () => React.createElement('span', { role: 'switch' }, React.createElement('span', { className: 'fixture-thumb' })),
          SettingsValueField: props => React.createElement('div', { className: 'fixture-settings-field' },
            React.createElement('div', { className: 'fixture-field-head' }, React.createElement('label', { htmlFor: props.id }, props.label)),
            React.createElement('input', { id: props.id, disabled: props.disabled, value: props.text, readOnly: true })),
          Tooltip: ({ children, label }) => React.createElement(React.Fragment, null, children,
            React.createElement('span', { role: 'tooltip' }, label)),
          IconCheckOutlineRegular: () => React.createElement('svg', { viewBox: '0 0 16 16' }),
        };
      }
      throw new Error(`unexpected module ${id}`);
    });
  }
  for (const kind of Object.keys(COMPONENTS)) {
    const definition = COMPONENTS[kind], listeners = new Set(), localeListeners = new Set(), disposers = [];
    const snapshot = { status: 'ready', writable: true, revision: 0, value: kind === 'identity' ? { ...DEFAULTS, maskIdentity: true, nickname: '别名' } : kind === 'titles' ? { maskTitles: true } : {} };
    const mutations = [];
    const form = { getSnapshot: () => snapshot, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, async mutate(ops, revision) {
      mutations.push({ ops, revision }); snapshot.value = { ...snapshot.value, [ops[0].path[0]]: ops[0].value }; ++snapshot.revision;
      for (const fn of listeners) fn(); return true;
    } };
    let served, active, unloading = false;
    const ctx = {
      effect(fn) { const off = fn(); if (typeof off === 'function') disposers.push(off); return off; },
      locale: { register(ns, values) { assert.equal(ns, definition.locale); assert.ok(!dictionaries.has(ns)); dictionaries.set(ns, values); return () => dictionaries.delete(ns); },
        bind: ns => key => dictionaries.get(ns)[language][key], subscribe(fn) { localeListeners.add(fn); return () => localeListeners.delete(fn); } },
      remote: { pluginManager: { async listBundles() { return { ok: true, value: [] }; }, async installBundle() { assert.fail('不得自动安装'); } } },
      configForms: { get(id) { assert.equal(id, definition.id); return form; }, whileServed(ids, fn) { assert.equal(ids[0], definition.id); served = fn; return () => { active?.(); active = undefined; }; } },
      slots: { inject(name, fn) { if (unloading) throw Object.assign(new Error('inactive effect'), { code: 'INACTIVE_EFFECT' }); return fn(); }, register(options, component) {
        if (failSlot && options.name === 'plugins.detail.badge') throw new Error('slot unavailable');
        const key = `${options.name}:${options.key ?? options.id}`;
        assert.ok(!registrations.has(key), `不得重复注册 ${key}`); const item = { options, component, kind }; registrations.set(key, item);
        return () => { assert.equal(registrations.get(key), item); registrations.delete(key); };
      } }, logger: { warn() { assert.fail('合法配置不应被拒绝'); } },
    };
    load(kind).apply(ctx);
    scopes.set(kind, { snapshot, mutations, listeners, localeListeners,
      unloading() { unloading = true; },
      enable() { assert.ok(!active); active = served(); }, disable() { active?.(); active = undefined; },
      close() { for (const off of disposers.reverse()) off(); },
    });
  }
  return { dom, document, before, registrations, roots, dictionaries, scopes,
    language(value) { language = value; for (const scope of scopes.values()) for (const fn of scope.localeListeners) fn(); },
    close() {
      try { for (const scope of [...scopes.values()].reverse()) scope.close(); }
      finally {
        dom.window.close();
        if (globalDescriptors) for (const [key, descriptor] of globalDescriptors) {
          if (descriptor) Object.defineProperty(globalThis, key, descriptor);
          else delete globalThis[key];
        }
      }
    },
  };
}
for (let mask = 0; mask < 8; mask++) test(`三个安装入口的启停组合 ${mask.toString(2).padStart(3, '0')}`, async () => {
  const h = harness(), kinds = Object.keys(COMPONENTS);
  try {
    for (let i = 0; i < 3; i++) if (mask & (1 << i)) h.scopes.get(kinds[i]).enable();
    const { document } = h;
    assert.equal(document.querySelectorAll('[data-pdsh-name]').length, mask & 1 ? 1 : 0);
    assert.equal(document.querySelectorAll('[data-pdsh-search-entry]').length, mask & 2 ? 1 : 0);
    assert.equal(document.querySelectorAll('[data-pdsh-capture-entry]').length, mask & 4 ? 1 : 0);
    assert.equal(document.querySelectorAll('[data-pdsh-probe]').length, mask ? 1 : 0);
    assert.equal(document.querySelectorAll('style').length, mask ? 1 : 0);
    assert.equal(h.registrations.size, mask ? 2 + kinds.filter((_, i) => mask & 1 << i).length : 0);
    h.language('en');
    if (mask & 2) {
      const hat = document.querySelector('[data-pdsh-search-entry]');
      assert.equal(hat.getAttribute('aria-label'), 'Show sidebar titles'); hat.click();
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(h.scopes.get('titles').mutations.length, 1);
      assert.equal(h.scopes.get('identity').mutations.length, 0);
    }
    for (const kind of kinds) h.scopes.get(kind).disable();
    assert.equal(document.body.outerHTML, h.before);
    assert.equal(h.registrations.size, 0); assert.equal(h.roots.size, 0);
    for (const scope of h.scopes.values()) { assert.equal(scope.listeners.size, 0); assert.equal(scope.localeListeners.size, 0); }
  } finally { h.close(); }
});
test('关闭旧身份后设置/徽标交接给标题，相机可脱离帽子且保留昵称偏好', () => {
  const h = harness(); try {
    for (const scope of h.scopes.values()) scope.enable();
    h.scopes.get('identity').disable();
    assert.equal(h.scopes.get('identity').snapshot.value.nickname, '别名');
    assert.equal(h.document.querySelector('[data-pdsh-name]'), null);
    assert.equal(h.registrations.get('plugins.bundle.config:@daftai/pdsh').kind, 'titles');
    h.scopes.get('titles').disable();
    assert.equal(h.scopes.get('titles').snapshot.value.maskTitles, true);
    assert.equal(h.document.querySelector('[data-pdsh-search-entry]'), null);
    assert.ok(h.document.querySelector('[data-pdsh-capture-entry][data-pdsh-entry-first]'));
    assert.equal(h.document.querySelectorAll('[data-pdsh-probe]').length, 1);
    h.scopes.get('identity').enable();
    assert.equal(h.document.querySelector('[data-pdsh-name]').textContent, '别名');
  } finally { h.close(); }
});
test('真实 ReactDOM DOM-shape fixture：所有加载顺序只挂一个身份/probe，停用与无样式负例可见', () => {
  const orders = [
    ['identity', 'titles', 'capture'], ['identity', 'capture', 'titles'],
    ['titles', 'identity', 'capture'], ['titles', 'capture', 'identity'],
    ['capture', 'identity', 'titles'], ['capture', 'titles', 'identity'],
  ];
  for (const order of orders) {
    const h = harness({ realReact: true });
    try {
      for (const kind of order) h.scopes.get(kind).enable();
      const label = h.document.querySelector('[data-slot="settings.launcher"] button > span:nth-child(2)');
      const probe = h.document.querySelector('[data-pdsh-probe]');
      const style = h.document.querySelector('style[data-plugin="@daftai/pdsh"]');
      const assertStyled = () => {
        assert.equal(h.document.querySelectorAll('[data-pdsh-name]').length, 1, '身份别名只有一个 owner 节点');
        assert.equal(h.document.defaultView.getComputedStyle(label).display, 'none', '宿主原账号名仍留在DOM，但不得可见');
        assert.equal(h.document.querySelectorAll('[data-pdsh-probe]').length, 1, '三个运行时共享唯一样式 probe');
        assert.ok(probe.querySelector('.fixture-settings-field input'), 'probe 必须实际包含设置输入 DOM');
        assert.ok(probe.querySelector('[role="tooltip"]'), 'DOM-shape fixture 的 tooltip 留在 probe 子树');
        assert.equal(probe.hasAttribute('inert'), true);
        assert.equal(probe.getAttribute('aria-hidden'), 'true');
        assert.equal(h.document.defaultView.getComputedStyle(probe).opacity, '0');
        assert.equal(h.document.defaultView.getComputedStyle(probe).position, 'fixed');
        assert.equal(h.document.defaultView.getComputedStyle(probe).pointerEvents, 'none');
        for (const node of [probe, ...probe.querySelectorAll('*')]) {
          assert.equal(h.document.defaultView.getComputedStyle(node).visibility, 'hidden', node.tagName);
        }
      };
      assertStyled();
      assert.ok(style?.sheet?.cssRules.length, '运行时注入的合并样式表必须可解析并含 CSS rules');

      // +--- 同一 fixture 拿掉注入 stylesheet，必须重新暴露回归信号 ---+
      style.remove();
      assert.notEqual(h.document.defaultView.getComputedStyle(label).display, 'none', '没有样式时原账号名重新可见');
      assert.notEqual(h.document.defaultView.getComputedStyle(probe).opacity, '0', '没有样式时 probe 的防绘制保障失效');
      h.document.head.append(style);
      assertStyled();

      h.scopes.get('identity').disable();
      assert.equal(h.document.querySelector('[data-pdsh-name]'), null, '只停身份必须撤回别名');
      assert.notEqual(h.document.defaultView.getComputedStyle(label).display, 'none', '只停身份须恢复原账号名');
      assert.equal(h.document.querySelectorAll('[data-pdsh-probe]').length, 1, '其他组件仍活跃时共享 probe 保留');
      assert.equal(h.document.defaultView.getComputedStyle(probe).visibility, 'hidden', '共享 probe 继续不可见');
      h.scopes.get('identity').enable();
      assertStyled();

      for (const kind of ['identity', 'titles', 'capture']) h.scopes.get(kind).disable();
      assert.equal(h.document.body.outerHTML, h.before, '最后 owner 卸载后还原原生 DOM/body inline style');
      assert.equal(h.document.head.querySelector('style[data-plugin="@daftai/pdsh"]'), null);
      assert.equal(h.document.querySelector('[data-pdsh-probe]'), null);
      assert.equal(h.roots.size, 0);
    } finally { h.close(); }
  }
});
test('桥不存在时身份/标题仍工作；组件注册失败不留下页面资源或重复 owner', () => {
  const h = harness({ bridge: false }); try {
    for (const scope of h.scopes.values()) scope.enable();
    assert.equal(h.document.querySelector('[data-pdsh-capture-entry]'), null);
    assert.ok(h.document.querySelector('[data-pdsh-search-entry]'));
  } finally { h.close(); }
  const failed = harness({ failSlot: true }); try {
    for (let i = 0; i < 2; i++) {
      assert.throws(() => failed.scopes.get('identity').enable(), /slot unavailable/);
      assert.equal(failed.document.body.outerHTML, failed.before, '失败后恢复原页面');
      assert.equal(failed.document.querySelector('style'), null);
      assert.equal(failed.roots.size, 0); assert.equal(failed.registrations.size, 0);
    }
  } finally { failed.close(); }
});

test('Bundle 同时停用三个 Fiber，不能向已卸载 owner 新建 effect，仍完全归还资源', () => {
  const h = harness(); try {
    for (const scope of h.scopes.values()) scope.enable();
    for (const scope of h.scopes.values()) scope.unloading();
    for (const scope of h.scopes.values()) assert.doesNotThrow(() => scope.disable());
    assert.equal(h.document.body.outerHTML, h.before);
    assert.equal(h.document.querySelector('style'), null);
    assert.equal(h.registrations.size, 0); assert.equal(h.roots.size, 0);
  } finally { h.close(); }
});
