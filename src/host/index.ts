/**
 * [INPUT]: 依赖 shared/components.ts 的配置身份、shared/model.ts 的显示默认值、capture.ts 的拍照字段/Loader volatile-update 订阅与平台原生 helper 可用性。
 * [OUTPUT]: 提供当前稳定/RC 身份的唯一 Config/apply 与 Typert 可见的 owned-window service；captureEnabled 撤回取像/保存/壁纸三路。
 * [POS]: PDSH 唯一 Cordis Host 入口；仅在有对应平台 provider 时注册 capture service，不影响身份/标题设置。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import z from '@deepseek-ai/schemastery';
import { ROOT_ENTRY_ID } from '../shared/components.ts';
import { lstatSync } from 'node:fs';
import './context.ts'
import { DEFAULTS, MAX_AVATAR_CHARS, MAX_NAME_CHARS, NICKNAME_PATTERN, LOCAL_AVATAR_PATTERN } from '../shared/model.ts';
import { CAPTURE_CONFIG_FIELDS, apply as applyCapture, observeCaptureEnabled } from './capture.ts';
import { shouldRegisterNativeCaptureProvider } from './native-window-capture.ts';
import { WindowCaptureService } from './window-capture-service.ts';

// +--- 官方 workspace Typert 通过此真实 Host entry 发现唯一 Remote service ---+
export { WindowCaptureService } from './window-capture-service.ts';

export const name = ROOT_ENTRY_ID;
export const Config = z.object({
  maskTitles: z.boolean().default(DEFAULTS.maskTitles).description('Mask sidebar titles / 遮挡侧栏标题').volatile(),
  maskIdentity: z.boolean().default(DEFAULTS.maskIdentity).description('Local display alias only / 仅替换显示身份').volatile(),
  useAccountAvatar: z.boolean().default(DEFAULTS.useAccountAvatar).description('Keep native account avatar / 使用账号原始头像').volatile(),
  nickname: z.string().max(MAX_NAME_CHARS).pattern(NICKNAME_PATTERN).default(DEFAULTS.nickname).description('Display nickname / 显示昵称').volatile(),
  avatar: z.string().max(MAX_AVATAR_CHARS).pattern(LOCAL_AVATAR_PATTERN).default('').description('Local raster data URL; empty generates avatar / 本地图片，留空生成头像').volatile(),
  ...CAPTURE_CONFIG_FIELDS,
});

export function apply(ctx, config) {
  // +--- 只由产品设置页展示，不让通用编辑器成为第二套 UI ---+
  ctx.inject(['settings'], child => child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)));
  applyCapture(ctx);
  // +--- Windows provider 只有确实打包 x64 helper 才暴露；不推测 ARM64 等未构建目标 ---+
  if (shouldRegisterNativeCaptureProvider(process.platform, process.arch, path => {
    try { return lstatSync(path).isFile(); } catch { return false; }
  }, import.meta.url)) ctx.plugin(WindowCaptureService);
  // +--- Loader volatile-update 是 Config owner-scoped；此 listener 必须留在 pdsh root fiber ---+
  observeCaptureEnabled(ctx)
}
