/**
 * [INPUT]: 依赖 schemastery 的 volatile Config、shared/model.ts 的默认值与 Harness settings 注入。
 * [OUTPUT]: 提供 @daftai/pdsh 的显示偏好配置，由官方设置页负责编辑与持久化。
 * [POS]: PDSH Host 配置边界；只声明 Host 配置并启用设置表单，不接触连接、截图或账户/会话数据。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import z from '@deepseek-ai/schemastery';
import { DEFAULTS, MAX_AVATAR_CHARS, MAX_NAME_CHARS, NICKNAME_PATTERN, LOCAL_AVATAR_PATTERN } from '../shared/model.ts';

export const name = 'pdsh';
export const Config = z.object({
  maskTitles: z.boolean().default(DEFAULTS.maskTitles).description('Mask sidebar titles / 遮挡侧栏标题').volatile(),
  maskIdentity: z.boolean().default(DEFAULTS.maskIdentity).description('Local display alias only / 仅替换显示身份').volatile(),
  useAccountAvatar: z.boolean().default(DEFAULTS.useAccountAvatar).description('Keep native account avatar / 使用账号原始头像').volatile(),
  nickname: z.string().max(MAX_NAME_CHARS).pattern(NICKNAME_PATTERN).default(DEFAULTS.nickname).description('Display nickname / 显示昵称').volatile(),
  avatar: z.string().max(MAX_AVATAR_CHARS).pattern(LOCAL_AVATAR_PATTERN).default('').description('Local raster data URL; empty generates avatar / 本地图片，留空生成头像').volatile(),
});

export function apply(ctx) {
  // +--- 只由产品设置页展示，不让通用编辑器成为第二套 UI ---+
  ctx.inject(['settings'], child => child.effect(() => child.settings.configure({ auto: false }, ctx.fiber)));
}
