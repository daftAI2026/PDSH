/**
 * [INPUT]: 依赖 host-update-watch.ts 的版本排序、只读 API 与提醒去重边界。
 * [OUTPUT]: 验证稳定版/RC 选择、失败闭锁、dry-run 和无发布副作用。
 * [POS]: tests 的官方宿主标签监控合同；桩只验证 API 编排，不创建真实 issue。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  HOST_UPDATE_WATCH_BASELINE,
  monitorHostUpdate,
  type HostUpdateWatchApi,
  type HostUpdateWatchFetch,
} from '../tools/host-update-watch.ts';

const repository = fileURLToPath(new URL('../', import.meta.url));
const baseline = {
  name: HOST_UPDATE_WATCH_BASELINE.tag,
  commit: { sha: HOST_UPDATE_WATCH_BASELINE.sha },
};
const tag = (name: string, sha = 'a'.repeat(40)) => ({ name, commit: { sha } });

type FixtureIssue = {
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  user?: { login: string; type: string } | null;
  pull_request?: { url: string };
};

function createFixture(options: {
  tags?: unknown[];
  issues?: FixtureIssue[];
  failTags?: Error;
  failIssues?: Error;
  failCreate?: Error;
} = {}) {
  const tags = [...(options.tags ?? [baseline])];
  const issues = [...(options.issues ?? [])];
  const calls: Array<{ method: string; params: Record<string, unknown> }> = [];
  const api: HostUpdateWatchApi = {
    rest: {
      issues: {
        async listForRepo(params) {
          calls.push({ method: 'listForRepo', params });
          if (options.failIssues) throw options.failIssues;
          const offset = (params.page - 1) * params.per_page;
          return { data: issues.slice(offset, offset + params.per_page) };
        },
        async create(params) {
          calls.push({ method: 'create', params });
          if (options.failCreate) throw options.failCreate;
          const created: FixtureIssue = {
            title: params.title,
            body: params.body,
            state: 'open',
            user: { login: 'github-actions[bot]', type: 'Bot' },
          };
          issues.push(created);
          return { data: { number: issues.length, html_url: 'https://example.test/issues/1' } };
        },
      },
    },
  };
  const fetchUpstream: HostUpdateWatchFetch = async (input, init) => {
    const url = new URL(input);
    calls.push({ method: 'fetchTags', params: { url: input, page: Number(url.searchParams.get('page')) } });
    assert.equal(url.origin, 'https://api.github.com');
    assert.equal(url.pathname, '/repos/deepseek-ai/deepseek-harness/tags');
    assert.equal(url.searchParams.get('per_page'), '100');
    assert.equal(init.credentials, 'omit');
    assert.equal(new Headers(init.headers).has('authorization'), false);
    if (options.failTags) throw options.failTags;
    const offset = (Number(url.searchParams.get('page')) - 1) * 100;
    return {
      ok: true,
      status: 200,
      async json() { return tags.slice(offset, offset + 100); },
    };
  };
  return { api, fetchUpstream, tags, issues, calls };
}

const run = (fixture: ReturnType<typeof createFixture>, dryRun = false) => monitorHostUpdate({
  github: fixture.api,
  fetchUpstream: fixture.fetchUpstream,
  owner: 'daftAI2026',
  repo: 'PDSH',
  dryRun,
});

test('初始监控基线固定为已核验的最新官方 RC', () => {
  assert.deepEqual(HOST_UPDATE_WATCH_BASELINE, {
    tag: 'dsh-v0.2.2-rc.3',
    sha: '38a6a5c965aa99ab525161efb7cc5cf1fe62fced',
  });
});

test('选取 SemVer 最新 RC，忽略 alpha、nightly 和非法标签', async () => {
  const candidateSha = 'b'.repeat(40);
  const fixture = createFixture({ tags: [
    tag('dsh-v0.2.4-rc.2', '2'.repeat(40)),
    tag('dsh-v0.2.10-rc.2', candidateSha),
    tag('dsh-v0.2.10-rc.10', 'c'.repeat(40)),
    tag('dsh-v0.2.11-alpha.1', 'd'.repeat(40)),
    tag('dsh-v0.2.12-nightly.1', 'e'.repeat(40)),
    tag('dsh-v00.9.0', 'f'.repeat(40)),
    tag('v99.0.0', '1'.repeat(40)),
    baseline,
  ] });

  const result = await run(fixture);

  assert.equal(result.kind, 'created');
  assert.equal(result.tag, 'dsh-v0.2.10-rc.10');
  assert.equal(result.sha, 'c'.repeat(40));
  assert.equal(fixture.calls.filter(call => call.method === 'create').length, 1);
});

test('稳定版高于同版本 RC', async () => {
  const fixture = createFixture({ tags: [
    tag('dsh-v0.2.4-rc.10', 'a'.repeat(40)),
    tag('dsh-v0.2.4', 'b'.repeat(40)),
    baseline,
  ] });

  const result = await run(fixture);

  assert.equal(result.kind, 'created');
  assert.equal(result.tag, 'dsh-v0.2.4');
});

test('较新 RC 高于旧稳定版', async () => {
  const fixture = createFixture({ tags: [
    tag('dsh-v0.2.4', 'a'.repeat(40)),
    tag('dsh-v0.2.5-rc.1', 'b'.repeat(40)),
    baseline,
  ] });

  const result = await run(fixture);

  assert.equal(result.kind, 'created');
  assert.equal(result.tag, 'dsh-v0.2.5-rc.1');
});

test('基线之后没有合法稳定版或 RC 时不创建提醒', async () => {
  const fixture = createFixture({ tags: [
    tag('dsh-v0.2.1'),
    tag('dsh-v0.2.3-alpha.1'),
    tag('dsh-v0.2.4-nightly.2'),
    tag('dsh-v1.2', '2'.repeat(40)),
    tag('dsh-v01.2.3', '3'.repeat(40)),
    tag('dsh-v0.2.2-rc.3+invalid..metadata', '4'.repeat(40)),
    baseline,
  ] });

  const result = await run(fixture);

  assert.equal(result.kind, 'no-update');
  assert.equal(fixture.calls.some(call => call.method === 'create'), false);
});

test('与固定初始基线相同的最新标签不追溯建 issue', async () => {
  const fixture = createFixture({ tags: [baseline] });

  const result = await run(fixture);

  assert.equal(result.kind, 'no-update');
  assert.deepEqual(fixture.calls.map(call => call.method), ['fetchTags']);
});

test('匹配已关闭提醒的精确标题与稳定 marker 时不重建', async () => {
  const candidate = tag('dsh-v0.2.3', '3'.repeat(40));
  const fixture = createFixture({
    tags: [candidate, baseline],
    issues: [{
      title: 'Host compatibility review: deepseek-ai/deepseek-harness dsh-v0.2.3',
      body: '<!-- pdsh-host-update-watch: deepseek-ai/deepseek-harness@dsh-v0.2.3 -->\nreviewed',
      state: 'closed',
      user: { login: 'github-actions[bot]', type: 'Bot' },
    }],
  });

  const result = await run(fixture);

  assert.equal(result.kind, 'already-reported');
  assert.equal(fixture.calls.some(call => call.method === 'create'), false);
  assert.ok(fixture.calls.some(call => call.method === 'listForRepo'
    && call.params.state === 'all'));
});

test('非 workflow bot 的同标题与伪造 marker 不能抑制提醒', async () => {
  for (const user of [
    { login: 'attacker', type: 'User' },
    { login: 'github-actions[bot]', type: 'User' },
    { login: 'attacker', type: 'Bot' },
  ]) {
    const candidate = tag('dsh-v0.2.3', '3'.repeat(40));
    const fixture = createFixture({
      tags: [candidate, baseline],
      issues: [{
        title: 'Host compatibility review: deepseek-ai/deepseek-harness dsh-v0.2.3',
        body: '<!-- pdsh-host-update-watch: deepseek-ai/deepseek-harness@dsh-v0.2.3 -->',
        state: 'open',
        user,
      }],
    });

    const result = await run(fixture);

    assert.equal(result.kind, 'created');
    assert.equal(fixture.calls.filter(call => call.method === 'create').length, 1);
  }
});

test('重复触发共享 issue marker 与精确标题去重', async () => {
  const candidate = tag('dsh-v0.2.3', '3'.repeat(40));
  const fixture = createFixture({ tags: [candidate, baseline] });

  const first = await run(fixture);
  const second = await run(fixture);

  assert.equal(first.kind, 'created');
  assert.equal(second.kind, 'already-reported');
  assert.equal(fixture.calls.filter(call => call.method === 'create').length, 1);
});

test('提醒只包含固定标签和 SHA，并明确不是兼容结论', async () => {
  const candidate = tag('dsh-v0.2.3-rc.1', '3'.repeat(40));
  const fixture = createFixture({ tags: [candidate, baseline] });

  await run(fixture);

  const create = fixture.calls.find(call => call.method === 'create');
  assert.ok(create);
  assert.equal(create.params.title, 'Host compatibility review: deepseek-ai/deepseek-harness dsh-v0.2.3-rc.1');
  assert.match(String(create.params.body), /compare\/dsh-v0\.2\.2-rc\.3\.\.\.dsh-v0\.2\.3-rc\.1/u);
  assert.match(String(create.params.body), /commit\/3333333333333333333333333333333333333333/u);
  assert.match(String(create.params.body), /pnpm compat:assess/u);
  assert.match(String(create.params.body), /macOS/u);
  assert.match(String(create.params.body), /Windows/u);
  assert.match(String(create.params.body), /不判断破坏性变化，也不证明兼容/u);
  assert.match(String(create.params.body), /精确 Host/u);
});

test('dry-run 返回候选但不创建 issue', async () => {
  const fixture = createFixture({ tags: [tag('dsh-v0.2.3', '3'.repeat(40)), baseline] });

  const result = await run(fixture, true);

  assert.equal(result.kind, 'dry-run');
  assert.equal(fixture.calls.some(call => call.method === 'create'), false);
});

test('上游标签 API 失败时不读取或写入本仓 issue', async () => {
  const fixture = createFixture({
    tags: [tag('dsh-v0.2.3', '3'.repeat(40)), baseline],
    failTags: new Error('upstream unavailable'),
  });

  await assert.rejects(run(fixture), /Official Host tags request failed/u);
  assert.deepEqual(fixture.calls.map(call => call.method), ['fetchTags']);
});

test('上游标签解析失败时不假装无更新，也不写 issue', async () => {
  const fixture = createFixture();
  fixture.fetchUpstream = async () => ({ ok: true, status: 200, async json() { return { tags: [] }; } });

  await assert.rejects(run(fixture), /Official Host tags response is not an array/u);
  assert.equal(fixture.calls.some(call => call.method === 'create'), false);
  assert.equal(fixture.calls.some(call => call.method === 'listForRepo'), false);
});

test('本仓 issue API 失败时绝不创建重复提醒', async () => {
  const fixture = createFixture({
    tags: [tag('dsh-v0.2.3', '3'.repeat(40)), baseline],
    failIssues: new Error('issue listing unavailable'),
  });

  await assert.rejects(run(fixture), /PDSH issue listing failed/u);
  assert.equal(fixture.calls.some(call => call.method === 'create'), false);
});

test('标签与 issue 分页完整读取，分页边界不丢最新标签', async () => {
  const oldTags = Array.from({ length: 100 }, (_, index) => tag(`dsh-v0.1.${index}`));
  const fixture = createFixture({ tags: [...oldTags, tag('dsh-v0.3.0-rc.1', '3'.repeat(40)), baseline] });

  const result = await run(fixture);

  assert.equal(result.kind, 'created');
  assert.equal(result.tag, 'dsh-v0.3.0-rc.1');
  assert.ok(fixture.calls.some(call => call.method === 'fetchTags' && call.params.page === 2));
});

test('工作流只定时读标签并发提醒，不安装、构建或发布宿主插件', async () => {
  const workflow = await readFile(`${repository}/.github/workflows/host-update-watch.yml`, 'utf8');
  const manifest = await readFile(`${repository}/package.json`, 'utf8');

  assert.match(workflow, /cron: ['"]23 1 \* \* \*['"]/u);
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /default: true/u);
  assert.match(workflow, /contents: read/u);
  assert.match(workflow, /issues: write/u);
  assert.match(workflow, /persist-credentials: false/u);
  assert.match(workflow, /group: host-update-watch/u);
  assert.match(workflow, /if: github\.event_name == 'schedule' \|\| github\.ref == 'refs\/heads\/main'/u);
  assert.ok(workflow.includes('actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6'));
  assert.ok(workflow.includes('actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd # v8'));
  assert.match(workflow, /github\.event_name == 'workflow_dispatch' && inputs\.dry_run/u);
  assert.match(workflow, /host-update-watch\.ts/u);
  assert.doesNotMatch(workflow, /(?:pnpm|npm)\s+(?:install|add|publish|run\s+(?:build|bundle))/u);
  assert.doesNotMatch(workflow, /(?:native\/|bundle:rc|release:check|git\s+(?:push|tag))/u);
  assert.equal(manifest.includes('host-update-watch'), false, '不改依赖或项目脚本');
});
