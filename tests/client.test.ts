/**
 * [INPUT]: 依赖生成 Client、Cordis、ReactDOM、平台标识与共享组合根加载器。
 * [OUTPUT]: 验证两 Remote、平台 provider 门、几何代际、字形清理、相机插槽。
 * [POS]: 组合根合同；不冒充 Host、原生像素或 Desktop 验收。
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
import { loadComponentRuntime } from './client-runtime-fixture.ts';

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
    LinkIconRegular: ({ kind, href }) => React.createElement('svg', { 'data-native-link-kind': kind, 'data-native-link-href': href, viewBox: '0 0 24 24' }),
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

  const roots = new Set(), registrations = new Map(), dictionariesByNamespace = new Map(), localeListeners = new Set(), settingsViews = new Set();
  let activeLocale = 'zh';
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
    getSnapshot() { return { active: activeLocale }; },
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
    renderSettings(view = 'detail', slot = 'plugins.bundle.config') {
      const item = registrations.get(`${slot}:${slot === 'plugins.row.config' ? '@daftai/pdsh#pdsh' : '@daftai/pdsh'}`);
      assert.ok(item, '必须通过生产 slot 呈现设置，不能另建页脚演示');
      const node = doc.createElement('div'); doc.body.append(node);
      const root = createRoot(node);
      const render = nextView => root.render(React.createElement(item.component, { view: nextView }));
      const close = () => { root.unmount(); node.remove(); settingsViews.delete(close); };
      settingsViews.add(close); render(view);
      return { node, render, close };
    },
    changeLocale(next) {
      act(() => { activeLocale = next; for (const listener of [...localeListeners]) listener(); });
    },
    async update(fields, nextStatus = snapshot.status) {
      snapshot.status = nextStatus; snapshot.revision++;
      snapshot.value = { ...snapshot.value, ...fields };
      for (const listener of [...formListeners]) listener();
      await new Promise(resolve => dom.window.setTimeout(resolve, 0));
    },
    failNextRender() { renderFailure = true; },
    async close() {
      try { await ready; } catch { /* 启动失败时仍须检查已回滚资源。 */ }
      for (const close of [...settingsViews]) close();
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

function assertBundleSlots(registrations) {
  assert.deepEqual([...registrations.values()].map(item => item.options.name).sort(), [
    'conversation.session.header.utilities', 'plugins.bundle.config',
    'plugins.detail.badge', 'plugins.row.config',
  ]);
}


function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function flushMicrotasks() {
  for (let index = 0; index < 10; index++) await Promise.resolve();
}

function replaceExactlyOnce(source, before, after) {
  assert.equal(source.split(before).length - 1, 1, `expected exactly one mutation target: ${before}`);
  return source.replace(before, after);
}

