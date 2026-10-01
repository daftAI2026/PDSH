/**
 * [INPUT]: src/host/index.ts，由 build.ts 生成。
 * [OUTPUT]: pdsh Config/name/apply。
 * [POS]: 单包运行产物；PDSH build "0.3.0-rc.11"，不手工修改。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

// src/host/index.ts
import z2 from "@deepseek-ai/schemastery";

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
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { join as join2 } from "node:path";

// src/host/capture-bootstrap.ts
import { execFileSync } from "node:child_process";
import { mkdtemp, chmod, lstat, unlink, rmdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { connect } from "node:net";

// src/host/inspector-ownership.ts
var OWNER = "@daftai/pdsh.inspector-bootstrap.v1";
function prelude(pid, nonce, url) {
  return `if(process.pid!==${JSON.stringify(pid)}||process.type!=='browser')throw Error('wrong Main');const i=process.getBuiltinModule('node:inspector'),key=Symbol.for(${JSON.stringify(OWNER)}),nonce=${JSON.stringify(nonce)},url=${JSON.stringify(url)};`;
}
function inspectorWatchdog(pid, nonce, url) {
  return `(()=>{${prelude(pid, nonce, url)}if(globalThis[key]||i.url()!==url)throw Error('inspector ownership changed');const record={nonce,url,timer:null};globalThis[key]=record;record.timer=setTimeout(()=>{if(globalThis[key]!==record)return;delete globalThis[key];if(i.url()===record.url)i.close();},5000);record.timer.unref();return {pid:process.pid,electron:process.versions.electron};})()`;
}
function inspectorClose(pid, nonce, url) {
  return `(()=>{${prelude(pid, nonce, url)}const record=globalThis[key];if(record&&record.nonce!==nonce)throw Error('inspector ownership changed');if(record){clearTimeout(record.timer);delete globalThis[key];}if(i.url()!==url)return false;setTimeout(()=>{if(i.url()===url)i.close();},50).unref();return true;})()`;
}

// src/shared/capture-bridge.ts
var CAPTURE_ROUTE = "/api/pdsh.capture";
var CAPTURE_ENDPOINT = "pdsh.capture";
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

// src/host/capture-bootstrap.ts
var NODE_DEFAULT_INSPECTOR_PORT = 9229;
var INSPECTOR_ENDPOINT = `http://127.0.0.1:${NODE_DEFAULT_INSPECTOR_PORT}/json/list`;
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var unavailable = (code = "bridge-unavailable") => Object.assign(new Error("PDSH Main bridge unavailable"), { code });
var unclosed = () => new Error("PDSH_MAIN_INSPECTOR_CLOSE_UNCONFIRMED");
function listeners(pid) {
  try {
    return execFileSync("/usr/sbin/lsof", ["-nP", ...pid ? ["-a", "-p", String(pid)] : [], `-iTCP:${NODE_DEFAULT_INSPECTOR_PORT}`, "-sTCP:LISTEN"], { encoding: "utf8", timeout: 1e3 }).trim();
  } catch (error) {
    if (error.status === 1) return "";
    throw unavailable();
  }
}
async function target(pid) {
  if (!listeners(pid).includes(`127.0.0.1:${NODE_DEFAULT_INSPECTOR_PORT}`)) throw unavailable();
  const response = await fetch(INSPECTOR_ENDPOINT, { signal: AbortSignal.timeout(500) });
  const list = await response.json();
  if (!Array.isArray(list) || list.length !== 1) throw unavailable();
  const url = new URL(list[0].webSocketDebuggerUrl);
  if (url.protocol !== "ws:" || url.hostname !== "127.0.0.1" || url.port !== String(NODE_DEFAULT_INSPECTOR_PORT) || url.username || url.password) throw unavailable();
  return url.href;
}
async function inspectorClient(url) {
  const ws = new WebSocket(url), pending = /* @__PURE__ */ new Map();
  let sequence = 0;
  ws.addEventListener("message", (event) => {
    let message;
    try {
      message = parseControlRecord(String(event.data));
    } catch {
      ws.close();
      return;
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error || message.result?.exceptionDetails) request.reject(unavailable());
    else request.resolve(message.result?.result?.value);
  });
  const closed = new Promise((resolve) => ws.addEventListener("close", () => {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(unavailable());
    }
    pending.clear();
    resolve();
  }, { once: true }));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.close();
      reject(unavailable());
    }, 2e3);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      ws.close();
      reject(unavailable());
    }, { once: true });
  });
  return {
    close() {
      ws.close();
    },
    closed,
    evaluate(expression) {
      return new Promise((resolve, reject) => {
        const id = ++sequence, timer = setTimeout(() => {
          pending.delete(id);
          ws.close();
          reject(unavailable());
        }, 5e3);
        pending.set(id, { resolve, reject, timer });
        ws.send(JSON.stringify({ id, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } }));
      });
    }
  };
}
async function connectCaptureControl(path, secret, signal, connectSocket = connect) {
  const socket = connectSocket(path), pending = /* @__PURE__ */ new Map();
  let buffer = "", disposed = false, ready;
  const acknowledged = new Promise((resolve, reject) => {
    ready = { resolve, reject };
  });
  const fail = () => {
    ready.reject(unavailable());
    for (const request2 of pending.values()) {
      clearTimeout(request2.timer);
      request2.reject(unavailable());
    }
    pending.clear();
  };
  socket.on("connect", () => socket.write(`${JSON.stringify({ op: "hello", secret })}
`));
  socket.on("error", fail);
  socket.on("close", fail);
  const closed = new Promise((resolve) => socket.once("close", resolve));
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
        if (message.protocolVersion !== 1) {
          socket.destroy();
          return;
        }
        if (message.op === "ready") {
          ready.resolve();
          continue;
        }
        if (!isCaptureId(message.requestId) || typeof message.ok !== "boolean") {
          socket.destroy();
          return;
        }
        const request2 = pending.get(message.requestId);
        if (!request2) continue;
        pending.delete(message.requestId);
        clearTimeout(request2.timer);
        message.ok === true ? request2.resolve({ protocolVersion: 1, ...["saved", "cancelled"].includes(message.outcome) ? { outcome: message.outcome } : {} }) : request2.reject(unavailable());
      }
    } catch {
      socket.destroy();
    }
  });
  function cancel(requestId) {
    if (!socket.destroyed) socket.write(`${JSON.stringify({ op: "cancel", requestId })}
`);
  }
  async function dispose() {
    if (!disposed) {
      disposed = true;
      if (!socket.destroyed) socket.end(`${JSON.stringify({ op: "dispose" })}
`);
      socket.destroy();
    }
    await closed;
  }
  const abort = () => {
    void dispose();
  };
  signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => socket.destroy(), 2e3);
  try {
    if (signal.aborted) throw unavailable();
    await acknowledged;
  } catch {
    await dispose();
    throw unavailable();
  } finally {
    clearTimeout(timer);
  }
  function request(op, requestId, owner) {
    if (disposed || socket.destroyed || !isCaptureId(requestId) || pending.size) return Promise.reject(unavailable());
    return new Promise((resolve, reject) => {
      const timer2 = op === "save" ? void 0 : setTimeout(() => {
        pending.delete(requestId);
        cancel(requestId);
        reject(unavailable());
      }, BRIDGE_TIMEOUT_MS);
      pending.set(requestId, { resolve, reject, timer: timer2 });
      socket.write(`${JSON.stringify({ op, requestId, owner })}
`);
    });
  }
  return {
    cancel,
    capture: (requestId, owner) => request("capture", requestId, owner),
    save: (requestId, owner) => request("save", requestId, owner),
    async dispose() {
      signal.removeEventListener("abort", abort);
      await dispose();
    }
  };
}
function createCaptureBootstrap(io) {
  return async function openCaptureBridge2(modulePath, signal, trace = () => {
  }) {
    const record = (phase) => {
      try {
        trace(phase);
      } catch {
      }
    };
    record("bootstrap-start");
    if (io.platform !== "darwin" || !io.argv.some((value) => value.endsWith("/@deepseek-ai/dsh-desktop-host/lib/index.js")) || !io.electron?.startsWith("44.")) {
      record("bootstrap-unsupported");
      throw unavailable();
    }
    const pid = io.pid;
    const identity = () => io.identity(pid);
    let original;
    try {
      original = identity();
    } catch {
      record("bootstrap-identity-rejected");
      throw unavailable();
    }
    if (!original.startsWith(`${io.execPath} `) || !io.execPath.endsWith("/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness")) {
      record("bootstrap-identity-rejected");
      throw unavailable();
    }
    if (io.listeners()) {
      record("bootstrap-port-busy");
      throw unavailable("bridge-port-busy");
    }
    const directory = await mkdtemp(join(tmpdir(), "pdsh-main-"));
    await chmod(directory, 448);
    const owned = await lstat(directory), socketPath = join(directory, "bridge.sock"), secret = randomBytes(32).toString("hex");
    let client, bridge, originalUrl, signalled = false, verified = false, cleanupConfirmed = false;
    const nonce = randomBytes(32).toString("hex");
    async function removeDirectory() {
      const current = await lstat(directory).catch(() => null);
      if (!current || current.ino !== owned.ino || current.dev !== owned.dev || !current.isDirectory()) return;
      const socket = await lstat(socketPath).catch(() => null);
      if (socket?.isSocket() && socket.uid === owned.uid) await unlink(socketPath).catch(() => {
      });
      await rmdir(directory).catch(() => {
      });
    }
    try {
      if (signal.aborted || identity() !== original) throw unavailable();
      if (io.listeners()) {
        record("bootstrap-port-busy");
        throw unavailable("bridge-port-busy");
      }
      io.signalMain(pid);
      signalled = true;
      record("inspector-signalled");
      let url;
      for (let attempt = 0; attempt < 25 && !signal.aborted; attempt++) {
        try {
          url = await io.target(pid);
          break;
        } catch {
          await io.sleep(100);
        }
      }
      if (!url || identity() !== original) throw unavailable();
      originalUrl = url;
      client = await io.inspectorClient(url);
      record("inspector-attached");
      const facts = await client.evaluate(inspectorWatchdog(pid, nonce, url));
      if (facts?.pid !== pid || !facts.electron?.startsWith("44.")) throw unavailable();
      verified = true;
      record("main-verified");
      if (signal.aborted) throw unavailable();
      const result = await client.evaluate(`process.getBuiltinModule('node:module').createRequire(process.execPath)(${JSON.stringify(modulePath)}).startMainBridge(${JSON.stringify({ expectedPid: pid, socketPath, secret })})`);
      if (result?.pid !== pid || result.protocolVersion !== 1) throw unavailable();
      record("main-loaded");
      bridge = await io.socketClient(socketPath, secret, signal);
      record("control-ready");
    } finally {
      const closedState = () => {
        try {
          return io.listeners(pid) ? "open" : "closed";
        } catch {
          return "unknown";
        }
      };
      const sameIdentity = () => {
        try {
          return identity() === original;
        } catch {
          return false;
        }
      };
      try {
        if (client && verified) try {
          await client.evaluate(inspectorClose(pid, nonce, originalUrl));
        } catch {
        }
        client?.close();
        if (signalled) {
          for (let attempt = 0; attempt < 60; attempt++) {
            if (closedState() === "closed") {
              cleanupConfirmed = true;
              break;
            }
            await io.sleep(100);
          }
        } else cleanupConfirmed = true;
        if (!cleanupConfirmed && originalUrl && sameIdentity()) {
          try {
            const retryUrl = await io.target(pid);
            if (retryUrl !== originalUrl) throw unavailable();
            const recovery = await io.inspectorClient(retryUrl);
            try {
              await recovery.evaluate(inspectorClose(pid, nonce, originalUrl));
            } finally {
              recovery.close();
            }
          } catch {
          }
          for (let attempt = 0; attempt < 20; attempt++) {
            if (closedState() === "closed") {
              cleanupConfirmed = true;
              break;
            }
            await io.sleep(100);
          }
        }
      } finally {
        client?.close();
        if (!bridge || !cleanupConfirmed || signal.aborted) {
          try {
            await bridge?.dispose();
          } finally {
            await removeDirectory();
          }
        }
      }
      if (signalled) record(cleanupConfirmed ? "inspector-closed" : "inspector-close-unconfirmed");
      if (!cleanupConfirmed) throw unclosed();
    }
    if (!bridge || signal.aborted) throw unavailable();
    return {
      capture: bridge.capture,
      save: bridge.save,
      cancel: bridge.cancel,
      async dispose() {
        await bridge.dispose();
        await removeDirectory();
      }
    };
  };
}
function readMainIdentity(pid, run = execFileSync) {
  const line = run("/bin/ps", ["-p", String(pid), "-o", "lstart=,comm="], { encoding: "utf8", timeout: 1e3 }).trim();
  const match = line.match(/^(\S+\s+\S+\s+\d+\s+\d{2}:\d{2}:\d{2}\s+\d{4})\s+(\/.+)$/);
  if (!match) throw unavailable();
  return `${match[2]} ${match[1]}`;
}
var openCaptureBridge = createCaptureBootstrap({
  platform: process.platform,
  argv: process.argv,
  electron: process.versions.electron,
  get pid() {
    return process.ppid;
  },
  execPath: process.execPath,
  listeners,
  target,
  inspectorClient,
  socketClient: connectCaptureControl,
  sleep,
  identity: readMainIdentity,
  signalMain(pid) {
    process.kill(pid, "SIGUSR1");
  }
});

