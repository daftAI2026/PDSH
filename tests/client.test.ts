/**
 * [INPUT]: 依赖生成的唯一 Bundle Client、Cordis 4 服务注册、ReactDOM 与 rc.2 DOM fixture。
 * [OUTPUT]: 验证单根生命周期、实际后台版本确认下的八种设置组合、独立恢复、取像取消、CSS 正负例与回滚。
 * [POS]: Client 集成合同；本测试证明源码/生成 Client 的服务图，不冒充 Host primitives、CSP 或实窗验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TextEncoder } from 'node:util';
import { runInNewContext } from 'node:vm';
import { Context } from '@deepseek-ai/cordis';
import React, { act } from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { createRoot as reactCreateRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { DEFAULTS } from '../src/shared/model.ts';
import { DEFAULT_CAPTURE_EXPORT } from '../src/shared/capture-export.ts';
import { dictionaries, NS } from '../src/shared/locales.ts';

const CLIENT = new URL('../client.js', import.meta.url);
const LABEL = dictionaries.zh.captureEnabled;

function loadBundle(createRoot, doc) {
  let row;
  const window = doc.defaultView;
  window.__ModuleLoader__ = { load(value) { assert.equal(value.id, '@daftai/pdsh'); row = value; } };
  runInNewContext(readFileSync(CLIENT, 'utf8'), {
    window,
    document: doc, TextEncoder, URL, Blob, AbortController,
    setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window),
  });
  delete window.__ModuleLoader__;
  assert.ok(row?.factory, '生成 Client 必须只暴露唯一 Bundle factory');
  const module = row.factory(id => {
    if (id === 'react') return React;
    if (id === 'react/jsx-runtime') return jsxRuntime;
    if (id === 'react-dom/client') return { createRoot };
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return primitives();
    throw new Error(`unexpected external module ${id}`);
  });
  assert.deepEqual([...module.inject], ['slots', 'locale', 'configForms', 'remote', 'remote.pluginManager']);
  return module;
}

function primitives() {
  return {
    Input: props => React.createElement('input', props),
    Button: ({ children, variant: _variant, ...props }) => React.createElement('button', props, children),
    Switch: ({ checked, label, disabled, onChange }) => React.createElement('button', {
      type: 'button', role: 'switch', 'aria-label': label, 'aria-checked': String(checked), disabled, onClick: onChange,
    }, React.createElement('span', { className: 'fixture-thumb' })),
    SettingsValueField: props => React.createElement('div', { className: 'fixture-settings-field' },
      React.createElement('div', { className: 'fixture-field-head' }, React.createElement('label', { htmlFor: props.id }, props.label)),
      React.createElement('input', { id: props.id, disabled: props.disabled, value: props.text, readOnly: true })),
    Tooltip: ({ children, label }) => React.createElement(React.Fragment, null, children,
      React.createElement('span', { role: 'tooltip' }, label)),
    IconCheckOutlineRegular: () => React.createElement('svg', { viewBox: '0 0 16 16' }),
    IconEditOutlineRegular: () => React.createElement('svg', { viewBox: '0 0 16 16' }),
    IconUserOutlineMedium: () => React.createElement('svg', { viewBox: '0 0 16 16' }),
    IconWarningOutlineRegular: () => React.createElement('svg', { viewBox: '0 0 16 16' }),
    Toast: ({ text }) => React.createElement('span', { role: 'status' }, text),
  };
}

function pageMarkup() {
  return `<body>
    <main>原生内容</main>
    <div data-slot="settings.launcher"><button type="button" data-collapsed="false" data-signed-out="false" aria-haspopup="menu" aria-expanded="false">
      <span class="native-avatar"><img src="native.png" alt=""></span><span class="native-label">真实名称</span>
    </button></div>
    <div data-slot="sidebar.workspaces"><div>
      <div><div><div><button type="button" class="native-search" aria-label="搜索会话" aria-expanded="false"><svg viewBox="0 0 16 16" style="width:14px;height:14px;stroke-width:1"><circle cx="7" cy="7" r="4"></circle><path d="m10 10 4 4"></path></svg></button><input type="text"></div></div></div>
      <div role="tree" aria-label="工作区与会话">
        <div role="treeitem" data-row-key="session:s-secret" aria-selected="false"><span><span>状态</span></span><span>秘密会话</span><span>现在</span><span>操作</span></div>
      </div>
    </div></div>
  </body>`;
}

function environment({ value = {}, status = 'ready', bridge = false, failRoot = false, failRender = false, failSlot = null, failMount = false } = {}) {
  const dom = new JSDOM(pageMarkup(), { url: 'dsh-app://desktop/index.html', pretendToBeVisual: true });
  const doc = dom.window.document, before = doc.body.outerHTML;
  Object.defineProperty(dom.window.navigator, 'platform', { configurable: true, value: 'MacIntel' });
  const descriptors = new Map(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: dom.window });
  Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: doc });
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { configurable: true, writable: true, value: true });

  const roots = new Set(), registrations = new Map(), dictionariesByNamespace = new Map(), localeListeners = new Set();
  let renderFailure = failRender;
  const createRoot = node => {
    if (failRoot) throw new Error('root creation failure');
    const mounted = reactCreateRoot(node);
    const root = {
      render(element) {
        if (renderFailure) throw new Error('render failure');
        act(() => mounted.render(element));
      },
      unmount() { act(() => mounted.unmount()); roots.delete(root); },
    };
    roots.add(root);
    return root;
  };
  const snapshot = {
    status, writable: true, revision: 0,
    value: { ...DEFAULTS, ...DEFAULT_CAPTURE_EXPORT, maskIdentity: true, maskTitles: true, captureEnabled: true, captureMaskIdentity: true, nickname: '别名', ...value },
  };
  const formListeners = new Set(), writes = [];
  const form = {
    getSnapshot: () => snapshot,
    subscribe(fn) {
      if (failMount) throw new Error('controller mount failure');
      formListeners.add(fn); return () => formListeners.delete(fn);
    },
    async mutate(ops, revision) {
      writes.push({ ops, revision });
      const path = ops[0]?.path?.[0];
      if (!path || revision !== snapshot.revision) return false;
      snapshot.revision++;
      snapshot.value = { ...snapshot.value, [path]: ops[0].value };
      for (const listener of [...formListeners]) listener();
      return true;
    },
  };
  const locale = {
    register(ns, values) { assert.equal(ns, NS); assert.ok(!dictionariesByNamespace.has(ns)); dictionariesByNamespace.set(ns, values); return () => dictionariesByNamespace.delete(ns); },
    bind(ns) { return key => dictionariesByNamespace.get(ns)[locale.getSnapshot().active][key]; },
    getSnapshot() { return { active: 'zh' }; },
    subscribe(fn) { localeListeners.add(fn); return () => localeListeners.delete(fn); },
  };
  const pluginManager = {
    async listBundles() { return { ok: true, value: [] }; },
    async installBundle() { assert.fail('Client 不得自动安装'); },
  };
  const slots = {
    inject(name, fn) { if (failSlot === `inject:${name}`) throw new Error(`slot inject failure: ${name}`); return fn(); },
    register(options, component) {
      if (failSlot === options.name || failSlot === `register:${options.name}`) throw new Error(`slot register failure: ${options.name}`);
      const key = `${options.name}:${options.key ?? options.id}`;
      assert.ok(!registrations.has(key), `不得重复注册 ${key}`);
      const item = { options, component };
      registrations.set(key, item);
      return () => { assert.equal(registrations.get(key), item); registrations.delete(key); };
    },
  };
  const configForms = {
    get(id) { assert.equal(id, 'pdsh'); return form; },
    whileServed(ids, callback) { assert.equal(ids.length, 1); assert.equal(ids[0], 'pdsh'); const dispose = callback(); return () => dispose?.(); },
  };
  const app = new Context(), diagnostics = [];
  app.logger.info = (...values) => diagnostics.push(values);
  app.logger.error = (...values) => diagnostics.push(['error', ...values]);
  const pageCapture = {
    pending: new Map(), cancelled: [],
    async implementationVersion() { return {ok: true, value: JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version}; },
    capture(signal) {
      const id=String(pageCapture.pending.size);
      let fail;
      const pending=new Promise((_resolve,reject)=>{fail=reject;pageCapture.pending.set(id,reject);});
      const cancel=()=>{pageCapture.cancelled.push(id);pageCapture.pending.delete(id);fail(new Error('cancelled'));};
      signal.addEventListener('abort',cancel,{once:true});
      return {send(){},end(){},dispose(){signal.removeEventListener('abort',cancel);},
        async *[Symbol.asyncIterator](){await pending;}};
    },
    save(){assert.fail('挂载不能保存');},
  };
  const provider = app.plugin(ctx => {
    ctx.provide('slots', slots);
    ctx.provide('locale', locale);
    ctx.provide('configForms', configForms);
    ctx.provide('remote', { pluginManager, ...(bridge?{pdshNativeWindowCapture:pageCapture}:{}), async $mount(){return ()=>{};} });
    ctx.provide('remote.pluginManager', pluginManager);
    if(bridge)ctx.provide('remote.pdshNativeWindowCapture',pageCapture);
  });
  const bundlePlugin = loadBundle(createRoot, doc);
  let bundle;
  const ready = (async () => { await provider; bundle = app.plugin(bundlePlugin); await bundle; })();
  return {
    dom, doc, before, roots, registrations, dictionariesByNamespace, form, formListeners, localeListeners, writes, pageCapture, diagnostics,
    finalBody: null,
    async start() { await ready; },
    async update(fields, nextStatus = snapshot.status) {
      snapshot.status = nextStatus; snapshot.revision++;
      snapshot.value = { ...snapshot.value, ...fields };
      for (const listener of [...formListeners]) listener();
      await new Promise(resolve => dom.window.setTimeout(resolve, 0));
    },
    failNextRender() { renderFailure = true; },
    async close() {
      try { await ready; } catch { /* 启动失败时仍须检查已回滚资源。 */ }
      try { await bundle?.dispose(); } finally {
        await provider.dispose();
        this.finalBody = doc.body.outerHTML;
        dom.window.close();
        for (const [key, descriptor] of descriptors) {
          if (descriptor) Object.defineProperty(globalThis, key, descriptor);
          else delete globalThis[key];
        }
      }
    },
  };
}

