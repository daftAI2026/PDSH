/**
 * [INPUT]: 依赖精确 Desktop Host/父 Main 身份、组件首次点击启动的调试 bootstrap 与固定阶段诊断 与包内 Main 模块、系统临时根；副作用适配边界可隔离验证。
 * [OUTPUT]: 提供 openCaptureBridge 与内部 readMainIdentity/createCaptureBootstrap/connectCaptureControl 合同边界；仅启动时用 inspector，确认关闭后只留私有 socket 控制连接。
 * [POS]: PDSH 包内拍照模块的连接生命周期；已有调试端口拒绝接管，清理未知明确报错，不重启/修改应用。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { execFileSync } from 'node:child_process';
import { mkdtemp, chmod, lstat, unlink, rmdir } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from 'node:net';
import type { CaptureTracePhase } from '../shared/capture-trace.ts';
import { inspectorWatchdog, inspectorClose } from './inspector-ownership.ts';
import { MAX_CONTROL_BYTES, BRIDGE_TIMEOUT_MS, isCaptureId, parseControlRecord } from '../shared/capture-bridge.ts';
// +--- Node v24.18.1 node_options.h:88-90 的默认值，不是插件可分配的桥端口 ---+
// SIGUSR1 不接受端口参数；只能使用父 Main 已持有的默认配置，冲突必须拒绝。
const NODE_DEFAULT_INSPECTOR_PORT = 9229;
const INSPECTOR_ENDPOINT = `http://127.0.0.1:${NODE_DEFAULT_INSPECTOR_PORT}/json/list`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const unavailable = (code = 'bridge-unavailable') => Object.assign(new Error('PDSH Main bridge unavailable'), { code });
const unclosed = () => new Error('PDSH_MAIN_INSPECTOR_CLOSE_UNCONFIRMED');
function listeners(pid?: number) {
  try { return execFileSync('/usr/sbin/lsof', ['-nP', ...(pid ? ['-a', '-p', String(pid)] : []), `-iTCP:${NODE_DEFAULT_INSPECTOR_PORT}`, '-sTCP:LISTEN'], { encoding: 'utf8', timeout: 1000 }).trim(); }
  catch (error) { if (error.status === 1) return ''; throw unavailable(); }
}
async function target(pid) {
  if (!listeners(pid).includes(`127.0.0.1:${NODE_DEFAULT_INSPECTOR_PORT}`)) throw unavailable();
  const response = await fetch(INSPECTOR_ENDPOINT, { signal: AbortSignal.timeout(500) });
  const list = await response.json();
  if (!Array.isArray(list) || list.length !== 1) throw unavailable();
  const url = new URL(list[0].webSocketDebuggerUrl);
  if (url.protocol !== 'ws:' || url.hostname !== '127.0.0.1' || url.port !== String(NODE_DEFAULT_INSPECTOR_PORT) || url.username || url.password) throw unavailable();
  return url.href;
}
async function inspectorClient(url) {
  const ws = new WebSocket(url), pending = new Map<any, any>(); let sequence = 0;
  ws.addEventListener('message', event => {
    let message; try { message = parseControlRecord(String(event.data)); } catch { ws.close(); return; }
    const request = pending.get(message.id); if (!request) return;
    pending.delete(message.id); clearTimeout(request.timer);
    if (message.error || message.result?.exceptionDetails) request.reject(unavailable()); else request.resolve(message.result?.result?.value);
  });
  const closed = new Promise<void>(resolve => ws.addEventListener('close', () => {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(unavailable()); } pending.clear(); resolve();
  }, { once: true }));
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { ws.close(); reject(unavailable()); }, 2000);
    ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
    ws.addEventListener('error', () => { clearTimeout(timer); ws.close(); reject(unavailable()); }, { once: true });
  });
  return { close() { ws.close(); }, closed,
    evaluate(expression): Promise<any> { return new Promise((resolve, reject) => {
      const id = ++sequence, timer = setTimeout(() => { pending.delete(id); ws.close(); reject(unavailable()); }, 5000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, returnByValue: true, awaitPromise: true } }));
    }); },
  };
}
export async function connectCaptureControl(path, secret, signal, connectSocket = connect) {
  const socket = connectSocket(path), pending = new Map<string, any>(); let buffer = '', disposed = false, ready;
  const acknowledged = new Promise<void>((resolve, reject) => { ready = { resolve, reject }; });
  const fail = () => {
    ready.reject(unavailable()); for (const request of pending.values()) { clearTimeout(request.timer); request.reject(unavailable()); } pending.clear();
  };
  socket.on('connect', () => socket.write(`${JSON.stringify({ op: 'hello', secret })}\n`));
  socket.on('error', fail); socket.on('close', fail);
  const closed = new Promise<void>(resolve => socket.once('close', resolve));
  socket.on('data', chunk => {
    try {
      buffer += chunk.toString(); if (Buffer.byteLength(buffer) > MAX_CONTROL_BYTES) { socket.destroy(); return; }
      while (buffer.includes('\n')) {
        const index = buffer.indexOf('\n'), line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
        let message; try { message = parseControlRecord(line); } catch { socket.destroy(); return; }
        if (message.protocolVersion !== 1) { socket.destroy(); return; }
        if (message.op === 'ready') { ready.resolve(); continue; }
        if (!isCaptureId(message.requestId) || typeof message.ok !== 'boolean') { socket.destroy(); return; }
        const request = pending.get(message.requestId); if (!request) continue;
        pending.delete(message.requestId); clearTimeout(request.timer);
        message.ok === true ? request.resolve({ protocolVersion: 1, ...(['saved', 'cancelled'].includes(message.outcome) ? { outcome: message.outcome } : {}) }) : request.reject(unavailable());
      }
    } catch { socket.destroy(); }
  });
  function cancel(requestId) { if (!socket.destroyed) socket.write(`${JSON.stringify({ op: 'cancel', requestId })}\n`); }
  async function dispose() { if (!disposed) { disposed = true; if (!socket.destroyed) socket.end(`${JSON.stringify({ op: 'dispose' })}\n`); socket.destroy(); } await closed; }
  const abort = () => { void dispose(); };
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => socket.destroy(), 2000);
  try { if (signal.aborted) throw unavailable(); await acknowledged; }
  catch { await dispose(); throw unavailable(); }
  finally { clearTimeout(timer); }
  function request(op, requestId, owner) {
    if (disposed || socket.destroyed || !isCaptureId(requestId) || pending.size) return Promise.reject(unavailable());
    return new Promise((resolve, reject) => {
      const timer = op === 'save' ? undefined : setTimeout(() => { pending.delete(requestId); cancel(requestId); reject(unavailable()); }, BRIDGE_TIMEOUT_MS);
      // 原生保存面板等用户决定；断连/停用仍取消，不能用自动超时冒充面板已关闭。
      pending.set(requestId, { resolve, reject, timer }); socket.write(`${JSON.stringify({ op, requestId, owner })}\n`);
    });
  }
  return { cancel,
    capture: (requestId, owner) => request('capture', requestId, owner),
    save: (requestId, owner) => request('save', requestId, owner),
    async dispose() { signal.removeEventListener('abort', abort); await dispose(); },
  };
}
export function createCaptureBootstrap(io) {
 return async function openCaptureBridge(modulePath: string, signal: AbortSignal, trace: (phase: CaptureTracePhase) => void = () => {}) {
  const record = (phase: CaptureTracePhase) => { try { trace(phase); } catch {} };
  record('bootstrap-start');
  // +--- 所有零副作用检查先于 SIGUSR1；Host 从普通启动路径取得自己唯一父 Main ---+
  if (io.platform !== 'darwin' || !io.argv.some(value => value.endsWith('/@deepseek-ai/dsh-desktop-host/lib/index.js')) || !io.electron?.startsWith('44.')) { record('bootstrap-unsupported'); throw unavailable(); }
  const pid = io.pid;
  const identity = () => io.identity(pid);
  let original;
  try { original = identity(); } catch { record('bootstrap-identity-rejected'); throw unavailable(); }
  if (!original.startsWith(`${io.execPath} `) || !io.execPath.endsWith('/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness')) { record('bootstrap-identity-rejected'); throw unavailable(); }
  if (io.listeners()) { record('bootstrap-port-busy'); throw unavailable('bridge-port-busy'); }
  const directory = await mkdtemp(join(tmpdir(), 'pdsh-main-')); await chmod(directory, 0o700);
  const owned = await lstat(directory), socketPath = join(directory, 'bridge.sock'), secret = randomBytes(32).toString('hex');
  let client, bridge, originalUrl, signalled = false, verified = false, cleanupConfirmed = false;
  const nonce = randomBytes(32).toString('hex');

  async function removeDirectory() {
    const current = await lstat(directory).catch(() => null);
    if (!current || current.ino !== owned.ino || current.dev !== owned.dev || !current.isDirectory()) return;
    const socket = await lstat(socketPath).catch(() => null);
    if (socket?.isSocket() && socket.uid === owned.uid) await unlink(socketPath).catch(() => {});
    await rmdir(directory).catch(() => {});
  }
  try {
    if (signal.aborted || identity() !== original) throw unavailable();
    if (io.listeners()) { record('bootstrap-port-busy'); throw unavailable('bridge-port-busy'); }
    io.signalMain(pid); signalled = true; record('inspector-signalled');
    let url;
    for (let attempt = 0; attempt < 25 && !signal.aborted; attempt++) {
      try { url = await io.target(pid); break; } catch { await io.sleep(100); }
    }
    if (!url || identity() !== original) throw unavailable();
    originalUrl = url; client = await io.inspectorClient(url); record('inspector-attached');
    const facts = await client.evaluate(inspectorWatchdog(pid, nonce, url));
    if (facts?.pid !== pid || !facts.electron?.startsWith('44.')) throw unavailable(); verified = true; record('main-verified');
    if (signal.aborted) throw unavailable();
    const result = await client.evaluate(`process.getBuiltinModule('node:module').createRequire(process.execPath)(${JSON.stringify(modulePath)}).startMainBridge(${JSON.stringify({ expectedPid: pid, socketPath, secret })})`);
    if (result?.pid !== pid || result.protocolVersion !== 1) throw unavailable();
    record('main-loaded');
    bridge = await io.socketClient(socketPath, secret, signal); record('control-ready');
  } finally {
    const closedState = () => { try { return io.listeners(pid) ? 'open' : 'closed'; } catch { return 'unknown'; } };
    const sameIdentity = () => { try { return identity() === original; } catch { return false; } };
    try {
      if (client && verified) try { await client.evaluate(inspectorClose(pid, nonce, originalUrl)); } catch {}
      client?.close();
      if (signalled) {
        for (let attempt = 0; attempt < 60; attempt++) { if (closedState() === 'closed') { cleanupConfirmed = true; break; } await io.sleep(100); }
      } else cleanupConfirmed = true;
      if (!cleanupConfirmed && originalUrl && sameIdentity()) {
        // 首次求值前失败也只归还原地址；新调试会话或身份变化绝不接管。
        try {
          const retryUrl = await io.target(pid); if (retryUrl !== originalUrl) throw unavailable();
          const recovery = await io.inspectorClient(retryUrl);
          try { await recovery.evaluate(inspectorClose(pid, nonce, originalUrl)); } finally { recovery.close(); }
        } catch {}
        for (let attempt = 0; attempt < 20; attempt++) { if (closedState() === 'closed') { cleanupConfirmed = true; break; } await io.sleep(100); }
      }
    } finally {
      client?.close();
      if (!bridge || !cleanupConfirmed || signal.aborted) {
        try { await bridge?.dispose(); } finally { await removeDirectory(); }
      }
    }
    if (signalled) record(cleanupConfirmed ? 'inspector-closed' : 'inspector-close-unconfirmed');
    if (!cleanupConfirmed) throw unclosed();
  }

  if (!bridge || signal.aborted) throw unavailable();
  return { capture: bridge.capture, save: bridge.save, cancel: bridge.cancel,
    async dispose() { await bridge.dispose(); await removeDirectory(); } };
}

}

// +--- 进程身份查询独立于启动副作用，便于用真实 ps 验证格式 ---+
export function readMainIdentity(pid, run = execFileSync) {
  // macOS 会截断非末列 comm，-ww 也无效；启动时间放前，完整路径放末列。
  const line = run('/bin/ps', ['-p', String(pid), '-o', 'lstart=,comm='], { encoding: 'utf8', timeout: 1000 }).trim();
  const match = line.match(/^(\S+\s+\S+\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(\/.+)$/);
  if (!match) throw unavailable();
  return `${match[2]} ${match[1]}`;
}

// +--- 生产只绑定普通 Desktop 的真实能力；调用方不能选择进程或调试地址 ---+
export const openCaptureBridge = createCaptureBootstrap({
  platform: process.platform, argv: process.argv, electron: (process as any).versions.electron,
  get pid() { return process.ppid; }, execPath: process.execPath, listeners, target, inspectorClient, socketClient: connectCaptureControl, sleep,
  identity: readMainIdentity,
  signalMain(pid) { process.kill(pid, 'SIGUSR1'); },
});
