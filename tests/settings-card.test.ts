/**
 * [INPUT]: 依赖真实 SettingsCard/历史面板 JSX 与 React/jsdom；primitives 桩替代外观、定位和外点 hook。
 * [OUTPUT]: 验证设置即时提交、局部草稿/异步冲突，历史原子提交、迟到清除围栏与焦点边界、真实 MutationObserver 驱动的账号头像登出/恢复。
 * [POS]: PDSH 设置交互回归；真实 presentation 驱动 JSX，宿主 token 与布局由 runtime 截图另验。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import * as model from '../src/shared/model.ts';
import * as avatarHistory from '../src/shared/avatar-history.ts';
import { dictionaries } from '../src/shared/locales.ts';
import { mountPresentation } from '../src/client/presentation.ts';

async function mountSettings({ fileReader, imageDecode, value, presentation: initialPresentation, realPresentation = false, t = key => key } = {}) {
  const dom = new JSDOM('<body><main></main></body>', { url: 'http://localhost' });
  const previous = new Map(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const { createPortal } = await import('react-dom');
  const buttonHandlers = new Map();
  const primitives = {
    Input: props => React.createElement('span', {}, React.createElement('input', props)),
    Button: ({ children, variant, size, ...props }) => {
      buttonHandlers.set(props['aria-label'] ?? children, props.onClick);
      return React.createElement('button', { type: 'button', 'data-variant': variant, 'data-size': size, ...props }, children);
    },
    MenuSurface: React.forwardRef((props, ref) => React.createElement('div', { ...props, ref })),
    useAnchoredPosition: ({ open }) => open ? { left: 0, top: 0 } : null,
    useDismissOnOutsidePointer: (root, open, dismiss, panel) => React.useEffect(() => {
      if (!open) return;
      const outside = event => { if (!root.current?.contains(event.target) && !panel.current?.contains(event.target)) dismiss(false); };
      dom.window.document.addEventListener('pointerdown', outside);
      return () => dom.window.document.removeEventListener('pointerdown', outside);
    }, [open, root, panel, dismiss]),
    IconUserOutlineMedium: () => React.createElement('svg'),
    IconEditOutlineRegular: () => React.createElement('svg'),
    IconCheckOutlineRegular: () => React.createElement('svg'),
    Tooltip: ({ children, label, side, delayMs, focusDelayMs, portal }) => React.cloneElement(children, { 'data-native-tooltip': label, 'data-side': side, 'data-delay-ms': delayMs, 'data-focus-delay-ms': focusDelayMs, 'data-portal': String(portal) }),
    Switch: ({ label, checked, onChange, disabled, title }) => React.createElement('input', { type: 'checkbox', role: 'switch', 'aria-label': label, checked, disabled, title, onChange: event => onChange(event.target.checked) }),
  };
  const module = { exports: {} };
  const avatarImage = { exports: {} };
  runInNewContext(transformSync(readFileSync(new URL('../src/client/avatar-image.tsx', import.meta.url), 'utf8'), { loader: 'tsx', format: 'cjs' }).code,
    { module: avatarImage, exports: avatarImage.exports, require: id => { if (id === 'react') return React; throw new Error(id); } });
  const popover = { exports: {} };
  const popoverCode = transformSync(readFileSync(new URL('../src/client/avatar-history-popover.tsx', import.meta.url), 'utf8'), { loader: 'tsx', format: 'cjs' }).code;
  runInNewContext(popoverCode, { module: popover, exports: popover.exports, require(id) {
    if (id === 'react') return React;
    if (id === 'react-dom') return { createPortal };
    if (id === './avatar-image.tsx') return avatarImage.exports;
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return primitives;
    throw new Error(id);
  } });
  const code = transformSync(readFileSync(new URL('../src/client/settings-card.tsx', import.meta.url), 'utf8'), { loader: 'tsx', format: 'cjs' }).code;
  runInNewContext(code, { module, exports: module.exports, FileReader: fileReader ?? dom.window.FileReader,
    Image: class { async decode() { await imageDecode?.(); } }, require(id) {
    if (id === 'react') return React;
    if (id === './avatar-history-popover.tsx') return popover.exports;
    if (id === './avatar-image.tsx') return avatarImage.exports;
    if (id === '../shared/model.ts') return model;
    if (id === '../shared/avatar-history.ts') return avatarHistory;
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return primitives;
    throw new Error(id);
  } });
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(dom.window.document.querySelector('main'));
  const listeners = new Set(), writes = [];
  let snapshot = { status: 'ready', writable: true, revision: 7, value: { ...model.DEFAULTS, avatarHistory: [], ...value } };
  let accepted = false;
  let presentationController = null;
  const form = { getSnapshot: () => snapshot, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, async mutate(ops, revision) { writes.push({ ops, revision }); if (accepted) { snapshot = { ...snapshot, revision: snapshot.revision + 1, value: { ...snapshot.value, ...Object.fromEntries(ops.map(op => [op.path[0], op.value])) } }; presentationController?.update(model.resolvePreferences(snapshot.value)); for (const fn of listeners) fn(); } return accepted; } };
  const presentationListeners = new Set();
  let presentationSnapshot = { accountAvatar: 'official.png', accountStatus: 'signed-in', status: 'disabled', ...initialPresentation };
  const fakePresentation = {
    accountAvatar: () => presentationSnapshot.accountAvatar,
    accountStatus: () => presentationSnapshot.accountStatus,
    status: () => presentationSnapshot.status,
    subscribe(fn) { presentationListeners.add(fn); return () => presentationListeners.delete(fn); },
  };
  const doc = dom.window.document;
  if (realPresentation) {
    doc.body.insertAdjacentHTML('afterbegin', '<div data-slot="settings.launcher"><button type="button" data-collapsed="false" data-signed-out="false" aria-haspopup="menu"><span class="native-avatar"><img src="official.png" alt=""></span><span class="native-label">账号</span></button></div>');
    presentationController = mountPresentation(doc);
    presentationController.update(model.resolvePreferences(snapshot.value));
  }
  const presentation = presentationController ?? fakePresentation;
  const buttons = () => [...doc.querySelectorAll('button')];
  const button = name => buttons().find(node => node.textContent === name || node.getAttribute('aria-label') === name || node.getAttribute('aria-label')?.startsWith(`${name}: `));
  return { doc, dom, root, button, writes, form, presentation, listeners, handler: name => buttonHandlers.get(name),
    accept(value) { accepted = value; },
    async snapshot(changes) { await act(async () => { snapshot = { ...snapshot, ...changes }; for (const fn of listeners) fn(); }); },
    async render() { await act(async () => root.render(React.createElement(module.exports.SettingsCard, { preferencesForm: form, presentation, t }))); },
    async input(node, value) { await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(node, value);
      node.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    }); },
    async selectFile() { const node = doc.querySelector('input[type="file"]');
      Object.defineProperty(node, 'files', { configurable: true, value: [{ type: 'image/png', size: 32 }] });
      await act(async () => node.dispatchEvent(new dom.window.Event('change', { bubbles: true })));
    },
    async close() {
      await act(async () => root.unmount());
      presentationController?.dispose();
      dom.window.close();
      for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
      assert.equal(listeners.size, 0); assert.equal(presentationListeners.size, 0);
    },
    async publishPresentation(changes) { await act(async () => { presentationSnapshot = { ...presentationSnapshot, ...changes }; for (const fn of presentationListeners) fn(); }); },
    setPresentation(changes) { presentationSnapshot = { ...presentationSnapshot, ...changes }; },
    Component: module.exports.SettingsCard,
  };
}

async function editName(h, text) {
  await act(async () => h.button('editNickname').click());
  await h.input(h.doc.querySelector('#pdsh-nickname'), text);
}
function readerFixture() {
  const readers = [];
  class Reader {
    readAsDataURL() { readers.push(this); }
    abort() { this.onabort?.(); }
    finish() { this.result = 'data:image/png;base64,YQ=='; this.onload?.(); }
  }
  return { Reader, readers };
}

test('头像来源属于右侧操作组并紧邻首个按钮，没有额外字段或全局保存', async () => {
  const h = await mountSettings();
  try {
    await h.render();
    const actions = h.doc.querySelector('.pdsh-identity .pdsh-avatar-actions');
    assert.ok(actions); assert.equal(actions.querySelectorAll('button').length, 3);
    const sourceLabel = h.doc.querySelector('#pdsh-avatar-source-label');
    assert.equal(sourceLabel?.textContent, 'avatarLabel');
    assert.equal(actions.firstElementChild, sourceLabel);
    assert.equal(sourceLabel?.nextElementSibling, h.button('generated'));
    assert.equal(h.doc.querySelector('.pdsh-profile-copy')?.contains(sourceLabel), false);
    assert.equal(actions.getAttribute('aria-labelledby'), 'pdsh-avatar-source-label');
    assert.equal(actions.querySelector('[data-native-tooltip="avatarHint"]')?.getAttribute('data-side'), 'bottom');
    assert.equal(actions.querySelector('[data-native-tooltip="accountAvatarHint"]')?.getAttribute('data-delay-ms'), '500');
    assert.equal(h.doc.querySelector('[role="switch"][aria-label="maskTitles"]').getAttribute('title'), null);
    for (const key of ['generated', 'avatar', 'accountAvatar']) assert.ok(actions.contains(h.button(key)));
    assert.equal(h.button('generated').getAttribute('aria-pressed'), 'true');
    assert.equal(h.doc.querySelectorAll('.pdsh-detail-row').length, 1);
    assert.equal(h.button('changeAvatar'), undefined); assert.equal(h.button('save'), undefined);
    assert.equal(h.button('discard'), undefined); assert.equal(h.doc.querySelector('footer'), null);
    assert.equal(h.doc.querySelector('#pdsh-update-title'), null, '更新入口属于官方详情标题槽位，不在设置卡片');
    assert.equal(h.button('checkUpdate'), undefined);
    assert.equal(h.writes.length, 0);
  } finally { await h.close(); }
});

test('登出只临时生成已选账号头像，替换关闭时仍可主动启用本地身份', async () => {
  const t = key => dictionaries.zh[key] ?? key;
  const savedAvatar = 'data:image/png;base64,Yg==';
  const h = await mountSettings({ value: { maskIdentity: false, nickname: '临时访客甲', avatar: savedAvatar, useAccountAvatar: true }, presentation: { accountStatus: 'signed-out', accountAvatar: 'stale-account.png', status: 'disabled' }, t });
  try {
    await h.render();
    const account = h.button('账号头像');
    assert.equal(account.disabled, true);
    assert.equal(account.closest('.pdsh-avatar-source-tooltip')?.getAttribute('data-native-tooltip'), '登录后可用。');
    assert.equal(h.button('选择图片').closest('[data-native-tooltip]')?.getAttribute('data-native-tooltip'), '支持 PNG、JPEG、WebP，不会上传。');
    const preview = h.doc.querySelector('.pdsh-identity img');
    assert.equal(preview?.getAttribute('src'), model.resolvePreferences({ nickname: '临时访客甲', avatar: '' }).avatar);
    assert.notEqual(preview?.getAttribute('src'), savedAvatar);
    assert.notEqual(preview?.getAttribute('src'), 'stale-account.png');
    assert.equal(h.doc.querySelector('[role="status"]') === null, true);
    assert.equal(h.button('编辑显示昵称').disabled, false);
    assert.equal(h.button('选择图片').disabled, false);
    assert.equal(h.button('按昵称生成').disabled, false);
    const replace = h.doc.querySelector('[role="switch"][aria-label="替换侧栏身份"]');
    assert.equal(replace.checked, false); assert.equal(replace.disabled, false);
    h.accept(true);
    await act(async () => replace.click());
    assert.deepEqual(Array.from(h.writes[0].ops, op => [op.path[0], op.value]), [['maskIdentity', true]]);

    await act(async () => h.button('编辑显示昵称').click());
    await h.input(h.doc.querySelector('#pdsh-nickname'), '   ');
    assert.equal(h.doc.querySelector('.pdsh-identity img')?.getAttribute('src'), model.resolvePreferences({ nickname: '临时访客甲', avatar: '' }).avatar);
    await act(async () => h.doc.querySelector('#pdsh-nickname').dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));

    await h.publishPresentation({ accountStatus: 'signed-in', accountAvatar: 'official.png' });
    assert.equal(h.button('账号头像').disabled, false);
    assert.equal(h.doc.querySelector('.pdsh-identity img')?.getAttribute('src'), 'official.png');
    await h.publishPresentation({ accountStatus: 'signed-out', accountAvatar: 'stale-account.png' });
    assert.equal(h.button('账号头像').disabled, true);
    assert.equal(h.doc.querySelector('.pdsh-identity img')?.getAttribute('src'), model.resolvePreferences({ nickname: '临时访客甲', avatar: '' }).avatar);
    assert.equal(h.writes.length, 1, '登录状态切换不得写入账号或头像配置');
  } finally { await h.close(); }
});

test('过期 signed-out 状态不再显示账号登录门槛说明', async () => {
  const t = key => dictionaries.zh[key] ?? key;
  const h = await mountSettings({ presentation: { accountStatus: 'signed-out', accountAvatar: '', status: 'signed-out' }, t });
  try {
    await h.render();
    assert.equal(h.doc.querySelector('[role="status"]')?.textContent, undefined);
    assert.equal(h.button('账号头像').closest('.pdsh-avatar-source-tooltip')?.getAttribute('data-native-tooltip'), '登录后可用。');
    assert.equal(dictionaries.zh['status.signed-out'], undefined);
    assert.equal(dictionaries.en['status.signed-out'], undefined);
  } finally { await h.close(); }
});

test('真实 presentation 的 MutationObserver 驱动登出与登录恢复且不写配置', async () => {
  const savedAvatar = 'data:image/png;base64,Yg==';
  const h = await mountSettings({ realPresentation: true, value: { maskIdentity: false, nickname: '访客头像', avatar: savedAvatar, useAccountAvatar: true } });
  try {
    await h.render();
    assert.equal(h.presentation.status(), 'disabled');
    assert.equal(h.presentation.accountStatus(), 'signed-in');
    assert.equal(h.button('accountAvatar').disabled, false);
    assert.equal(h.doc.querySelector('.pdsh-identity img')?.getAttribute('src'), 'official.png');

    const launcher = h.doc.querySelector('[data-slot="settings.launcher"] button');
    await act(async () => {
      launcher.dataset.signedOut = 'true';
      launcher.innerHTML = '<svg style="width:14px;height:14px"></svg><span>更多</span>';
      await new Promise(resolve => h.dom.window.setTimeout(resolve, 0));
    });
    assert.equal(h.presentation.status(), 'disabled');
    assert.equal(h.presentation.accountStatus(), 'signed-out');
    assert.equal(h.presentation.accountAvatar(), '');
    assert.equal(h.button('accountAvatar').disabled, true);
    assert.equal(h.doc.querySelector('.pdsh-identity img')?.getAttribute('src'), model.resolvePreferences({ nickname: '访客头像', avatar: '' }).avatar);
    assert.equal(h.doc.querySelector('[role="status"]')?.textContent, undefined);
    assert.equal(h.writes.length, 0);

    await act(async () => {
      launcher.dataset.signedOut = 'false';
      launcher.innerHTML = '<span class="native-avatar"><img src="recovered.png" alt=""></span><span class="native-label">账号</span>';
      await new Promise(resolve => h.dom.window.setTimeout(resolve, 0));
    });
    assert.equal(h.presentation.accountStatus(), 'signed-in');
    assert.equal(h.presentation.accountAvatar(), 'recovered.png');
    assert.equal(h.button('accountAvatar').disabled, false);
    assert.equal(h.doc.querySelector('.pdsh-identity img')?.getAttribute('src'), 'recovered.png');
    assert.equal(h.writes.length, 0);
  } finally { await h.close(); }
});

test('账号状态未知时不称为未登录，并保留无头像占位', async () => {
  const t = key => dictionaries.en[key] ?? key;
  const h = await mountSettings({ value: { useAccountAvatar: true, avatar: 'data:image/png;base64,Yg==' }, presentation: { accountStatus: 'unsupported', accountAvatar: '', status: 'disabled' }, t });
  try {
    await h.render();
    const account = h.button('Account avatar');
    assert.equal(account.disabled, true);
    assert.equal(account.closest('.pdsh-avatar-source-tooltip')?.getAttribute('data-native-tooltip'), dictionaries.en['status.unsupported']);
    assert.ok(h.doc.querySelector('.pdsh-avatar-fallback'));
    assert.equal(h.doc.querySelector('.pdsh-identity img'), null);
    assert.equal(h.doc.querySelector('[role="status"]')?.textContent, undefined);
    assert.equal(h.writes.length, 0);
  } finally { await h.close(); }
});

test('已登录但使用宿主默认 SVG 时账号来源仍可选，事件处理器复核登录状态', async () => {
  const h = await mountSettings({ presentation: { accountStatus: 'signed-in', accountAvatar: '' } });
  try {
    await h.render();
    assert.equal(h.button('accountAvatar').disabled, false);
    h.accept(true);
    await act(async () => h.button('accountAvatar').click());
    assert.equal(h.button('accountAvatar').getAttribute('aria-pressed'), 'true');
    assert.ok(h.doc.querySelector('.pdsh-avatar-fallback'));
    assert.equal(h.writes.length, 1);
  } finally { await h.close(); }
  const race = await mountSettings();
  try {
    await race.render(); race.accept(true);
    const staleRenderButton = race.button('accountAvatar');
    race.setPresentation({ accountStatus: 'signed-out' });
    await act(async () => staleRenderButton.click());
    assert.equal(race.writes.length, 0, '事件必须读取最新账号状态，不能只依赖渲染时的 disabled');
  } finally { await race.close(); }
});

test('头像来源提示按中英文说明本地图片与账号原图', () => {
  assert.equal(dictionaries.zh.avatarHint, '支持 PNG、JPEG、WebP，不会上传。');
  assert.equal(dictionaries.en.avatarHint, 'Supports PNG, JPEG, and WebP. Your image is not uploaded.');
  assert.equal(dictionaries.zh.accountAvatarHint, '使用账号原始头像。');
  assert.equal(dictionaries.en.accountAvatarHint, "Use your account's original avatar.");
  assert.equal(dictionaries.zh.accountAvatarSignedOut, '登录后可用。');
  assert.equal(dictionaries.en.accountAvatarSignedOut, 'Available after signing in.');
});

test('头像切换即保存，只写原子头像字段；原样生成不产生写入', async () => {
  const h = await mountSettings();
  try {
    await h.render(); h.accept(true);
    await act(async () => h.button('generated').click()); assert.equal(h.writes.length, 0);
    await act(async () => h.button('accountAvatar').click());
    assert.deepEqual(Array.from(h.writes[0].ops, op => op.path[0]), ['avatar', 'useAccountAvatar']);
    assert.equal(h.writes[0].ops[1].value, true); assert.equal(h.writes[0].revision, 7);
    assert.equal(h.button('accountAvatar').getAttribute('aria-pressed'), 'true');
    await act(async () => h.button('generated').click());
    assert.equal(h.writes[1].ops[0].value, ''); assert.equal(h.writes[1].ops[1].value, false);
    assert.equal(h.writes[1].revision, 8);
    assert.equal(h.button('generated').getAttribute('aria-pressed'), 'true');
  } finally { await h.close(); }
});

test('取消选图不切换来源，合法解码后才立即写入本地头像', async () => {
  const { Reader, readers } = readerFixture();
  const h = await mountSettings({ fileReader: Reader });
  try {
    await h.render(); h.accept(true);
    await act(async () => h.button('accountAvatar').click());
    await act(async () => h.button('avatar').click());
    assert.equal(h.button('accountAvatar').getAttribute('aria-pressed'), 'true');
    await h.selectFile(); assert.equal(h.writes.length, 1);
    assert.equal(Boolean(h.doc.querySelector('[data-pdsh-avatar-loading]')), false, '正常读取不新增可见提示');
    assert.equal(Boolean(h.doc.querySelector('[data-pdsh-avatar-feedback]')), false, '正常读取不新增占位行');
    assert.equal(h.doc.querySelector('.pdsh-avatar-actions').getAttribute('aria-busy'), 'true');
    await act(async () => readers[0].finish());
    assert.equal(h.writes.length, 2);
    assert.equal(h.writes[1].ops[0].value, 'data:image/png;base64,YQ==');
    assert.equal(h.writes[1].ops[1].value, false);
    assert.equal(h.button('avatar').getAttribute('aria-pressed'), 'true');
  } finally { await h.close(); }
});

test('昵称输入是局部草稿，勾立即写昵称；确认按钮不在输入框里', async () => {
  const h = await mountSettings();
  try {
    await h.render(); h.accept(true);
    const pencil = h.button('editNickname');
    assert.equal(pencil.textContent, ''); assert.equal(pencil.previousElementSibling.tagName, 'SPAN');
    await editName(h, '演示访客'); assert.equal(h.writes.length, 0);
    const done = h.button('doneEditing'), input = h.doc.querySelector('#pdsh-nickname');
    assert.equal(done.previousElementSibling.contains(input), true);
    assert.equal(input.parentElement.contains(done), false);
    await act(async () => { done.focus(); done.click(); });
    assert.equal(h.writes.length, 1);
    assert.deepEqual(Array.from(h.writes[0].ops, op => op.path[0]), ['nickname']);
    assert.equal(h.writes[0].ops[0].value, '演示访客');
    assert.equal(h.doc.querySelector('#pdsh-nickname'), null);
    assert.equal(h.doc.activeElement, h.button('editNickname'));
  } finally { await h.close(); }
});

test('昵称Enter保存、Esc撤回、IME不确认、非法输入保持编辑', async () => {
  const h = await mountSettings();
  try {
    await h.render(); h.accept(true); await editName(h, '');
    const input = h.doc.querySelector('#pdsh-nickname');
    assert.equal(h.button('doneEditing').disabled, true);
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    assert.equal(h.doc.getElementById(input.getAttribute('aria-describedby')).textContent, 'invalidNickname');
    const key = (name, isComposing = false) => act(async () => input.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: name, isComposing, bubbles: true })));
    await key('Enter'); assert.ok(h.doc.querySelector('#pdsh-nickname')); assert.equal(h.writes.length, 0);
    await h.input(input, '临时'); await key('Enter', true); await key('Escape', true);
    assert.ok(h.doc.querySelector('#pdsh-nickname')); assert.equal(h.writes.length, 0);
    await key('Escape'); assert.equal(h.doc.querySelector('#pdsh-nickname'), null);
    assert.equal(h.doc.querySelector('.pdsh-profile-name').textContent, model.DEFAULTS.nickname);
    await editName(h, '完成');
    await act(async () => h.doc.querySelector('#pdsh-nickname').dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    assert.equal(h.writes.length, 1); assert.equal(h.doc.querySelector('#pdsh-nickname'), null);
  } finally { await h.close(); }
});

test('昵称保存失败保留字段草稿，点勾重试而非全局保存', async () => {
  const h = await mountSettings();
  try {
    await h.render(); await editName(h, '失败草稿');
    await act(async () => h.button('doneEditing').click());
    assert.equal(h.doc.querySelector('#pdsh-nickname').value, '失败草稿');
    assert.equal(h.doc.querySelector('.pdsh-nickname-editor [role="alert"]').textContent, 'nicknameSaveFailed');
    h.accept(true); await act(async () => h.button('doneEditing').click());
    assert.equal(h.writes.length, 2); assert.equal(h.doc.querySelector('#pdsh-nickname'), null);
  } finally { await h.close(); }
});

test('头像修改独立保存，不提交或丢弃正在编辑的昵称', async () => {
  const h = await mountSettings();
  try {
    await h.render(); h.accept(true); await editName(h, '未确认昵称');
    await act(async () => h.button('accountAvatar').click());
    assert.ok(h.writes[0].ops.every(op => op.path[0] !== 'nickname'));
    assert.equal(h.doc.querySelector('#pdsh-nickname').value, '未确认昵称');
    assert.equal(h.button('accountAvatar').getAttribute('aria-pressed'), 'true');
    await act(async () => h.button('doneEditing').click());
    assert.equal(h.writes[1].revision, 8);
    assert.deepEqual(Array.from(h.writes[1].ops, op => op.path[0]), ['nickname']);
  } finally { await h.close(); }
});

test('外来昵称更新时阻止覆盖，Esc取当前值；无关开关不制造冲突', async () => {
  const h = await mountSettings();
  try {
    await h.render(); await editName(h, '本地编辑');
    await h.snapshot({ revision: 8, value: { ...model.DEFAULTS, avatarHistory: [], nickname: '外来新昵称' } });
    assert.equal(h.doc.querySelector('#pdsh-nickname').value, '本地编辑');
    assert.equal(h.button('doneEditing').disabled, true);
    assert.equal(h.doc.querySelector('.pdsh-nickname-editor [role="alert"]').textContent, 'nicknameConflict');
    await act(async () => h.doc.querySelector('#pdsh-nickname').dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(h.doc.querySelector('.pdsh-profile-name').textContent, '外来新昵称');
    await editName(h, '再编辑');
    await h.snapshot({ revision: 9, value: { ...model.DEFAULTS, avatarHistory: [], nickname: '外来新昵称', maskTitles: true, future: 'host' } });
    assert.equal(h.button('doneEditing').disabled, false);
    h.accept(true); await act(async () => h.button('doneEditing').click());
    assert.equal(h.writes[0].revision, 9); assert.equal(h.writes[0].ops.length, 1);
  } finally { await h.close(); }
});

test('头像写入失败不假选中，保留候选供重试；外来来源更新阻止重试覆盖', async () => {
  const h = await mountSettings();
  try {
    await h.render(); await act(async () => h.button('accountAvatar').click());
    assert.equal(h.button('generated').getAttribute('aria-pressed'), 'true');
    assert.equal(h.doc.querySelector('[data-pdsh-avatar-feedback] [role="alert"]').textContent, 'avatarSaveFailed');
    assert.ok(h.button('retryAvatar'));
    h.accept(true); await act(async () => h.button('retryAvatar').click());
    assert.equal(h.button('accountAvatar').getAttribute('aria-pressed'), 'true');
    h.accept(false); await act(async () => h.button('generated').click());
    await h.snapshot({ revision: 9, value: { ...model.DEFAULTS, avatarHistory: [], avatar: 'data:image/png;base64,Yg==' } });
    assert.equal(h.button('retryAvatar').disabled, true);
    assert.equal(h.doc.querySelector('[data-pdsh-avatar-feedback] [role="alert"]').textContent, 'avatarConflict');
    assert.equal(h.writes.length, 3);
  } finally { await h.close(); }
});

test('图片解码迟到、切换来源、只读和卸载都不能复活旧请求', async () => {
  for (const mode of ['switch', 'readonly', 'unmount']) {
    const { Reader, readers } = readerFixture();
    let finishDecode; const decode = new Promise(resolve => { finishDecode = resolve; });
    const h = await mountSettings({ fileReader: Reader, imageDecode: () => decode });
    let closed = false;
    try {
      await h.render(); h.accept(true); await h.selectFile(); await act(async () => readers[0].finish());
      if (mode === 'switch') await act(async () => h.button('accountAvatar').click());
      if (mode === 'readonly') await h.snapshot({ writable: false });
      if (mode === 'unmount') { await h.close(); closed = true; }
      await act(async () => finishDecode());
      assert.equal(h.writes.length, mode === 'switch' ? 1 : 0);
      if (!closed) assert.equal(h.doc.querySelector('[data-pdsh-avatar-loading]'), null);
    } finally { if (!closed) await h.close(); }
  }
});

test('读取期间Host改了头像，不在解码结束后覆盖它', async () => {
  const { Reader, readers } = readerFixture(); const h = await mountSettings({ fileReader: Reader });
  try {
    await h.render(); h.accept(true); await h.selectFile();
    await h.snapshot({ revision: 8, value: { ...model.DEFAULTS, avatarHistory: [], useAccountAvatar: true } });
    await act(async () => readers[0].finish());
    assert.equal(h.writes.length, 0); assert.equal(h.button('accountAvatar').getAttribute('aria-pressed'), 'true');
    assert.equal(h.doc.querySelector('[data-pdsh-avatar-feedback] [role="alert"]').textContent, 'avatarConflict');
  } finally { await h.close(); }
});

test('全局单次写入门防重复，完成后不抢用户移走的焦点', async () => {
  const h = await mountSettings(); let settle;
  try {
    await h.render(); await editName(h, '异步昵称');
    h.form.mutate = (ops, revision) => { h.writes.push({ ops, revision }); return new Promise(resolve => { settle = resolve; }); };
    await act(async () => { h.button('doneEditing').focus(); h.button('doneEditing').click(); });
    assert.equal(h.button('doneEditing').disabled, true); assert.equal(h.button('accountAvatar').disabled, true);
    await act(async () => h.button('doneEditing').click()); assert.equal(h.writes.length, 1);
    const elsewhere = h.doc.createElement('button'); h.doc.body.append(elsewhere); elsewhere.focus();
    await act(async () => settle(false));
    assert.equal(h.doc.activeElement, elsewhere);
  } finally { settle?.(false); await h.close(); }
});

test('开关仍即时单字段保存，不与昵称草稿或头像竞争', async () => {
  const h = await mountSettings();
  try {
    await h.render(); h.accept(true); await editName(h, '待确认');
    const titles = h.doc.querySelector('[role="switch"][aria-label="maskTitles"]');
    await act(async () => { titles.focus(); titles.click(); });
    assert.deepEqual(Array.from(h.writes[0].ops, op => op.path[0]), ['maskTitles']);
    assert.equal(h.doc.querySelector('#pdsh-nickname').value, '待确认');
    assert.equal(titles.checked, true); assert.equal(h.doc.activeElement, titles);
    await act(async () => h.button('doneEditing').click());
    assert.equal(h.writes[1].revision, 8); assert.equal(h.writes[1].ops.length, 1);
  } finally { await h.close(); }
});

test('只读/不可用不写入，原生按钮和状态保留', async () => {
  const h = await mountSettings();
  try {
    await h.render(); await h.snapshot({ writable: false });
    for (const key of ['editNickname', 'generated', 'avatar', 'accountAvatar']) assert.equal(h.button(key).disabled, true);
    assert.equal(h.doc.querySelector('[role="status"]').textContent, 'readOnly');
    await h.snapshot({ status: 'unavailable' });
    assert.equal(h.doc.querySelector('[role="status"]').textContent, 'unavailable');
    assert.equal(h.writes.length, 0);
  } finally { await h.close(); }
});

test('开关失败与pending不改变选中态，保留昵称且修复自己的焦点空洞', async () => {
  const h = await mountSettings(); let settle;
  try {
    await h.render(); await editName(h, '保留的输入');
    h.form.mutate = (ops, revision) => { h.writes.push({ ops, revision }); return new Promise(resolve => { settle = resolve; }); };
    const titles = h.doc.querySelector('[role="switch"][aria-label="maskTitles"]');
    await act(async () => { titles.focus(); titles.click(); });
    assert.equal(titles.disabled, true); assert.equal(titles.checked, false);
    await act(async () => titles.click()); assert.equal(h.writes.length, 1);
    h.doc.body.tabIndex = -1; h.doc.body.focus();
    await act(async () => settle(false));
    assert.equal(h.doc.activeElement, titles);
    assert.equal(h.doc.querySelector('[role="alert"]').textContent, 'toggleFailed');
    assert.equal(h.doc.querySelector('#pdsh-nickname').value, '保留的输入');
    assert.equal(h.button('doneEditing').disabled, false);
  } finally { settle?.(false); await h.close(); }
});

test('昵称改回原值只关闭编辑，不物化继承值；首次编辑取最新Host值', async () => {
  const h = await mountSettings();
  try {
    await h.render(); await editName(h, '暂改');
    await h.input(h.doc.querySelector('#pdsh-nickname'), model.DEFAULTS.nickname);
    await act(async () => h.button('doneEditing').click()); assert.equal(h.writes.length, 0);
    const next = { status: 'ready', writable: true, revision: 99, value: { ...model.DEFAULTS, avatarHistory: [], nickname: '刚更新' } };
    h.form.getSnapshot = () => next;
    await act(async () => h.button('editNickname').click());
    assert.equal(h.doc.querySelector('#pdsh-nickname').value, '刚更新');
  } finally { await h.close(); }
});

test('图片解码失败不改变Host选中态，错误属于头像而非昵称', async () => {
  const { Reader, readers } = readerFixture();
  const h = await mountSettings({ fileReader: Reader, imageDecode: () => { throw new Error('decode'); } });
  try {
    await h.render(); await editName(h, ''); await h.selectFile();
    await act(async () => readers[0].finish());
    assert.equal(h.writes.length, 0); assert.equal(h.button('generated').getAttribute('aria-pressed'), 'true');
    assert.equal(h.doc.querySelector('[data-pdsh-avatar-feedback] [role="alert"]').textContent, 'avatarFailed');
    assert.equal(h.doc.querySelector('.pdsh-nickname-editor [role="alert"]').textContent, 'invalidNickname');
    assert.equal(h.doc.querySelector('[data-pdsh-avatar-loading]'), null);
  } finally { await h.close(); }
});

test('非法昵称不妨碍合法头像独立保存；头像成功不提交非法昵称', async () => {
  const { Reader, readers } = readerFixture(); const h = await mountSettings({ fileReader: Reader });
  try {
    await h.render(); h.accept(true); await editName(h, ''); await h.selectFile();
    await act(async () => readers[0].finish());
    assert.equal(h.writes.length, 1); assert.ok(h.writes[0].ops.every(op => op.path[0] !== 'nickname'));
    assert.equal(h.doc.querySelector('#pdsh-nickname').value, '');
    assert.equal(h.button('avatar').getAttribute('aria-pressed'), 'true');
  } finally { await h.close(); }
});

test('每组只有一次功能标题并与开关同排，遮挡范围只在悬停提示', async () => {
  const h = await mountSettings();
  try {
    await h.render();
    const rows = [...h.doc.querySelectorAll('.pdsh-group-header')];
    assert.equal(rows.length, 2);
    assert.equal(rows[0].querySelector('h4').textContent, 'maskTitles');
    assert.equal(rows[1].querySelector('h4').textContent, 'maskIdentity');
    assert.equal(rows[0].querySelector('[data-native-tooltip]').getAttribute('data-native-tooltip'), 'titlesHint');
    assert.equal(rows[0].querySelector('[role="switch"]').getAttribute('title'), null);
    assert.equal(rows[1].querySelector('[role="switch"]').getAttribute('title'), null);
    assert.equal(h.doc.querySelectorAll('.pdsh-row .pdsh-hint, .pdsh-row .pdsh-label').length, 0);
    assert.equal(h.doc.querySelectorAll('h4').length, 2, '更新徽标不再占用设置分组');
    assert.equal(h.doc.querySelectorAll('section[role="group"]').length, 2);
    assert.equal(rows[1].querySelector('[role="switch"]').disabled, false);
    assert.equal(h.writes.length, 0);
  } finally { await h.close(); }
});

test('切到生成头像时，旧本地图与两个历史项在同一提交中轮换', async () => {
  const A = 'data:image/png;base64,YQ==', B = 'data:image/png;base64,Yg==', C = 'data:image/png;base64,Yw==';
  const h = await mountSettings({ value: { avatar: C, avatarHistory: [B, A] } });
  try {
    await h.render(); h.accept(true);
    await act(async () => h.button('generated').click());
    assert.deepEqual(Array.from(h.form.getSnapshot().value.avatarHistory), [C, B]);
    assert.equal(h.form.getSnapshot().value.avatar, '');
    assert.equal(h.writes.length, 1);
    assert.deepEqual(Array.from(h.writes[0].ops, op => op.path[0]), ['avatar', 'useAccountAvatar', 'avatarHistory']);
  } finally { await h.close(); }
});

test('头像提交失败不推进历史，切到账号不把本地图重复归档', async () => {
  const A = 'data:image/png;base64,YQ==', B = 'data:image/png;base64,Yg==';
  const h = await mountSettings({ value: { avatar: B, avatarHistory: [A] } });
  try {
    await h.render(); await act(async () => h.button('generated').click());
    assert.equal(h.form.getSnapshot().value.avatar, B);
    assert.deepEqual(Array.from(h.form.getSnapshot().value.avatarHistory), [A]);
    assert.deepEqual(Array.from(h.writes[0].ops.find(op => op.path[0] === 'avatarHistory')?.value ?? []), [B, A]);
    h.accept(true); await act(async () => h.button('accountAvatar').click());
    assert.equal(h.form.getSnapshot().value.avatar, B);
    assert.deepEqual(Array.from(h.form.getSnapshot().value.avatarHistory), [A]);
  } finally { await h.close(); }
});

test('有历史时只打开一层 dialog；复用旧头像轮换历史，不改昵称', async () => {
  const A = 'data:image/png;base64,YQ==', B = 'data:image/png;base64,Yg==', C = 'data:image/png;base64,Yw==';
  const h = await mountSettings({ value: { avatar: C, avatarHistory: [B, A], nickname: '保持昵称' } });
  try {
    await h.render(); h.accept(true);
    await act(async () => h.button('avatar').click());
    const panel = h.doc.querySelector('[role="dialog"]');
    assert.ok(panel); assert.equal(panel.parentElement, h.doc.body);
    assert.equal(h.doc.activeElement, panel); assert.equal(h.doc.querySelector('[role="menu"]'), null);
    assert.equal(h.button('avatar').getAttribute('aria-expanded'), 'true');
    const old = h.button('reuseAvatar 2'); assert.equal(old.disabled, true);
    assert.equal(old.querySelector('img').className, h.doc.querySelector('.pdsh-identity img').className,
      '历史图片与实际设置预览共用头像几何，不能各自缩放');
    await act(async () => old.querySelector('img').dispatchEvent(new h.dom.window.Event('load')));
    await act(async () => old.click());
    const state = h.form.getSnapshot().value;
    assert.equal(state.avatar, A); assert.equal(state.useAccountAvatar, false); assert.equal(state.nickname, '保持昵称');
    assert.deepEqual(Array.from(state.avatarHistory), [C, B]);
    assert.equal(h.doc.querySelector('[role="dialog"]'), null);
    assert.equal(h.doc.activeElement, h.button('avatar'));
  } finally { await h.close(); }
});

test('Escape归还触发焦点，外点和外部焦点关闭不抢焦点；Tab不选图', async () => {
  const h = await mountSettings({ value: { avatarHistory: ['data:image/png;base64,YQ=='] } });
  try {
    await h.render();
    await act(async () => h.button('avatar').click());
    await act(async () => h.doc.activeElement.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
    assert.equal(h.writes.length, 0); assert.ok(h.doc.querySelector('[role="dialog"]'));
    await act(async () => h.doc.activeElement.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(h.doc.querySelector('[role="dialog"]'), null); assert.equal(h.doc.activeElement, h.button('avatar'));
    await act(async () => h.button('avatar').click());
    await act(async () => h.button('accountAvatar').focus());
    assert.equal(h.doc.querySelector('[role="dialog"]'), null); assert.equal(h.doc.activeElement, h.button('accountAvatar'));
    await act(async () => h.button('avatar').click());
    await act(async () => h.doc.body.dispatchEvent(new h.dom.window.Event('pointerdown', { bubbles: true })));
    assert.equal(h.doc.querySelector('[role="dialog"]'), null); assert.equal(h.writes.length, 0);
  } finally { await h.close(); }
});

test('清除历史只写历史字段；失败不清空当前图或历史', async () => {
  const A = 'data:image/png;base64,YQ==', B = 'data:image/png;base64,Yg==';
  const h = await mountSettings({ value: { avatar: B, avatarHistory: [A] } });
  try {
    await h.render();
    await act(async () => h.button('avatar').click());
    await act(async () => h.button('clearAvatarHistory').click());
    assert.deepEqual(Array.from(h.form.getSnapshot().value.avatarHistory), [A]);
    assert.equal(h.doc.querySelector('[role="alert"]').textContent, 'avatarHistoryClearFailed');
    h.accept(true);
    await act(async () => h.button('avatar').click());
    await act(async () => h.button('clearAvatarHistory').click());
    assert.equal(h.form.getSnapshot().value.avatar, B);
    assert.deepEqual(Array.from(h.form.getSnapshot().value.avatarHistory), []);
    assert.ok(h.writes.every(write => write.ops.length === 1 && write.ops[0].path[0] === 'avatarHistory'));
    assert.equal(h.button('avatar').hasAttribute('aria-haspopup'), false);
  } finally { await h.close(); }
});

test('历史图解码失败只显示占位且不能选中，没有伪装成生成头像', async () => {
  const h = await mountSettings({ value: { avatarHistory: ['data:image/png;base64,YQ=='] } });
  try {
    await h.render(); await act(async () => h.button('avatar').click());
    const image = h.doc.querySelector('[role="dialog"] img');
    await act(async () => image.dispatchEvent(new h.dom.window.Event('error')));
    const failed = h.button('avatarHistoryUnavailable 1');
    assert.equal(failed.disabled, true); assert.equal(image.hidden, true);
    await act(async () => failed.click()); assert.equal(h.writes.length, 0);
    assert.equal(h.doc.querySelector('[role="dialog"] img').src, 'data:image/png;base64,YQ==');
  } finally { await h.close(); }
});

test('旧Host缺少历史字段时保留原头像来源，只提交既有字段', async () => {
  const A = 'data:image/png;base64,YQ==';
  const h = await mountSettings();
  try {
    await h.snapshot({ value: { ...model.DEFAULTS, avatar: A } });
    await h.render(); h.accept(true);
    for (const key of ['avatar', 'generated', 'accountAvatar']) assert.equal(h.button(key).disabled, false);
    assert.equal(h.doc.querySelector('[role="status"]') === null, true);
    assert.equal(h.button('editNickname').disabled, false);
    assert.equal(h.doc.querySelector('[role="switch"][aria-label="maskIdentity"]').disabled, false);
    await act(async () => h.button('generated').click());
    assert.equal(h.form.getSnapshot().value.avatar, '');
    await act(async () => h.button('accountAvatar').click());
    assert.equal(h.form.getSnapshot().value.useAccountAvatar, true);
    assert.ok(h.writes.every(write => write.ops.length === 2 && write.ops.every(op => ['avatar', 'useAccountAvatar'].includes(op.path[0]))));
    assert.equal(Object.hasOwn(h.form.getSnapshot().value, 'avatarHistory'), false);
    await h.snapshot({ value: { ...model.DEFAULTS, avatarHistory: [] }, revision: 10 });
    assert.equal(h.button('avatar').disabled, false); assert.equal(h.doc.querySelector('[role="status"]') === null, true);
  } finally { await h.close(); }
});

test('旧Host选择图片直开picker，失败可重试且不伪造历史字段', async () => {
  const { Reader, readers } = readerFixture();
  const h = await mountSettings({ fileReader: Reader });
  try {
    await h.snapshot({ value: { ...model.DEFAULTS } }); await h.render();
    let pickers = 0; h.doc.querySelector('input[type="file"]').click = () => ++pickers;
    await act(async () => h.button('avatar').click());
    assert.equal(pickers, 1); assert.equal(h.doc.querySelector('[role="dialog"]'), null);
    await h.selectFile(); await act(async () => readers[0].finish());
    assert.equal(h.doc.querySelector('[role="alert"]').textContent, 'avatarSaveFailed');
    assert.equal(h.form.getSnapshot().value.avatar, '');
    h.accept(true); await act(async () => h.button('retryAvatar').click());
    assert.equal(h.form.getSnapshot().value.avatar, 'data:image/png;base64,YQ==');
    assert.equal(Object.hasOwn(h.form.getSnapshot().value, 'avatarHistory'), false);
    assert.ok(h.writes.every(write => write.ops.length === 2));
  } finally { await h.close(); }
});

test('旧Host读取途中载入历史能力，旧事务拒绝越过能力世代', async () => {
  const { Reader, readers } = readerFixture();
  const h = await mountSettings({ fileReader: Reader });
  try {
    await h.snapshot({ value: { ...model.DEFAULTS } }); await h.render(); h.accept(true);
    await h.selectFile();
    assert.equal(readers.length, 1);
    await h.snapshot({ value: { ...model.DEFAULTS, avatarHistory: [] }, revision: 8 });
    await act(async () => readers[0].finish());
    assert.equal(h.writes.length, 0); assert.equal(h.doc.querySelector('[role="alert"]').textContent, 'avatarConflict');
  } finally { await h.close(); }
});

test('损坏的已声明历史字段不是旧Host；缺少基础头像字段也不猜默认值', async () => {
  const h = await mountSettings();
  try {
    await h.render();
    for (const value of [{ ...model.DEFAULTS, avatarHistory: undefined }, { ...model.DEFAULTS, avatarHistory: null },
      { ...model.DEFAULTS, avatarHistory: ['invalid'] }, { nickname: model.DEFAULTS.nickname }]) {
      await h.snapshot({ value });
      for (const key of ['avatar', 'generated', 'accountAvatar']) assert.equal(h.button(key).disabled, true);
      assert.equal(h.doc.querySelector('[role="status"]').textContent, 'avatarConfigurationUnavailable');
    }
    assert.equal(h.writes.length, 0);
  } finally { await h.close(); }
});

test('解码期间外部清除历史，迟到读取不得复活已清除的图片', async () => {
  const { Reader, readers } = readerFixture();
  const h = await mountSettings({ fileReader: Reader, value: { avatarHistory: ['data:image/png;base64,Yg=='] } });
  try {
    await h.render(); h.accept(true); await h.selectFile();
    await h.snapshot({ value: { ...model.DEFAULTS, avatarHistory: [] }, revision: 8 });
    await act(async () => readers[0].finish());
    assert.equal(h.writes.length, 0);
    assert.deepEqual(h.form.getSnapshot().value.avatarHistory, []);
    assert.equal(h.doc.querySelector('[role="alert"]').textContent, 'avatarConflict');
  } finally { await h.close(); }
});


test('历史能力撤回时拒绝在途旧事务，不丢弃待轮换历史后降级写入', async () => {
  const { Reader, readers } = readerFixture();
  const h = await mountSettings({ fileReader: Reader, value: { avatarHistory: ['data:image/png;base64,Yg=='] } });
  try {
    await h.render(); h.accept(true); await h.selectFile();
    await h.snapshot({ value: { ...model.DEFAULTS }, revision: 8 });
    await act(async () => readers[0].finish());
    assert.equal(h.writes.length, 0); assert.equal(h.doc.querySelector('[role="alert"]').textContent, 'avatarConflict');
    assert.equal(h.button('avatar').disabled, false);
  } finally { await h.close(); }
});

test('旧Host基础分流仍遵守登录状态，不放开账号来源', async () => {
  const h = await mountSettings({ presentation: { accountStatus: 'signed-out' } });
  try {
    await h.snapshot({ value: { ...model.DEFAULTS } }); await h.render();
    assert.equal(h.button('avatar').disabled, false); assert.equal(h.button('generated').disabled, false);
    assert.equal(h.button('accountAvatar').disabled, true); assert.equal(h.writes.length, 0);
  } finally { await h.close(); }
});


test('迟到的清除历史回调重新核对完整头像配置', async () => {
  const B = 'data:image/png;base64,Yg==';
  const h = await mountSettings({ value: { avatarHistory: [B] } });
  try {
    await h.render(); h.accept(true);
    await act(async () => h.button('avatar').click());
    const clear = h.handler('clearAvatarHistory');
    assert.equal(typeof clear, 'function');
    await h.snapshot({ value: { ...model.DEFAULTS, avatar: undefined, avatarHistory: [B] }, revision: 8 });
    await act(async () => clear());
    assert.equal(h.writes.length, 0);
    assert.deepEqual(h.form.getSnapshot().value.avatarHistory, [B]);
  } finally { await h.close(); }
});
