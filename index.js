/**
 * [INPUT]: 依赖 src/host/index.ts，由 build.ts 生成。
 * [OUTPUT]: 提供 @daftai/pdsh 的 Config/name/apply。
 * [POS]: identity Host 入口，不手工修改。
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
}
export {
  Config,
  apply,
  name
};
