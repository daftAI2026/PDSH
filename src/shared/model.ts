/**
 * [INPUT]: 依赖 blobatar/uri 的离线头像生成能力；接受 Host 配置的 JSON 值。
 * [OUTPUT]: 提供 DisplayPreferences 类型、默认显示偏好、输入约束与确定性的本地头像解析。
 * [POS]: PDSH 的纯数据边界；Host 验证与 Client 展示共用，禁止远端头像请求。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { blobatarUri } from 'blobatar/uri';

export interface DisplayPreferences {
  maskTitles: boolean;
  maskIdentity: boolean;
  useAccountAvatar: boolean;
  nickname: string;
  avatar: string;
}

export const MAX_NAME_CHARS = 64;
export const MAX_AVATAR_CHARS = 8 * 1024 * 1024;
export const NICKNAME_PATTERN = /^(?![\s\S]*\p{Cc})(?=[\s\S]*\S)[\s\S]+$/u;
export const LOCAL_AVATAR_PATTERN = /^(?:|data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2})$/;
export const DEFAULTS: Readonly<DisplayPreferences> = Object.freeze({
  maskTitles: false, maskIdentity: false, useAccountAvatar: false, nickname: '临时访客', avatar: '',
});

export function resolvePreferences(input: unknown): DisplayPreferences {
  // 旧frames/未知Host字段保留在Host，仅投影本代拥有的显示设置。
  const entries = input && typeof input === 'object' ? Object.entries(input) : [];
  const value: Record<string, unknown> = { ...DEFAULTS, ...Object.fromEntries(entries.filter(([field]) => Object.hasOwn(DEFAULTS, field))) };
  for (const field of ['maskTitles', 'maskIdentity', 'useAccountAvatar'] as const) {
    if (typeof value[field] !== 'boolean') throw new TypeError(field);
  }
  if (typeof value.nickname !== 'string') throw new TypeError('nickname');
  const nickname = value.nickname.trim();
  if (!NICKNAME_PATTERN.test(value.nickname) || value.nickname.length > MAX_NAME_CHARS) {
    throw new TypeError('nickname');
  }
  if (typeof value.avatar !== 'string' || value.avatar.length > MAX_AVATAR_CHARS ||
      !LOCAL_AVATAR_PATTERN.test(value.avatar)) throw new TypeError('avatar');
  return {
    maskTitles: value.maskTitles as boolean,
    maskIdentity: value.maskIdentity as boolean,
    useAccountAvatar: value.useAccountAvatar as boolean,
    nickname,
    avatar: value.avatar || blobatarUri(nickname, { background: 'circle' }),
  };
}
