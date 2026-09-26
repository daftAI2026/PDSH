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
    Button: ({ children, variant, ...props }) => React.createElement('button', { type: 'button', ...props }, children),
    IconUserOutlineMedium: () => React.createElement('svg'),
    IconEditOutlineRegular: () => React.createElement('svg'),
    Switch: ({ label, checked, onChange, disabled }) => React.createElement('input', { type: 'checkbox', 'aria-label': label, checked, disabled, onChange: event => onChange(event.target.checked) }),
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