// src/shared/capture-trace.ts
var CAPTURE_TRACE_PHASES = [
  "capture-click",
  "request-received",
  "bootstrap-start",
  "bootstrap-unsupported",
  "bootstrap-identity-rejected",
  "bootstrap-port-busy",
  "inspector-signalled",
  "inspector-attached",
  "main-verified",
  "main-loaded",
  "control-ready",
  "inspector-closed",
  "inspector-close-unconfirmed",
  "native-requested",
  "native-ready",
  "native-failed",
  "renderer-requested",
  "renderer-received",
  "renderer-failed",
  "pixels-start",
  "pixels-validating",
  "pixels-decoded",
  "pixels-ready",
  "capture-failed",
  "editor-ready",
  "cleanup-finished"
];
function createCaptureTrace(logger, side) {
  return (phase, requestId) => {
    if (!CAPTURE_TRACE_PHASES.includes(phase) || !["host", "renderer"].includes(side)) return;
    try {
      logger?.info?.("PDSH capture side=%s phase=%s request=%s", side, phase, isCaptureId(requestId) ? requestId : "-");
    } catch {
    }
  };
}

// src/host/capture-route.ts
function createCaptureRoute(consented, open, logger, guard = { error: null }) {
  const trace = createCaptureTrace(logger, "host");
  let disposed = false, current = null, retiring = Promise.resolve();
  const warn = (message) => {
    try {
      logger?.warn?.(message);
    } catch {
    }
  };
  function isolate(error) {
    if (error?.message === "PDSH_MAIN_INSPECTOR_CLOSE_UNCONFIRMED") {
      guard.error = error;
      warn("PDSH Main inspector close is unconfirmed. Preserve work and restart DSH before capture resumes.");
    } else if (!guard.error) {
      guard.error = Object.assign(new Error("PDSH control close unconfirmed"), { code: "control-cleanup-unconfirmed" });
      warn("PDSH capture control release is unconfirmed. Automatic reconnect is paused.");
    }
  }
  async function retire(session) {
    session.abort.abort();
    let connection;
    try {
      connection = await session.work;
    } catch (error) {
      if (error?.message === "PDSH_MAIN_INSPECTOR_CLOSE_UNCONFIRMED") isolate(error);
      return;
    }
    try {
      await connection.dispose();
    } catch (error) {
      isolate(error);
    }
  }
  function sessionFor(owner, requestId) {
    if (guard.error) throw guard.error;
    if (current?.owner === owner) return current;
    if (current) retiring = retire(current);
    const abort = new AbortController(), previous = retiring;
    const session = { owner, abort, work: previous.then(() => {
      if (guard.error) throw guard.error;
      if (disposed || abort.signal.aborted || !consented()) throw new Error("capture disabled");
      return open(abort.signal, requestId);
    }) };
    current = session;
    void session.work.catch((error) => {
      if (error?.message === "PDSH_MAIN_INSPECTOR_CLOSE_UNCONFIRMED") isolate(error);
      else if (current === session) current = null;
    });
    return session;
  }
  async function command(payload) {
    if (disposed || !payload || !isCaptureId(payload.owner)) throw new Error("invalid capture owner");
    const { op, owner, requestId } = payload;
    if (op === "release") {
      if (current?.owner === owner) {
        const own2 = current;
        current = null;
        retiring = retire(own2);
        await retiring;
      }
      return;
    }
    if (!isCaptureId(requestId) || !["capture", "save", "cancel"].includes(op)) throw new Error("invalid capture command");
    if (op === "cancel") {
      const own2 = current?.owner === owner ? current : null;
      if (own2) {
        const connection2 = await own2.work;
        if (!own2.abort.signal.aborted) connection2.cancel(requestId);
      }
      return;
    }
    if (!consented()) throw new Error("capture consent required");
    trace("request-received", requestId);
    const own = sessionFor(owner, requestId), connection = await own.work;
    if (disposed || own.abort.signal.aborted || !consented() || current !== own) throw new Error("capture disabled");
    let saved;
    try {
      trace("native-requested", requestId);
      saved = await (op === "save" ? connection.save(requestId, owner) : connection.capture(requestId, owner));
      trace("native-ready", requestId);
    } catch (error) {
      trace("native-failed", requestId);
      if (current === own) {
        current = null;
        retiring = retire(own);
        void retiring.catch(() => {
        });
      }
      throw error;
    }
    if (disposed || own.abort.signal.aborted || !consented() || current !== own) throw new Error("capture disabled");
    if (op === "save") {
      if (!["saved", "cancelled"].includes(saved?.outcome)) throw new Error("save unavailable");
      return { outcome: saved.outcome };
    }
  }
  return { refreshConsent() {
    if (!consented() && current) {
      const own = current;
      current = null;
      retiring = retire(own);
      void retiring.catch(() => {
      });
    }
  }, route: {
    path: CAPTURE_ROUTE,
    methods: ["POST"],
    requestBody: "buffered",
    async fetch(request) {
      let envelope;
      try {
        const text = await request.text();
        if (Buffer.byteLength(text) > MAX_CONTROL_BYTES) throw new Error("oversize command");
        envelope = JSON.parse(text);
        if (envelope.type !== "client-request" || typeof envelope.rpcId !== "string" || envelope.rpcId.length > 128 || envelope.method !== CAPTURE_ENDPOINT) throw new Error("invalid envelope");
      } catch {
        return new Response("invalid capture command", { status: 400 });
      }
      let result;
      try {
        const value = await command(envelope.payload);
        result = { ok: true, value: { protocolVersion: 1, ...value } };
      } catch (error) {
        result = { ok: false, error: { code: error?.message === "PDSH_MAIN_INSPECTOR_CLOSE_UNCONFIRMED" ? "pdsh/inspector-cleanup-unconfirmed" : error?.code === "bridge-port-busy" ? "pdsh/inspector-port-busy" : error?.code === "control-cleanup-unconfirmed" ? "pdsh/control-cleanup-unconfirmed" : "pdsh/capture-unavailable", message: "Current-page capture unavailable", details: {} } };
      }
      return Response.json({ type: "server-response", rpcId: envelope.rpcId, result });
    }
  }, async dispose() {
    if (disposed) return;
    disposed = true;
    if (current) {
      const own = current;
      current = null;
      retiring = retire(own);
    }
    await retiring;
    trace("cleanup-finished");
  } };
}

