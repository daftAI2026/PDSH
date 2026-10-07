/**
 * [INPUT]: src/host/capture-runtime.ts、官方能力面与原生后端，由 build.ts 生成。
 * [OUTPUT]: 稳定基础与当前子能力，同一 Config/Client。
 * [POS]: 单包运行产物；PDSH build "0.5.3"，不手工修改。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __knownSymbol = (name, symbol) => (symbol = Symbol[name]) ? symbol : Symbol.for("Symbol." + name);
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __decoratorStart = (base) => [, , , __create(base?.[__knownSymbol("metadata")] ?? null)];
var __decoratorStrings = ["class", "method", "getter", "setter", "accessor", "field", "value", "get", "set"];
var __expectFn = (fn) => fn !== void 0 && typeof fn !== "function" ? __typeError("Function expected") : fn;
var __decoratorContext = (kind, name, done, metadata, fns) => ({ kind: __decoratorStrings[kind], name, metadata, addInitializer: (fn) => done._ ? __typeError("Already initialized") : fns.push(__expectFn(fn || null)) });
var __decoratorMetadata = (array, target) => __defNormalProp(target, __knownSymbol("metadata"), array[3]);
var __runInitializers = (array, flags, self, value) => {
  for (var i = 0, fns = array[flags >> 1], n = fns && fns.length; i < n; i++) flags & 1 ? fns[i].call(self) : value = fns[i].call(self, value);
  return value;
};
var __decorateElement = (array, flags, name, decorators, target, extra) => {
  var fn, it, done, ctx, access, k = flags & 7, s = !!(flags & 8), p = !!(flags & 16);
  var j = k > 3 ? array.length + 1 : k ? s ? 1 : 2 : 0, key = __decoratorStrings[k + 5];
  var initializers = k > 3 && (array[j - 1] = []), extraInitializers = array[j] || (array[j] = []);
  var desc = k && (!p && !s && (target = target.prototype), k < 5 && (k > 3 || !p) && __getOwnPropDesc(k < 4 ? target : { get [name]() {
    return __privateGet(this, extra);
  }, set [name](x) {
    return __privateSet(this, extra, x);
  } }, name));
  k ? p && k < 4 && __name(extra, (k > 2 ? "set " : k > 1 ? "get " : "") + name) : __name(target, name);
  for (var i = decorators.length - 1; i >= 0; i--) {
    ctx = __decoratorContext(k, name, done = {}, array[3], extraInitializers);
    if (k) {
      ctx.static = s, ctx.private = p, access = ctx.access = { has: p ? (x) => __privateIn(target, x) : (x) => name in x };
      if (k ^ 3) access.get = p ? (x) => (k ^ 1 ? __privateGet : __privateMethod)(x, target, k ^ 4 ? extra : desc.get) : (x) => x[name];
      if (k > 2) access.set = p ? (x, y) => __privateSet(x, target, y, k ^ 4 ? extra : desc.set) : (x, y) => x[name] = y;
    }
    it = (0, decorators[i])(k ? k < 4 ? p ? extra : desc[key] : k > 4 ? void 0 : { get: desc.get, set: desc.set } : target, ctx), done._ = 1;
    if (k ^ 4 || it === void 0) __expectFn(it) && (k > 4 ? initializers.unshift(it) : k ? p ? extra = it : desc[key] = it : target = it);
    else if (typeof it !== "object" || it === null) __typeError("Object expected");
    else __expectFn(fn = it.get) && (desc.get = fn), __expectFn(fn = it.set) && (desc.set = fn), __expectFn(fn = it.init) && initializers.unshift(fn);
  }
  return k || __decoratorMetadata(array, target), desc && __defProp(target, name, desc), p ? k ^ 4 ? extra : desc : target;
};
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateIn = (member, obj) => Object(obj) !== obj ? __typeError('Cannot use the "in" operator on this value') : member.has(obj);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

// src/shared/components.ts
var BUNDLE_NAME = true ? "@daftai/pdsh" : "@daftai/pdsh";
var IS_RC_BUNDLE = BUNDLE_NAME === "@daftai/pdsh-rc";
var ROOT_ENTRY_ID = IS_RC_BUNDLE ? "pdsh-rc" : "pdsh";

// src/shared/capture-runtime-contract.ts
var CAPTURE_RUNTIME_CONTRACT = "pdsh-capture-runtime-v1";
var CAPTURE_WALLPAPER_CONTRACT = "pdsh-wallpaper-runtime-v1";

// src/host/capture-runtime.ts
import { Context } from "@deepseek-ai/cordis";

// src/host/native-window-capture.ts
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { crc32 } from "node:zlib";

// src/shared/window-capture-protocol.ts
var CAPTURE_LIMITS = {
  maxBytes: 128 * 1024 * 1024,
  pngChunkBytes: 32 * 1024,
  maxChunks: 4096,
  maxPixels: 16 * 1024 * 1024
};
var CAPTURE_FAILURE_CODES = [
  "permission-not-granted",
  "cancelled",
  "busy",
  "disposed",
  "capture-timeout",
  "helper-start-timeout",
  "helper-start-failed",
  "requires-macos-14",
  "api-unavailable",
  "process-changed",
  "window-changed",
  "no-ordinary-window-for-main-pid",
  "ambiguous-multiple-windows-refuse",
  "native-size-invalid-or-over-budget",
  "byte-budget-exceeded",
  "encoded-byte-budget-exceeded",
  "invalid-png",
  "metadata-mismatch",
  "helper-failed"
];

// src/host/native-window-capture.ts
var MAX_BYTES = CAPTURE_LIMITS.maxBytes;
var MAX_PIXELS = CAPTURE_LIMITS.maxPixels;
var START_TIMEOUT = 5e3;
var CAPTURE_TIMEOUT = 3e4;
var FORCE_TIMEOUT = 2e3;
var MAX_DIAGNOSTIC_LINE = 1024;
var MAX_PNG_CHUNKS = 65536;
var CaptureFailure = class extends Error {
  code;
  constructor(code) {
    super(code);
    this.code = code;
    this.name = "CaptureFailure";
  }
};
var FIXED_FAILURES = /* @__PURE__ */ new Set([
  "permission-not-granted",
  "requires-macos-14",
  "api-unavailable",
  "invalid-arguments",
  "invalid-pid",
  "caller-is-not-own-host-parent",
  "host-parent-mismatch",
  "main-process-unavailable",
  "own-main-is-not-dsh",
  "process-changed",
  "shareable-content-timeout",
  "shareable-content-unavailable",
  "no-ordinary-window-for-main-pid",
  "ambiguous-multiple-windows-refuse",
  "window-changed",
  "native-pixel-scale-unavailable",
  "native-size-invalid-or-over-budget",
  "capture-timeout",
  "capture-failed",
  "pixel-budget-exceeded",
  "byte-budget-exceeded",
  "encoded-byte-budget-exceeded",
  "png-destination-failed",
  "png-encode-failed",
  "output-pipe-failed",
  "invalid-png",
  "metadata-mismatch",
  "helper-start-failed",
  "helper-start-timeout",
  "helper-protocol-invalid",
  "helper-failed",
  "gesture-required",
  "cancelled",
  "disposed",
  "busy"
]);
var defaultScheduler = {
  set: (callback, delay) => ({ timer: setTimeout(callback, delay) }),
  clear: (handle) => clearTimeout(handle.timer)
};
var defaultSpawner = (command, args, options) => spawn(command, args, options);
function nativeCaptureTarget(platform, arch) {
  if (platform === "darwin") return { relativePath: "./native/window-capture", windowsHide: false };
  if (platform === "win32" && arch === "x64") {
    return { relativePath: "./native/windows/window-capture-x64.exe", windowsHide: true };
  }
  return void 0;
}
function resolveNativeCaptureHelperPath(platform, arch, bundleUrl = import.meta.url) {
  const target = nativeCaptureTarget(platform, arch);
  return target ? fileURLToPath(new URL(target.relativePath, bundleUrl)) : void 0;
}
function readPngSize(png) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!Buffer.isBuffer(png) || png.length < 33 || !png.subarray(0, 8).equals(signature) || png.readUInt32BE(8) !== 13 || !png.subarray(12, 16).equals(Buffer.from("IHDR"))) {
    throw new CaptureFailure("invalid-png");
  }
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  if (!width || !height || width > MAX_PIXELS / height) throw new CaptureFailure("pixel-budget-exceeded");
  return { width, height };
}
function validatePngEnvelope(png) {
  const size = readPngSize(png);
  const fail3 = () => {
    throw new CaptureFailure("invalid-png");
  };
  const depths = {
    0: [1, 2, 4, 8, 16],
    2: [8, 16],
    3: [1, 2, 4, 8],
    4: [8, 16],
    6: [8, 16]
  };
  if (!depths[png[25]]?.includes(png[24]) || png[26] !== 0 || png[27] !== 0 || ![0, 1].includes(png[28])) fail3();
  let offset = 8;
  let count = 0;
  let palette = false;
  let seenData = false;
  let dataEnded = false;
  let dataBytes = 0;
  while (offset < png.length) {
    if (++count > MAX_PNG_CHUNKS || png.length - offset < 12) fail3();
    const length = png.readUInt32BE(offset);
    const end = offset + length + 12;
    if (end > png.length) fail3();
    const typeBytes = png.subarray(offset + 4, offset + 8);
    if (!typeBytes.every((byte) => byte >= 65 && byte <= 90 || byte >= 97 && byte <= 122) || (typeBytes[2] & 32) !== 0 || crc32(png.subarray(offset + 4, end - 4)) !== png.readUInt32BE(end - 4)) fail3();
    const type = typeBytes.toString("ascii");
    if (count === 1) {
      if (type !== "IHDR" || length !== 13) fail3();
    } else if (type === "IHDR") fail3();
    else if (type === "PLTE") {
      if (palette || seenData || length < 3 || length > 768 || length % 3) fail3();
      palette = true;
    } else if (type === "IDAT") {
      if (dataEnded) fail3();
      seenData = true;
      dataBytes += length;
    } else if (type === "IEND") {
      if (length || !seenData || !dataBytes || end !== png.length || png[25] === 3 && !palette) fail3();
      return size;
    } else {
      if (seenData) dataEnded = true;
      if (/^[A-Z]/.test(type) || ["acTL", "fcTL", "fdAT"].includes(type)) fail3();
    }
    offset = end;
  }
  return fail3();
}
function runNativeCapture(options = {}) {
  const { signal, requestPermission, onPhase } = options;
  if (signal?.aborted) return Promise.reject(new CaptureFailure("cancelled"));
  if (requestPermission !== true) return Promise.reject(new CaptureFailure("gesture-required"));
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const target = nativeCaptureTarget(platform, arch);
  if (!target) return Promise.reject(new CaptureFailure("api-unavailable"));
  const helperPath = options.helperPath ?? resolveNativeCaptureHelperPath(platform, arch);
  if (!helperPath) return Promise.reject(new CaptureFailure("api-unavailable"));
  const spawnProcess = options.spawnProcess ?? defaultSpawner;
  const scheduler = options.scheduler ?? defaultScheduler;
  return new Promise((resolve2, reject) => {
    let child;
    try {
      child = spawnProcess(helperPath, [
        "--capture",
        String(process.pid),
        String(process.ppid),
        "--request-permission"
      ], { stdio: ["ignore", "pipe", "pipe"], shell: false, ...target.windowsHide ? { windowsHide: true } : {} });
    } catch {
      reject(new CaptureFailure("helper-start-failed"));
      return;
    }
    let chunks = [];
    let bytes = 0;
    let diagnosticLine = "";
    let droppingLine = false;
    let phase;
    let metadata;
    let failure;
    let settled = false;
    let timer;
    let forceTimer;
    const clearBudget = () => {
      if (timer !== void 0) scheduler.clear(timer);
      timer = void 0;
    };
    const killOwned = (kind) => {
      try {
        child.kill(kind);
      } catch {
      }
    };
    const fail3 = (code) => {
      if (failure || settled) return;
      failure = new CaptureFailure(code);
      chunks = [];
      clearBudget();
      killOwned("SIGTERM");
      forceTimer = scheduler.set(() => {
        if (!settled) killOwned("SIGKILL");
      }, FORCE_TIMEOUT);
    };
    const startBudget = (delay, code) => {
      clearBudget();
      timer = scheduler.set(() => fail3(code), delay);
    };
    const abort = () => fail3("cancelled");
    const receivePhase = (value) => {
      if (value === "authorization-required" && phase === void 0) {
        phase = value;
        clearBudget();
      } else if (value === "capture-ready" && phase !== "capture-ready") {
        phase = value;
        startBudget(CAPTURE_TIMEOUT, "capture-timeout");
      } else {
        fail3("helper-protocol-invalid");
        return;
      }
      try {
        onPhase?.(value);
      } catch {
        fail3("helper-protocol-invalid");
      }
    };
    const receiveLine = (line) => {
      if (failure) return;
      if (line === "phase=authorization-required" || line === "phase=capture-ready") {
        receivePhase(line.slice(6));
        return;
      }
      let value;
      try {
        value = JSON.parse(line);
      } catch {
        return;
      }
      if (!isRecord(value)) return;
      if (value.status === "captured") {
        if (metadata || phase !== "capture-ready") {
          fail3("helper-protocol-invalid");
          return;
        }
        metadata = {
          status: "captured",
          width: value.width,
          height: value.height,
          pointPixelScale: value.pointPixelScale,
          pngBytes: value.pngBytes
        };
      } else if (isNativeCaptureFailureCode(value.status)) {
        metadata = { status: value.status };
      }
    };
    const stdout = (chunk) => {
      if (failure || settled) return;
      bytes += chunk.length;
      if (bytes > MAX_BYTES) {
        fail3("byte-budget-exceeded");
        return;
      }
      chunks.push(chunk);
    };
    const stderr = (chunk) => {
      if (failure || settled) return;
      for (const char of chunk.toString()) {
        if (char === "\n") {
          if (!droppingLine) receiveLine(diagnosticLine.trim());
          diagnosticLine = "";
          droppingLine = false;
        } else if (!droppingLine) {
          if (diagnosticLine.length >= MAX_DIAGNOSTIC_LINE) {
            diagnosticLine = "";
            droppingLine = true;
          } else {
            diagnosticLine += char;
          }
        }
      }
    };
    const error = () => fail3("helper-start-failed");
    const close = (code) => {
      if (settled) return;
      if (diagnosticLine && !droppingLine) receiveLine(diagnosticLine.trim());
      settled = true;
      clearBudget();
      if (forceTimer !== void 0) scheduler.clear(forceTimer);
      signal?.removeEventListener("abort", abort);
      child.stdout.off("data", stdout);
      child.stderr.off("data", stderr);
      child.off("error", error);
      child.off("close", close);
      diagnosticLine = "";
      try {
        if (failure) throw failure;
        if (code !== 0) {
          const helperFailure = metadata?.status !== "captured" ? metadata?.status : void 0;
          throw new CaptureFailure(helperFailure ?? "helper-failed");
        }
        if (phase !== "capture-ready") throw new CaptureFailure("helper-protocol-invalid");
        const png = Buffer.concat(chunks, bytes);
        const size = validatePngEnvelope(png);
        if (metadata?.status !== "captured" || metadata.width !== size.width || metadata.height !== size.height || metadata.pngBytes !== bytes || typeof metadata.pointPixelScale !== "number" || !Number.isFinite(metadata.pointPixelScale) || metadata.pointPixelScale <= 0) {
          throw new CaptureFailure("metadata-mismatch");
        }
        resolve2({
          png,
          ...size,
          scope: "owned-window",
          pointPixelScale: metadata.pointPixelScale
        });
      } catch (problem) {
        reject(problem);
      } finally {
        chunks = [];
      }
    };
    child.stdout.on("data", stdout);
    child.stderr.on("data", stderr);
    child.on("error", error);
    child.on("close", close);
    startBudget(START_TIMEOUT, "helper-start-timeout");
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}
function createClickCapture({ runner = runNativeCapture } = {}) {
  let disposed = false;
  let flight;
  return {
    async capture(signal) {
      if (disposed) throw new CaptureFailure("disposed");
      if (signal?.aborted) throw new CaptureFailure("cancelled");
      if (flight) throw new CaptureFailure("busy");
      const aborter = new AbortController();
      let finish;
      const done = new Promise((resolve2) => {
        finish = resolve2;
      });
      const current = { aborter, done };
      flight = current;
      const abort = () => aborter.abort();
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      try {
        await Promise.resolve();
        if (aborter.signal.aborted) throw new CaptureFailure("cancelled");
        const image = await runner({ signal: aborter.signal, requestPermission: true });
        if (aborter.signal.aborted || disposed) throw new CaptureFailure("cancelled");
        return image;
      } catch (problem) {
        if (aborter.signal.aborted) throw new CaptureFailure("cancelled");
        const code = errorCode(problem);
        throw new CaptureFailure(code && FIXED_FAILURES.has(code) ? code : "helper-failed");
      } finally {
        signal?.removeEventListener("abort", abort);
        if (flight === current) flight = void 0;
        finish();
      }
    },
    dispose() {
      disposed = true;
      flight?.aborter.abort();
      return flight?.done ?? Promise.resolve();
    }
  };
}
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function isNativeCaptureFailureCode(value) {
  return typeof value === "string" && FIXED_FAILURES.has(value);
}
function errorCode(value) {
  if (!isRecord(value)) return void 0;
  return isNativeCaptureFailureCode(value.code) ? value.code : void 0;
}

// src/host/window-save-backend.ts
import { createHash as createHash2 } from "node:crypto";
import { isAbsolute, join as join2, normalize } from "node:path";

// src/shared/capture-export.ts
var CAPTURE_SAVE_FORMATS = ["png", "jpeg", "webp"];
var CAPTURE_SAVE_BEHAVIORS = ["ask", "direct"];
var CAPTURE_SAVE_DIRECTORY_PATTERN = /^(?=.{0,4096}$)(?:|\/(?!\/)[^\u0000-\u001f\u007f-\u009f]*|[A-Za-z]:\\(?:[^\\/:*?"<>|\u0000-\u001f\u007f-\u009f]+(?:\\[^\\/:*?"<>|\u0000-\u001f\u007f-\u009f]+)*\\?)?|\\\\(?!\.{1,2}\\)[^\\/:*?"<>|\u0000-\u001f\u007f-\u009f]+\\[^\\/:*?"<>|\u0000-\u001f\u007f-\u009f]+(?:\\[^\\/:*?"<>|\u0000-\u001f\u007f-\u009f]+)*\\?)$/u;
function isCaptureSaveDirectory(value) {
  return typeof value === "string" && CAPTURE_SAVE_DIRECTORY_PATTERN.test(value);
}
var CAPTURE_FILE_NAME_MAX_BYTES = 220;
var CAPTURE_EXPORT_MAX_PIXELS = 32e6;
var CAPTURE_EXPORT_MAX_BYTES = 128e6;
function isCaptureExportSizeAllowed(width, height) {
  return Number.isSafeInteger(width) && Number.isSafeInteger(height) && width > 0 && height > 0 && width * height <= CAPTURE_EXPORT_MAX_PIXELS;
}
function assertCaptureExportSize(width, height) {
  if (!isCaptureExportSizeAllowed(width, height)) throw Object.assign(new Error("Capture export budget exceeded"), { code: "export-oversize" });
}
var CAPTURE_FILE_NAME_PATTERN = /^(?=.{1,160}$)(?![\s.]+$)(?:[^{}\\/:*?"<>|\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u206f]|\{(?:date|time|title|width|height)\})+$/u;
var DEFAULT_CAPTURE_EXPORT = { saveBehavior: "ask", saveFormat: "png", fileNamePattern: "PDSH-screenshot-{date}-{time}", saveDirectory: "" };
function resolveCaptureExportPreferences(value) {
  return {
    saveBehavior: CAPTURE_SAVE_BEHAVIORS.includes(value?.saveBehavior) ? value.saveBehavior : DEFAULT_CAPTURE_EXPORT.saveBehavior,
    saveFormat: CAPTURE_SAVE_FORMATS.includes(value?.saveFormat) ? value.saveFormat : DEFAULT_CAPTURE_EXPORT.saveFormat,
    saveDirectory: isCaptureSaveDirectory(value?.saveDirectory) ? value.saveDirectory : "",
    fileNamePattern: typeof value?.fileNamePattern === "string" && CAPTURE_FILE_NAME_PATTERN.test(value.fileNamePattern) ? value.fileNamePattern : DEFAULT_CAPTURE_EXPORT.fileNamePattern
  };
}
function captureExportFileName(value, date = /* @__PURE__ */ new Date(), context = {}) {
  if (!Number.isFinite(date.getTime())) date = /* @__PURE__ */ new Date(0);
  const preferences = resolveCaptureExportPreferences(value), pad = (n) => String(n).padStart(2, "0");
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  const clean = (value2) => String(value2 ?? "").normalize("NFC").replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u206f<>:"/\\|?*]+/gu, "-").trim().replace(/[. ]+$/gu, "");
  const dimension = (value2) => String(Math.max(0, Number.isFinite(value2) ? Math.round(value2) : 0));
  const tokens = { date: day, time, title: clean(context.title) || "PDSH", width: dimension(context.width), height: dimension(context.height) };
  let base = clean(preferences.fileNamePattern.replace(/\{(date|time|title|width|height)\}/gu, (_match, token) => tokens[token])).replace(/\.(?:png|jpe?g|webp|gif|avif|bmp|tiff?|pdf)$/iu, "").replace(/[. ]+$/gu, "");
  if (!base || /^\.+$/u.test(base)) base = "PDSH";
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(base)) base = `PDSH-${base}`;
  let bytes = 0, limited = "";
  for (const { segment } of new Intl.Segmenter(void 0, { granularity: "grapheme" }).segment(base)) {
    const size = new TextEncoder().encode(segment).byteLength;
    if (bytes + size > CAPTURE_FILE_NAME_MAX_BYTES) break;
    limited += segment;
    bytes += size;
  }
  return `${limited.replace(/[. ]+$/gu, "") || "PDSH"}.${preferences.saveFormat === "jpeg" ? "jpg" : preferences.saveFormat}`;
}

// src/shared/capture-bridge.ts
var MAX_PAGE_PIXELS = 16e6;
var MAX_PNG_BYTES = MAX_PAGE_PIXELS * 8;
function isCaptureId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// src/host/page-save-file.ts
import { open, rename, link, unlink } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { randomBytes } from "node:crypto";
var MAX_NAME_ATTEMPTS = 1e3;
async function commitImage(target, bytes, commit) {
  const temporary = join(dirname(target), `.pdsh-save-${randomBytes(16).toString("hex")}.tmp`);
  let file, owned = false;
  try {
    file = await open(temporary, "wx", 384);
    owned = true;
    await file.writeFile(bytes);
    await file.sync();
    await file.close();
    file = null;
    await commit(temporary);
  } finally {
    if (file) await file.close().catch(() => {
    });
    if (owned) await unlink(temporary).catch(() => {
    });
  }
}
function writeUniqueImage(target, bytes, beforeCommit = () => {
}) {
  const extension = extname(target), stem = basename(target, extension);
  return commitImage(target, bytes, async (temporary) => {
    for (let attempt = 0; attempt < MAX_NAME_ATTEMPTS; ++attempt) {
      const candidate = attempt ? join(dirname(target), `${stem} (${attempt})${extension}`) : target;
      beforeCommit();
      try {
        await link(temporary, candidate);
        return;
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
      }
    }
    throw new Error("PDSH export name budget exhausted");
  });
}

// src/host/window-save-image.ts
import { createHash } from "node:crypto";

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

// src/shared/window-save-protocol.ts
var WINDOW_SAVE_CHUNK_BYTES = 32 * 1024;
var WINDOW_SAVE_MAX_BYTES = CAPTURE_EXPORT_MAX_BYTES;
var WINDOW_SAVE_MAX_CHUNKS = Math.ceil(WINDOW_SAVE_MAX_BYTES / WINDOW_SAVE_CHUNK_BYTES);
var WINDOW_SAVE_MAX_BASE64_CHARS = Math.ceil(WINDOW_SAVE_CHUNK_BYTES / 3) * 4;

// src/host/window-save-image.ts
var PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
var MAX_IMAGE_CHUNKS = 8192;
var MAX_SAFE_COLOR_METADATA_BYTES = 4096;
var CANVAS_SRGB_PROFILE_SHA256 = "12afb4d9953adee0607d347daee5b78b18d6b3cab2d572b88970703f5edb37bc";
function validateWindowSaveImage(bytes, format, width, height) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 12 || bytes.length > WINDOW_SAVE_MAX_BYTES) throw invalidImage();
  assertCaptureExportSize(width, height);
  const dimensions = format === "png" ? readPngDimensions(bytes) : format === "jpeg" ? readJpegDimensions(bytes) : format === "webp" ? readStaticWebpDimensions(bytes) : invalidImage();
  if (dimensions.width !== width || dimensions.height !== height) throw invalidImage();
}
function readPngDimensions(bytes) {
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw invalidImage();
  let offset = 8, chunks = 0, seenHeader = false, seenImageData = false, imageDataClosed = false, seenEnd = false;
  let colorMetadataBytes = 0, width = 0, height = 0, palette = false, srgb = false, gamma = false, chromaticity = false, transparency = false;
  while (offset < bytes.length) {
    if (++chunks > MAX_IMAGE_CHUNKS || offset + 12 > bytes.length) throw invalidImage();
    const length = bytes.readUInt32BE(offset), kind = bytes.toString("ascii", offset + 4, offset + 8), start = offset + 8, end = start + length;
    if (end + 4 > bytes.length || !/^[A-Za-z]{4}$/.test(kind) || seenEnd) throw invalidImage();
    if (!seenHeader) {
      if (kind !== "IHDR" || length !== 13) throw invalidImage();
      seenHeader = true;
      width = bytes.readUInt32BE(start);
      height = bytes.readUInt32BE(start + 4);
      const depth = bytes[start + 8], color = bytes[start + 9];
      const legalDepth = color === 0 ? [1, 2, 4, 8, 16].includes(depth) : color === 2 ? [8, 16].includes(depth) : color === 3 ? [1, 2, 4, 8].includes(depth) : color === 4 || color === 6 ? [8, 16].includes(depth) : false;
      if (!legalDepth || bytes[start + 10] !== 0 || bytes[start + 11] !== 0 || ![0, 1].includes(bytes[start + 12])) throw invalidImage();
      assertCaptureExportSize(width, height);
    } else if (kind === "IHDR") throw invalidImage();
    if (["tEXt", "zTXt", "iTXt", "eXIf", "iCCP", "acTL", "fcTL", "fdAT", "hIST", "sPLT"].includes(kind)) throw invalidImage();
    if (["PLTE", "tRNS", "sRGB", "gAMA", "cHRM"].includes(kind)) {
      if (seenImageData) throw invalidImage();
      colorMetadataBytes += length;
      if (colorMetadataBytes > MAX_SAFE_COLOR_METADATA_BYTES) throw invalidImage();
      if (kind === "PLTE") {
        if (palette || !length || length % 3 || length > 768) throw invalidImage();
        palette = true;
      }
      if (kind === "tRNS") {
        if (transparency || !length || length > 768) throw invalidImage();
        transparency = true;
      }
      if (kind === "sRGB") {
        if (srgb || length !== 1 || bytes[start] > 3) throw invalidImage();
        srgb = true;
      }
      if (kind === "gAMA") {
        if (gamma || length !== 4 || bytes.readUInt32BE(start) === 0) throw invalidImage();
        gamma = true;
      }
      if (kind === "cHRM") {
        if (chromaticity || length !== 32) throw invalidImage();
        chromaticity = true;
      }
    } else if (kind === "IHDR" && chunks === 1) {
    } else if (kind === "IDAT") {
      if (imageDataClosed || length === 0) throw invalidImage();
      seenImageData = true;
    } else if (kind === "IEND") {
      if (length !== 0 || !seenImageData || end + 4 !== bytes.length) throw invalidImage();
      seenEnd = true;
    } else throw invalidImage();
    if (seenImageData && kind !== "IDAT" && kind !== "IEND") imageDataClosed = true;
    offset = end + 4;
  }
  if (offset !== bytes.length || !seenHeader || !seenImageData || !seenEnd) throw invalidImage();
  return { width, height };
}
function readJpegDimensions(bytes) {
  if (bytes[0] !== 255 || bytes[1] !== 216) throw invalidImage();
  let offset = 2, width = 0, height = 0, frames = 0, scans = 0, ended = false, segments = 0, jfif = false, icc = false;
  while (offset < bytes.length) {
    if (++segments > MAX_IMAGE_CHUNKS) throw invalidImage();
    if (bytes[offset] !== 255) throw invalidImage();
    while (bytes[offset] === 255) ++offset;
    if (offset >= bytes.length) throw invalidImage();
    const marker = bytes[offset++];
    if (marker === 217) {
      ended = true;
      break;
    }
    if (marker === 0 || marker === 216 || marker >= 208 && marker <= 215) throw invalidImage();
    if (offset + 2 > bytes.length) throw invalidImage();
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) throw invalidImage();
    const start = offset + 2, end = offset + length, payloadLength = length - 2;
    if (marker >= 224 && marker <= 239) {
      if (marker === 224) {
        if (segments !== 1 || jfif || payloadLength !== 14 || bytes.toString("ascii", start, start + 5) !== "JFIF\0" || bytes[start + 7] > 2 || bytes[start + 12] !== 0 || bytes[start + 13] !== 0) throw invalidImage();
        jfif = true;
      } else if (marker === 226) {
        if (!jfif || icc || segments !== 2 || frames || payloadLength < 14 + 128 || payloadLength > 14 + MAX_SAFE_COLOR_METADATA_BYTES || bytes.toString("ascii", start, start + 12) !== "ICC_PROFILE\0" || bytes[start + 12] !== 1 || bytes[start + 13] !== 1 || !isCanvasSrgbProfile(bytes.subarray(start + 14, end))) throw invalidImage();
        icc = true;
      } else throw invalidImage();
    }
    if (marker === 254) throw invalidImage();
    if (isJpegFrameMarker(marker)) {
      if (++frames !== 1 || payloadLength < 6) throw invalidImage();
      const precision = bytes[start], frameHeight = bytes.readUInt16BE(start + 1), frameWidth = bytes.readUInt16BE(start + 3), components = bytes[start + 5];
      if (![8, 12].includes(precision) || components < 1 || components > 4 || payloadLength !== 6 + components * 3) throw invalidImage();
      assertCaptureExportSize(frameWidth, frameHeight);
      width = frameWidth;
      height = frameHeight;
    }
    if (marker === 218) {
      if (!frames || payloadLength < 6) throw invalidImage();
      ++scans;
      offset = end;
      let nextMarker = -1;
      for (let index = offset; index < bytes.length - 1; ++index) {
        if (bytes[index] !== 255) continue;
        let cursor = index + 1;
        while (bytes[cursor] === 255) ++cursor;
        const code = bytes[cursor];
        if (code === 0 || code !== void 0 && code >= 208 && code <= 215) {
          index = cursor;
          continue;
        }
        nextMarker = index;
        break;
      }
      if (nextMarker < 0) throw invalidImage();
      offset = nextMarker;
      continue;
    }
    offset = end;
  }
  if (!ended || offset !== bytes.length || frames !== 1 || scans < 1 || !width || !height) throw invalidImage();
  return { width, height };
}
function isJpegFrameMarker(marker) {
  return [192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker);
}
function isCanvasSrgbProfile(profile) {
  if (profile.length < 128 || profile.length > MAX_SAFE_COLOR_METADATA_BYTES || profile.readUInt32BE(0) !== profile.length || profile.toString("ascii", 16, 20) !== "RGB " || profile.toString("ascii", 20, 24) !== "XYZ " || profile.toString("ascii", 36, 40) !== "acsp") return false;
  return createHash("sha256").update(profile).digest("hex") === CANVAS_SRGB_PROFILE_SHA256;
}
function readStaticWebpDimensions(bytes) {
  const dimensions = readWebPDimensions(bytes);
  let offset = 12, chunks = 0, imageChunks = 0, seenExtended = false, alpha = false, iccFlag = false, icc = false;
  while (offset < bytes.length) {
    if (++chunks > MAX_IMAGE_CHUNKS || offset + 8 > bytes.length) throw invalidImage();
    const kind = bytes.toString("ascii", offset, offset + 4), length = bytes.readUInt32LE(offset + 4), start = offset + 8, end = start + length;
    if (end + (length & 1) > bytes.length) throw invalidImage();
    if (kind === "VP8X") {
      if (seenExtended || length !== 10 || (bytes[start] & 14) !== 0) throw invalidImage();
      seenExtended = true;
      iccFlag = (bytes[start] & 32) !== 0;
    } else if (kind === "ICCP") {
      if (!seenExtended || !iccFlag || icc || chunks !== 2 || alpha || imageChunks || length < 128 || length > MAX_SAFE_COLOR_METADATA_BYTES || !isCanvasSrgbProfile(bytes.subarray(start, end))) throw invalidImage();
      icc = true;
    } else if (kind === "ALPH") {
      if (!seenExtended || alpha || imageChunks || length === 0) throw invalidImage();
      alpha = true;
    } else if (kind === "VP8 " || kind === "VP8L") {
      if (++imageChunks !== 1 || kind === "VP8L" && alpha) throw invalidImage();
    } else if (["EXIF", "XMP ", "ANIM", "ANMF"].includes(kind)) throw invalidImage();
    else throw invalidImage();
    offset = end + (length & 1);
  }
  if (offset !== bytes.length || imageChunks !== 1 || iccFlag !== icc) throw invalidImage();
  return dimensions;
}
function invalidImage() {
  throw new Error("invalid image");
}

// src/host/window-save-backend.ts
var SAVE_LOCK = Symbol.for("@daftai/pdsh.window-save-singleflight.v1");
var INVALID_UUID = "";
var MAX_TITLE_BYTES = 2048;
var MAX_DIRECTORY_BYTES = 4096;
var BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
var SHA256_PATTERN = /^[0-9a-f]{64}$/;
var SaveFailure = class extends Error {
  code;
  constructor(code) {
    super(code);
    this.code = code;
    this.name = "SaveFailure";
  }
};
function createWindowSaveBackend(options) {
  let state = "active";
  let current;
  const writer = options.writeUniqueImage ?? writeUniqueImage;
  function save(request, session) {
    let generator;
    generator = runSave(request, session, () => generator);
    return generator;
  }
  async function* runSave(request, session, getGenerator) {
    const requestId = isCaptureId(request?.requestId) ? request.requestId : INVALID_UUID;
    const terminal = (code) => ({ type: "terminal", requestId, code });
    if (state !== "active") {
      yield terminal("disposed");
      return;
    }
    if (session?.signal?.aborted || session?.lifetimeSignal?.aborted) {
      yield terminal("cancelled");
      return;
    }
    let accepted;
    try {
      accepted = readPreferences(options.preferences);
      validateRequest(request, accepted);
    } catch (error) {
      yield terminal(failureCode(error));
      return;
    }
    const lock = saveLock();
    const owner = {};
    if (current || lock.owner) {
      yield terminal("busy");
      return;
    }
    const aborter = new AbortController();
    const abort = () => {
      if (!aborter.signal.aborted) aborter.abort();
    };
    const sources = [session.signal, session.lifetimeSignal];
    for (const source of sources) source.addEventListener("abort", abort, { once: true });
    const removeAborters = () => {
      for (const source of sources) source.removeEventListener("abort", abort);
    };
    let resolve2;
    const settled = new Promise((done2) => {
      resolve2 = done2;
    });
    const active = { requestId, aborter, settled, generator: getGenerator(), removeAborters, resolve: resolve2 };
    current = active;
    lock.owner = owner;
    let input, done = false;
    try {
      assertActive(active, options.preferences, accepted);
      input = session.uplink[Symbol.asyncIterator]();
      active.input = input;
      const chunks = [];
      const digest = createHash2("sha256");
      let byteLength = 0, chunkCount = 0;
      let final;
      while (!final) {
        const next = await nextUplink(input, active.aborter.signal);
        if (next.done) throw new SaveFailure("invalid-input");
        assertActive(active, options.preferences, accepted);
        const frame = next.value;
        if (!isRecord2(frame)) throw new SaveFailure("invalid-input");
        if (frame.type === "chunk") {
          const bytes2 = decodeChunk(frame, chunkCount);
          if (chunkCount >= WINDOW_SAVE_MAX_CHUNKS || byteLength + bytes2.length > WINDOW_SAVE_MAX_BYTES) throw new SaveFailure("invalid-input");
          if (chunkCount > 0 && chunks[chunkCount - 1].length !== WINDOW_SAVE_CHUNK_BYTES) throw new SaveFailure("invalid-input");
          chunks.push(bytes2);
          digest.update(bytes2);
          byteLength += bytes2.length;
          ++chunkCount;
          yield { type: "ack", requestId, nextIndex: chunkCount };
          continue;
        }
        if (frame.type !== "finish" || !validFinish(frame, chunkCount, byteLength)) throw new SaveFailure("invalid-input");
        final = frame;
      }
      const end = await nextUplink(input, active.aborter.signal);
      if (!end.done) throw new SaveFailure("invalid-input");
      if (chunkCount !== final.chunkCount || byteLength !== final.byteLength || digest.digest("hex") !== final.sha256) throw new SaveFailure("invalid-input");
      assertActive(active, options.preferences, accepted);
      const bytes = Buffer.concat(chunks, byteLength);
      try {
        validateWindowSaveImage(bytes, request.format, request.width, request.height);
      } catch {
        throw new SaveFailure("invalid-image");
      }
      const fileName = captureExportFileName(accepted, new Date(request.capturedAt), { title: request.title, width: request.width, height: request.height });
      const target = join2(accepted.saveDirectory, fileName);
      await writer(target, bytes, () => assertActive(active, options.preferences, accepted));
      done = true;
      yield { type: "receipt", requestId, outcome: "saved", format: request.format, byteLength, width: request.width, height: request.height };
    } catch (error) {
      yield terminal(failureCode(error, active.aborter.signal));
    } finally {
      if (input && !done) {
        try {
          await input.return?.();
        } catch {
        }
      }
      removeAborters();
      if (lock.owner === owner) delete lock.owner;
      if (current === active) current = void 0;
      resolve2();
    }
  }
  async function dispose() {
    if (state === "disposed") return;
    state = "disposing";
    const active = current;
    if (active) {
      active.aborter.abort();
      const closing = active.generator.return(void 0).then(() => void 0, () => void 0);
      await Promise.all([active.settled, closing]);
    }
    state = "disposed";
  }
  return { save, dispose };
}
function saveLock() {
  const root = globalThis;
  const existing = root[SAVE_LOCK];
  if (existing) return existing;
  const created = {};
  root[SAVE_LOCK] = created;
  return created;
}
function readPreferences(read) {
  let value;
  try {
    value = read();
  } catch {
    throw new SaveFailure("invalid-request");
  }
  if (!isRecord2(value) || value.captureEnabled !== true) throw new SaveFailure("disposed");
  const saveDirectory = typeof value.saveDirectory === "string" ? normalizeNativeSaveDirectory(value.saveDirectory) : null;
  if (!saveDirectory || value.saveDirectory.length > MAX_DIRECTORY_BYTES || Buffer.byteLength(value.saveDirectory) > MAX_DIRECTORY_BYTES || !CAPTURE_SAVE_FORMATS.includes(value.saveFormat) || typeof value.fileNamePattern !== "string" || !CAPTURE_FILE_NAME_PATTERN.test(value.fileNamePattern)) throw new SaveFailure("invalid-request");
  return {
    captureEnabled: true,
    saveDirectory,
    saveFormat: value.saveFormat,
    fileNamePattern: value.fileNamePattern
  };
}
function normalizeNativeSaveDirectory(value) {
  if (!value || !isCaptureSaveDirectory(value) || !isAbsolute(value)) return null;
  const normalized = normalize(value);
  if (normalized === value) return value;
  if (normalized === `${value}\\` && /^\\\\[^\\]+\\[^\\]+$/u.test(value)) return normalized;
  return null;
}
function validateRequest(request, accepted) {
  if (!isRecord2(request) || !isCaptureId(request.requestId) || Object.keys(request).sort().join(",") !== "capturedAt,format,height,requestId,title,width" || !CAPTURE_SAVE_FORMATS.includes(request.format) || request.format !== accepted.saveFormat || typeof request.title !== "string" || request.title.length > 1024 || Buffer.byteLength(request.title) > MAX_TITLE_BYTES || typeof request.capturedAt !== "string" || !isCanonicalDate(request.capturedAt)) throw new SaveFailure("invalid-request");
  try {
    assertCaptureSize(request.width, request.height);
  } catch {
    throw new SaveFailure("invalid-request");
  }
}
function assertCaptureSize(width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > CAPTURE_EXPORT_MAX_PIXELS / height) throw new Error("size");
}
function isCanonicalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}
function assertActive(active, read, initial) {
  if (stateIsAborted(active.aborter.signal)) throw new SaveFailure("cancelled");
  let now;
  try {
    now = readPreferences(read);
  } catch (error) {
    if (error instanceof SaveFailure && error.code === "disposed") throw error;
    throw new SaveFailure("invalid-request");
  }
  if (now.saveDirectory !== initial.saveDirectory || now.saveFormat !== initial.saveFormat || now.fileNamePattern !== initial.fileNamePattern) throw new SaveFailure("invalid-request");
}
function stateIsAborted(signal) {
  return signal.aborted;
}
function decodeChunk(frame, expectedIndex) {
  if (frame.type !== "chunk" || frame.index !== expectedIndex || !Number.isSafeInteger(frame.index) || typeof frame.base64 !== "string" || !frame.base64.length || frame.base64.length > WINDOW_SAVE_MAX_BASE64_CHARS || frame.base64.length % 4 !== 0 || !BASE64_PATTERN.test(frame.base64)) throw new SaveFailure("invalid-input");
  const bytes = Buffer.from(frame.base64, "base64");
  if (!bytes.length || bytes.length > WINDOW_SAVE_CHUNK_BYTES || bytes.toString("base64") !== frame.base64) throw new SaveFailure("invalid-input");
  return bytes;
}
function validFinish(frame, chunks, bytes) {
  return frame.type === "finish" && Number.isSafeInteger(frame.chunkCount) && frame.chunkCount === chunks && Number.isSafeInteger(frame.byteLength) && frame.byteLength === bytes && bytes > 0 && bytes <= WINDOW_SAVE_MAX_BYTES && chunks > 0 && chunks <= WINDOW_SAVE_MAX_CHUNKS && chunks === Math.ceil(bytes / WINDOW_SAVE_CHUNK_BYTES) && typeof frame.sha256 === "string" && SHA256_PATTERN.test(frame.sha256);
}
async function nextUplink(iterator, signal) {
  if (signal.aborted) throw new SaveFailure("cancelled");
  const pending = Promise.resolve().then(() => iterator.next());
  let remove = () => {
  };
  const interrupted = new Promise((_resolve, reject) => {
    const abort = () => reject(new SaveFailure("cancelled"));
    signal.addEventListener("abort", abort, { once: true });
    remove = () => signal.removeEventListener("abort", abort);
    if (signal.aborted) abort();
  });
  try {
    return await Promise.race([pending, interrupted]);
  } catch (error) {
    if (signal.aborted) {
      try {
        await iterator.return?.();
      } catch {
      }
      await pending.then(() => void 0, () => void 0);
      throw new SaveFailure("cancelled");
    }
    throw error;
  } finally {
    remove();
  }
}
function failureCode(error, signal) {
  if (signal?.aborted) return "cancelled";
  return error instanceof SaveFailure ? error.code : "save-failed";
}
function isRecord2(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// src/host/window-capture-stream.ts
function createCaptureServiceLifetime() {
  let state = "active";
  let enabled = true;
  let generation = new AbortController();
  let reserved = false;
  let operation;
  let releaseFlight;
  let disposal;
  const release = () => {
    reserved = false;
    operation = void 0;
    releaseFlight = void 0;
    if (state === "disposing") state = "disposed";
  };
  return {
    get signal() {
      return generation.signal;
    },
    reserve() {
      if (state !== "active" || !enabled) return "disposed";
      if (reserved) return "busy";
      reserved = true;
      let released = false;
      const unlock = () => {
        if (released) return;
        released = true;
        release();
      };
      releaseFlight = unlock;
      return {
        track(pending) {
          operation = pending.then(() => void 0, () => void 0);
        },
        release: unlock
      };
    },
    setEnabled(value) {
      if (state !== "active" || value === enabled) return;
      enabled = value;
      if (!enabled) generation.abort();
      else generation = new AbortController();
    },
    dispose() {
      if (disposal) return disposal;
      if (state === "disposed") return Promise.resolve();
      state = "disposing";
      generation.abort();
      disposal = (async () => {
        const current = operation;
        if (current) await current;
        releaseFlight?.();
        state = "disposed";
      })();
      return disposal;
    }
  };
}
function createCaptureFrameStream(options) {
  return { [Symbol.asyncIterator]: () => iterateCaptureFrames(options) };
}
async function* iterateCaptureFrames({ signal, lifetimeSignal, capture, reserve }) {
  const reservation = reserve();
  if (reservation === "busy" || reservation === "disposed") {
    yield { type: "terminal", status: reservation };
    return;
  }
  const aborter = new AbortController();
  let phase;
  const phaseFrames = [];
  let result;
  let failure;
  let settled = false;
  let wake;
  const notify = () => {
    wake?.();
    wake = void 0;
  };
  const abort = () => {
    if (!aborter.signal.aborted) aborter.abort();
    result = void 0;
    phaseFrames.length = 0;
    notify();
  };
  const signals = [signal, lifetimeSignal];
  for (const source of signals) source.addEventListener("abort", abort, { once: true });
  if (signals.some((source) => source.aborted)) abort();
  const capturePromise = Promise.resolve().then(() => {
    if (aborter.signal.aborted) throw new CaptureFailure2("cancelled");
    return capture({
      signal: aborter.signal,
      onPhase(next) {
        if (aborter.signal.aborted) return;
        if (!["authorization-required", "capture-ready"].includes(next) || next === "authorization-required" && phase !== void 0 || next === "capture-ready" && phase === "capture-ready") {
          throw new CaptureFailure2("helper-protocol-invalid");
        }
        phase = next;
        phaseFrames.push({ type: "phase", phase: next });
        notify();
      }
    });
  }).then(
    (value) => {
      if (!aborter.signal.aborted) result = value;
      settled = true;
      notify();
    },
    (error) => {
      failure = error;
      settled = true;
      notify();
    }
  );
  reservation.track(capturePromise);
  try {
    while (phaseFrames.length > 0 || !settled) {
      if (aborter.signal.aborted) {
        phaseFrames.length = 0;
        break;
      }
      if (phaseFrames.length) {
        yield phaseFrames.shift();
        continue;
      }
      if (settled) break;
      await new Promise((resolve2) => {
        wake = resolve2;
        if (phaseFrames.length || settled || aborter.signal.aborted) notify();
      });
    }
    if (aborter.signal.aborted) {
      yield { type: "terminal", status: "cancelled" };
      return;
    }
    if (failure !== void 0) {
      yield { type: "terminal", status: failureCode2(failure) };
      return;
    }
    if (result === void 0 || phase !== "capture-ready" || !validResult(result)) {
      yield { type: "terminal", status: "metadata-mismatch" };
      return;
    }
    const chunkCount = Math.ceil(result.png.length / CAPTURE_LIMITS.pngChunkBytes);
    yield {
      type: "image",
      scope: "owned-window",
      width: result.width,
      height: result.height,
      pointPixelScale: result.pointPixelScale,
      pngBytes: result.png.length,
      chunkCount
    };
    for (let index = 0; index < chunkCount; index++) {
      if (aborter.signal.aborted) {
        yield { type: "terminal", status: "cancelled" };
        return;
      }
      const start = index * CAPTURE_LIMITS.pngChunkBytes;
      const end = Math.min(start + CAPTURE_LIMITS.pngChunkBytes, result.png.length);
      yield { type: "chunk", index, base64: result.png.subarray(start, end).toString("base64") };
    }
    if (aborter.signal.aborted) {
      yield { type: "terminal", status: "cancelled" };
      return;
    }
    yield { type: "terminal", status: "captured" };
  } finally {
    abort();
    for (const source of signals) source.removeEventListener("abort", abort);
    await capturePromise;
    reservation.release();
  }
}
function validResult(result) {
  return Buffer.isBuffer(result.png) && result.png.length >= 33 && result.png.length <= CAPTURE_LIMITS.maxBytes && Number.isSafeInteger(result.width) && result.width > 0 && Number.isSafeInteger(result.height) && result.height > 0 && result.width <= CAPTURE_LIMITS.maxPixels / result.height && Number.isFinite(result.pointPixelScale) && result.pointPixelScale > 0 && result.scope === "owned-window" && Math.ceil(result.png.length / CAPTURE_LIMITS.pngChunkBytes) <= CAPTURE_LIMITS.maxChunks;
}
var FAILURE_CODES = new Set(CAPTURE_FAILURE_CODES);
function failureCode2(error) {
  const code = error?.code;
  return typeof code === "string" && FAILURE_CODES.has(code) ? code : "helper-failed";
}
var CaptureFailure2 = class extends Error {
  code;
  constructor(code) {
    super(code);
    this.code = code;
  }
};

// src/shared/system-wallpaper-protocol.ts
var SYSTEM_WALLPAPER_IDS = [
  "system-wallpaper-golden-gate",
  "system-wallpaper-golden-gate-sunset",
  "system-wallpaper-tahoe",
  "system-wallpaper-tahoe-day"
];
var WALLPAPER_LIMITS = {
  maxCatalogEntries: 4,
  maxBytes: 8 * 1024 * 1024,
  maxDimension: 2600,
  chunkBytes: 32 * 1024,
  maxChunks: 256,
  maxSourceImageBytes: 64 * 1024 * 1024,
  maxVideoBytes: 256 * 1024 * 1024,
  maxVideoSourceLength: 1024 * 1024 * 1024,
  videoHeaderBytes: 64,
  maxVideoMetadataBytes: 2 * 1024 * 1024,
  maxVideoSampleBytes: 16 * 1024 * 1024,
  maxVideoDownloadBytes: 18 * 1024 * 1024 + 64,
  maxCatalogBytes: 16 * 1024,
  helperStartMs: 5e3,
  helperMs: 2e4,
  downloadMs: 9e4
};
function isSystemWallpaperId(value) {
  return typeof value === "string" && (SYSTEM_WALLPAPER_IDS.includes(value) || /^system-wallpaper-video-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(value) || /^system-wallpaper-image-[a-f0-9]{64}$/u.test(value));
}
function isSystemWallpaperName(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 96 && !/\p{Cc}/u.test(value);
}

// src/host/system-wallpaper-native.ts
import { spawn as spawn2 } from "node:child_process";
import { relative, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
var START_TIMEOUT2 = WALLPAPER_LIMITS.helperStartMs;
var HELPER_TIMEOUT = WALLPAPER_LIMITS.helperMs;
var FORCE_TIMEOUT2 = 2e3;
var MAX_ERROR_BYTES = 1024;
var JPEG_MARKERS = /* @__PURE__ */ new Set([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207]);
var NativeWallpaperFailure = class extends Error {
  code;
  constructor(code) {
    super(code);
    this.code = code;
    this.name = "NativeWallpaperFailure";
  }
};
var defaultScheduler2 = {
  set: (callback, delayMs) => ({ timer: setTimeout(callback, delayMs) }),
  clear: (handle) => clearTimeout(handle.timer)
};
var defaultSpawner2 = (file, args, options) => spawn2(file, args, options);
function resolveSystemWallpaperHelperPath(platform, arch, bundleUrl = import.meta.url) {
  if (platform !== "darwin" || !["arm64", "x64"].includes(arch)) return void 0;
  return resolveNativeCaptureHelperPath(platform, arch, bundleUrl);
}
function runNativeWallpaperImage(id, options = {}) {
  if (!isSystemWallpaperId(id)) return Promise.reject(new NativeWallpaperFailure("invalid-request"));
  if (options.videoPath !== void 0 && (typeof options.videoPath !== "string" || !options.videoPath || !isHostTemporaryPath(options.videoPath))) {
    return Promise.reject(new NativeWallpaperFailure("invalid-request"));
  }
  if (options.systemImagePath !== void 0 && (options.videoPath !== void 0 || !isSystemImagePath(options.systemImagePath) || id !== "system-wallpaper-tahoe" && !id.startsWith("system-wallpaper-image-"))) {
    return Promise.reject(new NativeWallpaperFailure("invalid-request"));
  }
  const args = options.systemImagePath !== void 0 ? ["--wallpaper-system-image", id, options.systemImagePath] : options.videoPath === void 0 ? ["--wallpaper", id] : ["--wallpaper-video", id, options.videoPath];
  const allowDownload = options.videoPath === void 0;
  return runHelper({ ...options, mode: "image", args, expectedId: id, allowDownload }).then((output) => parseImage(output, id));
}
function isSystemImagePath(path) {
  return typeof path === "string" && path.length < 4096 && /^\/System\/Library\/ExtensionKit\/Extensions\/[A-Za-z0-9._-]+Wallpaper\.appex\/Contents\/Resources\/[A-Za-z0-9 _-]+Light\.heic$/u.test(path);
}
function runHelper(input) {
  const platform = input.platform ?? process.platform;
  const arch = input.arch ?? process.arch;
  if (platform !== "darwin" || !["arm64", "x64"].includes(arch)) {
    return Promise.reject(new NativeWallpaperFailure("unsupported-platform"));
  }
  if (input.signal?.aborted) return Promise.reject(new NativeWallpaperFailure("cancelled"));
  const helperPath = input.helperPath ?? resolveSystemWallpaperHelperPath(platform, arch, input.bundleUrl);
  if (!helperPath) return Promise.reject(new NativeWallpaperFailure("unavailable"));
  const args = input.mode === "list" ? ["--wallpaper-list"] : input.args;
  if (!args) return Promise.reject(new NativeWallpaperFailure("invalid-request"));
  const spawnProcess = input.spawnProcess ?? defaultSpawner2;
  const scheduler = input.scheduler ?? defaultScheduler2;
  const maxOutput = input.mode === "list" ? WALLPAPER_LIMITS.maxCatalogBytes : WALLPAPER_LIMITS.maxBytes + 1024;
  return new Promise((resolve2, reject) => {
    let child;
    try {
      child = spawnProcess(helperPath, args, { stdio: ["ignore", "pipe", "pipe"], shell: false });
    } catch {
      reject(new NativeWallpaperFailure("helper-start-failed"));
      return;
    }
    const stdout = [];
    const stderr = [];
    let outputBytes = 0;
    let errorBytes = 0;
    let settled = false;
    let spawned = false;
    let failure;
    let startTimer;
    let helperTimer;
    let forceTimer;
    const clear = (timer) => {
      if (timer !== void 0) scheduler.clear(timer);
    };
    const kill = (signal) => {
      try {
        child.kill(signal);
      } catch {
      }
    };
    const fail3 = (code, terminate = true) => {
      if (failure || settled) return;
      failure = new NativeWallpaperFailure(code);
      clear(startTimer);
      startTimer = void 0;
      clear(helperTimer);
      helperTimer = void 0;
      stdout.length = 0;
      if (!terminate) return;
      kill("SIGTERM");
      forceTimer = scheduler.set(() => {
        if (!settled) kill("SIGKILL");
      }, FORCE_TIMEOUT2);
    };
    const onAbort = () => fail3("cancelled");
    const onSpawn = () => {
      if (spawned || settled) return;
      spawned = true;
      clear(startTimer);
      startTimer = void 0;
      helperTimer = scheduler.set(() => fail3("helper-timeout"), HELPER_TIMEOUT);
    };
    const onError = () => fail3(spawned ? "helper-failed" : "helper-start-failed");
    const onStdout = (chunk) => {
      if (failure || settled) return;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      outputBytes += bytes.length;
      if (outputBytes > maxOutput) {
        fail3("byte-budget-exceeded");
        return;
      }
      stdout.push(bytes);
    };
    const onStderr = (chunk) => {
      if (failure || settled) return;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (errorBytes + bytes.length > MAX_ERROR_BYTES) {
        stderr.length = 0;
        errorBytes = 0;
        fail3("helper-failed");
        return;
      }
      errorBytes += bytes.length;
      stderr.push(bytes);
    };
    const onClose = (code, childSignal) => {
      if (settled) return;
      settled = true;
      clear(startTimer);
      clear(helperTimer);
      clear(forceTimer);
      startTimer = void 0;
      helperTimer = void 0;
      forceTimer = void 0;
      input.signal?.removeEventListener("abort", onAbort);
      child.off("spawn", onSpawn);
      child.off("error", onError);
      child.off("close", onClose);
      if (!spawned && !failure) failure = new NativeWallpaperFailure("helper-start-failed");
      if (failure) {
        reject(failure);
        return;
      }
      const diagnostic = Buffer.concat(stderr, errorBytes);
      const errorStatus = parseErrorStatus(diagnostic);
      if (errorStatus === "download-required") {
        const statusMatches = input.mode === "image" && input.allowDownload === true && input.expectedId && validDownloadRequired(stdout.length ? Buffer.concat(stdout, outputBytes) : Buffer.alloc(0), input.expectedId);
        reject(new NativeWallpaperFailure(statusMatches ? "download-required" : "protocol-invalid"));
        return;
      }
      if (errorStatus) {
        reject(new NativeWallpaperFailure(errorStatus));
        return;
      }
      if (diagnostic.length > 0) {
        reject(new NativeWallpaperFailure("helper-failed"));
        return;
      }
      if (code !== 0 || childSignal !== null) {
        reject(new NativeWallpaperFailure("helper-failed"));
        return;
      }
      resolve2(Buffer.concat(stdout, outputBytes));
    };
    input.signal?.addEventListener("abort", onAbort, { once: true });
    startTimer = scheduler.set(() => fail3("helper-start-timeout"), START_TIMEOUT2);
    child.stdout.on("data", onStdout);
    child.stderr.on("data", onStderr);
    child.on("spawn", onSpawn);
    child.on("error", onError);
    child.on("close", onClose);
    if (input.signal?.aborted) onAbort();
  });
}
function parseImage(output, expectedId) {
  const newline = output.indexOf(10);
  if (newline <= 0 || newline > 1024) throw new NativeWallpaperFailure("protocol-invalid");
  let value;
  try {
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(output.subarray(0, newline)));
  } catch {
    throw new NativeWallpaperFailure("protocol-invalid");
  }
  if (!isRecord3(value) || exactKeys(value, ["height", "id", "jpegBytes", "sourceType", "status", "width"]) !== true || value.status !== "loaded" || !isSystemWallpaperId(value.id) || value.id !== expectedId) {
    throw new NativeWallpaperFailure("protocol-invalid");
  }
  const id = value.id;
  const sourceType = value.sourceType;
  const width = value.width;
  const height = value.height;
  const jpegBytes = value.jpegBytes;
  if (sourceType !== "image" && sourceType !== "video" || typeof width !== "number" || typeof height !== "number" || typeof jpegBytes !== "number" || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width > WALLPAPER_LIMITS.maxDimension || height > WALLPAPER_LIMITS.maxDimension || !Number.isSafeInteger(jpegBytes) || jpegBytes < 12 || jpegBytes > WALLPAPER_LIMITS.maxBytes || output.length - newline - 1 !== jpegBytes) {
    throw new NativeWallpaperFailure(output.length - newline - 1 > WALLPAPER_LIMITS.maxBytes ? "byte-budget-exceeded" : "protocol-invalid");
  }
  const jpeg = output.subarray(newline + 1);
  const actualSize = readJpegDimensions2(jpeg);
  if (actualSize.width !== width || actualSize.height !== height) {
    throw new NativeWallpaperFailure("protocol-invalid");
  }
  return { id, sourceType, width, height, jpeg: Buffer.from(jpeg) };
}
function parseSingleJsonLine(output, maxBytes) {
  if (output.length > maxBytes || output.length < 2 || output[output.length - 1] !== 10 || output.subarray(0, output.length - 1).includes(10)) throw new NativeWallpaperFailure("protocol-invalid");
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(output.subarray(0, output.length - 1)));
  } catch {
    throw new NativeWallpaperFailure("protocol-invalid");
  }
}
function parseErrorStatus(stderr) {
  if (!stderr.length) return void 0;
  if (stderr.length > MAX_ERROR_BYTES || stderr[stderr.length - 1] !== 10 || stderr.subarray(0, stderr.length - 1).includes(10)) {
    return void 0;
  }
  const token = stderr.toString("ascii");
  if (token === "download-required\n") return "download-required";
  if (token === "wallpaper-unavailable\n") return "unavailable";
  if (token === "wallpaper-decode-failed\n") return "decode-failed";
  if (token === "wallpaper-byte-budget-exceeded\n") return "byte-budget-exceeded";
  if (token === "wallpaper-invalid-request\n") return "invalid-request";
  if (token === "wallpaper-read-failed\n" || token === "wallpaper-jpeg-encode-failed\n" || token === "wallpaper-output-failed\n") return "helper-failed";
  return stderr.length ? "helper-failed" : void 0;
}
function validDownloadRequired(output, expectedId) {
  try {
    const value = parseSingleJsonLine(output, 1024);
    return isRecord3(value) && exactKeys(value, ["downloadable", "id", "status"]) && value.status === "unavailable" && value.id === expectedId && value.downloadable === true;
  } catch {
    return false;
  }
}
function readJpegDimensions2(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 12 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) {
    throw new NativeWallpaperFailure("protocol-invalid");
  }
  let offset = 2;
  let segments = 0;
  let dimensions;
  while (offset < bytes.length - 2) {
    if (++segments > 8192 || bytes[offset] !== 255) throw new NativeWallpaperFailure("protocol-invalid");
    while (bytes[offset] === 255) offset++;
    if (offset >= bytes.length - 2) throw new NativeWallpaperFailure("protocol-invalid");
    const marker = bytes[offset++];
    if (marker === 217 || marker === 216 || marker === 0 || marker >= 208 && marker <= 215) {
      throw new NativeWallpaperFailure("protocol-invalid");
    }
    if (offset + 2 > bytes.length - 2) throw new NativeWallpaperFailure("protocol-invalid");
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) throw new NativeWallpaperFailure("protocol-invalid");
    if (JPEG_MARKERS.has(marker)) {
      if (dimensions || length < 8) throw new NativeWallpaperFailure("protocol-invalid");
      const height = bytes.readUInt16BE(offset + 3);
      const width = bytes.readUInt16BE(offset + 5);
      const components = bytes[offset + 7];
      if (!width || !height || width > WALLPAPER_LIMITS.maxDimension || height > WALLPAPER_LIMITS.maxDimension || components < 1 || components > 4 || length !== 8 + components * 3) {
        throw new NativeWallpaperFailure("protocol-invalid");
      }
      dimensions = { width, height };
    }
    offset += length;
    if (marker === 218) {
      if (!dimensions || length < 6) throw new NativeWallpaperFailure("protocol-invalid");
      break;
    }
  }
  if (!dimensions || offset > bytes.length - 2) throw new NativeWallpaperFailure("protocol-invalid");
  return dimensions;
}
function isHostTemporaryPath(value) {
  if (!value || !resolve(value).endsWith(`${sep}source.mov`)) return false;
  const relativePath = relative(resolve(tmpdir()), resolve(value));
  const parts = relativePath.split(sep);
  return parts.length === 2 && /^pdsh-wallpaper-[A-Za-z0-9]+$/u.test(parts[0]) && parts[1] === "source.mov";
}
function exactKeys(value, expected) {
  return Object.keys(value).sort().join(",") === [...expected].sort().join(",");
}
function isRecord3(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// src/host/system-wallpaper-stream.ts
function createSystemWallpaperStream(options) {
  return {
    [Symbol.asyncIterator]() {
      const aborter = new AbortController();
      const control = { returning: false };
      const iterator = iterateSystemWallpaper(options, aborter, control);
      return {
        next: (value) => iterator.next(value),
        return: (value) => {
          control.returning = true;
          if (!aborter.signal.aborted) aborter.abort();
          return iterator.return(value);
        },
        throw: (error) => {
          control.returning = true;
          if (!aborter.signal.aborted) aborter.abort();
          return iterator.throw(error);
        }
      };
    }
  };
}
async function* iterateSystemWallpaper(options, operationAborter, control) {
  const terminal = (status) => ({ type: "terminal", status });
  if (!isValidRequest(options.request)) {
    yield terminal("invalid-request");
    return;
  }
  if (options.platform !== "darwin") {
    yield terminal("unsupported-platform");
    return;
  }
  if (options.signal.aborted) {
    yield terminal("cancelled");
    return;
  }
  if (safeBoolean(options.disposed)) {
    yield terminal("disposed");
    return;
  }
  if (!safeBoolean(options.enabled)) {
    yield terminal("not-enabled");
    return;
  }
  const reservation = options.reserve();
  if (reservation === "busy") {
    yield terminal("busy");
    return;
  }
  if (reservation === "disposed") {
    yield terminal(safeBoolean(options.disposed) ? "disposed" : "not-enabled");
    return;
  }
  const phaseQueue = [];
  const signals = [options.signal, options.lifetimeSignal];
  let wake;
  let settled = false;
  let result;
  let operationFailure;
  let failed = false;
  const notify = () => {
    wake?.();
    wake = void 0;
  };
  const abortOperation = () => {
    if (!operationAborter.signal.aborted) operationAborter.abort();
    phaseQueue.length = 0;
    notify();
  };
  for (const signal of signals) signal.addEventListener("abort", abortOperation, { once: true });
  if (signals.some((signal) => signal.aborted)) abortOperation();
  const operation = Promise.resolve().then(async () => {
    if (operationAborter.signal.aborted) throw new NativeWallpaperFailure("cancelled");
    if (options.request.kind === "list") return options.list(operationAborter.signal);
    return options.load(options.request.id, operationAborter.signal, (phase) => {
      if (operationAborter.signal.aborted) return;
      if (phaseQueue.length >= 2 || !["downloading", "decoding"].includes(phase)) {
        throw new NativeWallpaperFailure("protocol-invalid");
      }
      phaseQueue.push({ type: "phase", phase });
      notify();
    });
  }).then(
    (value) => {
      if (!operationAborter.signal.aborted) result = value;
      settled = true;
      notify();
    },
    (error) => {
      operationFailure = error;
      failed = true;
      settled = true;
      notify();
    }
  );
  reservation.track(operation.then(() => void 0));
  try {
    while (phaseQueue.length || !settled) {
      if (control.returning) return;
      if (phaseQueue.length) {
        yield phaseQueue.shift();
        continue;
      }
      if (settled) break;
      await new Promise((resolve2) => {
        wake = resolve2;
        if (phaseQueue.length || settled || control.returning) notify();
      });
    }
    if (control.returning) return;
    if (options.signal.aborted || options.lifetimeSignal.aborted) {
      yield terminal("cancelled");
      return;
    }
    if (safeBoolean(options.disposed)) {
      yield terminal("disposed");
      return;
    }
    if (failed) {
      yield terminal(failureStatus(operationFailure));
      return;
    }
    if (options.request.kind === "list") {
      const entries = validateCatalog(result);
      yield { type: "catalog", entries };
      yield terminal("listed");
      return;
    }
    const image = validateImage(result, options.request.id);
    const chunkCount = Math.ceil(image.jpeg.length / WALLPAPER_LIMITS.chunkBytes);
    yield {
      type: "image",
      id: image.id,
      sourceType: image.sourceType,
      width: image.width,
      height: image.height,
      jpegBytes: image.jpeg.length,
      chunkCount
    };
    for (let index = 0; index < chunkCount; index++) {
      if (control.returning) return;
      if (options.signal.aborted || options.lifetimeSignal.aborted) {
        yield terminal("cancelled");
        return;
      }
      const start = index * WALLPAPER_LIMITS.chunkBytes;
      const end = Math.min(start + WALLPAPER_LIMITS.chunkBytes, image.jpeg.length);
      yield { type: "chunk", index, base64: image.jpeg.subarray(start, end).toString("base64") };
    }
    if (control.returning) return;
    if (options.signal.aborted || options.lifetimeSignal.aborted) {
      yield terminal("cancelled");
      return;
    }
    yield terminal("loaded");
  } finally {
    abortOperation();
    for (const signal of signals) signal.removeEventListener("abort", abortOperation);
    await operation;
    result = void 0;
    reservation.release();
  }
}
function isValidRequest(request) {
  if (!isRecord4(request)) return false;
  if (request.kind === "list") return Object.keys(request).length === 1 && Object.hasOwn(request, "kind");
  return request.kind === "load" && Object.keys(request).length === 2 && Object.hasOwn(request, "kind") && Object.hasOwn(request, "id") && isSystemWallpaperId(request.id);
}
function validateCatalog(value) {
  if (!Array.isArray(value) || value.length > WALLPAPER_LIMITS.maxCatalogEntries) {
    throw new NativeWallpaperFailure("protocol-invalid");
  }
  const entries = [];
  const seen = /* @__PURE__ */ new Set();
  for (const entry of value) {
    if (!isRecord4(entry) || !isSystemWallpaperId(entry.id) || seen.has(entry.id) || !isSystemWallpaperName(entry.name) || typeof entry.available !== "boolean" || typeof entry.downloadable !== "boolean") {
      throw new NativeWallpaperFailure("protocol-invalid");
    }
    seen.add(entry.id);
    entries.push({ id: entry.id, name: entry.name, available: entry.available, downloadable: entry.downloadable });
  }
  return entries;
}
function validateImage(value, expectedId) {
  if (!isRecord4(value) || !isSystemWallpaperId(value.id) || value.id !== expectedId || value.sourceType !== "image" && value.sourceType !== "video" || !Buffer.isBuffer(value.jpeg) || value.jpeg.length < 12 || value.jpeg.length > WALLPAPER_LIMITS.maxBytes || typeof value.width !== "number" || typeof value.height !== "number" || !Number.isSafeInteger(value.width) || !Number.isSafeInteger(value.height) || value.width < 1 || value.height < 1 || value.width > WALLPAPER_LIMITS.maxDimension || value.height > WALLPAPER_LIMITS.maxDimension) throw new NativeWallpaperFailure("protocol-invalid");
  const actual = readJpegDimensions2(value.jpeg);
  if (actual.width !== value.width || actual.height !== value.height) throw new NativeWallpaperFailure("protocol-invalid");
  return { id: value.id, sourceType: value.sourceType, width: value.width, height: value.height, jpeg: value.jpeg };
}
var PUBLIC_FAILURES = /* @__PURE__ */ new Set([
  "unavailable",
  "download-failed",
  "download-certificate-failed",
  "decode-failed",
  "protocol-invalid",
  "byte-budget-exceeded",
  "helper-failed"
]);
function failureStatus(error) {
  const code = error && typeof error === "object" ? error.code : void 0;
  return typeof code === "string" && PUBLIC_FAILURES.has(code) ? code : "helper-failed";
}
function safeBoolean(read) {
  try {
    return read() === true;
  } catch {
    return false;
  }
}
function isRecord4(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// src/host/system-wallpaper-download.ts
import { lstat, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir as tmpdir2 } from "node:os";
import { join as join3 } from "node:path";

// src/host/system-wallpaper-mov-aux.ts
var MovAuxiliaryValidationError = class extends Error {
  constructor() {
    super("invalid-movie");
    this.name = "MovAuxiliaryValidationError";
  }
};
function validateTrackAperture(bytes, tapt, children) {
  if (tapt.end - tapt.start !== 68 || children.length !== 3) fail();
  const expected = ["clef", "prof", "enof"];
  for (let index = 0; index < expected.length; index++) {
    const box = children[index];
    if (box.type !== expected[index] || box.end - box.start !== 20) fail();
    fullBox(bytes, box, 0, 0);
    if (readU32(bytes, box.payloadStart + 4, box.end) === 0 || readU32(bytes, box.payloadStart + 8, box.end) === 0) fail();
  }
}
function validateDataHandler(bytes, box) {
  if (box.type !== "hdlr" || box.end - box.start !== 56) fail();
  fullBox(bytes, box, 0, 0);
  if (readType(bytes, box.payloadStart + 4, box.end) !== "dhlr" || readType(bytes, box.payloadStart + 8, box.end) !== "alis") fail();
}
function validateMediaHandler(bytes, box) {
  if (box.type !== "hdlr" || box.end - box.start !== 49) fail();
  fullBox(bytes, box, 0, 0);
  if (readType(bytes, box.payloadStart + 4, box.end) !== "mhlr" || readType(bytes, box.payloadStart + 8, box.end) !== "vide") fail();
}
function validateHevcSampleEntry(bytes, entry, children) {
  if (entry.type !== "hvc1" || children.length !== 2) fail();
  const [config, color] = children;
  if (config.type !== "hvcC" || config.end - config.payloadStart < 23 || bytes[config.payloadStart] !== 1) fail();
  if (color.type !== "colr" || color.end - color.start !== 18 || readType(bytes, color.payloadStart, color.end) !== "nclc" || color.end - color.payloadStart !== 10) fail();
  const trailer = entry.end - 4;
  if (children[children.length - 1].end !== trailer || bytes[trailer] !== 0 || bytes[trailer + 1] !== 0 || bytes[trailer + 2] !== 0 || bytes[trailer + 3] !== 0) fail();
}
function validateAuxiliarySampleTables(bytes, children, sampleCount) {
  const descriptions = children.filter((box) => box.type === "sgpd");
  if (descriptions.length !== 2) fail();
  const groups = /* @__PURE__ */ new Set();
  for (const box of descriptions) {
    fullBox(bytes, box, 1, 0);
    const groupingType = readType(bytes, box.payloadStart + 4, box.end);
    const defaultLength = readU32(bytes, box.payloadStart + 8, box.end);
    const entryCount = readU32(bytes, box.payloadStart + 12, box.end);
    const payloadLength = box.end - (box.payloadStart + 16);
    if (groupingType === "tscl") {
      if (box.end - box.start !== 124 || defaultLength !== 20 || entryCount !== 5 || payloadLength !== 100) fail();
    } else if (groupingType === "tsas") {
      if (box.end - box.start !== 28 || defaultLength !== 0 || entryCount !== 1 || payloadLength !== 4 || readU32(bytes, box.payloadStart + 16, box.end) !== 0) fail();
    } else fail();
    if (groups.has(groupingType)) fail();
    groups.add(groupingType);
  }
  if (!groups.has("tscl") || !groups.has("tsas")) fail();
  const compositionGroups = children.filter((box) => box.type === "csgm");
  if (compositionGroups.length !== 2) fail();
  const compositionTypes = /* @__PURE__ */ new Set();
  for (const box of compositionGroups) {
    const groupingType = readType(bytes, box.payloadStart + 4, box.end);
    if (groupingType !== "tscl" && groupingType !== "tsas" || box.end - box.start !== 68 && box.end - box.start !== 53 || !versionFlags(bytes, box, 0, 0) || readU32(bytes, box.payloadStart + 8, box.end) !== 0 || readU32(bytes, box.payloadStart + 12, box.end) !== 4 || compositionTypes.has(groupingType)) fail();
    compositionTypes.add(groupingType);
  }
  if (!compositionTypes.has("tscl") || !compositionTypes.has("tsas") || compositionGroups[0].end - compositionGroups[0].start !== compositionGroups[1].end - compositionGroups[1].start) fail();
  const compositionShift = only(children, "cslg");
  if (compositionShift.end - compositionShift.start !== 32 || !versionFlags(bytes, compositionShift, 0, 0)) fail();
  const dependencies = only(children, "sdtp");
  if (dependencies.end - dependencies.start !== sampleCount + 12 || !versionFlags(bytes, dependencies, 0, 0) || bytes[dependencies.payloadStart + 4] !== 0) fail();
}
function only(children, type) {
  const values = children.filter((box) => box.type === type);
  if (values.length !== 1) fail();
  return values[0];
}
function fullBox(bytes, box, version2, flags) {
  if (box.end - box.payloadStart < 4 || !versionFlags(bytes, box, version2, flags)) fail();
}
function versionFlags(bytes, box, version2, flags) {
  if (box.end - box.payloadStart < 4) return false;
  const actualFlags = bytes[box.payloadStart + 1] << 16 | bytes[box.payloadStart + 2] << 8 | bytes[box.payloadStart + 3];
  return bytes[box.payloadStart] === version2 && actualFlags === flags;
}
function readType(bytes, offset, end) {
  if (offset < 0 || offset + 4 > end) fail();
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}
function readU32(bytes, offset, end) {
  if (offset < 0 || offset + 4 > end) fail();
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);
}
function fail() {
  throw new MovAuxiliaryValidationError();
}

// src/host/system-wallpaper-mov.ts
var AppleWallpaperMovError = class extends Error {
  code;
  constructor(code) {
    super(code);
    this.name = "AppleWallpaperMovError";
    this.code = code;
  }
};
var MAX_TABLE_ENTRIES = 524288;
var MAX_SAMPLE_COUNT = 1e6;
var MAX_NESTED_ATOMS = 131072;
var U32_MAX = 4294967295;
var SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
var DEFAULT_LIMITS = {
  maxSourceLength: WALLPAPER_LIMITS.maxVideoSourceLength,
  maxMetadataBytes: WALLPAPER_LIMITS.maxVideoMetadataBytes,
  maxSampleBytes: WALLPAPER_LIMITS.maxVideoSampleBytes
};
function fail2(code) {
  throw new AppleWallpaperMovError(code);
}
function validateAux(validate) {
  try {
    validate();
  } catch (error) {
    if (error instanceof MovAuxiliaryValidationError) fail2("invalid-movie");
    throw error;
  }
}
function resolveLimits(options) {
  if (options !== void 0 && (options === null || typeof options !== "object" || Array.isArray(options))) {
    return fail2("invalid-options");
  }
  const limits = {
    maxSourceLength: options?.maxSourceLength ?? DEFAULT_LIMITS.maxSourceLength,
    maxMetadataBytes: options?.maxMetadataBytes ?? DEFAULT_LIMITS.maxMetadataBytes,
    maxSampleBytes: options?.maxSampleBytes ?? DEFAULT_LIMITS.maxSampleBytes
  };
  const ceilings = DEFAULT_LIMITS;
  for (const key of Object.keys(limits)) {
    const value = limits[key];
    if (!Number.isSafeInteger(value) || value <= 0) return fail2("invalid-options");
    if (value > ceilings[key]) return fail2("invalid-options");
  }
  return limits;
}
function parseAppleWallpaperMovHeader(prefix, sourceLength, options) {
  const limits = resolveLimits(options);
  if (!(prefix instanceof Uint8Array) || prefix.byteLength !== WALLPAPER_LIMITS.videoHeaderBytes) fail2("invalid-layout");
  if (!Number.isSafeInteger(sourceLength) || sourceLength <= prefix.byteLength) fail2("invalid-layout");
  if (sourceLength > limits.maxSourceLength) fail2("budget-exceeded");
  const ftyp = atomAt(prefix, 0, prefix.byteLength);
  if (ftyp.type !== "ftyp" || ftyp.start !== 0 || ftyp.end !== 20) fail2("invalid-layout");
  const wide = atomAt(prefix, ftyp.end, prefix.byteLength);
  if (wide.type !== "wide" || wide.end !== 28) fail2("invalid-layout");
  if (readType2(prefix, 32, prefix.byteLength) !== "mdat") fail2("invalid-layout");
  const mdatSize = readU322(prefix, 28, prefix.byteLength);
  if (mdatSize <= 8) fail2("invalid-layout");
  const mdatEnd = checkedAdd(28, mdatSize);
  if (mdatEnd >= sourceLength) fail2("invalid-layout");
  const moovLength = sourceLength - mdatEnd;
  if (moovLength < 8) fail2("invalid-layout");
  if (moovLength > limits.maxMetadataBytes) fail2("budget-exceeded");
  return {
    sourceLength,
    ftyp: prefix.slice(ftyp.start, ftyp.end),
    mdatBodyStart: 36,
    mdatBodyEnd: mdatEnd,
    moovOffset: mdatEnd,
    moovLength
  };
}
function parseAppleWallpaperFirstSample(layout, moovBytes, options) {
  const limits = resolveLimits(options);
  validateLayout(layout, limits);
  if (!(moovBytes instanceof Uint8Array) || moovBytes.byteLength !== layout.moovLength) fail2("invalid-movie");
  if (moovBytes.byteLength > limits.maxMetadataBytes) fail2("budget-exceeded");
  const root = atomAt(moovBytes, 0, moovBytes.byteLength);
  if (root.type !== "moov" || root.end !== moovBytes.byteLength) fail2("invalid-movie");
  const movieChildren = atoms(moovBytes, root.payloadStart, root.end);
  assertOnly(movieChildren, ["mvhd", "trak", "udta", "meta", "free"]);
  const movieHeader = required(movieChildren, "mvhd");
  const tracks = all(movieChildren, "trak");
  if (tracks.length !== 1) fail2("invalid-movie");
  const mvhdVersion = checkFullBox(moovBytes, movieHeader, [0, 1], 0);
  checkDurationField(moovBytes, movieHeader, mvhdVersion, mvhdVersion === 0 ? 16 : 24);
  const movieTimescale = readTimescale(moovBytes, movieHeader, mvhdVersion);
  const track = parseTrack(moovBytes, movieHeader, tracks[0], layout, movieTimescale, limits);
  if (track.sampleSize.firstSampleSize > limits.maxSampleBytes) fail2("budget-exceeded");
  return {
    sourceOffset: track.chunkOffsets[0],
    sampleSize: track.sampleSize.firstSampleSize,
    rebuild(sampleBytes) {
      if (!(sampleBytes instanceof Uint8Array) || sampleBytes.byteLength !== track.sampleSize.firstSampleSize) {
        fail2("invalid-movie");
      }
      if (sampleBytes.byteLength > limits.maxSampleBytes) fail2("budget-exceeded");
      const movieDuration = durationInMovieScale(
        BigInt(track.firstSampleDuration),
        track.movieTimescale,
        track.mediaTimescale
      );
      const makeMovie = (chunkOffset) => rebuildMovie(
        moovBytes,
        track,
        movieDuration,
        chunkOffset
      );
      const firstMoov = makeMovie(0);
      const sampleOffset = checkedAdd(layout.ftyp.byteLength, firstMoov.byteLength);
      const absoluteSampleOffset = checkedAdd(sampleOffset, 8);
      const rebuiltMoov = makeMovie(absoluteSampleOffset);
      const mdatSize = checkedAdd(sampleBytes.byteLength, 8);
      if (mdatSize > U32_MAX) fail2("budget-exceeded");
      const outputSize = checkedAdd(checkedAdd(layout.ftyp.byteLength, rebuiltMoov.byteLength), mdatSize);
      const outputBudget = checkedAdd(checkedAdd(limits.maxMetadataBytes, limits.maxSampleBytes), WALLPAPER_LIMITS.videoHeaderBytes);
      if (outputSize > outputBudget) fail2("budget-exceeded");
      const output = new Uint8Array(outputSize);
      output.set(layout.ftyp, 0);
      output.set(rebuiltMoov, layout.ftyp.byteLength);
      const mdatOffset = layout.ftyp.byteLength + rebuiltMoov.byteLength;
      writeU32(output, mdatOffset, mdatSize);
      writeType(output, mdatOffset + 4, "mdat");
      output.set(sampleBytes, mdatOffset + 8);
      return output;
    }
  };
}
function validateLayout(layout, limits) {
  if (!layout || typeof layout !== "object" || !(layout.ftyp instanceof Uint8Array)) fail2("invalid-layout");
  if (!Number.isSafeInteger(layout.sourceLength) || layout.sourceLength <= 0) fail2("invalid-layout");
  if (layout.sourceLength > limits.maxSourceLength) fail2("budget-exceeded");
  if (layout.ftyp.byteLength !== 20 || !Number.isSafeInteger(layout.mdatBodyStart) || !Number.isSafeInteger(layout.mdatBodyEnd) || !Number.isSafeInteger(layout.moovOffset) || !Number.isSafeInteger(layout.moovLength)) fail2("invalid-layout");
  if (layout.mdatBodyStart !== 36 || layout.mdatBodyEnd !== layout.moovOffset || BigInt(layout.moovOffset) + BigInt(layout.moovLength) !== BigInt(layout.sourceLength) || layout.moovLength > limits.maxMetadataBytes || layout.mdatBodyEnd <= layout.mdatBodyStart) {
    fail2(layout.moovLength > limits.maxMetadataBytes ? "budget-exceeded" : "invalid-layout");
  }
  const ftyp = atomAt(layout.ftyp, 0, layout.ftyp.byteLength);
  if (ftyp.type !== "ftyp" || ftyp.end !== 20) fail2("invalid-layout");
}
function parseTrack(bytes, movieHeader, trak, layout, movieTimescale, limits) {
  const trackChildren = atoms(bytes, trak.payloadStart, trak.end);
  assertOnly(trackChildren, ["tkhd", "tapt", "edts", "mdia"]);
  if (all(trackChildren, "edts").length > 1) fail2("invalid-movie");
  const trackHeader = required(trackChildren, "tkhd");
  const trackAperture = required(trackChildren, "tapt");
  validateAux(() => validateTrackAperture(bytes, trackAperture, atoms(bytes, trackAperture.payloadStart, trackAperture.end)));
  const media = required(trackChildren, "mdia");
  const tkhdVersion = checkFullBox(bytes, trackHeader, [0, 1]);
  const tkhdFlags = readFlags(bytes, trackHeader);
  if ((tkhdFlags & ~15) !== 0) fail2("invalid-movie");
  checkDurationField(bytes, trackHeader, tkhdVersion, tkhdVersion === 0 ? 20 : 28);
  const mediaChildren = atoms(bytes, media.payloadStart, media.end);
  assertOnly(mediaChildren, ["mdhd", "hdlr", "minf"]);
  const mediaHeader = required(mediaChildren, "mdhd");
  const handler = required(mediaChildren, "hdlr");
  const minf = required(mediaChildren, "minf");
  const mdhdVersion = checkFullBox(bytes, mediaHeader, [0, 1], 0);
  const mediaTimescale = readTimescale(bytes, mediaHeader, mdhdVersion);
  checkDurationField(bytes, mediaHeader, mdhdVersion, mdhdVersion === 0 ? 16 : 24);
  validateAux(() => validateMediaHandler(bytes, handler));
  const minfChildren = atoms(bytes, minf.payloadStart, minf.end);
  assertOnly(minfChildren, ["vmhd", "hdlr", "dinf", "stbl"]);
  const videoHeader = required(minfChildren, "vmhd");
  const dataHandler = required(minfChildren, "hdlr");
  validateAux(() => validateDataHandler(bytes, dataHandler));
  const dataInfo = required(minfChildren, "dinf");
  const sampleTable = required(minfChildren, "stbl");
  checkFullBox(bytes, videoHeader, [0], 1);
  if (videoHeader.end - videoHeader.payloadStart < 12) fail2("invalid-movie");
  const dataReferences = parseDataReferences(bytes, dataInfo);
  const tables = parseSampleTables(bytes, sampleTable, layout, dataReferences.length, limits);
  return {
    movieHeader,
    trackHeader,
    trackAperture,
    mediaHeader,
    handler,
    videoHeader,
    dataHandler,
    dataInfo,
    ...tables,
    movieTimescale,
    mediaTimescale
  };
}
function parseSampleTables(bytes, sampleTable, layout, dataReferenceCount, limits) {
  const children = atoms(bytes, sampleTable.payloadStart, sampleTable.end);
  assertOnly(children, ["stsd", "stts", "ctts", "stss", "stsc", "stsz", "stco", "co64", "sgpd", "csgm", "cslg", "sdtp"]);
  const sampleDescription = required(children, "stsd");
  const sampleSizeAtom = required(children, "stsz");
  const stts = required(children, "stts");
  const stsc = required(children, "stsc");
  const offsets = all(children, "stco").concat(all(children, "co64"));
  if (offsets.length !== 1) fail2("invalid-movie");
  const chunkType = offsets[0].type;
  const descriptions = parseSampleDescriptions(bytes, sampleDescription, dataReferenceCount);
  const sampleSize = parseSampleSizes(bytes, sampleSizeAtom);
  if (sampleSize.sampleCount > MAX_SAMPLE_COUNT) fail2("budget-exceeded");
  validateAux(() => validateAuxiliarySampleTables(bytes, children, sampleSize.sampleCount));
  const chunkOffsets = parseChunkOffsets(bytes, offsets[0], layout);
  const chunkMap = parseChunkMap(bytes, stsc, chunkOffsets.length, descriptions.length);
  validateTimeToSample(bytes, stts, sampleSize.sampleCount);
  const composition = all(children, "ctts");
  if (composition.length > 1) fail2("invalid-movie");
  const compositionVersion = composition.length ? validateCompositionOffsets(bytes, composition[0], sampleSize.sampleCount) : 0;
  const sync = all(children, "stss");
  if (sync.length > 1) fail2("invalid-movie");
  if (sync.length) validateSyncSamples(bytes, sync[0], sampleSize.sampleCount);
  const firstSampleDuration = readFirstSampleDuration(bytes, stts);
  const firstSampleDescriptionIndex = validateChunkCoverage(
    sampleSize,
    chunkOffsets,
    chunkMap,
    layout,
    descriptions.length
  );
  if (sampleSize.firstSampleSize > limits.maxSampleBytes) fail2("budget-exceeded");
  return {
    sampleDescription,
    sampleSize,
    chunkOffsets,
    chunkType,
    chunkMap,
    firstSampleDescriptionIndex,
    firstSampleDuration,
    compositionVersion
  };
}
function parseSampleDescriptions(bytes, stsd, dataReferenceCount) {
  checkFullBox(bytes, stsd, [0], 0);
  const entryCount = readU322(bytes, stsd.payloadStart + 4, stsd.end);
  if (entryCount !== 1) fail2("invalid-movie");
  const entries = atoms(bytes, stsd.payloadStart + 8, stsd.end, entryCount);
  for (const entry of entries) {
    if (entry.end - entry.payloadStart < 8) fail2("invalid-movie");
    const dataReferenceIndex = readU16(bytes, entry.payloadStart + 6, entry.end);
    if (dataReferenceIndex < 1 || dataReferenceIndex > dataReferenceCount) fail2("invalid-movie");
    const codecBoxes = atoms(bytes, entry.payloadStart + 78, entry.end - 4);
    validateAux(() => validateHevcSampleEntry(bytes, entry, codecBoxes));
  }
  return entries;
}
function parseDataReferences(bytes, dinf) {
  const children = atoms(bytes, dinf.payloadStart, dinf.end);
  assertOnly(children, ["dref", "free"]);
  const dref = required(children, "dref");
  checkFullBox(bytes, dref, [0], 0);
  const count = readU322(bytes, dref.payloadStart + 4, dref.end);
  if (count !== 1) fail2("invalid-movie");
  const entries = atoms(bytes, dref.payloadStart + 8, dref.end, count);
  for (const entry of entries) {
    if (entry.type !== "alis") fail2("invalid-movie");
    checkFullBox(bytes, entry, [0], 1);
    if (entry.end - entry.payloadStart !== 4) fail2("invalid-movie");
  }
  return entries;
}
function parseSampleSizes(bytes, stsz) {
  checkFullBox(bytes, stsz, [0], 0);
  const constantSize = readU322(bytes, stsz.payloadStart + 4, stsz.end);
  const sampleCount = readU322(bytes, stsz.payloadStart + 8, stsz.end);
  if (sampleCount < 1 || sampleCount > MAX_SAMPLE_COUNT) fail2("budget-exceeded");
  if (constantSize > 0) {
    if (stsz.end - (stsz.payloadStart + 12) !== 0) fail2("invalid-movie");
    return { sampleCount, firstSampleSize: constantSize, sampleSizeAt: () => constantSize };
  }
  const tableStart = stsz.payloadStart + 12;
  if (stsz.end - tableStart !== sampleCount * 4) fail2("invalid-movie");
  const firstSampleSize = readU322(bytes, tableStart, stsz.end);
  const sampleSizeAt = (index) => readU322(bytes, tableStart + index * 4, stsz.end);
  for (let index = 0; index < sampleCount; index++) {
    if (sampleSizeAt(index) === 0) fail2("invalid-movie");
  }
  return { sampleCount, firstSampleSize, sampleSizeAt };
}
function parseChunkOffsets(bytes, box, layout) {
  checkFullBox(bytes, box, [0], 0);
  const count = readU322(bytes, box.payloadStart + 4, box.end);
  if (count < 1 || count > MAX_TABLE_ENTRIES) fail2("budget-exceeded");
  const entryBytes = box.type === "co64" ? 8 : 4;
  const start = box.payloadStart + 8;
  if (box.end - start !== count * entryBytes) fail2("invalid-movie");
  const offsets = [];
  for (let index = 0; index < count; index++) {
    const offset = box.type === "co64" ? readU64(bytes, start + index * 8, box.end) : readU322(bytes, start + index * 4, box.end);
    if (offset < layout.mdatBodyStart || offset >= layout.mdatBodyEnd) fail2("invalid-movie");
    offsets.push(offset);
  }
  return offsets;
}
function parseChunkMap(bytes, stsc, chunkCount, descriptionCount) {
  checkFullBox(bytes, stsc, [0], 0);
  const count = readU322(bytes, stsc.payloadStart + 4, stsc.end);
  if (count < 1 || count > MAX_TABLE_ENTRIES) fail2("budget-exceeded");
  const start = stsc.payloadStart + 8;
  if (stsc.end - start !== count * 12) fail2("invalid-movie");
  const entries = [];
  let previousChunk = 0;
  for (let index = 0; index < count; index++) {
    const offset = start + index * 12;
    const firstChunk = readU322(bytes, offset, stsc.end);
    const samplesPerChunk = readU322(bytes, offset + 4, stsc.end);
    const sampleDescriptionIndex = readU322(bytes, offset + 8, stsc.end);
    if (firstChunk <= previousChunk || firstChunk > chunkCount || samplesPerChunk < 1 || sampleDescriptionIndex < 1 || sampleDescriptionIndex > descriptionCount) fail2("invalid-movie");
    entries.push({ firstChunk, samplesPerChunk, sampleDescriptionIndex });
    previousChunk = firstChunk;
  }
  if (entries[0].firstChunk !== 1) fail2("invalid-movie");
  return entries;
}
function validateTimeToSample(bytes, stts, sampleCount) {
  checkFullBox(bytes, stts, [0], 0);
  const count = readU322(bytes, stts.payloadStart + 4, stts.end);
  if (count < 1 || count > MAX_TABLE_ENTRIES) fail2("invalid-movie");
  const start = stts.payloadStart + 8;
  if (stts.end - start !== count * 8) fail2("invalid-movie");
  let samples = 0n;
  for (let index = 0; index < count; index++) {
    const entry = start + index * 8;
    const runCount = readU322(bytes, entry, stts.end);
    const delta = readU322(bytes, entry + 4, stts.end);
    if (runCount < 1 || delta < 1) fail2("invalid-movie");
    samples += BigInt(runCount);
  }
  if (samples !== BigInt(sampleCount)) fail2("invalid-movie");
}
function readFirstSampleDuration(bytes, stts) {
  return readU322(bytes, stts.payloadStart + 12, stts.end);
}
function validateCompositionOffsets(bytes, ctts, sampleCount) {
  const version2 = checkFullBox(bytes, ctts, [0, 1], 0);
  const count = readU322(bytes, ctts.payloadStart + 4, ctts.end);
  if (count < 1 || count > MAX_TABLE_ENTRIES) fail2("invalid-movie");
  const start = ctts.payloadStart + 8;
  if (ctts.end - start !== count * 8) fail2("invalid-movie");
  let samples = 0n;
  for (let index = 0; index < count; index++) {
    const entry = start + index * 8;
    const runCount = readU322(bytes, entry, ctts.end);
    if (runCount < 1) fail2("invalid-movie");
    samples += BigInt(runCount);
    if (version2 === 1) new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getInt32(entry + 4);
    else readU322(bytes, entry + 4, ctts.end);
  }
  if (samples !== BigInt(sampleCount)) fail2("invalid-movie");
  return version2;
}
function validateSyncSamples(bytes, stss, sampleCount) {
  checkFullBox(bytes, stss, [0], 0);
  const count = readU322(bytes, stss.payloadStart + 4, stss.end);
  if (count < 1 || count > Math.min(sampleCount, MAX_TABLE_ENTRIES)) fail2("invalid-movie");
  const start = stss.payloadStart + 8;
  if (stss.end - start !== count * 4) fail2("invalid-movie");
  let previous = 0;
  for (let index = 0; index < count; index++) {
    const sample = readU322(bytes, start + index * 4, stss.end);
    if (sample <= previous || sample > sampleCount) fail2("invalid-movie");
    if (index === 0 && sample !== 1) fail2("invalid-movie");
    previous = sample;
  }
}
function validateChunkCoverage(sizes, offsets, map, layout, descriptionCount) {
  let sampleIndex = 0;
  let mapIndex = 0;
  const ranges = [];
  for (let chunkIndex = 0; chunkIndex < offsets.length; chunkIndex++) {
    const chunkNumber = chunkIndex + 1;
    while (mapIndex + 1 < map.length && map[mapIndex + 1].firstChunk <= chunkNumber) mapIndex++;
    const entry = map[mapIndex];
    if (!entry || entry.firstChunk > chunkNumber || entry.sampleDescriptionIndex > descriptionCount) fail2("invalid-movie");
    if (sampleIndex + entry.samplesPerChunk > sizes.sampleCount) fail2("invalid-movie");
    let chunkBytes = 0n;
    for (let sample = sampleIndex; sample < sampleIndex + entry.samplesPerChunk; sample++) {
      chunkBytes += BigInt(sizes.sampleSizeAt(sample));
    }
    const chunkStart = BigInt(offsets[chunkIndex]);
    const chunkEnd = chunkStart + chunkBytes;
    if (chunkEnd > BigInt(layout.mdatBodyEnd) || chunkStart < BigInt(layout.mdatBodyStart)) fail2("invalid-movie");
    ranges.push({ start: offsets[chunkIndex], end: Number(chunkEnd) });
    sampleIndex += entry.samplesPerChunk;
  }
  if (sampleIndex !== sizes.sampleCount || map[0].firstChunk !== 1) fail2("invalid-movie");
  ranges.sort((left, right) => left.start - right.start);
  for (let index = 1; index < ranges.length; index++) {
    if (ranges[index - 1].end > ranges[index].start) fail2("invalid-movie");
  }
  return map[0].sampleDescriptionIndex;
}
function readTimescale(bytes, box, version2) {
  const offset = box.payloadStart + (version2 === 0 ? 12 : 20);
  const scale = readU322(bytes, offset, box.end);
  if (scale === 0) fail2("invalid-movie");
  return scale;
}
function checkDurationField(bytes, box, version2, relativeOffset) {
  const width = version2 === 0 ? 4 : 8;
  if (box.end - (box.start + box.headerSize + relativeOffset) < width) fail2("invalid-movie");
  if (version2 === 1) readU64(bytes, box.start + box.headerSize + relativeOffset, box.end);
  else readU322(bytes, box.start + box.headerSize + relativeOffset, box.end);
}
function checkFullBox(bytes, box, versions, flags) {
  if (box.end - box.payloadStart < 4) fail2("invalid-movie");
  const version2 = bytes[box.payloadStart];
  const actualFlags = readFlags(bytes, box);
  if (!versions.includes(version2) || flags !== void 0 && actualFlags !== flags) fail2("invalid-movie");
  return version2;
}
function readFlags(bytes, box) {
  return bytes[box.payloadStart + 1] << 16 | bytes[box.payloadStart + 2] << 8 | bytes[box.payloadStart + 3];
}
function rebuildMovie(bytes, track, movieDuration, chunkOffset) {
  const mvhdVersion = bytes[track.movieHeader.payloadStart];
  const tkhdVersion = bytes[track.trackHeader.payloadStart];
  const mdhdVersion = bytes[track.mediaHeader.payloadStart];
  const mvhd = rewriteDuration(bytes, track.movieHeader, mvhdVersion, mvhdVersion === 0 ? 16 : 24, movieDuration);
  const tkhd = rewriteDuration(bytes, track.trackHeader, tkhdVersion, tkhdVersion === 0 ? 20 : 28, movieDuration);
  const mdhd = rewriteDuration(
    bytes,
    track.mediaHeader,
    mdhdVersion,
    mdhdVersion === 0 ? 16 : 24,
    BigInt(track.firstSampleDuration)
  );
  const stsd = raw(bytes, track.sampleDescription);
  const stts = makeFullBox("stts", concat(u32(1), u32(1), u32(track.firstSampleDuration)));
  const ctts = makeFullBox("ctts", concat(u32(1), u32(1), u32(0)), track.compositionVersion);
  const stss = makeFullBox("stss", concat(u32(1), u32(1)));
  const stsc = makeFullBox("stsc", concat(u32(1), u32(1), u32(1), u32(track.firstSampleDescriptionIndex)));
  const stsz = makeFullBox("stsz", concat(u32(0), u32(1), u32(track.sampleSize.firstSampleSize)));
  const chunkTable = track.chunkType === "stco" ? makeFullBox("stco", concat(u32(1), u32(chunkOffset))) : makeFullBox("co64", concat(u32(1), u64(chunkOffset)));
  if (track.chunkType === "stco" && chunkOffset > U32_MAX) fail2("budget-exceeded");
  const stbl = makeAtom("stbl", concat(stsd, stts, ctts, stss, stsc, stsz, chunkTable));
  const minf = makeAtom("minf", concat(
    raw(bytes, track.videoHeader),
    raw(bytes, track.dataHandler),
    raw(bytes, track.dataInfo),
    stbl
  ));
  const mdia = makeAtom("mdia", concat(mdhd, raw(bytes, track.handler), minf));
  const trak = makeAtom("trak", concat(tkhd, raw(bytes, track.trackAperture), mdia));
  return makeAtom("moov", concat(mvhd, trak));
}
function rewriteDuration(bytes, box, version2, relativeOffset, duration) {
  const result = raw(bytes, box);
  const offset = box.headerSize + relativeOffset;
  if (version2 === 0) {
    if (duration > BigInt(U32_MAX)) fail2("invalid-movie");
    new DataView(result.buffer, result.byteOffset, result.byteLength).setUint32(offset, Number(duration));
  } else {
    new DataView(result.buffer, result.byteOffset, result.byteLength).setBigUint64(offset, duration);
  }
  return result;
}
function durationInMovieScale(duration, movieScale, mediaScale) {
  return (duration * BigInt(movieScale) + BigInt(mediaScale) - 1n) / BigInt(mediaScale);
}
function raw(bytes, atom) {
  return bytes.slice(atom.start, atom.end);
}
function required(atoms2, type) {
  const matches = all(atoms2, type);
  if (matches.length !== 1) fail2("invalid-movie");
  return matches[0];
}
function all(atoms2, type) {
  return atoms2.filter((atom) => atom.type === type);
}
function assertOnly(atoms2, allowed) {
  for (const atom of atoms2) if (!allowed.includes(atom.type)) fail2("invalid-movie");
}
function atoms(bytes, start, end, expectedCount) {
  const result = [];
  let cursor = start;
  while (cursor < end) {
    if (result.length >= MAX_NESTED_ATOMS) fail2("budget-exceeded");
    const atom = atomAt(bytes, cursor, end);
    result.push(atom);
    cursor = atom.end;
    if (expectedCount !== void 0 && result.length > expectedCount) fail2("invalid-movie");
  }
  if (cursor !== end || expectedCount !== void 0 && result.length !== expectedCount) fail2("invalid-movie");
  return result;
}
function atomAt(bytes, start, parentEnd) {
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(parentEnd) || start < 0 || parentEnd > bytes.byteLength || start + 8 > parentEnd) fail2("invalid-movie");
  const size32 = readU322(bytes, start, parentEnd);
  const type = readType2(bytes, start + 4, parentEnd);
  let headerSize = 8;
  let size;
  if (size32 === 1) {
    if (start + 16 > parentEnd) fail2("invalid-movie");
    size = readU64(bytes, start + 8, parentEnd);
    headerSize = 16;
  } else {
    if (size32 === 0) fail2("invalid-movie");
    size = size32;
  }
  if (size < headerSize || start + size > parentEnd || !Number.isSafeInteger(start + size)) fail2("invalid-movie");
  return { type, start, end: start + size, headerSize, payloadStart: start + headerSize };
}
function readType2(bytes, offset, end) {
  if (offset < 0 || offset + 4 > end) fail2("invalid-movie");
  let result = "";
  for (let index = 0; index < 4; index++) {
    const byte = bytes[offset + index];
    if (byte < 32 || byte > 126) fail2("invalid-movie");
    result += String.fromCharCode(byte);
  }
  return result;
}
function readU16(bytes, offset, end) {
  if (offset < 0 || offset + 2 > end) fail2("invalid-movie");
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset);
}
function readU322(bytes, offset, end) {
  if (offset < 0 || offset + 4 > end) fail2("invalid-movie");
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset);
}
function readU64(bytes, offset, end) {
  if (offset < 0 || offset + 8 > end) fail2("invalid-movie");
  const value = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(offset);
  if (value > SAFE_BIGINT) fail2("invalid-movie");
  return Number(value);
}
function checkedAdd(left, right) {
  const result = left + right;
  if (!Number.isSafeInteger(result) || result < 0) fail2("budget-exceeded");
  return result;
}
function concat(...parts) {
  const length = parts.reduce((sum, part) => checkedAdd(sum, part.byteLength), 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}
function u32(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > U32_MAX) fail2("invalid-movie");
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
}
function u64(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail2("invalid-movie");
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value));
  return bytes;
}
function makeAtom(type, payload) {
  const size = checkedAdd(payload.byteLength, 8);
  if (size > U32_MAX || type.length !== 4) fail2("budget-exceeded");
  const result = new Uint8Array(size);
  writeU32(result, 0, size);
  writeTypeBytes(result, 4, type);
  result.set(payload, 8);
  return result;
}
function makeFullBox(type, payload, version2 = 0) {
  return makeAtom(type, concat(new Uint8Array([version2, 0, 0, 0]), payload));
}
function writeU32(bytes, offset, value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > U32_MAX || offset + 4 > bytes.byteLength) fail2("invalid-movie");
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).setUint32(offset, value);
}
function writeType(bytes, offset, type) {
  writeTypeBytes(bytes, offset, type);
}
function writeTypeBytes(bytes, offset, type) {
  if (type.length !== 4 || offset < 0 || offset + 4 > bytes.byteLength) fail2("invalid-movie");
  for (let index = 0; index < 4; index++) bytes[offset + index] = type.charCodeAt(index);
}

