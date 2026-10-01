/** [INPUT]: src/host/page-capture-main.ts，由 build.ts 生成。
 * [OUTPUT]: Main startMainBridge；像素只交付原页面。
 * [POS]: 拍照包内部非视觉桥，不手工修改。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/host/page-capture-main.ts
var page_capture_main_exports = {};
__export(page_capture_main_exports, {
  createNativePageCapture: () => createNativePageCapture,
  startMainBridge: () => startMainBridge
});
module.exports = __toCommonJS(page_capture_main_exports);

// src/host/page-save-main.ts
var import_node_path2 = require("node:path");

// src/shared/capture-export.ts
var CAPTURE_EXPORT_MAX_PIXELS = 32e6;
var CAPTURE_EXPORT_MAX_BYTES = 128e6;
function isCaptureExportSizeAllowed(width, height) {
  return Number.isSafeInteger(width) && Number.isSafeInteger(height) && width > 0 && height > 0 && width * height <= CAPTURE_EXPORT_MAX_PIXELS;
}
function assertCaptureExportSize(width, height) {
  if (!isCaptureExportSizeAllowed(width, height)) throw Object.assign(new Error("Capture export budget exceeded"), { code: "export-oversize" });
}

// src/host/page-save-webp.ts
function readWebPDimensions(bytes) {
  const bad = () => new Error("Invalid WebP export");
  if (bytes.length < 20 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP" || bytes.readUInt32LE(4) !== bytes.length - 8) throw bad();
  let canvas, image;
  for (let offset = 12; offset < bytes.length; ) {
    if (offset + 8 > bytes.length) throw bad();
    const kind = bytes.toString("ascii", offset, offset + 4), length = bytes.readUInt32LE(offset + 4), start = offset + 8, end = start + length;
    if (end + (length & 1) > bytes.length || ["ANIM", "ANMF"].includes(kind)) throw bad();
    if (kind === "VP8X") {
      if (canvas || length !== 10 || bytes[start] & 195 || bytes[start + 1] || bytes[start + 2] || bytes[start + 3]) throw bad();
      canvas = { width: bytes.readUIntLE(start + 4, 3) + 1, height: bytes.readUIntLE(start + 7, 3) + 1 };
    } else if (kind === "VP8 ") {
      if (image || length < 10 || bytes[start] & 1 || bytes.toString("hex", start + 3, start + 6) !== "9d012a") throw bad();
      image = { width: bytes.readUInt16LE(start + 6) & 16383, height: bytes.readUInt16LE(start + 8) & 16383 };
    } else if (kind === "VP8L") {
      if (image || length < 5 || bytes[start] !== 47 || bytes[start + 4] & 224) throw bad();
      const bits = bytes.readUInt32LE(start + 1);
      image = { width: (bits & 16383) + 1, height: (bits >>> 14 & 16383) + 1 };
    }
    offset = end + (length & 1);
  }
  if (!image || canvas && (canvas.width !== image.width || canvas.height !== image.height)) throw bad();
  assertCaptureExportSize(image.width, image.height);
  return image;
}

// src/host/page-save-file.ts
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var import_node_crypto = require("node:crypto");
var MAX_NAME_ATTEMPTS = 1e3;
async function commitImage(target, bytes, commit) {
  const temporary = (0, import_node_path.join)((0, import_node_path.dirname)(target), `.pdsh-save-${(0, import_node_crypto.randomBytes)(16).toString("hex")}.tmp`);
  let file, owned = false;
  try {
    file = await (0, import_promises.open)(temporary, "wx", 384);
    owned = true;
    await file.writeFile(bytes);
    await file.sync();
    await file.close();
    file = null;
    await commit(temporary);
  } finally {
    if (file) await file.close().catch(() => {
    });
    if (owned) await (0, import_promises.unlink)(temporary).catch(() => {
    });
  }
}
function writeConfirmedImage(target, bytes, beforeCommit = () => {
}) {
  return commitImage(target, bytes, async (temporary) => {
    beforeCommit();
    await (0, import_promises.rename)(temporary, target);
  });
}
function writeUniqueImage(target, bytes, beforeCommit = () => {
}) {
  const extension = (0, import_node_path.extname)(target), stem = (0, import_node_path.basename)(target, extension);
  return commitImage(target, bytes, async (temporary) => {
    for (let attempt = 0; attempt < MAX_NAME_ATTEMPTS; ++attempt) {
      const candidate = attempt ? (0, import_node_path.join)((0, import_node_path.dirname)(target), `${stem} (${attempt})${extension}`) : target;
      beforeCommit();
      try {
        await (0, import_promises.link)(temporary, candidate);
        return;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    }
    throw new Error("PDSH export name budget exhausted");
  });
}

// src/shared/capture-bridge.ts
var CAPTURE_RECEIVER = "@daftai/pdsh.page-capture.receiver.v1";
var MAX_PAGE_PIXELS = 16e6;
var MAX_PNG_BYTES = MAX_PAGE_PIXELS * 8;
var MAX_CONTROL_BYTES = 2048;
var BRIDGE_TIMEOUT_MS = 3e4;
function isCaptureId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function parseControlRecord(line) {
  const value = JSON.parse(line);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid control record");
  return value;
}

// src/host/page-save-main.ts
var LOCK = Symbol.for("@daftai/pdsh.native-save-locks.v1");
function createNativePageSave(win, dialog, nativeImage, write = writeConfirmedImage, writeUnique = writeUniqueImage) {
  const contents = win.webContents;
  const locks = globalThis[LOCK] ?? (globalThis[LOCK] = /* @__PURE__ */ new WeakMap());
  let disposed = false, epoch = 0, current = null, settlement = Promise.resolve();
  const changed = () => {
    ++epoch;
    if (current) current.cancelled = true;
  };
  const events = ["did-start-navigation", "render-process-gone", "destroyed"];
  for (const event of events) contents.on(event, changed);
  win.on("closed", changed);
  function valid(frame, generation, request) {
    if (disposed || request.cancelled || generation !== epoch || win.isDestroyed() || contents.isDestroyed() || frame.isDestroyed() || contents.mainFrame !== frame) throw new Error("save unavailable");
    const url = new URL(contents.getURL());
    if (url.protocol !== "dsh-app:" || url.hostname !== "app" || !["/", "/index.html"].includes(url.pathname)) throw new Error("save unavailable");
  }
  return {
    cancel(id) {
      if (current?.id === id) current.cancelled = true;
    },
    settled: () => settlement,
    dispose() {
      if (disposed) return;
      disposed = true;
      changed();
      for (const event of events) contents.removeListener(event, changed);
      win.removeListener("closed", changed);
    },
    async save(id, owner) {
      if (disposed || current || locks.has(contents) || !isCaptureId(id) || !isCaptureId(owner)) throw new Error("save unavailable");
      const request = { id, cancelled: false }, frame = contents.mainFrame, generation = epoch;
      current = request;
      locks.set(contents, request);
      let settled;
      settlement = new Promise((resolve2) => {
        settled = resolve2;
      });
      try {
        valid(frame, generation, request);
        const data = await frame.executeJavaScript(`globalThis[Symbol.for(${JSON.stringify(CAPTURE_RECEIVER)})]?.exportData(${JSON.stringify(id)},${JSON.stringify(owner)}) ?? null`, false);
        valid(frame, generation, request);
        const extensions = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }, extension = extensions[data?.mime];
        const behavior = data?.saveBehavior ?? "ask";
        if (!data || data.nonce !== owner || !extension || typeof data.fileName !== "string" || Buffer.byteLength(data.fileName) > 240 || !["ask", "direct"].includes(behavior) || behavior === "direct" && !data.directory || !data.fileName.endsWith(`.${extension}`) || /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u206f/\\<>:"|?*]/u.test(data.fileName) || /^\.+$/u.test(data.fileName) || typeof data.directory !== "string" || data.directory && !(0, import_node_path2.isAbsolute)(data.directory) || /[\u0000-\u001f\u007f]/u.test(data.directory) || data.directory.length > 4096 || typeof data.base64 !== "string" || !data.base64.length || data.base64.length > Math.ceil(CAPTURE_EXPORT_MAX_BYTES / 3) * 4 || data.base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data.base64)) throw new Error("invalid export");
        const bytes = Buffer.from(data.base64, "base64");
        if (bytes.length > CAPTURE_EXPORT_MAX_BYTES) throw new Error("export budget");
        const signature = extension === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) : extension === "jpg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
        if (!signature) throw new Error("invalid export");
        const image = extension === "webp" ? null : nativeImage.createFromBuffer(bytes);
        const size = image ? image.getSize() : readWebPDimensions(bytes);
        if (image?.isEmpty()) throw new Error("invalid export");
        assertCaptureExportSize(size.width, size.height);
        if (behavior === "direct") {
          valid(frame, generation, request);
          await writeUnique((0, import_node_path2.join)(data.directory, data.fileName), bytes, () => valid(frame, generation, request));
          return { outcome: "saved" };
        }
        const answer = await dialog.showSaveDialog(win, {
          defaultPath: data.directory ? (0, import_node_path2.join)(data.directory, data.fileName) : data.fileName,
          filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
          properties: ["createDirectory"]
        });
        valid(frame, generation, request);
        if (answer.canceled) return { outcome: "cancelled" };
        if (typeof answer.filePath !== "string" || !(0, import_node_path2.isAbsolute)(answer.filePath) || /[\u0000-\u001f\u007f]/u.test(answer.filePath)) throw new Error("invalid save target");
        await write(answer.filePath, bytes, () => valid(frame, generation, request));
        return { outcome: "saved" };
      } finally {
        if (current === request) current = null;
        if (locks.get(contents) === request) locks.delete(contents);
        settled();
      }
    }
  };
}