async function assertCapabilityHandshakeLifecycle(mutateSource, {
  capabilityFirst = false,
  delayBaseReadiness = false,
  replaceBaseWhilePending = false,
  platform = 'MacIntel',
} = {}) {
  const dom = new JSDOM(pageMarkup(), { url: 'dsh-app://desktop/index.html', pretendToBeVisual: true });
  Object.defineProperty(dom.window.navigator, 'platform', { configurable: true, value: platform });
  const assemblies = { controllers: [], entries: [], adapters: [], typography: [] };
  const mountComponent = await loadComponentRuntime(assemblies, mutateSource);
  const value = { ...DEFAULTS, ...DEFAULT_CAPTURE_EXPORT, captureEnabled: true, captureMaskIdentity: true };
  const snapshot = { status: 'ready', revision: 0, value };
  const formListeners = new Set(), lifetime = [], providers = [];
  const injectors = new Map();
  const diagnostics = [];
  const form = {
    getSnapshot: () => snapshot,
    subscribe(listener) { formListeners.add(listener); return () => formListeners.delete(listener); },
  };
  const ctx = {
    configForms: {
      get(id) { assert.equal(id, 'pdsh'); return form; },
      whileServed(ids, callback) { assert.equal(ids.length, 1); assert.equal(ids[0], 'pdsh'); return callback(); },
    },
    locale: {
      register() { return () => {}; }, bind() { return key => key; },
      getSnapshot() { return { active: 'zh' }; }, subscribe() { return () => {}; },
    },
    slots: { inject(_name, callback) { return callback(); }, register() { return () => {}; } },
    remote: { pluginManager: {} },
    logger: { info() {}, warn(...values) { diagnostics.push(values); }, error(...values) { diagnostics.push(values); } },
    effect(factory) { const cleanup = factory(); if (typeof cleanup === 'function') lifetime.push(cleanup); return cleanup; },
    inject(names, callback) {
      assert.equal(names.length, 1);
      assert.ok(['remote.pdshNativeWindowCapture', 'remote.pdshRuntimeCapabilities'].includes(names[0]));
      assert.ok(!injectors.has(names[0]));
      injectors.set(names[0], callback);
      return { dispose() { for (const provider of providers.filter(item => item.name === names[0])) provider.dispose(); } };
    },
  };
  const disposeBundle = () => { for (const cleanup of lifetime.reverse()) cleanup(); };
  mountComponent(ctx, dom.window.document);
  assert.equal(assemblies.typography.length, 1, 'Bundle 生命周期安装一次详情字形适配器');
  const gates = [deferred(), deferred(), deferred()];
  let handshake = 0, nextHandshake = 0, currentHandshake = 0;
  let captureReady = !delayBaseReadiness;
  let captureReadiness = deferred();
  const captureRemote = {
    async implementationVersion() {
      const readiness = captureReadiness;
      return captureReady ? { ok: true, value: '0.5.1' } : await readiness.promise;
    },
    wallpaperRegistered() { assert.fail('基础壳握手不能授权 capability') },
    wallpaper() { assert.fail('基础壳媒体方法不能授权 capability') },
    captureCalls: 0,
    capture() { this.captureCalls++; }, save() {},
  };
  let capabilityVersion = '0.5.1';
  let capabilityVersionReads = 0;
  let geometryRegistered = true, geometryReads = 0;
  const capabilityRemote = {
    async implementationVersion() { capabilityVersionReads++; return { ok: true, value: capabilityVersion }; },
    wallpaperRegistered() { handshake++; return gates[currentHandshake].promise; },
    wallpaper() { assert.fail('测试只验证 readiness，不消费媒体流') },
    captureGeometryRegistered: async () => ({ ok: true, value: geometryRegistered }),
    captureGeometry: async () => { geometryReads++; return { ok: true, value: null }; },
  };
  const inject = (name, remote) => {
    let cleanup, active = true;
    const key = name === 'capture' ? 'remote.pdshNativeWindowCapture' : 'remote.pdshRuntimeCapabilities';
    const service = name === 'capture' ? 'pdshNativeWindowCapture' : 'pdshRuntimeCapabilities';
    if (name === 'capability') currentHandshake = Math.min(nextHandshake++, gates.length - 1);
    const provider = {
      remote: { [service]: remote },
      effect(factory) { cleanup = factory(); return cleanup; },
    };
    const inject = injectors.get(key);
    assert.equal(typeof inject, 'function', `${key} 必须各自订阅官方 Remote`);
    inject(provider);
    const record = { name, dispose() { if (!active) return; active = false; cleanup?.(); } };
    providers.push(record); return record;
  };

  try {
    let captureProvider, firstProvider, controller, entry;
    if (capabilityFirst) {
      firstProvider = inject('capability', capabilityRemote);
      await flushMicrotasks();
      assert.equal(assemblies.controllers.length, 0, 'capability 早到时不伪造基础截图入口');
      assert.equal(capabilityVersionReads, 0, '缺少基础 Remote 时不得探测 capability');
      assert.equal(handshake, 0, '缺少基础 Remote 时不得运行注册握手');
      captureProvider = inject('capture', captureRemote);
    } else {
      captureProvider = inject('capture', captureRemote);
    }
    controller = assemblies.controllers.at(-1);
    entry = assemblies.entries.at(-1);
    assert.ok(controller, `基础 Remote 注入后必须装配截图 controller: ${JSON.stringify(diagnostics)}`);
    assert.ok(entry?.options.capture, '基础截图入口不等待可选 capability');
    assert.equal(controller.options.readSystemWallpapers(), undefined,
      '基础壳即使保留旧 wallpaper 方法也不能授权新增入口');
    if (capabilityFirst) {
      if (delayBaseReadiness) {
        await flushMicrotasks();
        assert.equal(handshake, 0, '基础 Host runtime 未就绪时不得握手 capability');
        assert.equal(capabilityVersionReads, 0, '基础 Host runtime 未就绪时不得读取 capability 版本');
        captureReady = true;
        captureReadiness.resolve({ ok: true, value: '0.5.1' });
      }
    } else {
      firstProvider = inject('capability', capabilityRemote);
    }
    if (replaceBaseWhilePending) {
      await flushMicrotasks();
      assert.equal(handshake, 0, '基础 runtime 未 settle 时不得握手 capability');
      const oldReadiness = captureReadiness;
      captureProvider.dispose();
      captureReadiness = deferred();
      captureReady = false;
      captureProvider = inject('capture', captureRemote);
      controller = assemblies.controllers.at(-1);
      entry = assemblies.entries.at(-1);
      await flushMicrotasks();
      oldReadiness.resolve({ ok: true, value: '0.5.1' });
      await flushMicrotasks();
      assert.equal(handshake, 0, '旧基础世代 settle 不得启动扩展握手');
      captureReady = true;
      captureReadiness.resolve({ ok: true, value: '0.5.1' });
    }
    await flushMicrotasks();
    assert.equal(handshake, 1, '基础实际版本就绪后才启动 capability 注册握手');
    const controllerCount = assemblies.controllers.length;
    assert.equal(controller.options.readSystemWallpapers(), undefined,
      'capability 注册握手未结算时不开放壁纸入口');

    gates[0].resolve({ ok: true, value: false });
    await flushMicrotasks();
    assert.equal(assemblies.controllers.length, controllerCount, '扩展握手失败不撤回基础 controller');
    assert.equal(assemblies.entries.at(-1), entry, '扩展握手失败不重建基础相机入口');
    assert.equal(controller.options.readSystemWallpapers(), undefined);
    await controller.options.capture(dom.window.document, { signal: new AbortController().signal });
    assert.equal(captureRemote.captureCalls, 1, '扩展握手失败仍允许当前基础 Capture Remote 取像');
    assert.equal(await assemblies.activateInstalled('0.5.1'), false,
      '基础实现版本匹配不能单独宣称新增能力已激活');

    firstProvider.dispose();
    const secondProvider = inject('capability', capabilityRemote);
    await flushMicrotasks();
    assert.equal(assemblies.controllers.at(-1), controller, 'capability 重注入不重建截图 controller');
    assert.equal(assemblies.entries.at(-1), entry, 'capability 重注入不重建相机入口');
    const thirdProvider = inject('capability', capabilityRemote);
    await flushMicrotasks();
    secondProvider.dispose();
    assert.equal(controller.options.readSystemWallpapers(), undefined);

    gates[1].resolve({ ok: true, value: true });
    await flushMicrotasks();
    assert.equal(assemblies.controllers.at(-1), controller,
      '旧 capability 世代迟到 true 不重建基础 controller');
    assert.equal(assemblies.entries.at(-1), entry,
      '旧 capability 世代迟到 true 不重建相机入口');
    assert.equal(controller.options.readSystemWallpapers(), undefined,
      '同 proxy 身份不能让旧 Promise 授权当前 capability 世代');

    gates[2].resolve({ ok: true, value: true });
    await flushMicrotasks();
    assert.equal(assemblies.controllers.at(-1), controller, '迟到的正确握手不重建 controller');
    assert.equal(assemblies.entries.at(-1), entry, '迟到的正确握手不重建相机入口');
    const adapter = controller.options.readSystemWallpapers();
    const wallpaperSupported = platform.startsWith('Mac') || platform.startsWith('Win');
    if (wallpaperSupported) {
      assert.equal(adapter, assemblies.adapters.at(-1), '受支持平台仍须等待当前 capability 版本与握手');
      assert.equal(adapter.remote, capabilityRemote, '壁纸 adapter 必须使用独立 capability Remote');
      assert.equal(typeof adapter.options.beforeRequest, 'function', '每次壁纸动作必须经过 capability 版本围栏');
    } else {
      assert.equal(adapter, undefined, 'Linux 不伪造系统壁纸 provider');
      assert.equal(assemblies.adapters.length, 0);
    }
    assert.equal(await assemblies.activateInstalled('0.5.1'), true,
      'Updater activation 同时要求基础和 capability 的实际版本/握手');
    if (platform.startsWith('Win')) {
      geometryRegistered = false;
      assert.equal(await assemblies.activateInstalled('0.5.1'), false, 'Windows 新几何未注册时不能把新能力升级标为通过');
      const readGeometry = assemblies.captures.at(-1).readGeometry;
      assert.equal(typeof readGeometry, 'function', 'Windows 截图须接入独立几何读取');
      assert.equal(await readGeometry('a'.repeat(64)), undefined, '旧代理世代不借用当前扩展');
      assert.equal(geometryReads, 0);
      geometryRegistered = true;
      await controller.options.capture(dom.window.document, { signal: new AbortController().signal });
      assert.equal(await assemblies.captures.at(-1).readGeometry('a'.repeat(64)), null);
      assert.equal(geometryReads, 1);
    }
    if (adapter) await adapter.options.beforeRequest();
    capabilityVersion = '0.5.0';
    if (adapter) await assert.rejects(adapter.options.beforeRequest(), /runtime-not-current/,
      '每次壁纸动作都重新核对 capability 实际版本');
    capabilityVersion = '0.5.1';

    thirdProvider.dispose();
    assert.equal(controller.options.readSystemWallpapers(), undefined, 'dispose 立即撤回本地入口订阅');
    if (adapter) await assert.rejects(adapter.options.beforeRequest(), /runtime-not-current/,
      'dispose 后旧 adapter 不得继续使用 capability proxy');
    assert.equal(assemblies.controllers.at(-1), controller, '扩展 dispose 不重建正在编辑的工作台');
    captureProvider.dispose();
  } finally {
    disposeBundle();
    dom.window.close();
  }
  assert.equal(formListeners.size, 0, '卸载解除配置订阅');
  assert.equal(assemblies.controllers.at(-1).disposed, true, '卸载归还当前 controller');
  assert.equal(assemblies.typography.at(-1).disposed, true, '卸载归还详情字形观察器');
}