// src/host/system-wallpaper-transport.ts
import { spawn as spawn3 } from "node:child_process";
var CURL_PATH = "/usr/bin/curl";
var MAX_HEADER_BYTES = 16 * 1024;
var MAX_STDERR_BYTES = 1024;
var FORCE_TIMEOUT_MS = 2e3;
var START_TIMEOUT_MS = WALLPAPER_LIMITS.helperStartMs;
var REQUEST_TIMEOUT_MS = WALLPAPER_LIMITS.downloadMs;
var HEADER_END = Buffer.from("\r\n\r\n");
var STRONG_ETAG = /^"[\x21\x23-\x7e\x80-\xff]*"$/u;
var RANGE = /^bytes=(0|[1-9]\d*)-(0|[1-9]\d*)$/u;
var CONTENT_RANGE = /^bytes (0|[1-9]\d*)-(0|[1-9]\d*)\/([1-9]\d*)$/u;
var STATUS_LINE = /^HTTP\/(?:1\.[01]|2|3) 206(?: [\x20-\x7e]*)?$/u;
var HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;
var APPLE_VIDEO_URL = /^https:\/\/sylvan\.apple\.com\/itunes-assets\/Aerials[0-9]+\/(?:[A-Za-z0-9._~-]+\/)*[A-Za-z0-9._~-]+\.mov$/u;
var CERTIFICATE_EXIT_CODES = /* @__PURE__ */ new Set([51, 60, 77]);
var SUPPORTED_INIT_KEYS = /* @__PURE__ */ new Set(["body", "headers", "method", "redirect", "signal"]);
var defaultScheduler3 = {
  set: (callback, delayMs) => setTimeout(callback, delayMs),
  clear: (handle) => clearTimeout(handle)
};
var defaultSpawner3 = (file, args, options) => spawn3(file, [...args], options);
function isAppleWallpaperVideoUrl(value) {
  if (typeof value !== "string" || !APPLE_VIDEO_URL.test(value)) return false;
  const path = value.slice("https://sylvan.apple.com".length).split(/[?#]/u, 1)[0] ?? "";
  if (path.split("/").some((segment) => segment === "." || segment === "..")) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname === "sylvan.apple.com" && parsed.username === "" && parsed.password === "" && parsed.port === "" && parsed.search === "" && parsed.hash === "" && parsed.pathname.split("/").every((segment) => segment !== "." && segment !== "..");
  } catch {
    return false;
  }
}
function fetchAppleWallpaperRange(url, init) {
  return defaultRangeFetcher(url, init);
}
function createAppleWallpaperRangeFetcher(options = {}) {
  const spawnProcess = options.spawnProcess ?? defaultSpawner3;
  const scheduler = options.scheduler ?? defaultScheduler3;
  return function fetchRange(url, init) {
    let plan;
    try {
      plan = validateRequest2(url, init);
    } catch (error) {
      return Promise.reject(error);
    }
    if (plan.signal?.aborted) return Promise.reject(new NativeWallpaperFailure("cancelled"));
    const args = curlArgs(url, plan);
    let child;
    try {
      child = spawnProcess(CURL_PATH, args, { stdio: ["ignore", "pipe", "pipe"], shell: false });
    } catch {
      return Promise.reject(new NativeWallpaperFailure("download-failed"));
    }
    return new Promise((resolve2, reject) => {
      let failure;
      let responseHeaders;
      let headerBytes = Buffer.alloc(0);
      let body;
      let bodyBytes = 0;
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let settled = false;
      let sawSpawn = false;
      let startTimer;
      let requestTimer;
      let forceTimer;
      const clearTimer = (handle) => {
        if (handle !== void 0) scheduler.clear(handle);
      };
      const stopTimers = () => {
        clearTimer(startTimer);
        startTimer = void 0;
        clearTimer(requestTimer);
        requestTimer = void 0;
        clearTimer(forceTimer);
        forceTimer = void 0;
      };
      const kill = (signal) => {
        try {
          child.kill(signal);
        } catch {
        }
      };
      const fail3 = (code) => {
        if (failure || settled) return;
        failure = new NativeWallpaperFailure(code);
        clearTimer(startTimer);
        startTimer = void 0;
        clearTimer(requestTimer);
        requestTimer = void 0;
        body = void 0;
        bodyBytes = 0;
        headerBytes = Buffer.alloc(0);
        kill("SIGTERM");
        forceTimer = scheduler.set(() => {
          if (!settled) kill("SIGKILL");
        }, FORCE_TIMEOUT_MS);
      };
      const onAbort = () => fail3("cancelled");
      const onSpawn = () => {
        if (sawSpawn || settled) return;
        sawSpawn = true;
        clearTimer(startTimer);
        startTimer = void 0;
        requestTimer = scheduler.set(() => fail3("download-failed"), REQUEST_TIMEOUT_MS);
      };
      const onProcessError = () => fail3("download-failed");
      const onStdoutError = () => fail3("download-failed");
      const onStderrError = () => fail3("download-failed");
      const appendBody = (bytes) => {
        if (failure || settled || bytes.length === 0) return;
        if (!body || bytes.length > plan.expectedBytes - bodyBytes) {
          fail3("byte-budget-exceeded");
          return;
        }
        bytes.copy(body, bodyBytes);
        bodyBytes += bytes.length;
      };
      const onStdout = (chunk) => {
        if (failure || settled) return;
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        stdoutBytes += bytes.length;
        if (stdoutBytes > MAX_HEADER_BYTES + plan.expectedBytes) {
          fail3("byte-budget-exceeded");
          return;
        }
        if (responseHeaders) {
          appendBody(bytes);
          return;
        }
        const pending = headerBytes.length === 0 ? bytes : Buffer.concat([headerBytes, bytes]);
        const delimiter = pending.indexOf(HEADER_END);
        if (delimiter < 0) {
          if (pending.length > MAX_HEADER_BYTES) {
            fail3("byte-budget-exceeded");
            return;
          }
          headerBytes = pending;
          return;
        }
        const completeHeaderBytes = delimiter + HEADER_END.length;
        if (completeHeaderBytes > MAX_HEADER_BYTES) {
          fail3("byte-budget-exceeded");
          return;
        }
        try {
          responseHeaders = parseResponseHeaders(pending.subarray(0, completeHeaderBytes), plan);
        } catch {
          fail3("download-failed");
          return;
        }
        try {
          body = Buffer.allocUnsafe(plan.expectedBytes);
        } catch {
          fail3("download-failed");
          return;
        }
        headerBytes = Buffer.alloc(0);
        appendBody(pending.subarray(completeHeaderBytes));
      };
      const onStderr = (chunk) => {
        if (failure || settled) return;
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        stderrBytes += bytes.length;
        if (stderrBytes > MAX_STDERR_BYTES) fail3("download-failed");
      };
      const removeListeners = () => {
        plan.signal?.removeEventListener("abort", onAbort);
        child.stdout.off("data", onStdout);
        child.stdout.off("error", onStdoutError);
        child.stderr.off("data", onStderr);
        child.stderr.off("error", onStderrError);
        child.off("spawn", onSpawn);
        child.off("error", onProcessError);
        child.off("close", onClose);
      };
      const onClose = (exitCode, exitSignal) => {
        if (settled) return;
        settled = true;
        stopTimers();
        removeListeners();
        if (!sawSpawn && !failure) failure = new NativeWallpaperFailure("download-failed");
        if (!failure && exitCode !== 0) {
          failure = new NativeWallpaperFailure(exitCode !== null && CERTIFICATE_EXIT_CODES.has(exitCode) ? "download-certificate-failed" : "download-failed");
        }
        if (!failure && exitSignal !== null) failure = new NativeWallpaperFailure("download-failed");
        if (!failure && (!responseHeaders || headerBytes.length > 0 || bodyBytes !== plan.expectedBytes)) {
          failure = new NativeWallpaperFailure("download-failed");
        }
        if (failure || !body) {
          body = void 0;
          reject(failure ?? new NativeWallpaperFailure("download-failed"));
          return;
        }
        const responseBody = body;
        body = void 0;
        const headers = new Headers({
          "content-range": responseHeaders.contentRange,
          "content-length": String(responseHeaders.contentLength),
          etag: responseHeaders.etag
        });
        const encoding = responseHeaders.values.get("content-encoding");
        if (encoding !== void 0) headers.set("content-encoding", encoding);
        resolve2(new Response(responseBody, { status: 206, headers }));
      };
      child.stdout.on("data", onStdout);
      child.stdout.on("error", onStdoutError);
      child.stderr.on("data", onStderr);
      child.stderr.on("error", onStderrError);
      child.on("spawn", onSpawn);
      child.on("error", onProcessError);
      child.on("close", onClose);
      plan.signal?.addEventListener("abort", onAbort, { once: true });
      startTimer = scheduler.set(() => fail3("download-failed"), START_TIMEOUT_MS);
      if (plan.signal?.aborted) onAbort();
    });
  };
}
var defaultRangeFetcher = createAppleWallpaperRangeFetcher();
function validateRequest2(url, init) {
  if (!isAppleWallpaperVideoUrl(url) || !init || typeof init !== "object" || Object.keys(init).some((key) => !SUPPORTED_INIT_KEYS.has(key)) || init.method !== void 0 && init.method !== "GET" || init.redirect !== "error" || init.body !== void 0 && init.body !== null) {
    throw new NativeWallpaperFailure("invalid-request");
  }
  let headers;
  try {
    headers = new Headers(init.headers);
  } catch {
    throw new NativeWallpaperFailure("invalid-request");
  }
  const entries = [...headers.keys()];
  if (entries.some((name) => !["accept-encoding", "if-match", "range"].includes(name)) || headers.get("accept-encoding") !== "identity") {
    throw new NativeWallpaperFailure("invalid-request");
  }
  const match = headers.get("range")?.match(RANGE);
  if (!match) throw new NativeWallpaperFailure("invalid-request");
  const start = Number(match[1]);
  const end = Number(match[2]);
  const expectedBytes = end - start + 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= WALLPAPER_LIMITS.maxVideoSourceLength || !Number.isSafeInteger(expectedBytes) || expectedBytes < 1 || expectedBytes > WALLPAPER_LIMITS.maxVideoSampleBytes) {
    throw new NativeWallpaperFailure("invalid-request");
  }
  const ifMatch = headers.get("if-match") ?? void 0;
  if (ifMatch !== void 0 && !STRONG_ETAG.test(ifMatch)) throw new NativeWallpaperFailure("invalid-request");
  if (headers.get("range") !== `bytes=${start}-${end}`) throw new NativeWallpaperFailure("invalid-request");
  const signal = init.signal ?? void 0;
  if (signal !== void 0 && (typeof signal.aborted !== "boolean" || typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function")) {
    throw new NativeWallpaperFailure("invalid-request");
  }
  return { start, end, expectedBytes, ifMatch, signal };
}
function curlArgs(url, plan) {
  const args = [
    "--disable",
    "--silent",
    "--include",
    "--range",
    `${plan.start}-${plan.end}`,
    "--header",
    "Accept-Encoding: identity"
  ];
  if (plan.ifMatch !== void 0) args.push("--header", `If-Match: ${plan.ifMatch}`);
  args.push(
    "--max-filesize",
    String(plan.expectedBytes),
    "--max-time",
    String(Math.ceil(REQUEST_TIMEOUT_MS / 1e3)),
    "--suppress-connect-headers",
    "--output",
    "-",
    url
  );
  return args;
}
function parseResponseHeaders(bytes, request) {
  const text = bytes.toString("latin1");
  if (!text.endsWith("\r\n\r\n")) throw new NativeWallpaperFailure("download-failed");
  const lines = text.slice(0, -4).split("\r\n");
  const status = lines.shift();
  if (!status || !STATUS_LINE.test(status)) throw new NativeWallpaperFailure("download-failed");
  const values = /* @__PURE__ */ new Map();
  for (const line of lines) {
    const colon = line.indexOf(":");
    if (colon <= 0) throw new NativeWallpaperFailure("download-failed");
    const name = line.slice(0, colon);
    const lowerName = name.toLowerCase();
    const rawValue = line.slice(colon + 1);
    const duplicateIsUnsafe = lowerName.startsWith("content-") || ["etag", "location", "transfer-encoding"].includes(lowerName);
    if (!HEADER_NAME.test(name) || /[\x00-\x08\x0a-\x1f\x7f]/u.test(rawValue) || values.has(lowerName) && duplicateIsUnsafe) {
      throw new NativeWallpaperFailure("download-failed");
    }
    const value = rawValue.replace(/^[ \t]+|[ \t]+$/gu, "");
    if (lowerName === "location") throw new NativeWallpaperFailure("download-failed");
    if (!values.has(lowerName)) values.set(lowerName, value);
  }
  const contentRange = values.get("content-range") ?? "";
  const address = contentRange.match(CONTENT_RANGE);
  const contentLengthText = values.get("content-length") ?? "";
  const contentLength = Number(contentLengthText);
  const etag = values.get("etag") ?? "";
  const encoding = values.get("content-encoding");
  if (!address || Number(address[1]) !== request.start || Number(address[2]) !== request.end || !Number.isSafeInteger(Number(address[3])) || Number(address[3]) <= request.end || Number(address[3]) > WALLPAPER_LIMITS.maxVideoSourceLength || !/^[1-9]\d*$/u.test(contentLengthText) || contentLength !== request.expectedBytes || !STRONG_ETAG.test(etag) || request.ifMatch !== void 0 && etag !== request.ifMatch || encoding !== void 0 && encoding.toLowerCase() !== "identity" || values.has("transfer-encoding")) {
    throw new NativeWallpaperFailure("download-failed");
  }
  return { values, contentRange, contentLength, etag };
}

// src/host/system-wallpaper-download.ts
var APPLE_WALLPAPER_VIDEO_URLS = Object.freeze({
  "system-wallpaper-golden-gate": "https://sylvan.apple.com/itunes-assets/Aerials116/v4/cb/5b/50/cb5b5035-6701-619f-9065-3d7d0e5fbef4/GG_LM_H_v063_240fps-TSA.mov",
  "system-wallpaper-golden-gate-sunset": "https://sylvan.apple.com/itunes-assets/Aerials116/v4/cb/5b/50/cb5b5035-6701-619f-9065-3d7d0e5fbef4/GG_A_SUNSET_MarshallsBeach_c28_v7_24comp_HFR_16Mbps.mov",
  "system-wallpaper-tahoe-day": "https://sylvan.apple.com/itunes-assets/Aerials116/v4/cb/5b/50/cb5b5035-6701-619f-9065-3d7d0e5fbef4/LIGHT02_20250613_V2_sdr_4k_rate12000_240p_t2160_grover74_tsa_MTE-Modified.mov"
});
var CERTIFICATE_REJECTION_CODES = /* @__PURE__ */ new Set([
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "CERT_HAS_EXPIRED",
  "ERR_TLS_CERT_ALTNAME_INVALID"
]);
function downloadAppleWallpaperVideo(id, signal, sourceUrl) {
  return createAppleWallpaperDownloader({ fetcher: fetchAppleWallpaperRange })(id, signal, sourceUrl);
}
function createAppleWallpaperDownloader(options = {}) {
  const fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
  const maxBytes = options.maxBytes ?? WALLPAPER_LIMITS.maxVideoDownloadBytes;
  const timeoutMs = options.timeoutMs ?? WALLPAPER_LIMITS.downloadMs;
  const tempDirectory = options.tempDirectory ?? tmpdir2();
  const removeDirectory = options.removeDirectory ?? ((directory) => rm(directory, { recursive: true, force: true }));
  return async function download(id, signal, sourceUrl) {
    if (!isSystemWallpaperId(id) || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > WALLPAPER_LIMITS.maxVideoDownloadBytes || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new NativeWallpaperFailure("invalid-request");
    if (signal.aborted) throw new NativeWallpaperFailure("cancelled");
    const url = sourceUrl ?? APPLE_WALLPAPER_VIDEO_URLS[id];
    if (!url || !isAppleWallpaperVideoUrl(url)) throw new NativeWallpaperFailure("unavailable");
    let directory;
    let cleanupStarted;
    const cleanupDirectory = () => {
      if (!cleanupStarted) {
        const ownedDirectory = directory;
        cleanupStarted = ownedDirectory ? Promise.resolve().then(() => removeDirectory(ownedDirectory)).then(
          () => void 0,
          () => {
            throw new NativeWallpaperFailure("download-failed");
          }
        ) : Promise.resolve();
      }
      return cleanupStarted;
    };
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      if (controller.signal.aborted) throw new NativeWallpaperFailure("cancelled");
      directory = await mkdtemp(join3(tempDirectory, "pdsh-wallpaper-"));
      const file = join3(directory, "source.mov");
      const rootInfo = await lstat(directory);
      if (!rootInfo.isDirectory() || (rootInfo.mode & 511) !== 448 || typeof process.getuid === "function" && rootInfo.uid !== process.getuid()) {
        throw new NativeWallpaperFailure("download-failed");
      }
      const budget = { received: 0, maxBytes };
      const range = (start, end, total, etag) => readRange(
        fetcher,
        url,
        start,
        end,
        budget,
        controller.signal,
        total,
        etag
      );
      const prefix = await range(0, WALLPAPER_LIMITS.videoHeaderBytes - 1);
      const layout = parseAppleWallpaperMovHeader(prefix.bytes, prefix.total);
      const metadata = await range(layout.moovOffset, layout.sourceLength - 1, prefix.total, prefix.etag);
      const plan = parseAppleWallpaperFirstSample(layout, metadata.bytes);
      const sample = await range(plan.sourceOffset, plan.sourceOffset + plan.sampleSize - 1, prefix.total, prefix.etag);
      checkAbort(controller.signal);
      const movie = plan.rebuild(sample.bytes);
      if (movie.byteLength > WALLPAPER_LIMITS.maxVideoBytes) throw new NativeWallpaperFailure("byte-budget-exceeded");
      await writeFile(file, movie, { flag: "wx", mode: 384, signal: controller.signal });
      checkAbort(controller.signal);
      const info = await lstat(file);
      if (!info.isFile() || info.size !== movie.byteLength || (info.mode & 511) !== 384 || typeof process.getuid === "function" && info.uid !== process.getuid()) {
        throw new NativeWallpaperFailure("download-failed");
      }
      return {
        path: file,
        async cleanup() {
          await cleanupDirectory();
        }
      };
    } catch (error) {
      try {
        await cleanupDirectory();
      } catch {
        throw new NativeWallpaperFailure("download-failed");
      }
      if (signal.aborted) throw new NativeWallpaperFailure("cancelled");
      if (timedOut) throw new NativeWallpaperFailure("download-failed");
      if (isWallpaperFailure(error)) throw error;
      if (error instanceof AppleWallpaperMovError) {
        throw new NativeWallpaperFailure(error.code === "budget-exceeded" ? "byte-budget-exceeded" : "download-failed");
      }
      throw new NativeWallpaperFailure("download-failed");
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    }
  };
}
async function readRange(fetcher, url, start, end, budget, signal, expectedTotal, expectedEtag) {
  checkAbort(signal);
  const expectedBytes = end - start + 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || expectedBytes < 1) {
    throw new NativeWallpaperFailure("download-failed");
  }
  if (expectedBytes > budget.maxBytes - budget.received) throw new NativeWallpaperFailure("byte-budget-exceeded");
  const headers = { Range: `bytes=${start}-${end}`, "Accept-Encoding": "identity" };
  if (expectedEtag !== void 0) headers["If-Match"] = expectedEtag;
  let response;
  try {
    response = await fetcher(url, { method: "GET", redirect: "error", headers, signal });
  } catch (error) {
    if (isCertificateRejection(error)) throw new NativeWallpaperFailure("download-certificate-failed");
    throw error;
  }
  let total;
  let etag;
  try {
    checkAbort(signal);
    const address = response.headers.get("content-range")?.match(/^bytes (0|[1-9]\d*)-(0|[1-9]\d*)\/([1-9]\d*)$/u);
    const encoding = response.headers.get("content-encoding");
    const length = response.headers.get("content-length");
    etag = response.headers.get("etag") ?? "";
    total = Number(address?.[3]);
    if (response.status !== 206 || response.redirected || response.url !== "" && response.url !== url || !response.body || !address || Number(address[1]) !== start || Number(address[2]) !== end || !Number.isSafeInteger(total) || total <= end || expectedTotal !== void 0 && total !== expectedTotal || encoding !== null && encoding.toLowerCase() !== "identity" || length === null || !/^[1-9]\d*$/u.test(length) || Number(length) !== expectedBytes || !/^"[\x21\x23-\x7e\x80-\xff]*"$/u.test(etag) || expectedEtag !== void 0 && etag !== expectedEtag) {
      throw new NativeWallpaperFailure("download-failed");
    }
    if (total > WALLPAPER_LIMITS.maxVideoSourceLength) throw new NativeWallpaperFailure("byte-budget-exceeded");
  } catch (error) {
    await cancelBody(response.body);
    throw error;
  }
  const reader = response.body.getReader();
  let cancellation;
  const cancel = () => cancellation ??= reader.cancel().catch(() => void 0);
  const onAbort = () => {
    void cancel();
  };
  signal.addEventListener("abort", onAbort, { once: true });
  if (signal.aborted) onAbort();
  let completed = false;
  try {
    const bytes = new Uint8Array(expectedBytes);
    let received = 0;
    for (; ; ) {
      checkAbort(signal);
      const part = await reader.read();
      checkAbort(signal);
      if (part.done) break;
      if (!(part.value instanceof Uint8Array) || part.value.byteLength === 0) throw new NativeWallpaperFailure("download-failed");
      received += part.value.byteLength;
      budget.received += part.value.byteLength;
      if (received > expectedBytes || budget.received > budget.maxBytes) throw new NativeWallpaperFailure("byte-budget-exceeded");
      bytes.set(part.value, received - part.value.byteLength);
    }
    if (received !== expectedBytes) throw new NativeWallpaperFailure("download-failed");
    completed = true;
    return { bytes, total, etag };
  } finally {
    signal.removeEventListener("abort", onAbort);
    if (!completed) await cancel();
    else if (cancellation) await cancellation;
    reader.releaseLock();
  }
}
function checkAbort(signal) {
  if (signal.aborted) throw new NativeWallpaperFailure("cancelled");
}
function isCertificateRejection(error) {
  for (const failure of [error, error instanceof Error ? error.cause : void 0]) {
    if (failure instanceof Error && "code" in failure && typeof failure.code === "string" && CERTIFICATE_REJECTION_CODES.has(failure.code)) return true;
  }
  return false;
}
async function cancelBody(body) {
  if (!body) return;
  try {
    await body.cancel();
  } catch {
  }
}
function isWallpaperFailure(error) {
  return error instanceof NativeWallpaperFailure;
}

