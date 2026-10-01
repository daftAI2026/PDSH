/**
 * [INPUT]: 依赖三个生成子包 Client 的真实 inject 声明、Cordis 4.0.4 注册器和 rc.2 Connection 服务形状。
 * [OUTPUT]: 验证三入口不等待虚构子服务；Connection 撤回只卸载拍照的依赖边界。
 * [POS]: Client 启动审计回归；不直接调用 apply 绕过依赖解析，也不启动网络或 Main。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { Context } from '@deepseek-ai/cordis';
import React from 'react';
import * as jsx from 'react/jsx-runtime';

function declaration(kind: string) {
  let factory;
  const file = `../components/${kind}/client.js`;
  runInNewContext(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load(row) { factory = row.factory; } } }, TextEncoder,
  });
  return factory(id => {
    if (id === 'react') return React;
    if (id === 'react/jsx-runtime') return jsx;
    if (id === 'react-dom/client') return { createRoot() { assert.fail('声明加载不能渲染'); } };
    if (id === '@deepseek-ai/dsh-client-ui-primitives') return {};
    throw new Error(`unknown module ${id}`);
  }).inject;
}
function provideHostServices(ctx) {
  for (const key of ['slots', 'locale', 'configForms', 'remote', 'remote.pluginManager']) ctx.provide(key, {});
}

test('三个生成入口经真实 Cordis 注入后均启动；RPC 是 Connection 属性而非服务', async () => {
  const ctx = new Context(), started = [], stopped = [];
  try {
    provideHostServices(ctx);
    const connection = ctx.plugin(child => { child.provide('connection', { rpc: { call() {} } }); });
    await connection.await();
    assert.equal(ctx.get('connection.rpc'), undefined);
    const fibers = [];
    for (const kind of ['identity', 'titles', 'capture']) {
      const fiber = ctx.plugin({ inject: declaration(kind), apply(child) {
        started.push(kind); child.effect(() => () => { stopped.push(kind); });
      } });
      await fiber.await(); fibers.push(fiber);
      assert.ok(started.includes(kind), `${kind} 启动仍在等待：${Object.keys(fiber.inject).filter(key => ctx.get(key) === undefined).join(', ')}`);
    }
    await connection.dispose();
    for (const fiber of fibers) await fiber.await();
    assert.deepEqual(stopped, ['capture'], '桥能力撤回不得卸载身份/标题');
  } finally { await ctx.fiber.dispose(); }
});

test('坏声明正例：提供 Connection.rpc 对象仍不能满足 connection.rpc 注入', async () => {
  const ctx = new Context(); let started = false;
  try {
    ctx.provide('connection', { rpc: { call() {} } });
    const fiber = ctx.plugin({ inject: ['connection.rpc'], apply() { started = true; } });
    await fiber.await(); assert.equal(started, false); assert.equal(ctx.get('connection.rpc'), undefined);
  } finally { await ctx.fiber.dispose(); }
});