test('真实 component-runtime 分离基础截图与 capability 的迟到握手和世代', async () => {
  await assertCapabilityHandshakeLifecycle();
  await assertCapabilityHandshakeLifecycle(undefined, { platform: 'Win32' });
  await assertCapabilityHandshakeLifecycle(undefined, { capabilityFirst: true, delayBaseReadiness: true });
  await assertCapabilityHandshakeLifecycle(undefined, { delayBaseReadiness: true, replaceBaseWhilePending: true });
  const removeIncarnationFence = source => replaceExactlyOnce(source,
    'runtimeCapabilitiesRemote === capabilities && runtimeCapabilitiesGeneration === capabilitiesGeneration) {\n          runtimeCapabilitiesReady = ready;',
    'runtimeCapabilitiesRemote === capabilities) {\n          runtimeCapabilitiesReady = ready;');
  await assert.rejects(assertCapabilityHandshakeLifecycle(removeIncarnationFence),
    /同 proxy 身份不能让旧 Promise 授权当前 capability 世代/);
  const removeCaptureGenerationFence = source => replaceExactlyOnce(source,
    'captureRemoteGeneration !== captureGeneration ||\n            runtimeCapabilitiesRemote !== capabilities',
    'runtimeCapabilitiesRemote !== capabilities');
  await assert.rejects(assertCapabilityHandshakeLifecycle(removeCaptureGenerationFence, {
    delayBaseReadiness: true,
    replaceBaseWhilePending: true,
  }), /旧基础世代 settle 不得启动扩展握手/);
  const baseMethodAuthorization = source => replaceExactlyOnce(source,
    'readSystemWallpapers: () => captureRemote === remote && runtimeCapabilitiesRemote && runtimeCapabilitiesReady ? runtimeWallpaperAdapter : undefined,',
    "readSystemWallpapers: () => typeof remote.wallpaper === 'function' ? { remote } : undefined,");
  await assert.rejects(assertCapabilityHandshakeLifecycle(baseMethodAuthorization),
    /基础壳即使保留旧 wallpaper 方法也不能授权新增入口/);
});

