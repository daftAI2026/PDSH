/**
 * [INPUT]: capture-notice.tsx 的真实通知适配器、React 与仅观察官方 Toast 参数的根桩。
 * [OUTPUT]: 验证官方组件、默认生命周期、同文重显、旧通知完成围栏与停用回收。
 * [POS]: 截图通知装配合同；不复制或模拟宿主的 Toast 计时实现。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { JSDOM } from 'jsdom';

test('官方 Toast 拥有样式与默认消失周期；同文重显且过期完成不会清掉新消息', () => {
  const dom = new JSDOM('<body></body>');
  const doc = dom.window.document, renders = [];
  let unmounted = false;
  const Toast = () => null, IconWarningOutlineRegular = () => null;
  const module = { exports: {} };
  const source = readFileSync(new URL('../src/client/capture-notice.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /setTimeout|holdMs|className=|style=/, '适配器不另造计时或样式');
  const code = transformSync(source, { loader: 'tsx', format: 'cjs' }).code;
  runInNewContext(code, { module, exports: module.exports, require(id) {
    if (id === 'react') return React;
    if (id === 'react-dom/client') return { createRoot: () => ({ render: node => renders.push(node), unmount: () => { unmounted = true; } }) };
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return { Toast, IconWarningOutlineRegular };
    throw new Error(id);
  } });
  const notices = module.exports.mountCaptureNotices(doc);
  notices.show('无法截取');
  const first = renders.at(-1);
  assert.equal(first.type, Toast); assert.equal(first.props.text, '无法截取');
  assert.equal(first.props.icon.type, IconWarningOutlineRegular);
  assert.equal(first.props.holdMs, undefined);
  notices.show('无法截取');
  const second = renders.at(-1);
  assert.notEqual(first.key, second.key);
  first.props.onDone(); assert.equal(renders.at(-1), second);
  second.props.onDone(); assert.equal(renders.at(-1), null);
  notices.show('已复制', 'success'); assert.equal(renders.at(-1).props.tone, 'success');
  notices.show(''); assert.equal(renders.at(-1), null);
  notices.dispose(); notices.dispose();
  const count = renders.length;
  notices.show('迟到错误'); assert.equal(renders.length, count);
  assert.equal(unmounted, true); assert.equal(doc.body.children.length, 0);
  dom.window.close();
});
