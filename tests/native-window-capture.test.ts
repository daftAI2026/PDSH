/**
 * [INPUT]: 依赖 node:test、fake 子进程/时钟与 Host native capture 适配器，只读Mach-O双架构头，不触发真实 helper。
 * [OUTPUT]: 固定显式取像门、PNG/CRC封套、平台路由及取消/close结算合同；验证Win x64启动参数/隐藏窗口和ARM64拒绝。
 * [POS]: 原生整窗 Host 适配器的纯合同测试；不请求系统权限、不取像、不操作用户应用。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PassThrough } from 'node:stream';
import { crc32, deflateSync } from 'node:zlib';
import {
  createClickCapture,
  nativeCaptureTarget,
  readPngSize,
  resolveNativeCaptureHelperPath,
  runNativeCapture,
  shouldRegisterNativeCaptureProvider,
} from '../src/host/native-window-capture.ts';
import type {
  NativeCaptureScheduler,
  NativeCaptureSpawnOptions,
  NativeCaptureSpawner,
  NativeCaptureTimerHandle,
} from '../src/host/native-window-capture.ts';

interface FakeTimer {
  readonly id: number;
  readonly timer: number;
}

interface TimerEntry {
  readonly callback: () => void;
  readonly delay: number;
}

class FakeScheduler implements NativeCaptureScheduler {
  readonly timers = new Map<NativeCaptureTimerHandle, TimerEntry>();
  private nextId = 0;

  set(callback: () => void, delay: number): FakeTimer {
    const id = ++this.nextId;
    const handle = { id, timer: id };
    this.timers.set(handle, { callback, delay });
    return handle;
  }

  clear(handle: NativeCaptureTimerHandle): void {
    this.timers.delete(handle);
  }
}

class FakeChild extends EventEmitter {
  readonly stdout = new PassThrough();
  readonly stderr = new PassThrough();
  readonly kills: NodeJS.Signals[] = [];

  kill(signal: NodeJS.Signals): boolean {
    this.kills.push(signal);
    return true;
  }
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function pngChunk(type: string, data: Buffer): Buffer {
  const value = Buffer.alloc(data.length + 12);
  value.writeUInt32BE(data.length, 0);
  value.write(type, 4, 'ascii');
  data.copy(value, 8);
  value.writeUInt32BE(crc32(value.subarray(4, value.length - 4)), value.length - 4);
  return value;
}

function fakePng(width = 100, height = 80): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const pixels = width > 0 && height > 0 && width * height < 1_000_000
    ? Buffer.alloc((width * 4 + 1) * height)
    : Buffer.alloc(5);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function harness() {
  const child = new FakeChild();
  const calls: Array<{ file: string; args: readonly string[]; options: NativeCaptureSpawnOptions }> = [];
  const scheduler = new FakeScheduler();
  const spawnProcess: NativeCaptureSpawner = (file, args, options) => {
    calls.push({ file, args, options });
    return child;
  };
  const options = { helperPath: '/fake/native/window-capture', requestPermission: true, spawnProcess, scheduler };
  const phase = (value: string) => child.stderr.emit('data', Buffer.from(`phase=${value}\n`));
  const success = (png = fakePng()) => {
    const { width, height } = readPngSize(png);
    child.stdout.emit('data', png);
    child.stderr.emit('data', Buffer.from(`${JSON.stringify({
      status: 'captured', width, height, pngBytes: png.length, pointPixelScale: 2,
    })}\n`));
    child.emit('close', 0, null);
  };
  return { child, calls, options, phase, scheduler, success };
}

test('构造无副作用；只有显式 capture 才授权，权限不缓存', async () => {
  const images: Buffer[] = [];
  const controller = createClickCapture({ runner: async () => {
    const png = fakePng();
    images.push(png);
    return { png, width: 100, height: 80, scope: 'owned-window', pointPixelScale: 2 };
  } });
  await Promise.resolve();
  assert.equal(images.length, 0);
  await controller.capture();
  await controller.capture();
  assert.equal(images.length, 2);
  await controller.dispose();
  await assert.rejects(controller.capture(), { code: 'disposed' });
  assert.equal(images.length, 2);
});

test('仅构造 capture controller 不会调用带 fake spawn 的 helper wrapper', async () => {
  const h = harness();
  const controller = createClickCapture({
    runner: options => runNativeCapture({ ...h.options, ...options }),
  });
  await Promise.resolve();
  assert.equal(h.calls.length, 0);
  await controller.dispose();
  assert.equal(h.calls.length, 0);
});

test('已取消点击不运行 helper；同 tick dispose 也不触发授权', async () => {
  let runs = 0;
  const controller = createClickCapture({ runner: async () => {
    ++runs;
    const png = fakePng();
    return { png, width: 100, height: 80, scope: 'owned-window', pointPixelScale: 2 };
  } });
  await assert.rejects(controller.capture(AbortSignal.abort()), { code: 'cancelled' });
  assert.equal(runs, 0);
  const work = controller.capture();
  const rejection = assert.rejects(work, { code: 'cancelled' });
  await controller.dispose();
  await rejection;
  assert.equal(runs, 0);
});

test('取消保留 single-flight 到 runner 真正结算；晚到像素不交付', async () => {
  const gate = deferred<{ png: Buffer; width: number; height: number; scope: 'owned-window'; pointPixelScale: number }>();
  let invocation: { signal: AbortSignal; requestPermission: true } | undefined;
  const controller = createClickCapture({ runner: options => {
    invocation = options;
    return gate.promise;
  } });
  const caller = new AbortController();
  const work = controller.capture(caller.signal);
  const rejection = assert.rejects(work, { code: 'cancelled' });
  await Promise.resolve();
  assert.ok(invocation);
  caller.abort();
  assert.equal(invocation.signal.aborted, true);
  await assert.rejects(controller.capture(), { code: 'busy' });
  gate.resolve({ png: fakePng(), width: 100, height: 80, scope: 'owned-window', pointPixelScale: 2 });
  await rejection;
  assert.ok((await controller.capture()).png.length > 0);
  await controller.dispose();
});

test('权限拒绝不后台重试；下一次明确点击允许重试', async () => {
  let count = 0;
  const controller = createClickCapture({ runner: async () => {
    ++count;
    if (count === 1) throw Object.assign(new Error('fixed'), { code: 'permission-not-granted' });
    const png = fakePng();
    return { png, width: 100, height: 80, scope: 'owned-window', pointPixelScale: 2 };
  } });
  await assert.rejects(controller.capture(), { code: 'permission-not-granted' });
  await Promise.resolve();
  assert.equal(count, 1);
  assert.ok((await controller.capture()).png.length > 0);
  assert.equal(count, 2);
  await controller.dispose();
});

test('PNG头签名、长度、零尺寸与像素预算拒绝；合法尺寸通过', () => {
  assert.deepEqual(readPngSize(fakePng()), { width: 100, height: 80 });
  for (const bad of [Buffer.alloc(33), fakePng(0, 80), fakePng(0xffffffff, 0xffffffff)]) {
    assert.throws(() => readPngSize(bad));
  }
  const badLength = fakePng();
  badLength.writeUInt32BE(12, 8);
  assert.throws(() => readPngSize(badLength), { code: 'invalid-png' });
});

test('helper 仅以真实 Host pid/ppid 和显式授权参数启动，无 shell 或文件管道', async () => {
  const h = harness();
  const work = runNativeCapture(h.options);
  const call = h.calls[0];
  assert.ok(call);
  assert.equal(call.file, '/fake/native/window-capture');
  assert.deepEqual(call.args, ['--capture', String(process.pid), String(process.ppid), '--request-permission']);
  assert.equal(call.options.shell, false);
  assert.equal(call.options.windowsHide, undefined, 'macOS spawn behavior remains unchanged');
  assert.deepEqual(call.options.stdio, ['ignore', 'pipe', 'pipe']);
  h.phase('capture-ready');
  h.success();
  const image = await work;
  assert.equal(image.scope, 'owned-window');
  assert.equal(image.pointPixelScale, 2);
  assert.deepEqual(image.png, fakePng());
  assert.equal(h.scheduler.timers.size, 0);
});

test('原生 helper 路由只支持 universal macOS 与包内 Windows x64，不猜测 ARM64', () => {
  assert.deepEqual(nativeCaptureTarget('darwin', 'arm64'), {
    relativePath: './native/window-capture',
    windowsHide: false,
  });
  assert.deepEqual(nativeCaptureTarget('win32', 'x64'), {
    relativePath: './native/windows/window-capture-x64.exe',
    windowsHide: true,
  });
  assert.equal(nativeCaptureTarget('win32', 'arm64'), undefined);
  assert.equal(nativeCaptureTarget('linux', 'x64'), undefined);

  const bundleUrl = 'file:///opt/pdsh/index.js';
  assert.equal(resolveNativeCaptureHelperPath('win32', 'x64', bundleUrl), '/opt/pdsh/native/windows/window-capture-x64.exe');
  assert.equal(resolveNativeCaptureHelperPath('win32', 'arm64', bundleUrl), undefined);
  assert.equal(shouldRegisterNativeCaptureProvider('darwin', 'arm64', () => false, bundleUrl), true,
    'macOS retains its existing provider registration behavior');
  assert.equal(shouldRegisterNativeCaptureProvider('win32', 'x64', path => path.endsWith('window-capture-x64.exe'), bundleUrl), true);
  assert.equal(shouldRegisterNativeCaptureProvider('win32', 'x64', () => false, bundleUrl), false,
    'Windows provider is absent when the packaged helper is missing');
  assert.equal(shouldRegisterNativeCaptureProvider('win32', 'arm64', () => true, bundleUrl), false);
  assert.equal(shouldRegisterNativeCaptureProvider('linux', 'x64', () => true, bundleUrl), false);
});

test('Windows x64 spawns the packaged helper hidden, with the shared non-shell argv and stdio protocol', async () => {
  const h = harness();
  const helperPath = '/package/native/windows/window-capture-x64.exe';
  const work = runNativeCapture({
    ...h.options,
    helperPath,
    platform: 'win32',
    arch: 'x64',
  });
  const call = h.calls[0];
  assert.ok(call);
  assert.equal(call.file, helperPath);
  assert.deepEqual(call.args, ['--capture', String(process.pid), String(process.ppid), '--request-permission']);
  assert.equal(call.options.shell, false);
  assert.equal(call.options.windowsHide, true);
  assert.equal('runas' in call.options, false, 'helper never requests elevation');
  assert.deepEqual(call.options.stdio, ['ignore', 'pipe', 'pipe']);
  h.phase('capture-ready');
  h.success();
  assert.equal((await work).scope, 'owned-window');
});

test('Windows ARM64 fails closed before spawn when no matching helper is packaged', async () => {
  const h = harness();
  const work = runNativeCapture({ ...h.options, platform: 'win32', arch: 'arm64' });
  await assert.rejects(work, { code: 'api-unavailable' });
  assert.equal(h.calls.length, 0);
});

test('人控授权阶段无计时器；capture-ready 后才启动 30 秒取像预算', async () => {
  const h = harness();
  const phases: string[] = [];
  const work = runNativeCapture({ ...h.options, onPhase: phase => phases.push(phase) });
  assert.ok([...h.scheduler.timers.values()].some(timer => timer.delay === 5_000));
  h.phase('authorization-required');
  assert.equal(h.scheduler.timers.size, 0);
  assert.deepEqual(phases, ['authorization-required']);
  h.phase('capture-ready');
  assert.ok([...h.scheduler.timers.values()].some(timer => timer.delay === 30_000));
  h.success();
  await work;
  assert.deepEqual(phases, ['authorization-required', 'capture-ready']);
});

test('固定拒绝码保留、未知 helper 状态不透传', async () => {
  for (const status of ['permission-not-granted', 'private-path-or-credential']) {
    const h = harness();
    const work = runNativeCapture(h.options);
    const expected = status === 'permission-not-granted' ? status : 'helper-failed';
    const rejection = assert.rejects(work, { code: expected });
    h.child.stderr.emit('data', Buffer.from(`${JSON.stringify({ status })}\n`));
    h.child.emit('close', 1, null);
    await rejection;
    assert.equal(h.scheduler.timers.size, 0);
  }
});

test('缺少 capture-ready 或尺寸元数据不一致均拒绝交付', async () => {
  const missing = harness();
  const missingWork = runNativeCapture(missing.options);
  const missingRejection = assert.rejects(missingWork, { code: 'helper-protocol-invalid' });
  missing.child.stdout.emit('data', fakePng());
  missing.child.emit('close', 0, null);
  await missingRejection;

  const mismatch = harness();
  const mismatchWork = runNativeCapture(mismatch.options);
  const mismatchRejection = assert.rejects(mismatchWork, { code: 'metadata-mismatch' });
  mismatch.phase('capture-ready');
  mismatch.child.stdout.emit('data', fakePng());
  mismatch.child.stderr.emit('data', Buffer.from(`${JSON.stringify({
    status: 'captured', width: 101, height: 80, pointPixelScale: 2, pngBytes: fakePng().length,
  })}\n`));
  mismatch.child.emit('close', 0, null);
  await mismatchRejection;
});

test('stdout 与 stderr 可乱序；只在 child close 且 metadata 完整后交付', async () => {
  const h = harness();
  const work = runNativeCapture(h.options);
  let settled = false;
  void work.then(() => { settled = true; }, () => { settled = true; });
  h.child.stdout.emit('data', fakePng());
  await Promise.resolve();
  assert.equal(settled, false);
  h.phase('capture-ready');
  h.child.stderr.emit('data', Buffer.from(`${JSON.stringify({
    status: 'captured', width: 100, height: 80, pointPixelScale: 2, pngBytes: fakePng().length,
  })}\n`));
  await Promise.resolve();
  assert.equal(settled, false);
  h.child.emit('close', 0, null);
  assert.deepEqual((await work).png, fakePng());
  assert.deepEqual(h.child.kills, []);
});

test('未显式要求 requestPermission:true 时绝不启动 helper', async () => {
  for (const requestPermission of [false, undefined]) {
    const h = harness();
    const work = runNativeCapture({ ...h.options, requestPermission });
    const rejection = assert.rejects(work, { code: 'gesture-required' });
    if (h.calls.length > 0) {
      h.phase('capture-ready');
      h.success();
    }
    await rejection;
    assert.equal(h.calls.length, 0);
  }
  const allowed = harness();
  const work = runNativeCapture(allowed.options);
  allowed.phase('capture-ready');
  allowed.success();
  assert.ok((await work).png.length > 0);
});

test('CRC、IHDR/IDAT/IEND 封套和尾字节均经过严格检查', async () => {
  const valid = fakePng();
  const crcCorrupt = Buffer.from(valid);
  crcCorrupt[45] ^= 1;
  const noData = Buffer.concat([valid.subarray(0, 33), valid.subarray(valid.length - 12)]);
  const invalid = [
    valid.subarray(0, 33),
    noData,
    valid.subarray(0, valid.length - 12),
    crcCorrupt,
    Buffer.concat([valid, Buffer.from([0])]),
  ];
  for (const png of invalid) {
    const h = harness();
    const work = runNativeCapture(h.options);
    const rejection = assert.rejects(work, { code: 'invalid-png' });
    h.phase('capture-ready');
    h.success(png);
    await rejection;
  }
});

test('CRC 重算也不能让非 ASCII chunk type 或 reserved bit 伪装成合法 PNG', async () => {
  const valid = fakePng();
  const highHeader = Buffer.from(valid);
  highHeader[12] |= 0x80;
  highHeader.writeUInt32BE(crc32(highHeader.subarray(12, 29)), 29);
  const highData = Buffer.from(valid);
  highData[37] |= 0x80;
  const dataEnd = 33 + highData.readUInt32BE(33) + 12;
  highData.writeUInt32BE(crc32(highData.subarray(37, dataEnd - 4)), dataEnd - 4);
  const reserved = Buffer.concat([
    valid.subarray(0, 33),
    pngChunk('abcD', Buffer.from([1])),
    valid.subarray(33),
  ]);
  for (const png of [highHeader, highData, reserved]) {
    const h = harness();
    const work = runNativeCapture(h.options);
    const rejection = assert.rejects(work, { code: 'invalid-png' });
    h.phase('capture-ready');
    h.child.stdout.emit('data', png);
    h.child.stderr.emit('data', Buffer.from(`${JSON.stringify({
      status: 'captured', width: 100, height: 80, pointPixelScale: 2, pngBytes: png.length,
    })}\n`));
    h.child.emit('close', 0, null);
    await rejection;
  }

  const accepted = harness();
  const work = runNativeCapture(accepted.options);
  accepted.phase('capture-ready');
  accepted.success(Buffer.concat([
    valid.subarray(0, 33), pngChunk('abCD', Buffer.from([1])), valid.subarray(33),
  ]));
  assert.ok((await work).png.length > 0);
});

test('取消只杀自有 child；SIGKILL 后仍等待真实 close 才结算', async () => {
  const h = harness();
  const signal = new AbortController();
  const work = runNativeCapture({ ...h.options, signal: signal.signal });
  let settled = false;
  void work.then(() => { settled = true; }, () => { settled = true; });
  const rejection = assert.rejects(work, { code: 'cancelled' });
  h.phase('authorization-required');
  signal.abort();
  await Promise.resolve();
  assert.deepEqual(h.child.kills, ['SIGTERM']);
  assert.equal(settled, false);
  const force = [...h.scheduler.timers.values()].find(timer => timer.delay === 2_000);
  assert.ok(force);
  force.callback();
  assert.deepEqual(h.child.kills, ['SIGTERM', 'SIGKILL']);
  await Promise.resolve();
  assert.equal(settled, false);
  h.child.emit('close', null, 'SIGKILL');
  await rejection;
  assert.equal(h.scheduler.timers.size, 0);
});

test('Windows 取消先 SIGTERM、超时强杀，并且必须等 close 后才结算', async () => {
  const h = harness();
  const signal = new AbortController();
  const work = runNativeCapture({ ...h.options, platform: 'win32', arch: 'x64', signal: signal.signal });
  let settled = false;
  void work.then(() => { settled = true; }, () => { settled = true; });
  const rejection = assert.rejects(work, { code: 'cancelled' });
  signal.abort();
  await Promise.resolve();
  assert.deepEqual(h.child.kills, ['SIGTERM']);
  const force = [...h.scheduler.timers.values()].find(timer => timer.delay === 2_000);
  assert.ok(force);
  force.callback();
  assert.deepEqual(h.child.kills, ['SIGTERM', 'SIGKILL']);
  await Promise.resolve();
  assert.equal(settled, false);
  h.child.emit('close', null, 'SIGKILL');
  await rejection;
  assert.equal(settled, true);
});

test('PNG CRC32 使用 Host Node 的 node:zlib 实现', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
  assert.deepEqual(readPngSize(fakePng()), { width: 100, height: 80 });
});

test('PNG 管道上限为 128 MiB；超出一字节才拒绝并等 child close', async () => {
  const h = harness();
  const work = runNativeCapture(h.options);
  const rejection = assert.rejects(work, { code: 'byte-budget-exceeded' });
  h.phase('capture-ready');
  const block = Buffer.alloc(1024 * 1024);
  for (let count = 0; count < 128; ++count) h.child.stdout.emit('data', block);
  assert.deepEqual(h.child.kills, []);
  h.child.stdout.emit('data', Buffer.from([0]));
  assert.deepEqual(h.child.kills, ['SIGTERM']);
  h.child.emit('close', null, null);
  await rejection;
  assert.equal(h.scheduler.timers.size, 0);
});


test('捆包helper含arm64与x86_64，不把构建机器架构当作所有Mac架构', () => {
  const build = readFileSync(new URL('../native/build.sh', import.meta.url), 'utf8');
  assert.match(build, /-arch arm64/);
  assert.match(build, /-arch x86_64/);
  const binary = readFileSync(new URL('../native/window-capture', import.meta.url));
  assert.equal(binary.readUInt32BE(0), 0xcafebabe, '必须是universal Mach-O，不执行helper');
  assert.equal(binary.readUInt32BE(4), 2);
  const types = [binary.readUInt32BE(8), binary.readUInt32BE(28)].sort((a, b) => a - b);
  assert.deepEqual(types, [0x01000007, 0x0100000c]);
});