test('项目页脚只在两种实际设置详情底部呈现；摘要不添加链接或设置写入', async () => {
  const h = environment({ bridge: false });
  try {
    await h.start();
    for (const slot of ['plugins.bundle.config', 'plugins.row.config']) {
      const settings = h.renderSettings('detail', slot);
      const footer = settings.node.querySelector('footer.pdsh-project-footer');
      assert.ok(footer, '设置详情缺少底部项目链接');
      assert.equal(settings.node.lastElementChild, footer, '页脚必须在全部功能设置之后');
      const project = footer.querySelector('a[href="https://github.com/daftAI2026/PDSH"]');
      assert.ok(project, 'GitHub 图标必须链接当前项目，而非 Star API');
      assert.equal(project.target, '_blank');
      assert.deepEqual(project.rel.split(' ').sort(), ['noopener', 'noreferrer']);
      assert.ok(project.getAttribute('aria-label')?.includes('GitHub'));
      assert.ok(project.querySelector('svg')?.closest('[aria-hidden="true"]'));
      assert.equal(project.querySelector('svg')?.getAttribute('data-native-link-kind'), 'url');
      assert.equal(project.querySelector('svg')?.getAttribute('data-native-link-href'), project.href);
      assert.equal(project.querySelector('svg')?.hasAttribute('tabindex'), false);
      assert.equal(project.getAttribute('title'), null, '使用官方 Tooltip，不添加浏览器气泡');
      assert.ok(footer.querySelector('[role="tooltip"]'), '无文字 GitHub 链接保留原生 Tooltip');
      assert.equal(project.tabIndex, 0, '项目链接保留键盘焦点');
      assert.equal(project.textContent, '', '项目入口只显示 GitHub 图标');
      const author = footer.querySelector('a[href="https://x.com/singkid9527"]');
      assert.ok(author, '作者链接必须指向用户确认的 X 地址');
      assert.equal(author.textContent, '@daftAI', '显示名不能从 URL 用户名推导');
      assert.equal(author.target, '_blank');
      assert.deepEqual(author.rel.split(' ').sort(), ['noopener', 'noreferrer']);
      assert.equal(author.tabIndex, 0);
      assert.equal(author.querySelector('svg'), null, '作者入口只显示 @daftAI');
      settings.render('summary');
      assert.equal(settings.node.querySelector('footer'), null);
      assert.equal(settings.node.querySelector('a'), null);
      assert.equal(settings.node.textContent, dictionaries.zh.description);
      settings.close();
    }
    assert.deepEqual(h.writes, [], '项目链接与文案不写 Host Settings');
    assert.equal(h.pageCapture.pending.size, 0, '展示项目链接不取像');
  } finally { await h.close(); }
  assert.equal(h.roots.size, 0); assert.equal(h.localeListeners.size, 0);
});

