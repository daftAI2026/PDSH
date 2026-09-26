/**
 * [INPUT]: 依赖真实 SettingsCard JSX、React/jsdom 与只替代原生控件外观的 primitives 桩。
 * [OUTPUT]: 验证分组/身份预览、草稿与保存隔离、失败保留、放弃和只读状态。
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

test('原生控件装配的分组预览不提前保存；失败保留、放弃和只读合同不变', async () => {
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
  runInNewContext(code, { module, exports: module.exports, FileReader: dom.window.FileReader, require(id) {
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
  const button = name => buttons().find(node => node.textContent === name || node.getAttribute('aria-label') === name);
  try {
    await act(async () => root.render(React.createElement(module.exports.SettingsCard, { preferencesForm: form, presentation, t: key => key })));
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
    await act(async () => root.render(React.createElement(module.exports.SettingsCard, { preferencesForm: form, presentation, t: key => `en:${key}` })));
    assert.equal(doc.querySelector('#pdsh-nickname-label').textContent, 'en:nickname');
    assert.equal(editedInput.value, '演示访客', '热切换只改变文案，不翻译用户昵称或丢失草稿');
    assert.equal(writes.length, 0);
    await act(async () => root.render(React.createElement(module.exports.SettingsCard, { preferencesForm: form, presentation, t: key => key })));
    assert.equal(editedInput.value, '演示访客');
    await act(async () => button('save').click());
    assert.equal(writes.length, 1); assert.equal(writes[0].revision, 7);
    assert.equal(writes[0].ops.find(op => op.path[0] === 'nickname').value, '演示访客');
    assert.equal(writes[0].ops.find(op => op.path[0] === 'useAccountAvatar').value, true);
    assert.equal(editedInput.value, '演示访客'); assert.equal(doc.querySelector('[role="alert"]').textContent, 'saveFailed');
    await act(async () => button('discard').click());
    assert.equal(doc.querySelector('#pdsh-nickname'), null);
    assert.equal(doc.querySelector('.pdsh-profile-name').textContent, model.DEFAULTS.nickname);
    assert.equal(doc.querySelector('#pdsh-avatar-options').hidden, true);
    assert.equal(button('save').disabled, true);
    assert.equal(doc.querySelector('[role="alert"]'), null);
    accepted = true;
    await act(async () => button('generated').click());
    await act(async () => button('save').click());
    assert.equal(writes.length, 2); assert.equal(button('save').disabled, true);
    assert.equal(writes[1].ops.find(op => op.path[0] === 'useAccountAvatar').value, false, '恢复生成头像同时撤销原始头像来源');
    await act(async () => { snapshot = { ...snapshot, writable: false }; for (const fn of listeners) fn(); });
    assert.equal(button('editNickname').disabled, true); assert.equal(button('avatar').disabled, true);
    assert.equal(button('changeAvatar').disabled, true);
    assert.equal(button('accountAvatar').disabled, true);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
  assert.equal(listeners.size, 0);
});
