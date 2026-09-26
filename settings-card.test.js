/**
 * [INPUT]: 依赖真实 SettingsCard JSX、React/jsdom 与只替代原生控件外观的 primitives 桩。
 * [OUTPUT]: 验证原生控件装配、IME/局部取消/焦点、异步头像失效、字段错误、继承语义与冲突恢复。
 * [POS]: PDSH 设置交互回归；宿主 token 和真实布局由 runtime 截图另验。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import * as model from './model.js';

async function mountSettings({ fileReader, imageDecode } = {}) {
  const dom = new JSDOM('<body><main></main></body>', { url: 'http://localhost' });
  const previous = new Map(['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true });
  const primitives = {
    Input: props => React.createElement('span', {}, React.createElement('input', props)),
    Button: ({ children, variant, size, ...props }) => React.createElement('button', { type: 'button', 'data-variant': variant, 'data-size': size, ...props }, children),
    IconUserOutlineMedium: () => React.createElement('svg'),
    IconEditOutlineRegular: () => React.createElement('svg'),
    IconCheckOutlineRegular: () => React.createElement('svg'),
    Switch: ({ label, checked, onChange, disabled }) => React.createElement('input', { type: 'checkbox', role: 'switch', 'aria-label': label, checked, disabled, onChange: event => onChange(event.target.checked) }),
  };
  const module = { exports: {} };
  const code = transformSync(readFileSync(new URL('./settings-card.jsx', import.meta.url), 'utf8'), { loader: 'jsx', format: 'cjs' }).code;
  runInNewContext(code, { module, exports: module.exports, FileReader: fileReader ?? dom.window.FileReader,
    Image: class { async decode() { await imageDecode?.(); } }, require(id) {
    if (id === 'react') return React;
    if (id === './model.js') return model;
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return primitives;
    throw new Error(id);
  } });
  const { createRoot } = await import('react-dom/client');
  const root = createRoot(dom.window.document.querySelector('main'));
  const listeners = new Set(), writes = [];
  let snapshot = { status: 'ready', writable: true, revision: 7, value: model.DEFAULTS };
  let accepted = false;
  const form = { getSnapshot: () => snapshot, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, async mutate(ops, revision) { writes.push({ ops, revision }); return accepted; } };
  const presentation = { accountAvatar: () => 'official.png', status: () => 'disabled', subscribe: () => () => {} };
  const doc = dom.window.document;
  const buttons = () => [...doc.querySelectorAll('button')];
  const button = name => buttons().find(node => node.textContent === name || node.getAttribute('aria-label') === name || node.getAttribute('aria-label')?.startsWith(`${name}: `));
  return { doc, dom, root, button, writes, form, presentation, listeners,
    accept(value) { accepted = value; },
    async snapshot(changes) { await act(async () => { snapshot = { ...snapshot, ...changes }; for (const fn of listeners) fn(); }); },
    async render() { await act(async () => root.render(React.createElement(module.exports.SettingsCard, { preferencesForm: form, presentation, t: key => key }))); },
    async input(node, value) { await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(node, value);
      node.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    }); },
    async selectFile() { const node = doc.querySelector('input[type="file"]');
      Object.defineProperty(node, 'files', { configurable: true, value: [{ type: 'image/png', size: 32 }] });
      await act(async () => node.dispatchEvent(new dom.window.Event('change', { bubbles: true })));
    },
    async close() {
      await act(async () => root.unmount()); dom.window.close();
      for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
      assert.equal(listeners.size, 0);
    },
    Component: module.exports.SettingsCard,
  };
}

test('原生控件装配的分组预览不提前保存；失败保留、放弃和只读合同不变', async () => {
  const h = await mountSettings();
  const { doc, dom, root, button, writes, form, presentation, Component } = h;
  try {
    await h.render();
    assert.equal(doc.querySelectorAll('section[role="group"]').length, 2);
    const identity = doc.querySelector('.pdsh-identity');
    assert.ok(identity.querySelector('.pdsh-avatar-preview'));
    assert.equal(identity.querySelector('.pdsh-profile-name').textContent, model.DEFAULTS.nickname);
    assert.ok(identity.contains(button('changeAvatar')));
    assert.equal(identity.querySelector('#pdsh-nickname'), null, '摘要不是编辑表单');
    assert.equal(doc.querySelector('#pdsh-nickname'), null, '默认显示字段值，按编辑后才出现输入框');
    assert.equal(doc.querySelector('#pdsh-avatar-options').hidden, true, '头像来源默认渐进披露');
    assert.ok(doc.querySelector('#pdsh-identity-title').closest('.pdsh-group').contains(doc.querySelector('footer')), 'profile保存动作归属于身份设置组');
    assert.equal(doc.querySelector('[role="status"]')?.textContent, undefined, '无草稿时不显示重复savedHint');
    await act(async () => button('changeAvatar').click());
    assert.equal(button('changeAvatar').getAttribute('aria-expanded'), 'true');
    assert.equal(doc.querySelector('#pdsh-avatar-options').hidden, false);
    await act(async () => button('editNickname').click());
    const input = doc.querySelector('#pdsh-nickname');
    assert.ok(doc.querySelector('.pdsh-detail-row').contains(input));
    assert.equal(doc.querySelector('input[type="file"]').hidden, true);
    assert.equal(doc.querySelector('footer').contains(button('save')), true);
    // +--- 触发真实 React onChange；不直接调用组件内部 edit ---+
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, '演示访客');
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    assert.equal(writes.length, 0);
    assert.equal(input.value, '演示访客');
    await act(async () => input.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })));
    assert.ok(doc.querySelector('#pdsh-nickname'), '中文输入法确认字词不应提前结束编辑');
    assert.equal(button('doneEditing').getAttribute('aria-label'), 'doneEditing');
    assert.equal(button('doneEditing').getAttribute('title'), 'doneEditing');
    assert.ok(button('doneEditing').querySelector('svg'), '完成操作应使用原生按钮中的确认图标');
    assert.equal(button('doneEditing').getAttribute('data-variant'), 'ghost');
    assert.equal(button('doneEditing').getAttribute('data-size'), null, '图标按钮使用原生默认尺寸，维持稳定行高');
    await act(async () => button('doneEditing').click());
    assert.equal(doc.querySelector('#pdsh-nickname'), null);
    assert.equal(doc.activeElement, button('editNickname'), '结束编辑后键盘焦点回到原入口');
    assert.equal(doc.querySelector('.pdsh-profile-name').textContent, '演示访客');
    assert.equal(writes.length, 0, '完成编辑不是保存');
    await act(async () => button('editNickname').click());
    assert.equal(doc.querySelector('#pdsh-nickname').value, '演示访客');
    const editedInput = doc.querySelector('#pdsh-nickname');
    await act(async () => button('accountAvatar').click());
    assert.equal(button('accountAvatar').getAttribute('aria-pressed'), 'true');
    assert.equal(doc.querySelector('.pdsh-avatar-preview').getAttribute('src'), 'official.png');
    assert.equal(writes.length, 0, '选择原始头像也必须先保存');
    assert.equal(button('save').disabled, false);
    await act(async () => root.render(React.createElement(Component, { preferencesForm: form, presentation, t: key => `en:${key}` })));
    assert.equal(doc.querySelector('#pdsh-nickname-label').textContent, 'en:nickname');
    assert.equal(editedInput.value, '演示访客', '热切换只改变文案，不翻译用户昵称或丢失草稿');
    assert.equal(writes.length, 0);
    await h.render();
    assert.equal(editedInput.value, '演示访客');
    await act(async () => button('save').click());
    assert.equal(writes.length, 1); assert.equal(writes[0].revision, 7);
    assert.equal(writes[0].ops.find(op => op.path[0] === 'nickname').value, '演示访客');
    assert.equal(writes[0].ops.find(op => op.path[0] === 'useAccountAvatar').value, true);
    assert.ok(writes[0].ops.some(op => op.path[0] === 'avatar'), '头像与来源同批写，不能只提交一半');
    assert.equal(editedInput.value, '演示访客'); assert.equal(doc.querySelector('[role="alert"]').textContent, 'saveFailed');
    await act(async () => button('discard').click());
    assert.equal(doc.querySelector('#pdsh-nickname'), null);
    assert.equal(doc.querySelector('.pdsh-profile-name').textContent, model.DEFAULTS.nickname);
    assert.equal(doc.querySelector('#pdsh-avatar-options').hidden, true);
    assert.equal(button('save').disabled, true);
    assert.equal(doc.querySelector('[role="alert"]'), null);
    await h.snapshot({ value: { ...model.DEFAULTS, useAccountAvatar: true, avatar: 'data:image/png;base64,YQ==' } });
    h.accept(true);
    await act(async () => button('generated').click());
    await act(async () => button('save').click());
    assert.equal(writes.length, 2); assert.equal(button('save').disabled, true);
    assert.equal(writes[1].ops.find(op => op.path[0] === 'useAccountAvatar').value, false, '恢复生成头像同时撤销原始头像来源');
    assert.equal(writes[1].ops.find(op => op.path[0] === 'avatar').value, '', '生成头像必须同时清掉本地头像');
    await h.snapshot({ writable: false });
    assert.equal(button('editNickname').disabled, true); assert.equal(button('avatar').disabled, true);
    assert.equal(button('changeAvatar').disabled, true);
    assert.equal(button('accountAvatar').disabled, true);
  } finally {
    await h.close();
  }
});

test('两个偏好开关立即写入各自的Host路径，不进入头像昵称草稿', async () => {
  const h = await mountSettings();
  try {
    await h.render(); h.accept(true);
    const titles = h.doc.querySelector('input[aria-label="maskTitles"]');
    const identity = h.doc.querySelector('input[aria-label="maskIdentity"]');
    assert.equal(titles.checked, false); assert.equal(identity.checked, false);
    assert.equal(h.button('save').disabled, true);

    await act(async () => titles.click());
    assert.deepEqual(Array.from(h.writes[0].ops, op => op.path[0]), ['maskTitles']);
    assert.equal(h.writes[0].revision, 7);
    assert.equal(titles.checked, false, '提交期间不乐观改写，视觉状态只读Host接受值');
    await h.snapshot({ revision: 8, value: { ...model.DEFAULTS, maskTitles: true } });
    assert.equal(titles.checked, true);
    assert.equal(h.button('save').disabled, true, '开关不是profile待保存草稿');

    await act(async () => identity.click());
    assert.deepEqual(Array.from(h.writes[1].ops, op => op.path[0]), ['maskIdentity']);
    assert.equal(h.writes[1].revision, 8);
    await h.snapshot({ revision: 9, value: { ...model.DEFAULTS, maskTitles: true, maskIdentity: true } });
    assert.equal(identity.checked, true);

    await act(async () => h.button('editNickname').click());
    await h.input(h.doc.querySelector('#pdsh-nickname'), '保留的profile草稿');
    await act(async () => titles.click());
    assert.deepEqual(Array.from(h.writes[2].ops, op => op.path[0]), ['maskTitles']);
    await h.snapshot({ revision: 10, value: { ...model.DEFAULTS, maskIdentity: true, futureField: 'host-owned' } });
    assert.equal(h.doc.querySelector('#pdsh-nickname').value, '保留的profile草稿');
    assert.equal(h.button('save').disabled, false, '开关revision变化不能造成profile假冲突');

    await act(async () => h.button('save').click());
    assert.equal(h.writes[3].revision, 10, 'profile提交使用最新Host revision');
    assert.deepEqual(Array.from(h.writes[3].ops, op => op.path[0]), ['nickname']);
  } finally { await h.close(); }
});

test('开关pending时拒绝重复mutate；失败本地化且不污染profile草稿', async () => {
  const h = await mountSettings();
  let settle;
  const pending = new Promise(resolve => { settle = resolve; });
  try {
    await h.render(); await act(async () => h.button('editNickname').click());
    await h.input(h.doc.querySelector('#pdsh-nickname'), '仍可保存的草稿');
    h.form.mutate = (ops, revision) => { h.writes.push({ ops, revision }); return pending; };
    const titles = h.doc.querySelector('input[aria-label="maskTitles"]');
    await act(async () => titles.click());
    assert.equal(titles.disabled, true, '请求未完成时控件禁用');
    await act(async () => titles.click());
    assert.equal(h.writes.length, 1, 'pending请求不会重复提交');
    assert.equal(titles.checked, false, 'pending不乐观切换已接受值');
    assert.equal(h.button('save').disabled, true, 'Host mutation进行中不与profile保存竞争');

    await act(async () => settle(false));
    assert.equal(titles.disabled, false);
    assert.equal(titles.checked, false, '失败后依然显示Host接受值');
    assert.equal(h.doc.querySelector('[role="alert"]').textContent, 'toggleFailed');
    assert.equal(h.doc.querySelector('#pdsh-nickname').value, '仍可保存的草稿');
    assert.equal(h.button('save').disabled, false, '开关失败不让profile草稿失效');
  } finally { await h.close(); }
});

test('开关提交结算后只在焦点未移动时恢复原Switch焦点', async () => {
  for (const { result, moveFocus } of [{ result: true, moveFocus: false }, { result: false, moveFocus: false }, { result: true, moveFocus: true }]) {
    const h = await mountSettings();
    let settle;
    const pending = new Promise(resolve => { settle = resolve; });
    try {
      await h.render(); h.form.mutate = () => pending;
      const titles = h.doc.querySelector('input[role="switch"][aria-label="maskTitles"]');
      await act(async () => { titles.focus(); titles.click(); });
      assert.equal(titles.disabled, true);
      let elsewhere;
      if (moveFocus) {
        elsewhere = h.doc.createElement('button'); elsewhere.textContent = '其他控件'; h.doc.body.append(elsewhere); elsewhere.focus();
      } else { h.doc.body.tabIndex = -1; h.doc.body.focus(); }
      await act(async () => settle(result));
      assert.ok(h.doc.activeElement === (moveFocus ? elsewhere : titles), '只填补disable导致的焦点空洞，不打断用户已移走的焦点');
    } finally { settle(false); await h.close(); }
  }
});

test('profile冲突只由三字段基线判定，外来头像来源变化保留未提交昵称', async () => {
  const h = await mountSettings();
  try {
    await h.render(); await act(async () => h.button('editNickname').click());
    await h.input(h.doc.querySelector('#pdsh-nickname'), '本地昵称草稿');
    const changedAvatar = 'data:image/png;base64,Yg==';
    await h.snapshot({ revision: 8, value: { ...model.DEFAULTS, avatar: changedAvatar, useAccountAvatar: true, futureField: 'host-owned' } });
    assert.equal(h.doc.querySelector('#pdsh-nickname').value, '本地昵称草稿', '不自动重基或丢弃昵称草稿');
    assert.equal(h.button('save').disabled, true, 'avatar/source属于profile基线，外来变化必须阻止覆盖');
    assert.equal(h.doc.querySelector('[role="alert"]').textContent, 'saveConflict');
    assert.equal(h.writes.length, 0);

    await act(async () => h.button('reloadDiscard').click());
    assert.equal(h.doc.querySelector('.pdsh-profile-name').textContent, model.DEFAULTS.nickname);
    assert.equal(h.button('accountAvatar').getAttribute('aria-pressed'), 'true', '放弃草稿后采用Host的头像来源');
    assert.equal(h.doc.querySelector('.pdsh-avatar-preview').getAttribute('src'), 'official.png', '账号来源仍由Host展示，不拿本地头像覆盖');
  } finally { await h.close(); }
});

function deferredReader() {
  const readers = [];
  class Reader {
    readAsDataURL() { readers.push(this); }
    abort() { this.onabort?.(); }
    finish() { this.result = 'data:image/png;base64,YQ=='; this.onload?.(); }
  }
  return { Reader, readers };
}

test('头像读取期间不能保存旧草稿；切到账号来源后迟到结果不能覆盖选择', async () => {
  const { Reader, readers } = deferredReader();
  const h = await mountSettings({ fileReader: Reader });
  try {
    await h.render(); await act(async () => h.button('editNickname').click());
    await h.input(h.doc.querySelector('#pdsh-nickname'), '文件读入中');
    await h.selectFile();
    assert.equal(h.button('save').disabled, true, '读取尚未结束，不能保存缺失头像的旧草稿');
    assert.ok(h.doc.querySelector('[data-pdsh-avatar-loading]'), '读取有明确状态，而非静默等待');
    await act(async () => h.button('accountAvatar').click());
    await act(async () => readers[0].finish());
    assert.equal(h.button('accountAvatar').getAttribute('aria-pressed'), 'true');
    assert.equal(h.doc.querySelector('[data-pdsh-avatar-loading]'), null);
    assert.equal(h.writes.length, 0);
  } finally { await h.close(); }
});

test('昵称无效不把合法图片误报；字段错误有可访问关联；Esc只撤销本次昵称编辑', async () => {
  const { Reader, readers } = deferredReader();
  const h = await mountSettings({ fileReader: Reader });
  try {
    await h.render(); await act(async () => h.button('accountAvatar').click());
    await act(async () => h.button('editNickname').click());
    const input = h.doc.querySelector('#pdsh-nickname');
    await h.input(input, ''); await h.selectFile();
    await act(async () => readers[0].finish());
    assert.ok(h.doc.querySelector('.pdsh-avatar-preview'), '非法昵称不让独立头像预览消失');
    assert.equal(h.button('avatar').getAttribute('aria-pressed'), 'true', '合法图进入草稿，昵称错误只阻止保存');
    assert.equal(input.getAttribute('aria-invalid'), 'true');
    assert.equal(h.doc.getElementById(input.getAttribute('aria-describedby')).textContent, 'invalidNickname');
    assert.ok(h.doc.querySelector('.pdsh-nickname-editor').contains(h.doc.getElementById(input.getAttribute('aria-describedby'))), '错误靠近具体输入');
    assert.ok(![...h.doc.querySelectorAll('[role="alert"]')].some(node => node.textContent === 'avatarFailed'));
    await act(async () => input.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'Escape', isComposing: true, bubbles: true })));
    assert.ok(h.doc.querySelector('#pdsh-nickname'), 'IME阶段的Esc不退出编辑');
    await act(async () => input.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    assert.ok(h.doc.querySelector('#pdsh-nickname'), '非法昵称不能通过Enter关闭编辑并隐藏字段错误');
    assert.equal(h.button('doneEditing').disabled, true, '非法昵称禁用完成编辑');
    await act(async () => input.dispatchEvent(new h.dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    assert.equal(h.doc.querySelector('#pdsh-nickname'), null);
    assert.equal(h.doc.querySelector('.pdsh-profile-name').textContent, model.DEFAULTS.nickname);
    assert.equal(h.doc.activeElement, h.button('editNickname'));
    assert.equal(h.button('avatar').getAttribute('aria-pressed'), 'true', 'Esc不撤销独立头像草稿');
    assert.equal(h.writes.length, 0);
  } finally { await h.close(); }
});

test('只读与放弃取消正在读取的头像；Host扩展字段不被设置卡片回写', async () => {
  const { Reader, readers } = deferredReader();
  const h = await mountSettings({ fileReader: Reader });
  try {
    await h.render(); await h.selectFile();
    await h.snapshot({ writable: false });
    await act(async () => readers[0].finish());
    assert.equal(h.button('save').disabled, true);
    assert.equal(h.button('discard').disabled, true, '只读后迟到文件不创建新草稿');
    await h.snapshot({ writable: true, value: { ...model.DEFAULTS, futureField: 'host-owned' } });
    await act(async () => h.button('accountAvatar').click());
    await h.selectFile();
    assert.equal(h.button('discard').disabled, false, '读取期间仍可以放弃');
    await act(async () => h.button('discard').click());
    await act(async () => readers[1].finish());
    assert.equal(h.button('discard').disabled, true);
    await act(async () => h.button('accountAvatar').click()); h.accept(true);
    await act(async () => h.button('save').click());
    assert.ok(h.writes[0].ops.every(op => Object.hasOwn(model.DEFAULTS, op.path[0])), '只写自己的已知字段');
  } finally { await h.close(); }
});

test('Host修订更新后不重复提交过期草稿；显式放弃并读取当前值才恢复编辑', async () => {
  const h = await mountSettings();
  try {
    await h.render(); await act(async () => h.button('editNickname').click());
    await h.input(h.doc.querySelector('#pdsh-nickname'), '本地未保存');
    await h.snapshot({ revision: 8, value: { ...model.DEFAULTS, nickname: 'Host新值' } });
    assert.equal(h.doc.querySelector('#pdsh-nickname').value, '本地未保存', '不能自动覆盖或重基用户草稿');
    assert.equal(h.button('save').disabled, true, '过期草稿不可无限原revision重试');
    assert.equal(h.doc.querySelector('[role="alert"]').textContent, 'saveConflict');
    await act(async () => h.button('reloadDiscard').click());
    assert.equal(h.doc.querySelector('.pdsh-profile-name').textContent, 'Host新值');
    await act(async () => h.button('editNickname').click());
    await h.input(h.doc.querySelector('#pdsh-nickname'), '基于新版本');
    h.accept(true); await act(async () => h.button('save').click());
    assert.equal(h.writes.length, 1); assert.equal(h.writes[0].revision, 8);
  } finally { await h.close(); }
});

test('不可用不是加载中；异步解码迟到也不能复活放弃的草稿', async () => {
  const { Reader, readers } = deferredReader();
  let finishDecode;
  const decoding = new Promise(resolve => { finishDecode = resolve; });
  const h = await mountSettings({ fileReader: Reader, imageDecode: () => decoding });
  try {
    await h.render(); await h.snapshot({ status: 'unavailable', writable: false });
    const statuses = [...h.doc.querySelectorAll('[role="status"]')].map(node => node.textContent);
    assert.ok(statuses.includes('unavailable')); assert.ok(!statuses.includes('loading'));
    await h.snapshot({ status: 'ready', writable: true });
    await h.selectFile(); await act(async () => readers[0].finish());
    assert.equal(h.button('save').disabled, true);
    assert.equal(h.button('discard').disabled, false, '无其他草稿也可以取消解码');
    await act(async () => h.button('discard').click());
    await act(async () => finishDecode());
    assert.equal(h.button('discard').disabled, true);
    assert.equal(h.button('generated').getAttribute('aria-pressed'), 'true');
    assert.equal(h.writes.length, 0);
  } finally { await h.close(); }
});

test('编辑单个昵称只写昵称，不把继承设置物化；改回原值不显示待保存', async () => {
  const h = await mountSettings();
  try {
    await h.render(); await act(async () => h.button('editNickname').click());
    const input = h.doc.querySelector('#pdsh-nickname');
    await h.input(input, '暂时修改'); await h.input(input, model.DEFAULTS.nickname);
    assert.equal(h.button('save').disabled, true);
    await h.input(input, '只改昵称'); h.accept(true);
    await act(async () => h.button('save').click());
    assert.deepEqual(Array.from(h.writes[0].ops, op => op.path[0]), ['nickname']);
  } finally { await h.close(); }
});

test('设置默认只显示必要的行，正常状态不堆介绍与重复小字', async () => {
  const h = await mountSettings();
  try {
    await h.render();
    assert.equal(h.doc.querySelectorAll('.pdsh-settings > p.pdsh-hint').length, 0);
    assert.equal(h.doc.querySelector('.pdsh-profile-copy .pdsh-hint'), null);
    assert.ok(![...h.doc.querySelectorAll('[role="status"]')].some(n => n.textContent === 'status.disabled'));
  } finally { await h.close(); }
});

test('保存和放弃后焦点有稳定落点；昵称编辑按钮读出当前值', async () => {
  const h = await mountSettings();
  try {
    await h.render();
    assert.equal(h.button('editNickname').getAttribute('aria-label'), `editNickname: ${model.DEFAULTS.nickname}`);
    await act(async () => h.button('accountAvatar').click());
    h.accept(true); h.button('save').focus();
    await act(async () => h.button('save').click());
    assert.equal(h.doc.activeElement, h.button('editNickname'), '成功后不把焦点留在禁用Save');
    await act(async () => h.button('accountAvatar').click()); h.button('discard').focus();
    await act(async () => h.button('discard').click());
    assert.equal(h.doc.activeElement, h.button('editNickname'), '放弃后回到稳定编辑入口');
  } finally { await h.close(); }
});

test('未通知React时首次编辑仍取同一最新Host快照；清空昵称不隐藏原头像', async () => {
  const h = await mountSettings();
  try {
    await h.render();
    const value = { ...model.DEFAULTS, nickname: '最新昵称', avatar: 'data:image/png;base64,Yg==' };
    const latest = { status: 'ready', writable: true, revision: 8, value };
    h.form.getSnapshot = () => latest;
    await act(async () => h.button('accountAvatar').click());
    assert.equal(h.button('save').disabled, false, '第一次编辑使用current，不产生假冲突');
    h.accept(true); await act(async () => h.button('save').click());
    assert.equal(h.writes[0].revision, 8);
    await act(async () => h.button('editNickname').click());
    await h.input(h.doc.querySelector('#pdsh-nickname'), '');
    assert.equal(h.doc.querySelector('.pdsh-avatar-preview').getAttribute('src'), value.avatar);
    assert.equal(h.button('save').disabled, true);
  } finally { await h.close(); }
});

test('保存等待期间用户主动移走焦点，完成后不能抢回', async () => {
  const h = await mountSettings();
  let settle;
  const pending = new Promise(resolve => { settle = resolve; });
  try {
    await h.render(); h.form.mutate = () => pending;
    await act(async () => h.button('accountAvatar').click()); h.button('save').focus();
    await act(async () => h.button('save').click());
    const elsewhere = h.doc.createElement('button'); elsewhere.textContent = '宿主其他操作';
    h.doc.body.append(elsewhere); elsewhere.focus();
    await act(async () => settle(true));
    assert.equal(h.doc.activeElement, elsewhere);
  } finally { await h.close(); }
});
