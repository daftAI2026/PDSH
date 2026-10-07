/**
 * [INPUT]: 依赖根指南、发布 skill、README 和许可。依赖 Node 文件与摘要接口。
 * [OUTPUT]: 验证指南边界、tag 渠道、升级说明分层、skill 导航、历史原文和头像致谢。
 * [POS]: tests 的公开文档合同。不运行宿主或联网。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = (name: string) => readFile(new URL(name, root), 'utf8');
const guide = await read('AGENTS.md');

// -------------------- 稳定指南 --------------------
test('所有 Agent 共用 AGENTS，CLAUDE 保持相对符号链接', async () => {
  assert.equal(await readlink(new URL('CLAUDE.md', root)), 'AGENTS.md');
  assert.equal(await read('CLAUDE.md'), guide);
});

test('项目指南按产品、地图、命令、安全和验收组织', () => {
  const headings = guide.split('\n').filter(line => line.startsWith('## '));
  const expected = ['Project', 'Product Direction', 'Repository Map', 'Commands',
    'Critical Safety Rules', 'Working Rules', 'Hotspot Ownership', 'Testing and Review', 'Release'];
  assert.deepEqual(headings, expected.map(name => '## ' + name));
});

test('指南拒绝日期、逐版本和历史事件章节', () => {
  const chronological = /^#{2,6}\s+(?:\d{4}-\d{2}-\d{2}\b|v?\d+\.\d+\.\d+\b|Historical\b|历史|会话进度|任务进度|本轮进度)/imu;
  for (const rejected of ['## 2026-10-07 验收', '## 0.4.0 release contract',
    '## Historical routes', '### 本轮进度']) {
    assert.equal(chronological.test(rejected), true, rejected);
  }
  assert.equal(chronological.test('## Critical Safety Rules'), false);
  assert.equal(chronological.test(guide), false);
});

test('指南明确禁止 AI 写流水账并指向私人证据仓', () => {
  assert.ok(guide.includes('禁止加入会话进度、验收流水和版本逐次记录。'));
  assert.ok(guide.includes('其他 Agent 与 AI 必须遵守此边界。'));
  assert.ok(guide.includes('daftAI-project-docs/pdsh/'));
  assert.ok(guide.includes('tests/public-guides.test.ts'));
});

test('旧指南发布合同逐字保留在发布文档，不回流长期指南', async () => {
  const publishing = await read('PUBLISHING.md');
  const start = '<!-- pdsh:legacy-release-contracts:start -->\n';
  const end = '<!-- pdsh:legacy-release-contracts:end -->';
  assert.equal(publishing.split(start).length, 2);
  assert.equal(publishing.split(end).length, 2);
  const block = publishing.split(start)[1].split(end)[0];
  assert.equal(createHash('sha256').update(block).digest('hex'), 'ec54f919761a79bd2be1323f216de27aa56d6a757a8d9a29e0a9bd34db0ea784');
  assert.ok(guide.includes('[PUBLISHING.md](PUBLISHING.md)'));
  assert.ok(publishing.includes('历史合同不授予当前发布或安装权限。'));
});

test('项目发布 skill 可发现，按需引用和局部地图指向真实文件', async () => {
  const directory = '.agents/skills/pdsh-release-lifecycle/';
  const entry = new URL(directory + 'SKILL.md', root);
  const skill = await readFile(entry, 'utf8');
  assert.match(skill, /^---\nname: pdsh-release-lifecycle\ndescription: [^\n]+\n---\n/u);
  assert.ok(guide.includes(directory + 'SKILL.md'));
  assert.ok((await read('PUBLISHING.md')).includes(directory + 'SKILL.md'));
  assert.ok((await read('.agents/skills/CLAUDE.md')).includes('pdsh-release-lifecycle/'));
  const references = [...skill.matchAll(/\]\((references\/[^)]+\.md)\)/gu)].map(match => match[1]);
  assert.equal(references.length, 2);
  assert.equal(new Set(references).size, references.length);
  for (const relative of ['CLAUDE.md', 'references/CLAUDE.md', ...references]) {
    const text = await readFile(new URL(relative, entry), 'utf8');
    assert.ok(text.includes('[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md'), relative);
  }
  for (const relative of references) {
    assert.ok((await read(directory + 'references/CLAUDE.md')).includes(relative.slice('references/'.length)));
  }
});

test('公开规则与项目 skill 都默认只打 tag，不推断 Release 授权', async () => {
  const publishing = await read('PUBLISHING.md');
  const stable = await read('.agents/skills/pdsh-release-lifecycle/references/stable.md');
  for (const text of [guide, publishing, stable]) {
    assert.ok(text.includes('GitHub Release 默认关闭。'));
    assert.ok(text.includes('“发版”只授权 main 与稳定 tag。'));
    assert.ok(text.includes('只有另行明确授权才创建 GitHub Release。'));
  }
  const currentContract = publishing.split('<!-- pdsh:legacy-release-contracts:start -->')[0];
  assert.ok(!currentContract.includes('GitHub Release 页面可选'));
  assert.ok(publishing.includes('[update-source.ts](src/client/update-source.ts)'));
  assert.ok(publishing.includes('[updater.ts](src/client/updater.ts)'));
});

test('升级合同逐功能验同路径，基础恢复不能代替扩展就绪', async () => {
  const skill = await read('.agents/skills/pdsh-release-lifecycle/SKILL.md');
  const stable = await read('.agents/skills/pdsh-release-lifecycle/references/stable.md');
  const check = (entry: string) => {
    assert.match(guide, /每项新增业务功能.*同一官方 tag 升级路径/u);
    assert.match(entry, /每项新增业务功能.*同一官方 tag 升级路径/u);
    assert.ok(entry.includes('包内代码不代表运行时装配。'));
    assert.ok(entry.includes('纯版本回复不代替新增能力验收；缺失的功能仍记为失败。'));
    assert.ok(stable.includes('逐项核对该版新增功能的入口、实际接口和业务动作。'));
    assert.ok(stable.includes('保持同进程，不重启或切开关补齐业务功能。'));
  };
  check(skill);
  // -------------------- 基础恢复不能伪装整版通过 --------------------
  const baseOnly = skill.replace(/^- 每项新增业务功能[^\n]*\n/mu, '');
  assert.notEqual(baseOnly, skill);
  assert.throws(() => check(baseOnly));
});

// -------------------- 用户说明与技术合同分层 --------------------
test('README 安装段保留升级提醒，技术合同留在发布文档', async () => {
  const readme = await read('README.md');
  const installation = readme.split('## 安装\n')[1]?.split('\n## ')[0];
  assert.ok(installation, '安装说明不得缺失');
  assert.match(installation, /插件详情页.*确认升级/u);
  assert.match(installation, /0\.3\.2[^\n]*首次升级需正常加载一次/u);
  assert.match(installation, /0\.5\.0[^\n]*不支持免重启升级/u);
  assert.match(installation, /PUBLISHING\.md#升级兼容/u);
  assert.doesNotMatch(installation, /\b(?:Config|Remote|payload)\b|业务壳|固定壳|旧壳|截图\/保存合同/u);
  const publishing = await read('PUBLISHING.md');
  assert.ok(publishing.includes('## 升级兼容\n'));
  assert.ok(publishing.includes('根 Config、基础 Remote 协议或固定壳变更'));
  assert.ok(publishing.includes('该壳不接受恢复的 v1 payload'));
});

// -------------------- 开源致谢 --------------------
test('README 点名离线头像上游并保留完整许可声明', async () => {
  const readme = await read('README.md');
  assert.match(readme, /\[blobatar\]\(https:\/\/github\.com\/Alain00\/blobatar\)/u);
  assert.match(readme, /## 致谢[\s\S]*本地生成[\s\S]*MIT/u);
  assert.match(readme, /\[第三方声明\]\(THIRD_PARTY_NOTICES\.md\)/u);
  const license = await read('node_modules/blobatar/LICENSE');
  assert.ok((await read('THIRD_PARTY_NOTICES.md')).includes(license.trim()));
});