test('页脚整排把 Star 与 GitHub 成组，作者保留独立末端入口', async () => {
  const h = environment({ bridge: false });
  try {
    await h.start(); const settings = h.renderSettings();
    const footer = settings.node.querySelector('footer.pdsh-project-footer');
    const support = footer?.querySelector('.pdsh-project-support');
    assert.ok(support, 'Star 提示与 GitHub 必须属于同一可换行组');
    assert.equal(footer.firstElementChild, support);
    assert.equal(support.firstElementChild.tagName, 'P');
    assert.equal(support.querySelector('p').textContent, dictionaries.zh['project.star']);
    assert.ok(support.querySelector('a.pdsh-project-github'));
    const author = footer.querySelector('a.pdsh-project-author');
    assert.ok(author, '作者入口须有独立排版边界');
    assert.equal(author.closest('.pdsh-project-support'), null);
    assert.equal(footer.querySelectorAll('a').length, 2);
    h.changeLocale('en');
    assert.equal(support.querySelector('p').textContent, dictionaries.en['project.star']);
    assert.equal(footer.querySelector('.pdsh-project-support'), support);
    assert.deepEqual(h.writes, []);
  } finally { await h.close(); }
});

test('Host 语言变化即时更新 Star 文案与项目可访问名称，无独立语言状态', async () => {
  const h = environment({ bridge: false });
  try {
    await h.start(); const settings = h.renderSettings();
    const footer = () => settings.node.querySelector('footer.pdsh-project-footer');
    assert.ok(footer());
    assert.equal(footer().querySelector('p')?.textContent, '如果 PDSH 对你有帮助，欢迎在 GitHub 点个 Star 支持我们 👉');
    const project = footer().querySelector('a');
    const author = footer().querySelector('a[href="https://x.com/singkid9527"]');
    assert.ok(author);
    const chineseLabel = project.getAttribute('aria-label');
    h.changeLocale('en');
    assert.equal(footer().querySelector('p')?.textContent, 'If PDSH helps you, please support us with a Star on GitHub 👉');
    assert.equal(footer().querySelector('a'), project, '语言切换不重建项目链接');
    assert.notEqual(project.getAttribute('aria-label'), chineseLabel);
    assert.equal(author.textContent, '@daftAI', '英文界面不翻译固定作者名');
    assert.equal(footer().querySelector('a[href="https://x.com/singkid9527"]'), author);
    assert.equal(author.getAttribute('aria-label'), 'Follow @daftAI on X / Twitter');
    h.changeLocale('zh');
    assert.equal(footer().querySelector('p')?.textContent, '如果 PDSH 对你有帮助，欢迎在 GitHub 点个 Star 支持我们 👉');
    assert.equal(project.getAttribute('aria-label'), chineseLabel);
    assert.equal(author.textContent, '@daftAI');
    assert.equal(author.getAttribute('aria-label'), '在 X / Twitter 关注 @daftAI');
    assert.deepEqual(h.writes, []);
  } finally { await h.close(); }
});

