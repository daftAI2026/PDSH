/**
 * [INPUT]: src/host/index.ts 与官方 Typert service，由 build.ts 生成。
 * [OUTPUT]: 唯一 pdsh Config/name/apply 与 owned-window capture/save。
 * [POS]: 单包运行产物；PDSH build "0.3.1"，不手工修改。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __knownSymbol = (name2, symbol) => (symbol = Symbol[name2]) ? symbol : Symbol.for("Symbol." + name2);
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __decoratorStart = (base) => [, , , __create(base?.[__knownSymbol("metadata")] ?? null)];
var __decoratorStrings = ["class", "method", "getter", "setter", "accessor", "field", "value", "get", "set"];
var __expectFn = (fn) => fn !== void 0 && typeof fn !== "function" ? __typeError("Function expected") : fn;
var __decoratorContext = (kind, name2, done, metadata, fns) => ({ kind: __decoratorStrings[kind], name: name2, metadata, addInitializer: (fn) => done._ ? __typeError("Already initialized") : fns.push(__expectFn(fn || null)) });
var __decoratorMetadata = (array, target) => __defNormalProp(target, __knownSymbol("metadata"), array[3]);
var __runInitializers = (array, flags, self, value) => {
  for (var i = 0, fns = array[flags >> 1], n = fns && fns.length; i < n; i++) flags & 1 ? fns[i].call(self) : value = fns[i].call(self, value);
  return value;
};
var __decorateElement = (array, flags, name2, decorators, target, extra) => {
  var fn, it, done, ctx, access, k = flags & 7, s = !!(flags & 8), p = !!(flags & 16);
  var j = k > 3 ? array.length + 1 : k ? s ? 1 : 2 : 0, key = __decoratorStrings[k + 5];
  var initializers = k > 3 && (array[j - 1] = []), extraInitializers = array[j] || (array[j] = []);
  var desc = k && (!p && !s && (target = target.prototype), k < 5 && (k > 3 || !p) && __getOwnPropDesc(k < 4 ? target : { get [name2]() {
    return __privateGet(this, extra);
  }, set [name2](x) {
    return __privateSet(this, extra, x);
  } }, name2));
  k ? p && k < 4 && __name(extra, (k > 2 ? "set " : k > 1 ? "get " : "") + name2) : __name(target, name2);
  for (var i = decorators.length - 1; i >= 0; i--) {
    ctx = __decoratorContext(k, name2, done = {}, array[3], extraInitializers);
    if (k) {
      ctx.static = s, ctx.private = p, access = ctx.access = { has: p ? (x) => __privateIn(target, x) : (x) => name2 in x };
      if (k ^ 3) access.get = p ? (x) => (k ^ 1 ? __privateGet : __privateMethod)(x, target, k ^ 4 ? extra : desc.get) : (x) => x[name2];
      if (k > 2) access.set = p ? (x, y) => __privateSet(x, target, y, k ^ 4 ? extra : desc.set) : (x, y) => x[name2] = y;
    }
    it = (0, decorators[i])(k ? k < 4 ? p ? extra : desc[key] : k > 4 ? void 0 : { get: desc.get, set: desc.set } : target, ctx), done._ = 1;
    if (k ^ 4 || it === void 0) __expectFn(it) && (k > 4 ? initializers.unshift(it) : k ? p ? extra = it : desc[key] = it : target = it);
    else if (typeof it !== "object" || it === null) __typeError("Object expected");
    else __expectFn(fn = it.get) && (desc.get = fn), __expectFn(fn = it.set) && (desc.set = fn), __expectFn(fn = it.init) && initializers.unshift(fn);
  }
  return k || __decoratorMetadata(array, target), desc && __defProp(target, name2, desc), p ? k ^ 4 ? extra : desc : target;
};
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateIn = (member, obj) => Object(obj) !== obj ? __typeError('Cannot use the "in" operator on this value') : member.has(obj);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

// src/host/index.ts
import z2 from "@deepseek-ai/schemastery";
import { lstatSync } from "node:fs";

// src/shared/model.ts
import { blobatarUri } from "blobatar/uri";
var MAX_NAME_CHARS = 64;
var MAX_AVATAR_CHARS = 8 * 1024 * 1024;
var NICKNAME_PATTERN = /^(?![\s\S]*\p{Cc})(?=[\s\S]*\S)[\s\S]+$/u;
var LOCAL_AVATAR_PATTERN = /^(?:|data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2})$/;
var DEFAULTS = Object.freeze({
  maskTitles: false,
  maskIdentity: false,
  useAccountAvatar: false,
  nickname: "\u4E34\u65F6\u8BBF\u5BA2",
  avatar: ""
});

// src/host/capture.ts
import { homedir } from "node:os";
import { join } from "node:path";
import z from "@deepseek-ai/schemastery";

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

// src/host/capture.ts
var INITIAL_SAVE_DIRECTORY = join(homedir(), "Downloads");
var ROOT_NAMESPACE = "pdsh";
var CAPTURE_CONFIG_FIELDS = {
  captureEnabled: z.boolean().default(true).description("Enable owned-window capture / \u542F\u7528\u6240\u5C5E\u7A97\u53E3\u62CD\u6444").volatile(),
  captureMaskIdentity: z.boolean().default(true).description("Mask sidebar avatar and name in captures / \u622A\u56FE\u65F6\u906E\u6321\u5934\u50CF\u548C\u540D\u79F0").volatile(),
  saveBehavior: z.union(["ask", "direct"]).default(DEFAULT_CAPTURE_EXPORT.saveBehavior).volatile(),
  saveDirectory: z.string().pattern(CAPTURE_SAVE_DIRECTORY_PATTERN).default(INITIAL_SAVE_DIRECTORY).volatile(),
  saveFormat: z.union(["png", "jpeg", "webp"]).default(DEFAULT_CAPTURE_EXPORT.saveFormat).volatile(),
  fileNamePattern: z.string().pattern(CAPTURE_FILE_NAME_PATTERN).default(DEFAULT_CAPTURE_EXPORT.fileNamePattern).volatile()
};
async function normalizeLegacyCaptureExport(ctx, isDisposed = () => false) {
  await ctx.root.loader.await();
  if (isDisposed()) return;
  const section = ctx.settings.describe().find((view) => view.ns === ROOT_NAMESPACE);
  if (!section) return;
  const operations = [];
  if (section.value?.saveDirectory === "") operations.push({ op: "set", path: ["saveDirectory"], value: INITIAL_SAVE_DIRECTORY });
  if (section.value?.fileNamePattern === "DSH {date} at {time}") {
    operations.push({ op: "set", path: ["fileNamePattern"], value: DEFAULT_CAPTURE_EXPORT.fileNamePattern });
  }
  if (operations.length && !isDisposed()) await ctx.settings.mutate(ROOT_NAMESPACE, operations, section.revision);
}
function observeCaptureEnabled(ctx) {
  return ctx.on("loader/volatile-update", (paths) => {
    if (paths.some((path) => path.length === 1 && path[0] === "captureEnabled")) {
      ctx.get("pdshWindowCapture")?.refreshCaptureEnabled();
    }
  });
}
function apply(ctx) {
  ctx.inject(["settings"], (settings) => {
    settings.effect(() => {
      let disposed = false;
      void normalizeLegacyCaptureExport(settings, () => disposed).catch(() => {
        if (!disposed) settings.logger?.warn?.("PDSH export defaults were not updated; accepted preferences remain unchanged.");
      });
      return () => {
        disposed = true;
      };
    });
  });
}

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
function shouldRegisterNativeCaptureProvider(platform, arch, isPackagedFile, bundleUrl = import.meta.url) {
  if (platform === "darwin") return true;
  if (platform !== "win32" || arch !== "x64") return false;
  const helperPath = resolveNativeCaptureHelperPath(platform, arch, bundleUrl);
  if (!helperPath) return false;
  try {
    return isPackagedFile(helperPath);
  } catch {
    return false;
  }
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
  const fail = () => {
    throw new CaptureFailure("invalid-png");
  };
  const depths = {
    0: [1, 2, 4, 8, 16],
    2: [8, 16],
    3: [1, 2, 4, 8],
    4: [8, 16],
    6: [8, 16]
  };
  if (!depths[png[25]]?.includes(png[24]) || png[26] !== 0 || png[27] !== 0 || ![0, 1].includes(png[28])) fail();
  let offset = 8;
  let count = 0;
  let palette = false;
  let seenData = false;
  let dataEnded = false;
  let dataBytes = 0;
  while (offset < png.length) {
    if (++count > MAX_PNG_CHUNKS || png.length - offset < 12) fail();
    const length = png.readUInt32BE(offset);
    const end = offset + length + 12;
    if (end > png.length) fail();
    const typeBytes = png.subarray(offset + 4, offset + 8);
    if (!typeBytes.every((byte) => byte >= 65 && byte <= 90 || byte >= 97 && byte <= 122) || (typeBytes[2] & 32) !== 0 || crc32(png.subarray(offset + 4, end - 4)) !== png.readUInt32BE(end - 4)) fail();
    const type = typeBytes.toString("ascii");
    if (count === 1) {
      if (type !== "IHDR" || length !== 13) fail();
    } else if (type === "IHDR") fail();
    else if (type === "PLTE") {
      if (palette || seenData || length < 3 || length > 768 || length % 3) fail();
      palette = true;
    } else if (type === "IDAT") {
      if (dataEnded) fail();
      seenData = true;
      dataBytes += length;
    } else if (type === "IEND") {
      if (length || !seenData || !dataBytes || end !== png.length || png[25] === 3 && !palette) fail();
      return size;
    } else {
      if (seenData) dataEnded = true;
      if (/^[A-Z]/.test(type) || ["acTL", "fcTL", "fdAT"].includes(type)) fail();
    }
    offset = end;
  }
  return fail();
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
  return new Promise((resolve, reject) => {
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
    const fail = (code) => {
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
      timer = scheduler.set(() => fail(code), delay);
    };
    const abort = () => fail("cancelled");
    const receivePhase = (value) => {
      if (value === "authorization-required" && phase === void 0) {
        phase = value;
        clearBudget();
      } else if (value === "capture-ready" && phase !== "capture-ready") {
        phase = value;
        startBudget(CAPTURE_TIMEOUT, "capture-timeout");
      } else {
        fail("helper-protocol-invalid");
        return;
      }
      try {
        onPhase?.(value);
      } catch {
        fail("helper-protocol-invalid");
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
          fail("helper-protocol-invalid");
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
        fail("byte-budget-exceeded");
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
    const error = () => fail("helper-start-failed");
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
        resolve({
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
      const done = new Promise((resolve) => {
        finish = resolve;
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

// src/host/window-capture-service.ts
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

// src/host/window-save-backend.ts
import { createHash as createHash2 } from "node:crypto";
import { isAbsolute, join as join3, normalize } from "node:path";

// src/shared/capture-bridge.ts
var MAX_PAGE_PIXELS = 16e6;
var MAX_PNG_BYTES = MAX_PAGE_PIXELS * 8;
function isCaptureId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// src/host/page-save-file.ts
import { open, rename, link, unlink } from "node:fs/promises";
import { basename, dirname, extname, join as join2 } from "node:path";
import { randomBytes } from "node:crypto";
var MAX_NAME_ATTEMPTS = 1e3;
async function commitImage(target, bytes, commit) {
  const temporary = join2(dirname(target), `.pdsh-save-${randomBytes(16).toString("hex")}.tmp`);
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
      const candidate = attempt ? join2(dirname(target), `${stem} (${attempt})${extension}`) : target;
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
    let resolve;
    const settled = new Promise((done2) => {
      resolve = done2;
    });
    const active = { requestId, aborter, settled, generator: getGenerator(), removeAborters, resolve };
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
      const target = join3(accepted.saveDirectory, fileName);
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
      resolve();
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
      await new Promise((resolve) => {
        wake = resolve;
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

// src/host/window-capture-service.ts
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
var _save_dec, _capture_dec, _a, _init;
var WindowCaptureService = class extends (_a = TypertRemoteService, _capture_dec = [Remote({ mode: "stream" })], _save_dec = [Remote({ mode: "stream" })], _a) {
  constructor(ctx) {
    super(ctx, "pdshWindowCapture", { namespace: "pdshNativeWindowCapture" });
    __runInitializers(_init, 5, this);
    __publicField(this, "lifetime", createCaptureServiceLifetime());
    __publicField(this, "saveBackend", createWindowSaveBackend({
      preferences: () => acceptedWindowSavePreferences(this.ctx)
    }));
    __publicField(this, "disposal");
    const serviceContext = this.ctx;
    const enabled = acceptedWindowSavePreferences(serviceContext).captureEnabled === true;
    this.lifetime.setEnabled(enabled);
    logCaptureObservation(this.ctx, "service-mounted", enabled);
    serviceContext.effect(() => () => this.dispose(), "pdsh-window-capture: close streams and helper");
  }
  capture(signal) {
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
            helperPath: resolveNativeCaptureHelperPath(process.platform, process.arch, import.meta.url),
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
  save(request, signal) {
    const ctx = this.ctx;
    const invocation = ctx.invocation;
    if (!invocation) throw new Error("Window save requires an active Remote invocation");
    return this.saveBackend.save(request, {
      signal,
      lifetimeSignal: this.lifetime.signal,
      uplink: invocation.uplink()
    });
  }
  /** 由 Config owner 的 owner-scoped volatile listener 同步调用。 */
  refreshCaptureEnabled() {
    const preferences = acceptedWindowSavePreferences(this.ctx);
    const enabled = preferences.captureEnabled === true;
    this.lifetime.setEnabled(enabled);
    logCaptureObservation(this.ctx, "enabled", enabled);
  }
  dispose() {
    if (!this.disposal) {
      this.disposal = Promise.all([this.lifetime.dispose(), this.saveBackend.dispose()]).then(() => void 0);
    }
    return this.disposal;
  }
};
_init = __decoratorStart(_a);
__decorateElement(_init, 1, "capture", _capture_dec, WindowCaptureService);
__decorateElement(_init, 1, "save", _save_dec, WindowCaptureService);
__decoratorMetadata(_init, WindowCaptureService);
__publicField(WindowCaptureService, "inject", ["typert", "settings"]);
function acceptedWindowSavePreferences(ctx) {
  const accepted = ctx.settings.describe().find((section) => section.ns === "pdsh")?.value;
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

// src/host/index.ts
var name = "pdsh";
var Config = z2.object({
  maskTitles: z2.boolean().default(DEFAULTS.maskTitles).description("Mask sidebar titles / \u906E\u6321\u4FA7\u680F\u6807\u9898").volatile(),
  maskIdentity: z2.boolean().default(DEFAULTS.maskIdentity).description("Local display alias only / \u4EC5\u66FF\u6362\u663E\u793A\u8EAB\u4EFD").volatile(),
  useAccountAvatar: z2.boolean().default(DEFAULTS.useAccountAvatar).description("Keep native account avatar / \u4F7F\u7528\u8D26\u53F7\u539F\u59CB\u5934\u50CF").volatile(),
  nickname: z2.string().max(MAX_NAME_CHARS).pattern(NICKNAME_PATTERN).default(DEFAULTS.nickname).description("Display nickname / \u663E\u793A\u6635\u79F0").volatile(),
  avatar: z2.string().max(MAX_AVATAR_CHARS).pattern(LOCAL_AVATAR_PATTERN).default("").description("Local raster data URL; empty generates avatar / \u672C\u5730\u56FE\u7247\uFF0C\u7559\u7A7A\u751F\u6210\u5934\u50CF").volatile(),
  ...CAPTURE_CONFIG_FIELDS
});
function apply2(ctx, config) {
  ctx.inject(["settings"], (child) => child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)));
  apply(ctx);
  if (shouldRegisterNativeCaptureProvider(process.platform, process.arch, (path) => {
    try {
      return lstatSync(path).isFile();
    } catch {
      return false;
    }
  }, import.meta.url)) ctx.plugin(WindowCaptureService);
  observeCaptureEnabled(ctx);
}
export {
  Config,
  WindowCaptureService,
  apply2 as apply,
  name
};
