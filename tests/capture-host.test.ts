/**
 * [INPUT]: 依赖 Host capture 的命令/文件边界与 PNG 签名校验。
 * [OUTPUT]: 验证唯一窗口、读取前限额、取消信号、平台退让和临时文件释放。
 * [POS]: 截图 Host 测试，不以命令成功冒充桌面端工作台验证。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { captureMacWindow, createCaptureRoute } from '../src/host/capture.ts';
const png = Buffer.from('89504e470d0a1a0a000000', 'hex');
test('只用唯一窗口 ID，截图调用与 PNG 有界；无论成功失败均移除临时目录', async () => {
  const calls = []; let removed = false;
  const output = await captureMacWindow({ pid: 123, helper: '/bundle/native/window-id',
    exec: async (file, args) => { calls.push([file, args]); return file.endsWith('window-id') ? { stdout: '42\n' } : { stdout: '' }; },
    temp: async () => '/tmp/pdsh-test', read: async () => png, size: async () => ({ size: png.length }), copy: async () => {}, makeExecutable: async () => {},
    remove: async () => { removed = true; },
  });
  assert.deepEqual(output, png); assert.equal(removed, true);
  assert.deepEqual(calls[0], ['/tmp/pdsh-test/window-id', ['123']]);
  assert.deepEqual(calls[1], ['/usr/sbin/screencapture', ['-x', '-o', '-l', '42', '-t', 'png', '/tmp/pdsh-test/window.png']]);
});
test('拒绝模糊窗口与非 PNG，不泄露临时产物', async () => {
  await assert.rejects(captureMacWindow({ pid: 123, helper: '/window-id', exec: async () => ({ stdout: '42\n43\n' }), copy: async () => {}, makeExecutable: async () => {} }), /窗口/);
  let removed = false;
  await assert.rejects(captureMacWindow({ pid: 123, helper: '/window-id', exec: async (file) => ({ stdout: file.endsWith('window-id') ? '42' : '' }), temp: async () => '/tmp/pdsh-test', read: async () => Buffer.from('bad'), size: async () => ({ size: 3 }), copy: async () => {}, makeExecutable: async () => {}, remove: async () => { removed = true; } }), /PNG/);
  assert.equal(removed, true);
});
test('超限 PNG 在读取前拒绝，取消信号传入子进程且归还临时目录', async () => {
  let read = false; let removed = false; const signal = new AbortController().signal;
  await assert.rejects(captureMacWindow({ pid: 123, helper: '/window-id', signal,
    exec: async (file, _args, options) => { assert.equal(options.signal, signal); return { stdout: file.endsWith('window-id') ? '42' : '' }; },
    temp: async () => '/tmp/pdsh-test', size: async () => ({ size: 64 * 1024 * 1024 + 1 }), read: async () => { read = true; return png; },
    copy: async () => {}, makeExecutable: async () => {}, remove: async () => { removed = true; },
  }), /过大/);
  assert.equal(read, false); assert.equal(removed, true);
});
test('仅 macOS 请求截图；响应不缓存，失败不输出残缺像素', async () => {
  const route = createCaptureRoute({ platform: 'linux', capture: async () => png });
  const response = await route.fetch(new Request('http://dsh.internal/api/pdsh/capture', { method: 'POST' }));
  assert.equal(response.status, 501); assert.equal(response.headers.get('cache-control'), 'no-store');
});