// src/host/system-wallpaper-catalog.ts
import { createHash as createHash3 } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat as lstat2, open as open2, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute as isAbsolute2, join as join4 } from "node:path";
var EXTENSION_ROOT = "/System/Library/ExtensionKit/Extensions";
var MAX_MANIFEST_BYTES = 4 * 1024 * 1024;
var MAX_EXTENSION_MANIFEST_BYTES = 64 * 1024;
var MAX_ASSETS = 512;
var MAX_CATEGORIES = 32;
var MAX_SUBCATEGORIES = 128;
var MAX_EXTENSION_BUNDLES = 512;
var UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu;
var IDENTIFIER = /^[A-Za-z0-9 -]{1,64}$/u;
var THEME = /^[A-Z][A-Za-z0-9]*$/u;
var KEY_PREFIXES = ["AerialSubcategoryDescription", "AerialSubcategory"];
var LEGACY_VIDEO_IDS = /* @__PURE__ */ new Map([
  ["4DFE24ED-71CC-42D4-9FE8-3B8959B6CC19", "system-wallpaper-golden-gate"],
  ["4207734D-74FE-4F92-B5E1-6EC8DEE24A15", "system-wallpaper-golden-gate-sunset"],
  ["4C108785-A7BA-422E-9C79-B0129F1D5550", "system-wallpaper-tahoe-day"]
]);
var LEGACY_IMAGE_IDS = /* @__PURE__ */ new Map([["Tahoe", "system-wallpaper-tahoe"]]);
async function discoverSystemWallpaperSources(signal) {
  throwIfAborted(signal);
  if (process.platform !== "darwin" || typeof process.getuid !== "function") unavailable();
  const uid = process.getuid();
  const cache = join4(homedir(), "Library", "Application Support", "com.apple.wallpaper", "aerials");
  const manifestDir = join4(cache, "manifest");
  const videoDir = join4(cache, "videos");
  if (!await isDirectory(join4(homedir(), "Library"), uid) || !await isDirectory(join4(homedir(), "Library", "Application Support"), uid) || !await isDirectory(join4(homedir(), "Library", "Application Support", "com.apple.wallpaper"), uid) || !await isDirectory(cache, uid) || !await isDirectory(manifestDir, uid)) unavailable();
  const bytes = await readJsonBytes(join4(manifestDir, "entries.json"), MAX_MANIFEST_BYTES, uid, false, signal);
  if (!bytes) unavailable();
  const providers = await readExtensionProviders(signal);
  const sources = selectSystemWallpaperSources(parseJson(bytes), providers);
  const hasVideoDir = await isDirectory(videoDir, uid);
  const result = [];
  for (const source of sources) {
    throwIfAborted(signal);
    const path = source.sourceType === "video" ? hasVideoDir && source.cacheUUID ? join4(videoDir, `${source.cacheUUID}.mov`) : void 0 : source.imagePath;
    const owner = source.sourceType === "video" ? uid : 0;
    const maximum = source.sourceType === "video" ? WALLPAPER_LIMITS.maxVideoBytes : WALLPAPER_LIMITS.maxSourceImageBytes;
    result.push({ ...source, available: path ? await isOwnedRegularFile(path, owner, maximum, signal) : false });
  }
  throwIfAborted(signal);
  return result;
}
function selectSystemWallpaperSources(manifest, providers) {
  const catalog = parseCatalog(manifest);
  if (!Array.isArray(providers) || providers.length > MAX_EXTENSION_BUNDLES) invalidCatalog();
  const providersByTheme = /* @__PURE__ */ new Map();
  for (const value of providers) {
    if (!isRecord5(value) || typeof value.identifier !== "string" || !IDENTIFIER.test(value.identifier) || typeof value.imagePath !== "string" || !isSafeImagePath(value.imagePath, value.identifier) || value.url !== void 0 && !isAppleWallpaperVideoUrl(value.url)) invalidCatalog();
    const matches = providersByTheme.get(value.identifier) ?? [];
    matches.push(value);
    providersByTheme.set(value.identifier, matches);
  }
  if ([...providersByTheme.values()].some((matches) => matches.length > 1)) invalidCatalog();
  const landscapeCategories = catalog.categories.filter((item) => item.localizedNameKey === "AerialCategoryLandscapes");
  if (landscapeCategories.length !== 1) invalidCatalog();
  const landscape = landscapeCategories[0];
  const groups = [];
  const themes = /* @__PURE__ */ new Set();
  const orders = /* @__PURE__ */ new Set();
  for (const item of landscape.subcategories) {
    const theme = parseThemeKey(item.localizedNameKey);
    const order = requireOrder(item.preferredOrder);
    if (themes.has(theme) || orders.has(order)) invalidCatalog();
    themes.add(theme);
    orders.add(order);
    groups.push({
      id: requireString(item.id, 128),
      theme,
      order,
      representativeAssetID: requireUuid(item.representativeAssetID)
    });
  }
  groups.sort((a, b) => a.order - b.order);
  if (groups.length < 2) unavailable();
  const dynamicCategories = catalog.categories.filter((item) => item.id === "dynamic-aerials");
  if (dynamicCategories.length > 1) invalidCatalog();
  const dynamicCategory = dynamicCategories[0];
  const dynamicGroups = /* @__PURE__ */ new Map();
  for (const item of dynamicCategory?.subcategories ?? []) {
    const theme = parseDynamicTheme(item.localizedNameKey);
    if (theme === void 0) continue;
    const matches = dynamicGroups.get(theme) ?? [];
    matches.push(item);
    dynamicGroups.set(theme, matches);
  }
  const assets = new Map(catalog.assets.map((asset) => [requireUuid(asset.id), asset]));
  const result = [];
  for (const group of groups.slice(0, 2)) {
    const dynamicMatches = dynamicGroups.get(group.theme) ?? [];
    const providerMatches = providersByTheme.get(group.theme) ?? [];
    if (dynamicMatches.length > 1 || providerMatches.length > 1 || dynamicMatches.length && providerMatches.length) invalidCatalog();
    if (dynamicMatches.length) {
      const dynamic = dynamicMatches[0];
      const uuid = requireUuid(dynamic.representativeAssetID);
      const asset = requireMemberAsset(assets, uuid, requireString(dynamicCategory.id, 128), requireString(dynamic.id, 128));
      result.push(videoSource(uuid, displayName(group.theme), videoUrl(asset)));
    } else if (providerMatches.length) {
      result.push(imageSource(providerMatches[0]));
    } else unavailable();
    const landscapeAsset = requireMemberAsset(assets, group.representativeAssetID, requireString(landscape.id, 128), group.id);
    if (!isSystemWallpaperName(landscapeAsset.accessibilityLabel)) invalidCatalog();
    result.push(videoSource(group.representativeAssetID, landscapeAsset.accessibilityLabel, videoUrl(landscapeAsset)));
  }
  const ids = result.map((item) => item.id);
  const urls = result.map((item) => item.url).filter((item) => item !== void 0);
  if (result.length !== WALLPAPER_LIMITS.maxCatalogEntries || new Set(ids).size !== ids.length || new Set(urls).size !== urls.length) invalidCatalog();
  return result;
}
function parseCatalog(input) {
  if (!isRecord5(input) || input.version !== 1 || !Array.isArray(input.assets) || !Array.isArray(input.categories) || input.assets.length > MAX_ASSETS || input.categories.length > MAX_CATEGORIES || !Number.isSafeInteger(input.initialAssetCount) || input.initialAssetCount < 0 || input.initialAssetCount > MAX_ASSETS || typeof input.localizationVersion !== "string" || input.localizationVersion.length < 1 || input.localizationVersion.length > 128) invalidCatalog();
  const assetIds = /* @__PURE__ */ new Set();
  const assets = [];
  for (const entry of input.assets) {
    if (!isRecord5(entry)) invalidCatalog();
    const id = requireUuid(entry.id);
    if (assetIds.has(id)) invalidCatalog();
    assetIds.add(id);
    validateIdList(entry.categories);
    validateIdList(entry.subcategories);
    assets.push(entry);
  }
  const categoryIds = /* @__PURE__ */ new Set();
  const subcategoryIds = /* @__PURE__ */ new Set();
  let childCount = 0;
  const categories = [];
  for (const entry of input.categories) {
    if (!isRecord5(entry) || !Array.isArray(entry.subcategories)) invalidCatalog();
    const id = requireString(entry.id, 128);
    requireString(entry.localizedNameKey, 128);
    requireOrder(entry.preferredOrder);
    if (categoryIds.has(id)) invalidCatalog();
    categoryIds.add(id);
    childCount += entry.subcategories.length;
    if (childCount > MAX_SUBCATEGORIES) invalidCatalog();
    const subcategories = [];
    const childOrders = /* @__PURE__ */ new Set();
    for (const child of entry.subcategories) {
      if (!isRecord5(child)) invalidCatalog();
      const childId = requireString(child.id, 128);
      requireString(child.localizedNameKey, 128);
      const order = requireOrder(child.preferredOrder);
      requireUuid(child.representativeAssetID);
      if (subcategoryIds.has(childId) || childOrders.has(order)) invalidCatalog();
      subcategoryIds.add(childId);
      childOrders.add(order);
      subcategories.push(child);
    }
    categories.push({ ...entry, id, subcategories });
  }
  return { assets, categories };
}
function requireMemberAsset(assets, id, category, subcategory) {
  const asset = assets.get(id);
  if (!asset || !hasId(asset.categories, category) || !hasId(asset.subcategories, subcategory)) invalidCatalog();
  return asset;
}
function videoSource(uuid, name, url) {
  if (!isSystemWallpaperName(name)) invalidCatalog();
  const canonical = uuid.toUpperCase();
  return {
    id: LEGACY_VIDEO_IDS.get(canonical) ?? `system-wallpaper-video-${canonical.toLowerCase()}`,
    name,
    available: false,
    downloadable: url !== void 0,
    sourceType: "video",
    cacheUUID: canonical,
    ...url ? { url } : {}
  };
}
function imageSource(provider) {
  const name = displayName(provider.identifier);
  if (!isSystemWallpaperName(name)) invalidCatalog();
  const identity = provider.url ?? provider.imagePath;
  return {
    id: LEGACY_IMAGE_IDS.get(provider.identifier) ?? `system-wallpaper-image-${createHash3("sha256").update(provider.identifier).update("\0").update(identity).digest("hex")}`,
    name,
    available: false,
    downloadable: provider.url !== void 0,
    sourceType: "image",
    imagePath: provider.imagePath,
    ...provider.url ? { url: provider.url } : {}
  };
}
function parseThemeKey(value) {
  if (typeof value !== "string" || value.length > 128) invalidCatalog();
  for (const prefix of KEY_PREFIXES) {
    if (!value.startsWith(prefix)) continue;
    const theme = value.slice(prefix.length);
    if (!THEME.test(theme)) invalidCatalog();
    return theme;
  }
  return invalidCatalog();
}
function parseDynamicTheme(value) {
  if (typeof value !== "string" || value.length > 128) invalidCatalog();
  const prefix = KEY_PREFIXES.find((item) => value.startsWith(item));
  if (!prefix) return void 0;
  const tail = value.slice(prefix.length);
  if (!tail.endsWith("Graphical")) return void 0;
  const theme = tail.slice(0, -"Graphical".length);
  if (!THEME.test(theme)) invalidCatalog();
  return theme;
}
function displayName(theme) {
  return theme.replace(/([a-z0-9])([A-Z])/gu, "$1 $2");
}
function videoUrl(asset) {
  const value = asset["url-4K-SDR-240FPS"];
  if (value === void 0) return void 0;
  if (!isAppleWallpaperVideoUrl(value)) invalidCatalog();
  return value;
}
function validateIdList(value) {
  if (!Array.isArray(value) || value.length > MAX_CATEGORIES) invalidCatalog();
  const ids = /* @__PURE__ */ new Set();
  for (const item of value) {
    const id = requireString(item, 128);
    if (ids.has(id)) invalidCatalog();
    ids.add(id);
  }
}
function hasId(value, expected) {
  return Array.isArray(value) && value.includes(expected);
}
function requireUuid(value) {
  if (typeof value !== "string" || !UUID.test(value)) invalidCatalog();
  return value.toUpperCase();
}
function requireOrder(value) {
  if (!Number.isSafeInteger(value) || value < -1e5 || value > 1e5) invalidCatalog();
  return value;
}
function requireString(value, max) {
  if (typeof value !== "string" || !value || value.length > max || /\p{Cc}/u.test(value)) invalidCatalog();
  return value;
}
function isRecord5(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isSafeImagePath(path, identifier) {
  const expected = /^\/System\/Library\/ExtensionKit\/Extensions\/[A-Za-z0-9.-]+Wallpaper\.appex\/Contents\/Resources\/([A-Za-z0-9 -]{1,64})Light\.heic$/u;
  const match = path.match(expected);
  return isAbsolute2(path) && path.length <= 1024 && !path.includes("\0") && match?.[1] === identifier;
}
async function readExtensionProviders(signal) {
  throwIfAborted(signal);
  if (!await isDirectory(EXTENSION_ROOT, 0)) return [];
  let entries;
  try {
    entries = await readdir(EXTENSION_ROOT, { withFileTypes: true });
  } catch {
    return [];
  }
  const bundles = entries.filter((item) => item.isDirectory() && item.name.endsWith("Wallpaper.appex") && /^[A-Za-z0-9.-]+\.appex$/u.test(item.name));
  if (bundles.length > MAX_EXTENSION_BUNDLES) invalidCatalog();
  const providers = [];
  for (const item of bundles) {
    throwIfAborted(signal);
    const bundle = join4(EXTENSION_ROOT, item.name);
    const contents = join4(bundle, "Contents");
    const resources = join4(contents, "Resources");
    if (!await isDirectory(bundle, 0) || !await isDirectory(contents, 0) || !await isDirectory(resources, 0)) continue;
    const bytes = await readJsonBytes(join4(resources, "manifest.json"), MAX_EXTENSION_MANIFEST_BYTES, 0, true, signal);
    if (!bytes) continue;
    const manifest = parseJson(bytes);
    if (!isRecord5(manifest) || manifest.version !== 1 || typeof manifest.identifier !== "string" || !IDENTIFIER.test(manifest.identifier)) invalidCatalog();
    const lightUrl = manifest.lightLandscapeRemoteURL;
    if (lightUrl !== void 0 && !isAppleWallpaperVideoUrl(lightUrl)) invalidCatalog();
    const url = typeof lightUrl === "string" ? lightUrl : void 0;
    const imagePath = join4(resources, `${manifest.identifier}Light.heic`);
    if (!isSafeImagePath(imagePath, manifest.identifier)) invalidCatalog();
    providers.push({ identifier: manifest.identifier, imagePath, ...url ? { url } : {} });
  }
  return providers;
}
async function readJsonBytes(path, maximum, owner, missingAllowed, signal) {
  throwIfAborted(signal);
  let handle;
  try {
    handle = await open2(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK);
  } catch (error) {
    if (isMissing(error)) {
      if (missingAllowed) return void 0;
      unavailable();
    }
    unavailable();
  }
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.uid !== owner || before.size <= 0 || before.size > maximum) invalidCatalog();
    const chunks = [];
    let offset = 0;
    while (offset < before.size) {
      throwIfAborted(signal);
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, before.size - offset));
      const read = await handle.read(chunk, 0, chunk.length, offset);
      if (read.bytesRead <= 0) invalidCatalog();
      chunks.push(chunk.subarray(0, read.bytesRead));
      offset += read.bytesRead;
    }
    if (!sameFile(before, await handle.stat()) || offset !== before.size) invalidCatalog();
    return Buffer.concat(chunks, offset);
  } catch (error) {
    if (error instanceof NativeWallpaperFailure) throw error;
    unavailable();
  } finally {
    await handle.close().catch(() => void 0);
  }
}
function parseJson(bytes) {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return invalidCatalog();
  }
}
async function isOwnedRegularFile(path, owner, maximum, signal) {
  throwIfAborted(signal);
  let handle;
  try {
    handle = await open2(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK);
  } catch {
    return false;
  }
  try {
    const info = await handle.stat();
    return info.isFile() && info.uid === owner && info.size > 0 && info.size <= maximum;
  } catch {
    return false;
  } finally {
    await handle.close().catch(() => void 0);
  }
}
async function isDirectory(path, owner) {
  try {
    const info = await lstat2(path);
    return info.isDirectory() && !info.isSymbolicLink() && info.uid === owner;
  } catch {
    return false;
  }
}
function sameFile(before, after) {
  return before.dev === after.dev && before.ino === after.ino && before.uid === after.uid && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs;
}
function isMissing(error) {
  const code = error?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}