// src/host/page-capture-main.ts
var import_node_module = require("node:module");
var import_node_net = require("node:net");
var import_node_fs = require("node:fs");
var import_node_path3 = require("node:path");
var import_node_os = require("node:os");
var OWNED = Symbol.for("@daftai/pdsh.main-capture.v1");
var LOCKS = Symbol.for("@daftai/pdsh.native-capture-locks.v1");
function nativeLocks() {
  const registry = globalThis[LOCKS] ?? { map: /* @__PURE__ */ new WeakMap(), users: 0, flights: 0 };
  globalThis[LOCKS] = registry;
  ++registry.users;
  const release = () => {
    if (!registry.users && !registry.flights && globalThis[LOCKS] === registry) delete globalThis[LOCKS];
  };
  return { registry, release };
}
function createNativePageCapture(win, onDispose = () => {
}) {
  const contents = win.webContents, { registry, release } = nativeLocks();
  let settlement = Promise.resolve();
  let epoch = 0, disposed = false, flight = null;
  const change = () => {
    ++epoch;
    if (flight) flight.cancelled = true;
  };
  const close = () => {
    dispose();
    onDispose();
  };
  const events = ["did-start-navigation", "render-process-gone", "destroyed"];
  for (const event of events) contents.on(event, change);
  win.on("resize", change);
  win.on("closed", close);
  function dispose() {
    if (disposed) return;
    disposed = true;
    change();
    for (const event of events) contents.removeListener(event, change);
    win.removeListener("resize", change);
    win.removeListener("closed", close);
    --registry.users;
    release();
  }
  function probe(frame, id) {
    return frame.executeJavaScript(`globalThis[Symbol.for(${JSON.stringify(CAPTURE_RECEIVER)})]?.probe(${JSON.stringify(id)}) ?? null`, false);
  }
  function supported() {
    if (win.isDestroyed() || contents.isDestroyed() || !win.isVisible()) return false;
    return !(win.contentView?.children ?? []).some((view) => view.webContents && view.webContents !== contents && view.getVisible());
  }
  return {
    cancel(id) {
      if (flight?.id === id) flight.cancelled = true;
    },
    dispose,
    settled: () => settlement,
    async capture(id, owner = id) {
      if (disposed || flight || registry.map.has(contents) || !isCaptureId(id) || !supported()) throw new Error("capture unavailable");
      const current = { id, cancelled: false };
      flight = current;
      registry.map.set(contents, current);
      ++registry.flights;
      let settled;
      settlement = new Promise((resolve2) => {
        settled = resolve2;
      });
      try {
        let valid = function() {
          if (disposed || current.cancelled || epoch !== generation || !supported() || frame.isDestroyed() || contents.mainFrame !== frame || contents.getURL() !== url || win.getContentSize().some((value, index) => value !== size[index])) throw new Error("page changed");
        };
        const frame = contents.mainFrame, generation = epoch, size = win.getContentSize(), url = contents.getURL();
        const scope = new URL(url);
        if (scope.protocol !== "dsh-app:" || scope.hostname !== "app" || !["/", "/index.html"].includes(scope.pathname)) throw new Error("unsupported page scope");
        const before = await probe(frame, id);
        valid();
        if (!before || before.unsupportedEmbed === true || before.nonce !== owner || !isCaptureId(before.nonce) || ![before.width, before.height, before.dpr].every((value) => Number.isFinite(value) && value > 0) || before.width * before.height * before.dpr ** 2 > MAX_PAGE_PIXELS) throw new Error("invalid page request");
        const image = await contents.capturePage();
        valid();
        const scales = image.getScaleFactors();
        if (!scales.length || scales.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error("invalid native scale");
        const scaleFactor = Math.max(...scales), pixels = image.getSize(scaleFactor);
        if (!pixels.width || !pixels.height || pixels.width * pixels.height > MAX_PAGE_PIXELS) throw new Error("pixel budget");
        const matches = (physical, css) => physical >= Math.floor(css * before.dpr) && physical <= Math.ceil((css + 1) * before.dpr);
        if (!matches(pixels.width, before.width) || !matches(pixels.height, before.height)) throw new Error("DPR mismatch");
        const png = image.toPNG({ scaleFactor });
        if (!Buffer.isBuffer(png) || png.length < 33 || png.length > MAX_PNG_BYTES) throw new Error("byte budget");
        if (!png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || png.toString("ascii", 12, 16) !== "IHDR" || png.readUInt32BE(16) !== pixels.width || png.readUInt32BE(20) !== pixels.height) throw new Error("native PNG mismatch");
        const after = await probe(frame, id);
        valid();
        if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error("document changed");
        const delivered = await frame.executeJavaScript(`globalThis[Symbol.for(${JSON.stringify(CAPTURE_RECEIVER)})]?.receive(${JSON.stringify(id)},${JSON.stringify(before.nonce)},${JSON.stringify(png.toString("base64"))}) === true`, false);
        valid();
        if (!delivered) throw new Error("delivery rejected");
        return { protocolVersion: 1 };
      } finally {
        if (flight === current) flight = null;
        if (registry.map.get(contents) === current) registry.map.delete(contents);
        --registry.flights;
        settled();
        release();
      }
    }
  };
}
async function startMainBridge({ expectedPid, socketPath, secret }, electron = (0, import_node_module.createRequire)(process.execPath)("electron")) {
  if (process.pid !== expectedPid || process.type !== "browser" || electron.app.getVersion() !== "0.2.0-rc.2") throw new Error("unsupported Main");
  if (globalThis[OWNED] || typeof secret !== "string" || !/^[0-9a-f]{64}$/.test(secret) || typeof socketPath !== "string" || !(0, import_node_path3.isAbsolute)(socketPath) || (0, import_node_path3.resolve)(socketPath) !== socketPath || (0, import_node_path3.basename)(socketPath) !== "bridge.sock" || !/^pdsh-main-[A-Za-z0-9]+$/.test((0, import_node_path3.basename)((0, import_node_path3.dirname)(socketPath)))) throw new Error("bridge ownership rejected");
  try {
    const directory = (0, import_node_path3.dirname)(socketPath), parent = (0, import_node_fs.lstatSync)(directory);
    if ((0, import_node_fs.realpathSync)((0, import_node_path3.dirname)(directory)) !== (0, import_node_fs.realpathSync)((0, import_node_os.tmpdir)()) || !parent.isDirectory() || parent.uid !== process.getuid() || (parent.mode & 511) !== 448) throw new Error();
  } catch {
    throw new Error("private directory rejected");
  }
  const windows = electron.BrowserWindow.getAllWindows().filter((win) => {
    if (win.isDestroyed() || !win.isVisible()) return false;
    try {
      const url = new URL(win.webContents.getURL());
      return url.protocol === "dsh-app:" && url.hostname === "app" && url.pathname === "/";
    } catch {
      return false;
    }
  });
  if (windows.length !== 1) throw new Error("ambiguous page owner");
  let disposed = false, connection = null, authenticated = false;
  const sockets = /* @__PURE__ */ new Set();
  const server = (0, import_node_net.createServer)((socket) => {
    if (disposed || authenticated) {
      socket.destroy();
      return;
    }
    sockets.add(socket);
    let buffer = "", accepted = false;
    const handshake = setTimeout(() => socket.destroy(), 2e3);
    handshake.unref();
    socket.on("data", (chunk) => {
      try {
        buffer += chunk.toString();
        if (Buffer.byteLength(buffer) > MAX_CONTROL_BYTES) {
          socket.destroy();
          return;
        }
        while (buffer.includes("\n")) {
          const index = buffer.indexOf("\n"), line = buffer.slice(0, index);
          buffer = buffer.slice(index + 1);
          let message;
          try {
            message = parseControlRecord(line);
          } catch {
            socket.destroy();
            return;
          }
          if (typeof message.op !== "string") {
            socket.destroy();
            return;
          }
          if (!accepted) {
            if (message.secret !== secret || message.op !== "hello" || authenticated) {
              socket.destroy();
              return;
            }
            accepted = authenticated = true;
            connection = socket;
            clearTimeout(handshake);
            clearTimeout(startup);
            socket.write(`${JSON.stringify({ op: "ready", protocolVersion: 1 })}
`);
            continue;
          }
          if (message.op === "dispose") {
            socket.end();
            dispose();
            return;
          }
          if (!isCaptureId(message.requestId)) {
            socket.destroy();
            return;
          }
          if (message.op === "cancel") {
            capture.cancel(message.requestId);
            save.cancel(message.requestId);
            continue;
          }
          if (!["capture", "save"].includes(message.op)) {
            socket.destroy();
            return;
          }
          if (!isCaptureId(message.owner)) {
            socket.destroy();
            return;
          }
          void (message.op === "save" ? save.save(message.requestId, message.owner) : capture.capture(message.requestId, message.owner)).then(
            (result) => answer(message.requestId, true, result.outcome),
            () => answer(message.requestId, false)
          );
        }
      } catch {
        socket.destroy();
      }
    });
    socket.on("error", () => {
    });
    socket.on("close", () => {
      clearTimeout(handshake);
      sockets.delete(socket);
      if (connection === socket) dispose();
    });
  });
  const capture = createNativePageCapture(windows[0], dispose);
  const save = createNativePageSave(windows[0], electron.dialog, electron.nativeImage);
  const startup = setTimeout(dispose, BRIDGE_TIMEOUT_MS);
  startup.unref();
  function answer(requestId, ok, outcome) {
    if (!disposed && connection && !connection.destroyed) connection.write(`${JSON.stringify({ requestId, ok, protocolVersion: 1, ...outcome ? { outcome } : {} })}
`);
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    clearTimeout(startup);
    capture.dispose();
    save.dispose();
    for (const socket of sockets) socket.destroy();
    server.close();
    void Promise.all([capture.settled(), save.settled()]).finally(() => {
      if (globalThis[OWNED] === dispose) delete globalThis[OWNED];
      if (typeof __filename === "string") {
        const loader = (0, import_node_module.createRequire)(process.execPath), entry = loader.cache[__filename];
        if (entry?.exports.startMainBridge === startMainBridge) delete loader.cache[__filename];
      }
    });
  }
  globalThis[OWNED] = dispose;
  try {
    await new Promise((resolve2, reject) => {
      server.once("error", reject);
      server.listen(socketPath, resolve2);
    });
    (0, import_node_fs.chmodSync)(socketPath, 384);
    return { protocolVersion: 1, pid: process.pid };
  } catch {
    dispose();
    throw new Error("bridge startup failed");
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createNativePageCapture,
  startMainBridge
});