// src/host/capture.ts
import z from "@deepseek-ai/schemastery";

// src/shared/capture-export.ts
var CAPTURE_FILE_NAME_PATTERN = /^(?=.{1,160}$)(?![\s.]+$)(?:[^{}\\/:*?"<>|\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u206f]|\{(?:date|time|title|width|height)\})+$/u;
var DEFAULT_CAPTURE_EXPORT = { saveBehavior: "ask", saveFormat: "png", fileNamePattern: "PDSH-screenshot-{date}-{time}", saveDirectory: "" };

// src/host/capture.ts
var INITIAL_SAVE_DIRECTORY = join2(homedir(), "Downloads");
var CAPTURE_CONFIG_FIELDS = {
  captureEnabled: z.boolean().default(true).description("Enable current-page capture / \u542F\u7528\u5F53\u524D\u9875\u9762\u62CD\u6444").volatile(),
  saveBehavior: z.union(["ask", "direct"]).default(DEFAULT_CAPTURE_EXPORT.saveBehavior).volatile(),
  saveDirectory: z.string().pattern(/^(?:|\/(?!.*[\u0000-\u001f\u007f]).{0,4095})$/u).default(INITIAL_SAVE_DIRECTORY).volatile(),
  saveFormat: z.union(["png", "jpeg", "webp"]).default(DEFAULT_CAPTURE_EXPORT.saveFormat).volatile(),
  fileNamePattern: z.string().pattern(CAPTURE_FILE_NAME_PATTERN).default(DEFAULT_CAPTURE_EXPORT.fileNamePattern).volatile()
};
var ROOT_NAMESPACE = "pdsh";
async function normalizeLegacyCaptureExport(ctx, isDisposed = () => false) {
  await ctx.root.loader.await();
  if (isDisposed()) return;
  const section = ctx.settings.describe().find((view) => view.ns === ROOT_NAMESPACE);
  if (!section) return;
  const ops = [];
  if (section.value?.saveDirectory === "") ops.push({ op: "set", path: ["saveDirectory"], value: INITIAL_SAVE_DIRECTORY });
  if (section.value?.fileNamePattern === "DSH {date} at {time}") ops.push({ op: "set", path: ["fileNamePattern"], value: DEFAULT_CAPTURE_EXPORT.fileNamePattern });
  if (ops.length && !isDisposed()) await ctx.settings.mutate(ROOT_NAMESPACE, ops, section.revision);
}
var GUARD = Symbol.for("@daftai/pdsh.main-lifecycle-guard.v1");
function mainLifecycleGuard() {
  let identity;
  try {
    identity = readMainIdentity(process.ppid);
  } catch {
  }
  const previous = globalThis[GUARD];
  if (previous && (!identity || !previous.identity || previous.identity === identity)) return previous.guard;
  const guard = { error: null };
  globalThis[GUARD] = { identity, guard };
  return guard;
}
function isCaptureEnabled(config) {
  const value = config?.captureEnabled;
  return (typeof value?.get === "function" ? value.get() : value) !== false;
}
function apply(ctx, config) {
  let syncCapture = () => {
  };
  ctx.on("loader/volatile-update", (paths) => {
    if (paths.some((path) => path.length === 1 && path[0] === "captureEnabled")) syncCapture();
  });
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
    settings.inject(["connection"], (child) => {
      child.effect(() => {
        let disposed = false;
        let active;
        let retirement = Promise.resolve();
        let retirementPending = false;
        let retirementFailed = false;
        const logRetirementFailure = (_error) => {
          retirementFailed = true;
          try {
            child.logger?.warn?.("PDSH capture cleanup was not confirmed; capture remains paused.");
          } catch {
          }
        };
        const retire = (controller) => {
          retirementPending = true;
          let closing;
          try {
            closing = Promise.resolve(controller.dispose());
          } catch (error) {
            logRetirementFailure(error);
            closing = Promise.resolve();
          }
          let current;
          current = Promise.all([retirement.catch(logRetirementFailure), closing.catch(logRetirementFailure)]).then(() => {
            if (retirement === current) retirementPending = false;
          });
          retirement = current;
        };
        const unmount = () => {
          const resource = active;
          if (!resource) return;
          active = void 0;
          try {
            resource.unregister();
          } catch (error) {
            logRetirementFailure(error);
          }
          retire(resource.controller);
        };
        const mount = () => {
          if (disposed || active || !isCaptureEnabled(config)) return;
          const trace = createCaptureTrace(child.logger, "host");
          const guard = mainLifecycleGuard();
          const controller = createCaptureRoute(
            () => isCaptureEnabled(config) && !retirementPending && !retirementFailed,
            (signal, requestId) => openCaptureBridge(fileURLToPath(new URL("./main.cjs", import.meta.url)), signal, (phase) => trace(phase, requestId)),
            child.logger,
            guard
          );
          try {
            const unregister = child.connection.fetch.register(controller.route);
            active = { controller, unregister };
          } catch (error) {
            retire(controller);
            throw error;
          }
        };
        const reconcile = () => {
          if (disposed) return;
          if (isCaptureEnabled(config)) mount();
          else unmount();
        };
        syncCapture = reconcile;
        reconcile();
        return async () => {
          disposed = true;
          if (syncCapture === reconcile) syncCapture = () => {
          };
          unmount();
          await retirement;
        };
      });
    });
  });
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
  apply(ctx, config);
}
export {
  Config,
  apply2 as apply,
  name
};
