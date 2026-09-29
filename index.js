/**
 * [INPUT]: 依赖 src/host/index.ts，由 build.ts 生成。
 * [OUTPUT]: 提供 Cordis Host 的 Config/name/apply。
 * [POS]: PDSH 安装入口；TypeScript 源码是唯一手写实现。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

// src/host/index.ts
import z from "@deepseek-ai/schemastery";

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

// src/host/index.ts
import { fileURLToPath } from "node:url";

// src/host/capture.ts
import { execFile } from "node:child_process";
import { readFile, mkdtemp, rm, copyFile, chmod, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
var run = promisify(execFile);
var PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");
var MAX_PNG_BYTES = 64 * 1024 * 1024;
async function captureMacWindow({ pid, helper, signal, exec = run, temp = () => mkdtemp(join(tmpdir(), "pdsh-capture-")), read = readFile, size = stat, copy = copyFile, makeExecutable = chmod, remove = (path) => rm(path, { recursive: true, force: true }) }) {
  if (signal?.aborted) throw new Error("\u622A\u56FE\u5DF2\u53D6\u6D88");
  const directory = await temp();
  try {
    if (signal?.aborted) throw new Error("\u622A\u56FE\u5DF2\u53D6\u6D88");
    const probe = join(directory, "window-id");
    await copy(helper, probe);
    await makeExecutable(probe, 448);
    const result = await exec(probe, [String(pid)], { timeout: 5e3, maxBuffer: 4096, signal });
    const id = result.stdout.trim();
    if (!/^[1-9]\d{0,9}$/.test(id)) throw new Error("\u672A\u627E\u5230\u552F\u4E00\u7684 DSH \u7A97\u53E3");
    const path = join(directory, "window.png");
    await exec("/usr/sbin/screencapture", ["-x", "-o", "-l", id, "-t", "png", path], { timeout: 15e3, maxBuffer: 4096, signal });
    if ((await size(path)).size > MAX_PNG_BYTES) throw new Error("PNG \u622A\u56FE\u8FC7\u5927");
    const bytes = await read(path, { signal });
    if (bytes.length > MAX_PNG_BYTES || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("\u672A\u5F97\u5230\u6709\u6548 PNG \u622A\u56FE");
    return bytes;
  } finally {
    await remove(directory);
  }
}
function createCaptureRoute({ platform = process.platform, capture }) {
  return {
    path: "/api/pdsh/capture",
    methods: ["POST"],
    requestBody: "buffered",
    async fetch(request) {
      const headers = { "cache-control": "no-store" };
      if (platform !== "darwin") return new Response("unsupported platform", { status: 501, headers });
      if (request.signal.aborted) return new Response("cancelled", { status: 499, headers });
      try {
        const bytes = await capture(request.signal);
        return new Response(new Uint8Array(bytes), { status: 200, headers: { ...headers, "content-type": "image/png", "x-content-type-options": "nosniff" } });
      } catch {
        return new Response("capture failed", { status: 503, headers });
      }
    }
  };
}

// src/host/index.ts
var name = "pdsh";
var Config = z.object({
  maskTitles: z.boolean().default(DEFAULTS.maskTitles).description("Mask sidebar titles / \u906E\u6321\u4FA7\u680F\u6807\u9898").volatile(),
  maskIdentity: z.boolean().default(DEFAULTS.maskIdentity).description("Local display alias only / \u4EC5\u66FF\u6362\u663E\u793A\u8EAB\u4EFD").volatile(),
  useAccountAvatar: z.boolean().default(DEFAULTS.useAccountAvatar).description("Keep native account avatar / \u4F7F\u7528\u8D26\u53F7\u539F\u59CB\u5934\u50CF").volatile(),
  nickname: z.string().max(MAX_NAME_CHARS).pattern(NICKNAME_PATTERN).default(DEFAULTS.nickname).description("Display nickname / \u663E\u793A\u6635\u79F0").volatile(),
  avatar: z.string().max(MAX_AVATAR_CHARS).pattern(LOCAL_AVATAR_PATTERN).default("").description("Local raster data URL; empty generates avatar / \u672C\u5730\u56FE\u7247\uFF0C\u7559\u7A7A\u751F\u6210\u5934\u50CF").volatile()
});
function apply(ctx) {
  ctx.inject(["settings"], (child) => child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)));
  ctx.inject(["connection"], (child) => child.effect(() => child.connection.fetch.register(createCaptureRoute({
    capture: (signal) => captureMacWindow({ pid: process.ppid, helper: fileURLToPath(new URL("./native/window-id", import.meta.url)), signal })
  })), "pdsh: capture route"));
}
export {
  Config,
  apply,
  name
};
