/**
 * [INPUT]: 依赖标题开关控制器与可控的 Host ConfigForm 镜像。
 * [OUTPUT]: 验证单路径原子切换、已接受状态、pending/readonly/冲突与卸载。
 * [POS]: PDSH 帽子入口状态合同，不包含原生搜索或持久化第二份状态。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mountTitleToggle } from './title-toggle.js';

test('帽子只切换一个Host路径，串行期间禁用，失败不假装开启', async () => {
  let snapshot = { status: 'ready', writable: true, revision: 4, value: { maskTitles: false } };
  let settle, notifications = 0;
  const writes = [], listeners = new Set();
  const form = { getSnapshot: () => snapshot, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    mutate(ops, revision) { writes.push({ ops, revision }); return new Promise(resolve => { settle = resolve; }); } };
  const control = mountTitleToggle(form, () => ++notifications);
  const first = control.activate();
  assert.equal(control.state().busy, true); assert.equal(control.state().pressed, false);
  await control.activate(); assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], { ops: [{ op: 'set', path: ['maskTitles'], value: true }], revision: 4 });
  settle(false); await first;
  assert.equal(control.state().pressed, false); assert.equal(control.state().failed, true);
  const second = control.activate();
  snapshot = { ...snapshot, revision: 5, value: { maskTitles: true } };
  for (const fn of listeners) fn(); settle(true); await second;
  assert.equal(control.state().pressed, true); assert.equal(control.state().busy, false);
  snapshot = { ...snapshot, writable: false }; for (const fn of listeners) fn();
  await control.activate(); assert.equal(writes.length, 2); assert.equal(control.state().disabled, true);
  const before = notifications; control.dispose(); assert.equal(listeners.size, 0);
  await control.activate(); assert.equal(notifications, before); assert.equal(writes.length, 2);
});

test('拒绝非法配置/断连；异常结算和卸载后不通知残留入口', async () => {
  let snapshot = { status: 'loading', writable: false };
  let settle, notified = 0;
  const writes = [];
  const form = { getSnapshot: () => snapshot, subscribe: () => () => {}, mutate(ops) { writes.push(ops); return new Promise((resolve, reject) => { settle = reject; }); } };
  const control = mountTitleToggle(form, () => ++notified);
  await control.activate(); assert.equal(writes.length, 0);
  snapshot = { status: 'ready', writable: true, value: { maskTitles: 'true' }, revision: 0 };
  await control.activate(); assert.equal(writes.length, 0);
  snapshot = { ...snapshot, value: { maskTitles: false } };
  const pending = control.activate(); control.dispose(); const before = notified;
  settle(new Error('transport')); await pending; assert.equal(notified, before);
});
