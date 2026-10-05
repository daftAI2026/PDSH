/**
 * [INPUT]: src/host/index.ts 与官方 Typert service，由 build.ts 生成。
 * [OUTPUT]: 唯一 pdsh Config/name/apply 与 owned-window capture/save。
 * [POS]: 单包运行产物；PDSH build "0.3.4"，不手工修改。
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
var CAPTURE_SAVE_DIRECTORY_PATTERN = /^(?=.{0,4096}$)(?:|\/(?!\/)[^\u0000-\u001f\u007f-\u009f]*|[A-Za-z]:\\(?:[^\\/:*?"<>|\u0000-\u001f\u007f-\u009f]+(?:\\[^\\/:*?"<>|\u0000-\u001f\u007f-\u009f]+)*\\?)?|\\\\(?!\.{1,2}\\)[^\\/:*?"<>|\u0000-\u001f\u007f-\u009f]+\\[^\\/:*?"<>|\u0000-\u001f\u007f-\u009f]+(?:\\[^\\/:*?"<>|\u0000-\u001f\u007f-\u009f]+)*\\?)$/u;
var CAPTURE_FILE_NAME_PATTERN = /^(?=.{1,160}$)(?![\s.]+$)(?:[^{}\\/:*?"<>|\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u206f]|\{(?:date|time|title|width|height)\})+$/u;
var DEFAULT_CAPTURE_EXPORT = { saveBehavior: "ask", saveFormat: "png", fileNamePattern: "PDSH-screenshot-{date}-{time}", saveDirectory: "" };

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
import { fileURLToPath } from "node:url";

// src/shared/window-capture-protocol.ts
var CAPTURE_LIMITS = {
  maxBytes: 128 * 1024 * 1024,
  pngChunkBytes: 32 * 1024,
  maxChunks: 4096,
  maxPixels: 16 * 1024 * 1024
};

// src/host/native-window-capture.ts
var MAX_BYTES = CAPTURE_LIMITS.maxBytes;
var MAX_PIXELS = CAPTURE_LIMITS.maxPixels;
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

// src/host/window-capture-service.ts
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { dirname, join as join3 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";

// src/host/capture-runtime-loader.ts
import { lstat, readFile, realpath } from "node:fs/promises";
import { join as join2, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
var CAPTURE_RUNTIME_CONTRACT = "pdsh-capture-runtime-v1";
var VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\w.-]+)?$/;
async function locateCaptureRuntime(packageLink) {
  const root = await realpath(packageLink);
  const manifest = JSON.parse(await readFile(join2(root, "package.json"), "utf8"));
  if (manifest.name !== "@daftai/pdsh" || !VERSION.test(manifest.version)) throw new Error("invalid capture runtime package");
  const path = join2(root, "lib", "capture-runtime", `${manifest.version}.js`);
  if (!(await lstat(path)).isFile()) throw new Error("invalid capture runtime file");
  const physical = await realpath(path);
  const inside = relative(root, physical);
  if (!inside || inside === ".." || inside.startsWith(`..${sep}`)) throw new Error("invalid capture runtime location");
  return { version: manifest.version, url: pathToFileURL(physical).href };
}
function createCaptureRuntimeLoader(options) {
  let active;
  let activeUrl;
  let loading;
  let disposed = false;
  let disposal;
  async function load() {
    let target = await options.locate();
    if (disposed) throw new Error("capture runtime disposed");
    if (active && activeUrl === target.url && active.version === target.version) return active;
    let module = await (options.importModule ?? ((url) => import(url)))(target.url);
    if (disposed) throw new Error("capture runtime disposed");
    if (module.contract !== CAPTURE_RUNTIME_CONTRACT || module.version !== target.version || typeof module.create !== "function") {
      throw new Error("incompatible capture runtime");
    }
    const previous = active;
    active = void 0;
    activeUrl = void 0;
    await previous?.dispose();
    if (disposed) throw new Error("capture runtime disposed");
    for (let attempt = 0; ; attempt++) {
      const latest = await options.locate();
      if (disposed) throw new Error("capture runtime disposed");
      if (latest.version === target.version && latest.url === target.url) break;
      if (attempt >= 2) throw new Error("capture runtime installation changed");
      target = latest;
      module = await (options.importModule ?? ((url) => import(url)))(target.url);
      if (disposed) throw new Error("capture runtime disposed");
      if (module.contract !== CAPTURE_RUNTIME_CONTRACT || module.version !== target.version || typeof module.create !== "function") {
        throw new Error("incompatible capture runtime");
      }
    }
    const next = module.create(options.context);
    if (!next || next.version !== target.version || ["capture", "save", "refreshCaptureEnabled", "dispose"].some((method) => typeof next[method] !== "function")) {
      if (typeof next?.dispose === "function") await next.dispose();
      throw new Error("incompatible capture runtime instance");
    }
    active = next;
    activeUrl = target.url;
    return next;
  }
  return {
    current() {
      if (disposed) return Promise.reject(new Error("capture runtime disposed"));
      if (!loading) {
        const task = load();
        loading = task;
        task.then(() => {
          if (loading === task) loading = void 0;
        }, () => {
          if (loading === task) loading = void 0;
        });
      }
      return loading;
    },
    refreshCaptureEnabled() {
      if (!disposed) active?.refreshCaptureEnabled();
    },
    dispose() {
      if (disposal) return disposal;
      disposed = true;
      const current = active;
      active = void 0;
      activeUrl = void 0;
      disposal = Promise.all([current?.dispose(), loading?.catch(() => void 0)]).then(() => void 0);
      return disposal;
    }
  };
}

// src/shared/capture-bridge.ts
var MAX_PAGE_PIXELS = 16e6;
var MAX_PNG_BYTES = MAX_PAGE_PIXELS * 8;
function isCaptureId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// src/host/window-capture-service.ts
var _save_dec, _capture_dec, _implementationVersion_dec, _a, _init;
var WindowCaptureService = class extends (_a = TypertRemoteService, _implementationVersion_dec = [Remote], _capture_dec = [Remote({ mode: "stream" })], _save_dec = [Remote({ mode: "stream" })], _a) {
  constructor(ctx) {
    super(ctx, "pdshWindowCapture", { namespace: "pdshNativeWindowCapture" });
    __runInitializers(_init, 5, this);
    __publicField(this, "runtime");
    __publicField(this, "disposed", false);
    const profile = ctx.get("profileContext");
    const packageLink = profile?.dir ? join3(profile.dir, "node_modules", "@daftai", "pdsh") : dirname(fileURLToPath2(import.meta.url));
    this.runtime = createCaptureRuntimeLoader({ locate: () => locateCaptureRuntime(packageLink), context: this.ctx });
    this.ctx.effect(() => () => {
      this.disposed = true;
      return this.runtime.dispose();
    }, "pdsh-window-capture: settle versioned implementation");
  }
  async implementationVersion() {
    try {
      return (await this.runtime.current()).version;
    } catch {
      throw new Error("capture-runtime-unavailable");
    }
  }
  capture(signal) {
    const owner = this;
    return { async *[Symbol.asyncIterator]() {
      if (owner.disposed) {
        yield { type: "terminal", status: "disposed" };
        return;
      }
      let runtime;
      try {
        runtime = await owner.runtime.current();
      } catch {
        yield { type: "terminal", status: owner.disposed ? "disposed" : "helper-failed" };
        return;
      }
      if (owner.disposed) {
        yield { type: "terminal", status: "disposed" };
        return;
      }
      yield* runtime.capture(signal);
    } };
  }
  save(request, signal) {
    const invocation = this.ctx.invocation;
    if (!invocation) throw new Error("Window save requires an active Remote invocation");
    const uplink = invocation.uplink();
    const owner = this;
    return (async function* () {
      let runtime;
      try {
        runtime = await owner.runtime.current();
      } catch {
        yield { type: "terminal", requestId: isCaptureId(request?.requestId) ? request.requestId : "", code: owner.disposed ? "disposed" : "save-failed" };
        return;
      }
      yield* runtime.save(request, signal, uplink);
    })();
  }
  refreshCaptureEnabled() {
    this.runtime.refreshCaptureEnabled();
  }
};
_init = __decoratorStart(_a);
__decorateElement(_init, 1, "implementationVersion", _implementationVersion_dec, WindowCaptureService);
__decorateElement(_init, 1, "capture", _capture_dec, WindowCaptureService);
__decorateElement(_init, 1, "save", _save_dec, WindowCaptureService);
__decoratorMetadata(_init, WindowCaptureService);
__publicField(WindowCaptureService, "inject", ["typert", "settings"]);

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
