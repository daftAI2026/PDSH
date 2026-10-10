/**
 * [INPUT]: 依赖 model 的本地栅格头像合同；接受 Host 已提交的头像与历史数组。
 * [OUTPUT]: 提供头像基础/历史能力判别、两项预算与 MRU。
 * [POS]: 身份模块的纯数据规则。Client 计算候选，Host 接受后才发布新顺序。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { LOCAL_AVATAR_PATTERN, MAX_AVATAR_CHARS } from './model.ts';

export const MAX_PREVIOUS_AVATARS = 2;

export function isAvatarHistory(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_PREVIOUS_AVATARS &&
    value.every(avatar => typeof avatar === 'string' && avatar.length > 0 &&
      avatar.length <= MAX_AVATAR_CHARS && LOCAL_AVATAR_PATTERN.test(avatar)) &&
    new Set(value).size === value.length;
}

/** 字段缺失才属于旧合同；已声明但损坏的历史不得降级。 */
export function avatarConfigurationMode(value: unknown): 'legacy' | 'history' | 'invalid' {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'invalid';
  const config = value as Record<string, unknown>;
  if (!Object.hasOwn(config, 'avatar') || !Object.hasOwn(config, 'useAccountAvatar') ||
      typeof config.avatar !== 'string' || config.avatar.length > MAX_AVATAR_CHARS ||
      !LOCAL_AVATAR_PATTERN.test(config.avatar) || typeof config.useAccountAvatar !== 'boolean') return 'invalid';
  if (!Object.hasOwn(config, 'avatarHistory')) return 'legacy';
  return isAvatarHistory(config.avatarHistory) ? 'history' : 'invalid';
}

export function sameAvatarHistory(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((avatar, index) => avatar === right[index]);
}

export function rotateAvatarHistory(history: readonly string[], previous: string, next: string): string[] {
  // +--- 旧当前值排首位；去掉新当前值和重复项，再截取两个 ---+
  return [...new Set([previous, ...history])]
    .filter(avatar => avatar !== '' && avatar !== next).slice(0, MAX_PREVIOUS_AVATARS);
}