function throwIfAborted(signal) {
  if (signal?.aborted) throw new NativeWallpaperFailure("cancelled");
}
function invalidCatalog() {
  throw new NativeWallpaperFailure("protocol-invalid");
}
function unavailable() {
  throw new NativeWallpaperFailure("unavailable");
}

// src/host/runtime-capabilities-service.ts
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
var _wallpaper_dec, _wallpaperRegistered_dec, _implementationVersion_dec, _a, _init;
var RuntimeCapabilitiesService = class extends (_a = TypertRemoteService, _implementationVersion_dec = [Remote], _wallpaperRegistered_dec = [Remote], _wallpaper_dec = [Remote({ mode: "stream" })], _a) {
  constructor(ctx, implementation) {
    super(ctx, "pdshRuntimeCapabilities", { namespace: "pdshRuntimeCapabilities" });
    this.implementation = implementation;
    __runInitializers(_init, 5, this);
    __publicField(this, "disposed", false);
    this.ctx.effect(() => () => {
      this.disposed = true;
    }, "pdsh runtime capabilities: revoke calls");
  }
  async implementationVersion() {
    if (this.disposed) throw new Error("capture-runtime-unavailable");
    return this.implementation.version;
  }
  wallpaperRegistered() {
    return !this.disposed;
  }
  wallpaper(request, signal) {
    const owner = this;
    return { async *[Symbol.asyncIterator]() {
      if (owner.disposed) {
        yield { type: "terminal", status: "disposed" };
        return;
      }
      yield* owner.implementation.wallpaper(request, signal);
    } };
  }
};
_init = __decoratorStart(_a);
__decorateElement(_init, 1, "implementationVersion", _implementationVersion_dec, RuntimeCapabilitiesService);
__decorateElement(_init, 1, "wallpaperRegistered", _wallpaperRegistered_dec, RuntimeCapabilitiesService);
__decorateElement(_init, 1, "wallpaper", _wallpaper_dec, RuntimeCapabilitiesService);
__decoratorMetadata(_init, RuntimeCapabilitiesService);

