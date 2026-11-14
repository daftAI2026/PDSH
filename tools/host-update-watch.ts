/**
 * [INPUT]: 依赖无凭据的官方 tags 响应与 PDSH issue API；去重只信任 github-actions[bot] 作者。
 * [OUTPUT]: 导出固定基线、窄 API 契约与一次性兼容审查提醒器。
 * [POS]: tools 的只读宿主版本监视器；只创建人工提醒，不判断兼容或改动产品。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const UPSTREAM_OWNER = 'deepseek-ai';
const UPSTREAM_REPOSITORY = 'deepseek-harness';
const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const REQUEST_TIMEOUT_MS = 10_000;
const API_VERSION = '2022-11-28';

export const HOST_UPDATE_WATCH_BASELINE = {
  tag: 'dsh-v0.2.2-rc.3',
  sha: '38a6a5c965aa99ab525161efb7cc5cf1fe62fced',
} as const;

type PageRequest = {
  owner: string;
  repo: string;
  per_page: number;
  page: number;
  request: { timeout: number };
};

type IssueRequest = PageRequest & { state: 'all' };
type ApiResponse<T> = { data: T };

export type HostUpdateWatchApi = {
  rest: {
    issues: {
      listForRepo(params: IssueRequest): Promise<ApiResponse<unknown>>;
      create(params: {
        owner: string;
        repo: string;
        title: string;
        body: string;
        request: { timeout: number };
      }): Promise<ApiResponse<{ number?: number; html_url?: string }>>;
    };
  };
};

export type HostUpdateWatchFetch = (
  input: string,
  init: {
    method: 'GET';
    headers: Record<string, string>;
    cache: 'no-store';
    credentials: 'omit';
    signal: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

type ParsedVersion = {
  major: string;
  minor: string;
  patch: string;
  rc: string | null;
};

type UpstreamTag = { name: string; sha: string; version: ParsedVersion | undefined };
type IssueRecord = { title: string; body: string | null; pullRequest: boolean; automationAuthor: boolean };

export type HostUpdateResult =
  | { kind: 'no-update'; latestTag: string }
  | { kind: 'already-reported'; tag: string; sha: string; title: string }
  | { kind: 'dry-run'; tag: string; sha: string; title: string }
  | { kind: 'created'; tag: string; sha: string; title: string; issueNumber?: number; issueUrl?: string };

export type MonitorHostUpdateInput = {
  github: HostUpdateWatchApi;
  owner: string;
  repo: string;
  dryRun: boolean;
  fetchUpstream?: HostUpdateWatchFetch;
};

function record(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function compareNumeric(left: string, right: string): number {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseVersion(tag: string): ParsedVersion | undefined {
  // -------------------- 仅监控稳定版与 RC --------------------
  // alpha、nightly、其他预发布和非法 SemVer 均不参与排序。
  const match = /^dsh-v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-rc\.(0|[1-9]\d*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.exec(tag);
  if (!match) return undefined;
  return {
    major: match[1],
    minor: match[2],
    patch: match[3],
    rc: match[4] ?? null,
  };
}

function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  for (const key of ['major', 'minor', 'patch'] as const) {
    const order = compareNumeric(left[key], right[key]);
    if (order !== 0) return order;
  }
  if (left.rc === null && right.rc !== null) return 1;
  if (left.rc !== null && right.rc === null) return -1;
  if (left.rc !== null && right.rc !== null) {
    return compareNumeric(left.rc, right.rc);
  }
  return 0;
}

function readTag(value: unknown): UpstreamTag {
  const entry = record(value);
  const commit = record(entry?.commit);
  if (typeof entry?.name !== 'string' || !entry.name
    || typeof commit?.sha !== 'string' || !/^[a-f\d]{40}$/iu.test(commit.sha)) {
    throw new Error('Official Host tags response has an invalid entry');
  }
  return { name: entry.name, sha: commit.sha.toLowerCase(), version: parseVersion(entry.name) };
}

async function loadTagPage(
  fetchUpstream: HostUpdateWatchFetch,
  page: number,
): Promise<unknown[]> {
  const url = new URL(`https://api.github.com/repos/${UPSTREAM_OWNER}/${UPSTREAM_REPOSITORY}/tags`);
  url.searchParams.set('per_page', String(PAGE_SIZE));
  url.searchParams.set('page', String(page));
  let response: Awaited<ReturnType<HostUpdateWatchFetch>>;
  try {
    response = await fetchUpstream(url.toString(), {
      method: 'GET',
      headers: {
        accept: 'application/vnd.github+json',
        'x-github-api-version': API_VERSION,
        'user-agent': 'PDSH-host-update-watch',
      },
      cache: 'no-store',
      credentials: 'omit',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new Error('Official Host tags request failed');
  }
  if (!response.ok) throw new Error(`Official Host tags request failed (HTTP ${response.status})`);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('Official Host tags response is not valid JSON');
  }
  if (!Array.isArray(payload)) throw new Error('Official Host tags response is not an array');
  return payload;
}

async function loadUpstreamTags(fetchUpstream: HostUpdateWatchFetch): Promise<UpstreamTag[]> {
  const tags: UpstreamTag[] = [];
  const seen = new Map<string, string>();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const entries = await loadTagPage(fetchUpstream, page);
    if (entries.length > PAGE_SIZE) throw new Error('Official Host tags page exceeded its limit');
    for (const entry of entries) {
      const tag = readTag(entry);
      const previousSha = seen.get(tag.name);
      if (previousSha && previousSha !== tag.sha) {
        throw new Error('Official Host tags contain a rewritten duplicate tag');
      }
      if (!previousSha) {
        seen.set(tag.name, tag.sha);
        tags.push(tag);
      }
    }
    if (entries.length < PAGE_SIZE) return tags;
  }
  throw new Error('Official Host tag count exceeded the scan limit');
}

async function loadIssuePage(
  github: HostUpdateWatchApi,
  owner: string,
  repo: string,
  page: number,
): Promise<unknown[]> {
  try {
    const response = await github.rest.issues.listForRepo({
      owner,
      repo,
      state: 'all',
      per_page: PAGE_SIZE,
      page,
      request: { timeout: REQUEST_TIMEOUT_MS },
    });
    if (!Array.isArray(response.data)) throw new Error('Invalid issue response');
    return response.data;
  } catch {
    throw new Error('PDSH issue listing failed');
  }
}

function readIssue(value: unknown): IssueRecord {
  const issue = record(value);
  if (typeof issue?.title !== 'string'
    || (issue.body !== null && typeof issue.body !== 'string')
    || (issue.state !== 'open' && issue.state !== 'closed')) {
    throw new Error('PDSH issue response has an invalid entry');
  }
  const user = record(issue.user);
  return {
    title: issue.title,
    body: issue.body as string | null,
    pullRequest: issue.pull_request !== undefined,
    automationAuthor: user?.login === 'github-actions[bot]' && user.type === 'Bot',
  };
}

async function loadIssues(github: HostUpdateWatchApi, owner: string, repo: string): Promise<IssueRecord[]> {
  const issues: IssueRecord[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const entries = await loadIssuePage(github, owner, repo, page);
    if (entries.length > PAGE_SIZE) throw new Error('PDSH issue page exceeded its limit');
    issues.push(...entries.map(readIssue));
    if (entries.length < PAGE_SIZE) return issues;
  }
  throw new Error('PDSH issue count exceeded the scan limit');
}

function latestTag(tags: UpstreamTag[]): UpstreamTag | undefined {
  return tags
    .filter((tag): tag is UpstreamTag & { version: ParsedVersion } => tag.version !== undefined)
    .sort((left, right) => compareVersions(right.version, left.version)
      || (left.name < right.name ? -1 : left.name > right.name ? 1 : 0))[0];
}

function issueTitle(tag: string): string {
  return `Host compatibility review: ${UPSTREAM_OWNER}/${UPSTREAM_REPOSITORY} ${tag}`;
}

function issueMarker(tag: string): string {
  return `<!-- pdsh-host-update-watch: ${UPSTREAM_OWNER}/${UPSTREAM_REPOSITORY}@${tag} -->`;
}

function issueBody(tag: UpstreamTag): string {
  const compareUrl = `https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPOSITORY}/compare/${HOST_UPDATE_WATCH_BASELINE.tag}...${tag.name}`;
  const tagUrl = `https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPOSITORY}/releases/tag/${tag.name}`;
  const sourceUrl = `https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPOSITORY}/tree/${tag.name}`;
  const commitUrl = `https://github.com/${UPSTREAM_OWNER}/${UPSTREAM_REPOSITORY}/commit/${tag.sha}`;
  return [
    issueMarker(tag.name),
    '# 需要人工复核宿主兼容性',
    '',
    `监视器发现官方仓库出现新标签 **${tag.name}**，提交 SHA 为 \`${tag.sha}\`。`,
    `固定初始基线为 \`${HOST_UPDATE_WATCH_BASELINE.tag}\`（\`${HOST_UPDATE_WATCH_BASELINE.sha}\`）。`,
    '',
    '**此提醒不判断破坏性变化，也不证明兼容。** 工作流成功只表示标签和提醒 API 可用，不表示插件兼容。',
    '本监视器不更新依赖、不安装宿主、不构建原生助手，也不发布插件。',
    '',
    '## 官方来源',
    `- [官方标签发布页](${tagUrl})`,
    `- [基线到新标签的比较](${compareUrl})`,
    `- [该标签的宿主源码与文档](${sourceUrl})`,
    `- [该标签对应提交](${commitUrl})`,
    '',
    '## 人工验收清单',
    '- 运行 `pnpm compat:assess`，再逐项复核触点；该命令只提供静态线索。',
    '- 审查新标签的类型面、生命周期、错误码和现有合同。',
    '- 在隔离环境执行类型检查、Node 合同和真实归档检查。',
    '- 对精确 Host tag 与 SHA 验证 Manager、Loader、Settings、Client 和升级路径。',
    '- 在 macOS 验证 universal 助手、授权、整窗像素、取消和保存。',
    '- 在 Windows 验证 x64 助手、实际 ACL、整窗像素、取消和保存。',
    '- 记录未运行、失败、取消和未知结果；不得把自动监视结果写成兼容证据。',
  ].join('\n');
}

function duplicateExists(issues: IssueRecord[], title: string, marker: string): boolean {
  return issues.some(issue => issue.automationAuthor && !issue.pullRequest
    && (issue.title === title || issue.body?.split(/\r?\n/u).includes(marker)));
}

/**
 * [INPUT]: 接收公开标签读取器、本仓 Octokit、仓库身份与 dry-run 开关。
 * [OUTPUT]: 返回最新版本状态；仅在无重复且非 dry-run 时创建提醒 issue。
 * [POS]: 监视器的单一工作流入口；失败闭锁，不触碰依赖、宿主和发布渠道。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export async function monitorHostUpdate(input: MonitorHostUpdateInput): Promise<HostUpdateResult> {
  const fetchUpstream = input.fetchUpstream
    ?? ((url, init) => globalThis.fetch(url, init));
  const tags = await loadUpstreamTags(fetchUpstream);
  const newest = latestTag(tags);
  const newestVersion = newest?.version;
  const baselineVersion = parseVersion(HOST_UPDATE_WATCH_BASELINE.tag);
  if (!baselineVersion) throw new Error('Host update baseline is invalid');
  if (!newest || !newestVersion || compareVersions(newestVersion, baselineVersion) <= 0) {
    return { kind: 'no-update', latestTag: newest?.name ?? HOST_UPDATE_WATCH_BASELINE.tag };
  }

  const title = issueTitle(newest.name);
  const marker = issueMarker(newest.name);
  const issues = await loadIssues(input.github, input.owner, input.repo);
  if (duplicateExists(issues, title, marker)) {
    return { kind: 'already-reported', tag: newest.name, sha: newest.sha, title };
  }
  if (input.dryRun) return { kind: 'dry-run', tag: newest.name, sha: newest.sha, title };

  try {
    const created = await input.github.rest.issues.create({
      owner: input.owner,
      repo: input.repo,
      title,
      body: issueBody(newest),
      request: { timeout: REQUEST_TIMEOUT_MS },
    });
    return {
      kind: 'created',
      tag: newest.name,
      sha: newest.sha,
      title,
      ...(typeof created.data.number === 'number' ? { issueNumber: created.data.number } : {}),
      ...(typeof created.data.html_url === 'string' ? { issueUrl: created.data.html_url } : {}),
    };
  } catch {
    throw new Error('PDSH reminder issue creation failed');
  }
}