async function tick(dom) { await new Promise(resolve => dom.window.setTimeout(resolve, 15)); }

for (let mask = 0; mask < 8; mask++) test(`单 Bundle 的身份/标题/拍照设置组合 ${mask.toString(2).padStart(3, '0')}`, async () => {
  const h = environment({ value: {
    maskIdentity: Boolean(mask & 1), maskTitles: Boolean(mask & 2), captureEnabled: Boolean(mask & 4),
  }, bridge: true });
  try {
    await h.start();
    assert.equal(h.doc.querySelectorAll('[data-pdsh-name]').length, mask & 1 ? 1 : 0);
    assert.equal(h.doc.querySelectorAll('[data-pdsh-redacted-title="session"]').length, mask & 2 ? 1 : 0);
    assert.equal(h.doc.querySelectorAll('[data-pdsh-capture-entry]').length, mask & 4 ? 1 : 0);
    assert.equal(h.doc.querySelectorAll('[data-pdsh-probe]').length, 1, '共享视觉探针随唯一 Bundle 而非功能设置存在');
    assert.equal(h.registrations.size, 3, '一个 Bundle 只注册一次设置行、详情与更新 badge');
  } finally { await h.close(); }
  assert.equal(h.finalBody, h.before);
  assert.equal(h.roots.size, 0);
  assert.equal(h.registrations.size, 0);
});

