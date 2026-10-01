/**
 * [INPUT]: 依赖 shared/model.ts 的显示默认值、capture.ts 的拍照字段/Loader volatile-update 订阅与 Harness Settings 生命周期。
 * [OUTPUT]: 提供唯一 pdsh Config/apply；Settings form、显示偏好与拍照 route 共用 root Host，captureEnabled 原位撤回/重挂 route。
 * [POS]: PDSH 唯一 Cordis Host 入口，保留既有 pdsh 地址和配置字段，委托拍照 effect 而不另开 Host namespace。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import z from '@deepseek-ai/schemastery';
import { DEFAULTS, MAX_AVATAR_CHARS, MAX_NAME_CHARS, NICKNAME_PATTERN, LOCAL_AVATAR_PATTERN } from '../shared/model.ts';
import { CAPTURE_CONFIG_FIELDS, apply as applyCapture } from './capture.ts';

export const name = 'pdsh';
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
  applyCapture(ctx, config);
}
