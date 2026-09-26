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
  const presentation = { status: () => 'disabled', subscribe: () => () => {} };
  const doc = dom.window.document;
  const buttons = () => [...doc.querySelectorAll('button')];
  const button = name => buttons().find(node => node.textContent === name);
  try {
    await act(async () => root.render(React.createElement(module.exports.SettingsCard, { preferencesForm: form, presentation, t: key => key })));
    assert.equal(doc.querySelectorAll('[role="group"]').length, 2);
    assert.equal(doc.querySelector('.pdsh-preview-name').textContent, model.DEFAULTS.nickname);
    assert.equal(doc.querySelector('input[type="file"]').hidden, true);
    assert.equal(doc.querySelector('footer').contains(button('save')), true);
    const input = doc.querySelector('#pdsh-nickname');
    // +--- 触发真实 React onChange；不直接调用组件内部 edit ---+
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, '演示访客');
      input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    });
    assert.equal(writes.length, 0);
    assert.equal(doc.querySelector('.pdsh-preview-name').textContent, '演示访客');
    assert.equal(button('save').disabled, false);
    await act(async () => button('save').click());
    assert.equal(writes.length, 1); assert.equal(writes[0].revision, 7);
    assert.equal(writes[0].ops.find(op => op.path[0] === 'nickname').value, '演示访客');
    assert.equal(input.value, '演示访客'); assert.equal(doc.querySelector('[role="alert"]').textContent, 'saveFailed');
    await act(async () => button('discard').click());
    assert.equal(input.value, model.DEFAULTS.nickname); assert.equal(button('save').disabled, true);
    assert.equal(doc.querySelector('[role="alert"]'), null);
    accepted = true;
    await act(async () => button('generated').click());
    await act(async () => button('save').click());
    assert.equal(writes.length, 2); assert.equal(button('save').disabled, true);
    await act(async () => { snapshot = { ...snapshot, writable: false }; for (const fn of listeners) fn(); });
    assert.equal(input.disabled, true); assert.equal(button('avatar').disabled, true);
  } finally {
    await act(async () => root.unmount()); dom.window.close();
    for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
  }
  assert.equal(listeners.size, 0);
});