test('身份停用只归还覆盖并保留昵称；标题停用撤回灰条且两者可独立切换', async () => {
  const h = environment({ bridge: true });
  try {
    await h.start();
    const nativeLabel = h.doc.querySelector('.native-label');
    const title = h.doc.querySelector('[data-row-key="session:s-secret"] > span:nth-child(2)');
    assert.equal(h.doc.defaultView.getComputedStyle(nativeLabel).display, 'none');
    assert.equal(title.getAttribute('data-pdsh-redacted-title'), 'session');
    await h.update({ maskIdentity: false });
    assert.equal(h.doc.querySelector('[data-pdsh-name]'), null);
    assert.notEqual(h.doc.defaultView.getComputedStyle(nativeLabel).display, 'none');
    assert.equal(h.form.getSnapshot().value.nickname, '别名');
    assert.equal(title.getAttribute('data-pdsh-redacted-title'), 'session');
    await h.update({ maskTitles: false });
    assert.equal(title.hasAttribute('data-pdsh-redacted-title'), false);
    assert.equal(h.doc.head.querySelector('style[data-pdsh-sidebar-redaction-style]'), null);
    assert.equal(h.doc.querySelector('[data-pdsh-search-entry]').getAttribute('aria-label'), '遮挡侧栏标题');
    await h.update({ maskIdentity: true });
    assert.equal(h.doc.querySelector('[data-pdsh-name]').textContent, '别名');
    assert.equal(title.hasAttribute('data-pdsh-redacted-title'), false);
  } finally { await h.close(); }
});