// lib/runtime-capabilities/typert.host.js
import { z } from "zod";
var _daftai_pdsh_capabilities_pdshRuntimeCapabilities_implementationVersion_result$schema$value;
var _daftai_pdsh_capabilities_pdshRuntimeCapabilities_implementationVersion_result$schema = () => _daftai_pdsh_capabilities_pdshRuntimeCapabilities_implementationVersion_result$schema$value ??= z.string();
var _daftai_pdsh_capabilities_pdshRuntimeCapabilities_wallpaper_parameter_0$schema$value;
var _daftai_pdsh_capabilities_pdshRuntimeCapabilities_wallpaper_parameter_0$schema = () => _daftai_pdsh_capabilities_pdshRuntimeCapabilities_wallpaper_parameter_0$schema$value ??= z.union([z.object({
  "kind": z.literal("list")
}), z.object({
  "kind": z.literal("load"),
  "id": z.string()
})]);
var _daftai_pdsh_capabilities_pdshRuntimeCapabilities_wallpaper_result$schema$value;
var _daftai_pdsh_capabilities_pdshRuntimeCapabilities_wallpaper_result$schema = () => _daftai_pdsh_capabilities_pdshRuntimeCapabilities_wallpaper_result$schema$value ??= z.union([z.object({
  "type": z.literal("catalog"),
  "entries": z.array(z.object({
    "id": z.string(),
    "name": z.string(),
    "available": z.boolean(),
    "downloadable": z.boolean()
  }))
}), z.object({
  "type": z.literal("phase"),
  "phase": z.union([z.literal("downloading"), z.literal("decoding")])
}), z.object({
  "type": z.literal("image"),
  "id": z.string(),
  "sourceType": z.union([z.literal("image"), z.literal("video")]),
  "width": z.number(),
  "height": z.number(),
  "jpegBytes": z.number(),
  "chunkCount": z.number()
}), z.object({
  "type": z.literal("chunk"),
  "index": z.number(),
  "base64": z.string()
}), z.object({
  "type": z.literal("terminal"),
  "status": z.union([z.literal("cancelled"), z.literal("busy"), z.literal("disposed"), z.literal("byte-budget-exceeded"), z.literal("helper-failed"), z.literal("invalid-request"), z.literal("listed"), z.literal("loaded"), z.literal("unsupported-platform"), z.literal("not-enabled"), z.literal("unavailable"), z.literal("download-failed"), z.literal("download-certificate-failed"), z.literal("decode-failed"), z.literal("protocol-invalid")])
})]);
var _daftai_pdsh_capabilities_pdshRuntimeCapabilities_wallpaperRegistered_result$schema$value;
var _daftai_pdsh_capabilities_pdshRuntimeCapabilities_wallpaperRegistered_result$schema = () => _daftai_pdsh_capabilities_pdshRuntimeCapabilities_wallpaperRegistered_result$schema$value ??= z.boolean();
var TYPERT = {
  package: "@daftai/pdsh-capabilities",
  face: "host",
  schemas: [],
  invocations: [
    {
      id: "@daftai/pdsh-capabilities#pdshRuntimeCapabilities/implementationVersion",
      service: "pdshRuntimeCapabilities",
      namespace: "pdshRuntimeCapabilities",
      method: "implementationVersion",
      invocation: { kind: "direct" },
      parameters: [],
      result: {
        mode: "strict",
        typeSymbol: "@daftai/pdsh-capabilities#pdshRuntimeCapabilities/implementationVersion:result",
        create: _daftai_pdsh_capabilities_pdshRuntimeCapabilities_implementationVersion_result$schema
      },
      sourceLocation: { "file": "packages/pdsh-capabilities/src/host/runtime-capabilities-service.ts", "line": 26, "column": 9 }
    },
    {
      id: "@daftai/pdsh-capabilities#pdshRuntimeCapabilities/wallpaper",
      service: "pdshRuntimeCapabilities",
      namespace: "pdshRuntimeCapabilities",
      method: "wallpaper",
      mode: "stream",
      invocation: { kind: "direct" },
      parameters: [
        {
          name: "request",
          wire: "request",
          source: "json",
          codec: {
            mode: "strict",
            typeSymbol: "@daftai/pdsh-capabilities/types#WallpaperRequest",
            create: _daftai_pdsh_capabilities_pdshRuntimeCapabilities_wallpaper_parameter_0$schema
          }
        }
      ],
      cancellation: { parameter: "signal" },
      result: {
        mode: "strict",
        typeSymbol: "@daftai/pdsh-capabilities/types#WallpaperFrame",
        create: _daftai_pdsh_capabilities_pdshRuntimeCapabilities_wallpaper_result$schema
      },
      sourceLocation: { "file": "packages/pdsh-capabilities/src/host/runtime-capabilities-service.ts", "line": 36, "column": 3 }
    },
    {
      id: "@daftai/pdsh-capabilities#pdshRuntimeCapabilities/wallpaperRegistered",
      service: "pdshRuntimeCapabilities",
      namespace: "pdshRuntimeCapabilities",
      method: "wallpaperRegistered",
      invocation: { kind: "direct" },
      parameters: [],
      result: {
        mode: "strict",
        typeSymbol: "@daftai/pdsh-capabilities#pdshRuntimeCapabilities/wallpaperRegistered:result",
        create: _daftai_pdsh_capabilities_pdshRuntimeCapabilities_wallpaperRegistered_result$schema
      },
      sourceLocation: { "file": "packages/pdsh-capabilities/src/host/runtime-capabilities-service.ts", "line": 33, "column": 3 }
    }
  ],
  model: {
    "services": [],
    "events": [],
    "objects": []
  }
};