test('Host 配置 loading 不阻断静态项目链接，也不增加可提交字段', async () => {
  const h = environment({ status: 'loading', bridge: false });
  try {
    await h.start(); const settings = h.renderSettings();
    const footer = settings.node.querySelector('footer.pdsh-project-footer');
    assert.ok(footer?.querySelector('a[href="https://github.com/daftAI2026/PDSH"]'));
    assert.equal(footer.querySelector('input, button, [role="switch"]'), null);
    assert.deepEqual(h.writes, []);
  } finally { await h.close(); }
});

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
    assertBundleSlots(h.registrations);
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
    assertBundleSlots(h.registrations);
  } finally { await h.close(); }
});

test('会话相机追加官方 utilities，不覆盖既有 corner', async () => {
  const h = environment({ bridge: true });
  try {
    await h.start();
    const entries = [...h.registrations.values()].filter(item => item.options.name === 'conversation.session.header.utilities');
    assert.equal(entries.length, 1, '生成 Client 必须注册唯一会话相机');
    assert.equal(entries[0].options.id, 'pdsh-capture');
    assert.ok(entries[0].options.order < -10, '相机排在官方 open-in-app 之前');
    assert.equal([...h.registrations.values()].some(item => item.options.name === 'conversation.session.header.corner'), false);
    assert.equal(h.pageCapture.pending.size, 0, '注册入口不取像');
    await h.update({ captureEnabled: false });
    assert.equal(h.doc.querySelector('[data-pdsh-capture-entry]'), null);
    assert.equal(h.pageCapture.pending.size, 0, '关闭截图不取像');
  } finally { await h.close(); }
  assert.equal(h.registrations.size, 0, '停用归还自身 slot');
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
