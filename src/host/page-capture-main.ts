/**
 * [INPUT]: 依赖已验证的 Electron Main、系统临时根内的私有 socket 控制连接及当前主 frame 的固定接收器。
 * [OUTPUT]: 提供 startMainBridge；单次原生 PNG 只交付原页面，取消保留 native capture 锁直到真实结算。
 * [POS]: PDSH 包内拍照模块的 Main 边界；不使用 desktopCapturer，不读账号，取像不写文件，显式保存交给 page-save-main；像素不进 HTTP/日志。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { createNativePageSave } from './page-save-main.ts';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { chmodSync, lstatSync, realpathSync } from 'node:fs';
import { dirname, basename, isAbsolute, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { CAPTURE_RECEIVER, MAX_PAGE_PIXELS, MAX_PNG_BYTES, MAX_CONTROL_BYTES, BRIDGE_TIMEOUT_MS, isCaptureId, parseControlRecord } from '../shared/capture-bridge.ts';

const OWNED = Symbol.for('@daftai/pdsh.main-capture.v1');
const LOCKS = Symbol.for('@daftai/pdsh.native-capture-locks.v1');
function nativeLocks() {
  const registry = (globalThis as any)[LOCKS] ?? { map: new WeakMap(), users: 0, flights: 0 };
  (globalThis as any)[LOCKS] = registry; ++registry.users;
  const release = () => { if (!registry.users && !registry.flights && (globalThis as any)[LOCKS] === registry) delete (globalThis as any)[LOCKS]; };
  return { registry, release };
}
export function createNativePageCapture(win, onDispose = () => {}) {
  const contents = win.webContents, { registry, release } = nativeLocks();
  let settlement: Promise<void> = Promise.resolve();
  let epoch = 0, disposed = false, flight: { id: string; cancelled: boolean } | null = null;
  const change = () => { ++epoch; if (flight) flight.cancelled = true; };
  const close = () => { dispose(); onDispose(); };
  const events = ['did-start-navigation', 'render-process-gone', 'destroyed'];
  for (const event of events) contents.on(event, change);
  win.on('resize', change); win.on('closed', close);
  function dispose() {
    if (disposed) return; disposed = true; change();
    for (const event of events) contents.removeListener(event, change);
    win.removeListener('resize', change); win.removeListener('closed', close);
    --registry.users; release();
  }
  function probe(frame, id) {
    return frame.executeJavaScript(`globalThis[Symbol.for(${JSON.stringify(CAPTURE_RECEIVER)})]?.probe(${JSON.stringify(id)}) ?? null`, false);
  }
  function supported() {
    if (win.isDestroyed() || contents.isDestroyed() || !win.isVisible()) return false;
    // 独立 WebContentsView 不属于 capturePage 的页面像素；可见时拒绝漏层截图。
    return !(win.contentView?.children ?? []).some(view => view.webContents && view.webContents !== contents && view.getVisible());
  }
  return {
    cancel(id) { if (flight?.id === id) flight.cancelled = true; }, dispose, settled: () => settlement,
    async capture(id, owner = id) {
      if (disposed || flight || registry.map.has(contents) || !isCaptureId(id) || !supported()) throw new Error('capture unavailable');
      const current = { id, cancelled: false }; flight = current;
      registry.map.set(contents, current); ++registry.flights;
      let settled; settlement = new Promise<void>(resolve => { settled = resolve; });
      try {
        const frame = contents.mainFrame, generation = epoch, size = win.getContentSize(), url = contents.getURL();
        const scope = new URL(url);
        if (scope.protocol !== 'dsh-app:' || scope.hostname !== 'app' || !['/', '/index.html'].includes(scope.pathname)) throw new Error('unsupported page scope');
        function valid() {
          if (disposed || current.cancelled || epoch !== generation || !supported() || frame.isDestroyed()
            || contents.mainFrame !== frame || contents.getURL() !== url || win.getContentSize().some((value, index) => value !== size[index])) throw new Error('page changed');
        }
        const before = await probe(frame, id); valid();
        if (!before || before.unsupportedEmbed === true || before.nonce !== owner || !isCaptureId(before.nonce) || ![before.width, before.height, before.dpr].every(value => Number.isFinite(value) && value > 0)
          || before.width * before.height * before.dpr ** 2 > MAX_PAGE_PIXELS) throw new Error('invalid page request');
        const image = await contents.capturePage(); valid();
        const scales = image.getScaleFactors();
        if (!scales.length || scales.some(value => !Number.isFinite(value) || value <= 0)) throw new Error('invalid native scale');
        const scaleFactor = Math.max(...scales), pixels = image.getSize(scaleFactor);
        if (!pixels.width || !pixels.height || pixels.width * pixels.height > MAX_PAGE_PIXELS) throw new Error('pixel budget');
        const matches = (physical, css) => physical >= Math.floor(css * before.dpr) && physical <= Math.ceil((css + 1) * before.dpr);
        if (!matches(pixels.width, before.width) || !matches(pixels.height, before.height)) throw new Error('DPR mismatch');
        const png = image.toPNG({ scaleFactor });
        if (!Buffer.isBuffer(png) || png.length < 33 || png.length > MAX_PNG_BYTES) throw new Error('byte budget');
        if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || png.toString('ascii', 12, 16) !== 'IHDR'
          || png.readUInt32BE(16) !== pixels.width || png.readUInt32BE(20) !== pixels.height) throw new Error('native PNG mismatch');
        const after = await probe(frame, id); valid();
        if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error('document changed');
        const delivered = await frame.executeJavaScript(`globalThis[Symbol.for(${JSON.stringify(CAPTURE_RECEIVER)})]?.receive(${JSON.stringify(id)},${JSON.stringify(before.nonce)},${JSON.stringify(png.toString('base64'))}) === true`, false);
        valid(); if (!delivered) throw new Error('delivery rejected');
        return { protocolVersion: 1 };
      } finally {
        if (flight === current) flight = null;
        if (registry.map.get(contents) === current) registry.map.delete(contents);
        --registry.flights; settled(); release();
      }
    },
  };
}

export async function startMainBridge({ expectedPid, socketPath, secret }, electron = createRequire(process.execPath)('electron')) {
  if (process.pid !== expectedPid || (process as any).type !== 'browser' || electron.app.getVersion() !== '0.2.0-rc.2') throw new Error('unsupported Main');
  if ((globalThis as any)[OWNED] || typeof secret !== 'string' || !/^[0-9a-f]{64}$/.test(secret) || typeof socketPath !== 'string'
    || !isAbsolute(socketPath) || resolve(socketPath) !== socketPath || basename(socketPath) !== 'bridge.sock'
    || !/^pdsh-main-[A-Za-z0-9]+$/.test(basename(dirname(socketPath)))) throw new Error('bridge ownership rejected');
  // +--- 两端使用系统临时根；规范化只接受根别名，不接受私有目录自身是符号链接 ---+
  try {
    const directory = dirname(socketPath), parent = lstatSync(directory);
    if (realpathSync(dirname(directory)) !== realpathSync(tmpdir()) || !parent.isDirectory()
      || parent.uid !== process.getuid!() || (parent.mode & 0o777) !== 0o700) throw new Error();
  } catch { throw new Error('private directory rejected'); }
  const windows = electron.BrowserWindow.getAllWindows().filter(win => {
    if (win.isDestroyed() || !win.isVisible()) return false;
    try { const url = new URL(win.webContents.getURL()); return url.protocol === 'dsh-app:' && url.hostname === 'app' && url.pathname === '/'; } catch { return false; }
  });
  if (windows.length !== 1) throw new Error('ambiguous page owner');
  let disposed = false, connection = null, authenticated = false;
  const sockets = new Set<any>();
  const server = createServer(socket => {
    if (disposed || authenticated) { socket.destroy(); return; }
    sockets.add(socket); let buffer = '', accepted = false;
    const handshake = setTimeout(() => socket.destroy(), 2000); handshake.unref();
    socket.on('data', chunk => {
      try {
        buffer += chunk.toString(); if (Buffer.byteLength(buffer) > MAX_CONTROL_BYTES) { socket.destroy(); return; }
        while (buffer.includes('\n')) {
          const index = buffer.indexOf('\n'), line = buffer.slice(0, index); buffer = buffer.slice(index + 1);
          let message; try { message = parseControlRecord(line); } catch { socket.destroy(); return; }
          if (typeof message.op !== 'string') { socket.destroy(); return; }
          if (!accepted) {
            if (message.secret !== secret || message.op !== 'hello' || authenticated) { socket.destroy(); return; }
            accepted = authenticated = true; connection = socket; clearTimeout(handshake); clearTimeout(startup);
            socket.write(`${JSON.stringify({ op: 'ready', protocolVersion: 1 })}\n`); continue;
          }
          if (message.op === 'dispose') { socket.end(); dispose(); return; }
          if (!isCaptureId(message.requestId)) { socket.destroy(); return; }
          if (message.op === 'cancel') { capture.cancel(message.requestId); save.cancel(message.requestId); continue; }
          if (!['capture', 'save'].includes(message.op)) { socket.destroy(); return; }
          if (!isCaptureId(message.owner)) { socket.destroy(); return; }
          void (message.op === 'save' ? save.save(message.requestId, message.owner) : capture.capture(message.requestId, message.owner)).then(
            result => answer(message.requestId, true, result.outcome), () => answer(message.requestId, false));
        }
      } catch { socket.destroy(); }
    });
    socket.on('error', () => {});
    socket.on('close', () => { clearTimeout(handshake); sockets.delete(socket); if (connection === socket) dispose(); });
  });
  const capture = createNativePageCapture(windows[0], dispose);
  const save = createNativePageSave(windows[0], electron.dialog, electron.nativeImage);
  const startup = setTimeout(dispose, BRIDGE_TIMEOUT_MS); startup.unref();
  function answer(requestId, ok, outcome?) { if (!disposed && connection && !connection.destroyed) connection.write(`${JSON.stringify({ requestId, ok, protocolVersion: 1, ...(outcome ? { outcome } : {}) })}\n`); }
  function dispose() {
    if (disposed) return; disposed = true; clearTimeout(startup); capture.dispose(); save.dispose();
    for (const socket of sockets) socket.destroy(); server.close();
    void Promise.all([capture.settled(), save.settled()]).finally(() => {
      if ((globalThis as any)[OWNED] === dispose) delete (globalThis as any)[OWNED];
      // 原生结算后才允许重载模块；否则新 factory 不得绕过旧调用的锁。
      if (typeof __filename === 'string') {
        const loader = createRequire(process.execPath), entry = loader.cache[__filename];
        if (entry?.exports.startMainBridge === startMainBridge) delete loader.cache[__filename];
      }
    });
  }
  (globalThis as any)[OWNED] = dispose;
  try {
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(socketPath, resolve); });
    chmodSync(socketPath, 0o600);
    return { protocolVersion: 1, pid: process.pid };
  } catch { dispose(); throw new Error('bridge startup failed'); }
}