// src/host/capture-runtime.ts
var CAPTURE_TERMINAL_CODES = new Set(CAPTURE_FAILURE_CODES);
function logCaptureObservation(ctx, event, value) {
  try {
    const logger = ctx.logger;
    if (!logger?.info) return;
    if (event === "service-mounted" || event === "enabled") {
      logger.info(`PDSH capture event=${event} enabled=%s`, value === true);
      return;
    }
    if (event === "invocation") {
      logger.info("PDSH capture event=invocation");
      return;
    }
    if (event === "phase") {
      if (value === "authorization-required" || value === "capture-ready") {
        logger.info("PDSH capture event=phase phase=%s", value);
      }
      return;
    }
    if (event === "native-result") {
      const code2 = nativeFailureCode(value);
      logger.info("PDSH capture event=native-result code=%s", code2);
      return;
    }
    const code = value === "captured" || typeof value === "string" && CAPTURE_TERMINAL_CODES.has(value) ? value : "helper-failed";
    logger.info("PDSH capture event=terminal code=%s", code);
  } catch {
  }
}
function nativeFailureCode(error) {
  try {
    const code = error && typeof error === "object" ? error.code : void 0;
    return isNativeCaptureFailureCode(code) ? code : "helper-failed";
  } catch {
    return "helper-failed";
  }
}
async function* observeCaptureFrames(frames, ctx) {
  for await (const frame of frames) {
    if (frame.type === "phase") logCaptureObservation(ctx, "phase", frame.phase);
    else if (frame.type === "terminal") logCaptureObservation(ctx, "terminal", frame.status);
    yield frame;
  }
}
var version = "0.5.3";
var contract = CAPTURE_RUNTIME_CONTRACT;
var wallpaperContract = CAPTURE_WALLPAPER_CONTRACT;
function create(ctx) {
  const runtime = new CaptureRuntime(ctx);
  return Object.defineProperty(runtime, "then", {
    configurable: true,
    value(resolve2, reject) {
      return runtime.ready.then(() => {
        delete runtime.then;
        return resolve2(runtime);
      }, reject);
    }
  });
}
var CaptureRuntime = class {
  constructor(ctx) {
    this.ctx = ctx;
    const serviceContext = this.ctx;
    const enabled = acceptedWindowSavePreferences(serviceContext).captureEnabled === true;
    this.lifetime.setEnabled(enabled);
    logCaptureObservation(this.ctx, "service-mounted", enabled);
    if (!Context.is(ctx) || !ctx.get("typert")) {
      this.ready = Promise.resolve();
      return;
    }
    this.capabilities = ctx.plugin({
      name: "pdsh-runtime-capabilities",
      inject: ["typert", "settings"],
      apply: (child) => {
        child.typert.register(TYPERT);
        new RuntimeCapabilitiesService(child, this);
      }
    });
    this.ready = this.capabilities.await().then(() => void 0).catch(async () => {
      await this.capabilities?.dispose();
      try {
        ctx.get("logger")?.warn("PDSH runtime capabilities unavailable.");
      } catch {
      }
    });
  }
  version = version;
  ready;
  lifetime = createCaptureServiceLifetime();
  saveBackend = createWindowSaveBackend({
    preferences: () => acceptedWindowSavePreferences(this.ctx)
  });
  disposal;
  capabilities;
  /** 权限只在该 Remote iterable 首次被拉取时经原生 helper 请求。 */
  capture(signal) {
    if (this.version !== version) throw new Error("capture-runtime-version-mismatch");
    this.refreshCaptureEnabled();
    const serviceContext = this.ctx;
    logCaptureObservation(serviceContext, "invocation");
    const frames = createCaptureFrameStream({
      signal,
      lifetimeSignal: this.lifetime.signal,
      reserve: () => this.lifetime.reserve(),
      capture: ({ signal: operationSignal, onPhase }) => {
        const clickCapture = createClickCapture({
          runner: (options) => runNativeCapture({
            ...options,
            helperPath: resolveNativeCaptureHelperPath(process.platform, process.arch, new URL("../../index.js", import.meta.url).href),
            platform: process.platform,
            arch: process.arch,
            onPhase
          })
        });
        return clickCapture.capture(operationSignal).catch((error) => {
          logCaptureObservation(serviceContext, "native-result", error);
          throw error;
        }).finally(() => clickCapture.dispose());
      }
    });
    return observeCaptureFrames(frames, serviceContext);
  }
  /** 保存仅接受当前 Config 目录与模板；wire 不含 path/name，像素走有界 uplink。 */
  save(request, signal, uplink) {
    this.refreshCaptureEnabled();
    return this.saveBackend.save(request, {
      signal,
      lifetimeSignal: this.lifetime.signal,
      uplink
    });
  }
  /** 列表只读系统目录；素材只在明确load后按固定ID取回并像素化。 */
  wallpaper(request, signal) {
    if (this.version !== version) throw new Error("capture-runtime-version-mismatch");
    this.refreshCaptureEnabled();
    const helperPath = resolveSystemWallpaperHelperPath(
      process.platform,
      process.arch,
      new URL("../../index.js", import.meta.url).href
    );
    return createSystemWallpaperStream({
      request,
      signal,
      lifetimeSignal: this.lifetime.signal,
      platform: process.platform,
      enabled: () => acceptedWindowSavePreferences(this.ctx).captureEnabled === true,
      disposed: () => Boolean(this.disposal),
      reserve: () => this.lifetime.reserve(),
      list: async (operationSignal) => {
        if (!helperPath) throw new NativeWallpaperFailure("unavailable");
        const sources = await discoverSystemWallpaperSources(operationSignal);
        return sources.map(({ id, name, available, downloadable }) => ({ id, name, available, downloadable }));
      },
      load: (id, operationSignal, onPhase) => this.loadWallpaperImage(id, operationSignal, onPhase, helperPath)
    });
  }
  async loadWallpaperImage(id, signal, onPhase, helperPath) {
    if (!helperPath) throw new NativeWallpaperFailure("unavailable");
    const sources = await discoverSystemWallpaperSources(signal);
    const source = sources.find((entry) => entry.id === id);
    if (!source) throw new NativeWallpaperFailure("invalid-request");
    try {
      return await runNativeWallpaperImage(id, {
        signal,
        helperPath,
        platform: process.platform,
        arch: process.arch,
        ...source.imagePath ? { systemImagePath: source.imagePath } : {}
      });
    } catch (error) {
      if (!(error instanceof NativeWallpaperFailure) || error.code !== "download-required") throw error;
    }
    if (!source.downloadable || !source.url) throw new NativeWallpaperFailure("unavailable");
    onPhase("downloading");
    const video = await downloadAppleWallpaperVideo(id, signal, source.url);
    try {
      if (signal.aborted) throw new NativeWallpaperFailure("cancelled");
      onPhase("decoding");
      return await runNativeWallpaperImage(id, {
        signal,
        helperPath,
        platform: process.platform,
        arch: process.arch,
        videoPath: video.path
      });
    } finally {
      await video.cleanup();
    }
  }
  /** 显式调用先核对 accepted 设置；owner-scoped listener 继续负责在途同步撤权。 */
  refreshCaptureEnabled() {
    if (this.disposal) return;
    const preferences = acceptedWindowSavePreferences(this.ctx);
    const enabled = preferences.captureEnabled === true;
    this.lifetime.setEnabled(enabled);
    logCaptureObservation(this.ctx, "enabled", enabled);
  }
  dispose() {
    if (!this.disposal) {
      this.disposal = Promise.all([this.lifetime.dispose(), this.saveBackend.dispose()]).then(async () => {
        await this.capabilities?.dispose();
      });
    }
    return this.disposal;
  }
};
function acceptedWindowSavePreferences(ctx) {
  const accepted = ctx.settings.describe().find((section) => section.ns === ROOT_ENTRY_ID)?.value;
  const read = (field) => {
    if (field && typeof field === "object" && "get" in field && typeof field.get === "function") return field.get();
    return field;
  };
  return {
    captureEnabled: read(accepted?.captureEnabled),
    saveDirectory: read(accepted?.saveDirectory),
    saveFormat: read(accepted?.saveFormat),
    fileNamePattern: read(accepted?.fileNamePattern)
  };
}
export {
  CaptureRuntime,
  contract,
  create,
  version,
  wallpaperContract
};