test('关闭拍照会取消在途整窗取像并卸载工作台；身份与标题仍继续工作', async () => {
  const h = environment({ bridge: true });
  try {
    await h.start();
    const camera = h.doc.querySelector('[data-pdsh-capture-entry]');
    assert.ok(camera);
    camera.click();
    for (let attempt = 0; attempt < 40 && h.pageCapture.pending.size === 0; attempt++) await tick(h.dom);
    assert.equal(h.pageCapture.pending.size, 1, `拍照点击发起整窗请求；trace=${JSON.stringify(h.diagnostics)}`);
    await h.update({ captureEnabled: false });
    for (let attempt = 0; attempt < 40 && h.pageCapture.cancelled.length === 0; attempt++) await tick(h.dom);
    assert.equal(h.pageCapture.cancelled.length, 1, '停用拍照取消所属 Remote 请求');
    assert.equal(h.doc.querySelector('[data-pdsh-capture-entry]'), null);
    assert.equal(h.doc.querySelector('[data-pdsh-capture-host]'), null, '迟到截图不能打开编辑器');
    assert.equal(h.doc.querySelector('[data-pdsh-name]').textContent, '别名');
    assert.equal(h.doc.querySelector('[data-row-key="session:s-secret"] > span:nth-child(2)').getAttribute('data-pdsh-redacted-title'), 'session');
    await h.update({ maskTitles: false });
    assert.equal(h.doc.querySelector('[data-pdsh-name]').textContent, '别名');
    assert.equal(h.doc.querySelector('[data-pdsh-capture-entry]'), null);
  } finally { await h.close(); }
});

test('唯一真实 ReactDOM 探针计算隐藏可见性；移除同一 CSS 表会显露负例', async () => {
  const h = environment({ bridge: false });
  try {
    await h.start();
    const label = h.doc.querySelector('.native-label'), probe = h.doc.querySelector('[data-pdsh-probe]');
    const style = h.doc.head.querySelector('style[data-plugin="@daftai/pdsh"]');
    assert.equal(h.doc.querySelectorAll('[data-pdsh-probe]').length, 1);
    assert.equal(h.doc.querySelectorAll('[data-pdsh-name]').length, 1);
    assert.equal(h.doc.defaultView.getComputedStyle(label).display, 'none');
    assert.ok(probe.querySelector('.fixture-settings-field input'));
    assert.ok(probe.querySelector('[role="tooltip"]'));
    assert.equal(probe.getAttribute('aria-hidden'), 'true');
    assert.equal(probe.hasAttribute('inert'), true);
    assert.equal(h.doc.defaultView.getComputedStyle(probe).opacity, '0');
    assert.equal(h.doc.defaultView.getComputedStyle(probe).position, 'fixed');
    for (const node of [probe, ...probe.querySelectorAll('*')]) {
      assert.equal(h.doc.defaultView.getComputedStyle(node).visibility, 'hidden', node.tagName);
    }
    assert.ok(style?.sheet?.cssRules.length);
    style.remove();
    assert.notEqual(h.doc.defaultView.getComputedStyle(label).display, 'none', '撤去 CSS 后别名对原生昵称的遮挡失效');
    assert.notEqual(h.doc.defaultView.getComputedStyle(probe).opacity, '0', '撤去 CSS 后探针防绘制失效');
    h.doc.head.append(style);
  } finally { await h.close(); }
});

test('配置未就绪时身份/标题恢复灰掉，拍照不启动', async () => {
  const h = environment({ status: 'loading', value: { maskIdentity: true, maskTitles: true, captureEnabled: true }, bridge: true });
  try {
    await h.start();
    const nativeLabel = h.doc.querySelector('.native-label'), entry = h.doc.querySelector('[data-pdsh-search-entry]');
    assert.equal(h.doc.querySelector('[data-pdsh-name]'), null);
    assert.notEqual(h.doc.defaultView.getComputedStyle(nativeLabel).display, 'none');
    assert.equal(h.doc.querySelector('[data-row-key="session:s-secret"] > span:nth-child(2)').hasAttribute('data-pdsh-redacted-title'), false);
    assert.equal(entry.disabled, true, 'Host 未接受配置时帽子显示但不可写');
    assert.equal(h.doc.querySelector('[data-pdsh-capture-entry]'), null);
    assert.equal(h.registrations.size, 3, '设置仍由唯一 Bundle 所有');
  } finally { await h.close(); }
});

test('root/render/slot/mount 注册异常均回滚样式、React root、DOM 标记与监听器', async t => {
  for (const mode of ['root', 'render', 'slot', 'mount']) await t.test(mode, async () => {
    const h = environment({ bridge: true, failRoot: mode === 'root', failRender: mode === 'render', failSlot: mode === 'slot' ? 'plugins.detail.badge' : null, failMount: mode === 'mount' });
    try {
      try { await h.start(); } catch { /* Cordis 将启动错误记录在失败 Fiber，重点是资源回收。 */ }
      assert.equal(h.doc.body.outerHTML, h.before, `${mode} 失败后恢复原页面`);
      assert.equal(h.doc.head.querySelector('style[data-plugin="@daftai/pdsh"]'), null);
      assert.equal(h.doc.querySelector('[data-pdsh-sidebar-redaction-style]'), null);
      assert.equal(h.roots.size, 0);
      assert.equal(h.registrations.size, 0);
      assert.equal(h.formListeners.size, 0);
      assert.equal(h.localeListeners.size, 0);
    } finally { await h.close(); }
  });
});
