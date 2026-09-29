/**
 * [INPUT]: 依赖 GitHub 公开 tags API 与浏览器 fetch；不发送凭据、不读取用户 profile。
 * [OUTPUT]: 提供唯一网络边界 loadReleaseTags，验证响应形状后交给 updater 选择版本。
 * [POS]: Client 更新来源适配器；更新决策不直接发请求，失败仅令本次自动探测不显示徽标。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { ReleaseTag } from './updater.ts';

const TAGS_URL = 'https://api.github.com/repos/daftAI2026/PDSH/tags?per_page=100';

export async function loadReleaseTags(request: typeof fetch = fetch): Promise<ReleaseTag[]> {
  const response = await request(TAGS_URL, { credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error('release tag request failed');
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error('release tags invalid');
  return data as ReleaseTag[];
}
