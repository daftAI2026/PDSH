/**
 * [INPUT]: 依赖根指南、发布 skill、双语文档、Git链接索引与历史 LF blob。
 * [OUTPUT]: 验证文档互链、换行无关的内容合同、升级边界和致谢。
 * [POS]: tests 的公开文档合同。不运行宿主或联网。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { lstat, readFile, readlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const repository = fileURLToPath(root);
const normalizeLines = (text: string): string => text.replace(/\r\n/gu, '\n');
const read = async (name: string): Promise<string> => normalizeLines(await readFile(new URL(name, root), 'utf8'));
const readUrl = async (url: URL): Promise<string> => normalizeLines(await readFile(url, 'utf8'));
const gitText = (spec: string): string => normalizeLines(execFileSync('git', ['show', spec], { cwd: repository, encoding: 'utf8' }));
const guide = await read('AGENTS.md');

// -------------------- 稳定指南 --------------------
test('所有 Agent 共用 AGENTS，CLAUDE 保持相对符号链接', async () => {
  const linkPath = new URL('CLAUDE.md', root);
  const staged = execFileSync('git', ['ls-files', '--stage', '--', 'CLAUDE.md'], { cwd: repository, encoding: 'utf8' });
  assert.match(staged, /^120000\s[0-9a-f]{40}\s0\s+CLAUDE\.md$/mu, 'Git 必须保存相对符号链接条目');
  assert.equal(gitText(':CLAUDE.md'), 'AGENTS.md');
  if ((await lstat(linkPath)).isSymbolicLink()) {
    assert.equal(await readlink(linkPath), 'AGENTS.md');
    assert.equal(await read('CLAUDE.md'), guide);
    return;
  }
  assert.equal(process.platform, 'win32', '只有 Windows 无链接权限时才允许工作树 stub');
  assert.equal(await read('CLAUDE.md'), 'AGENTS.md', 'Windows stub 必须精确等于 Git 保存的链接目标');
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
  const original = gitText('HEAD:PUBLISHING.md');
  const start = '<!-- pdsh:legacy-release-contracts:start -->\n';
  const end = '<!-- pdsh:legacy-release-contracts:end -->';
  const extract = (text: string): string => {
    assert.equal(text.split(start).length, 2);
    assert.equal(text.split(end).length, 2);
    return text.split(start)[1].split(end)[0];
  };
  const block = extract(publishing);
  const originalBlock = extract(original);
  assert.equal(block, originalBlock, '工作树历史原文必须逐字匹配 Git 的 LF blob');
  assert.equal(createHash('sha256').update(originalBlock).digest('hex'), 'ec54f919761a79bd2be1323f216de27aa56d6a757a8d9a29e0a9bd34db0ea784');
  assert.ok(guide.includes('[PUBLISHING.md](PUBLISHING.md)'));
  assert.ok(publishing.includes('历史合同不授予当前发布或安装权限。'));
});

test('项目发布 skill 可发现，按需引用和局部地图指向真实文件', async () => {
  const directory = '.agents/skills/pdsh-release-lifecycle/';
  const entry = new URL(directory + 'SKILL.md', root);
  const skill = await readUrl(entry);
  assert.match(skill, /^---\nname: pdsh-release-lifecycle\ndescription: [^\n]+\n---\n/u);
  assert.ok(guide.includes(directory + 'SKILL.md'));
  assert.ok((await read('PUBLISHING.md')).includes(directory + 'SKILL.md'));
  assert.ok((await read('.agents/skills/CLAUDE.md')).includes('pdsh-release-lifecycle/'));
  const references = [...skill.matchAll(/\]\((references\/[^)]+\.md)\)/gu)].map(match => match[1]);
  assert.equal(references.length, 2);
  assert.equal(new Set(references).size, references.length);
  for (const relative of ['CLAUDE.md', 'references/CLAUDE.md', ...references]) {
    const text = await readUrl(new URL(relative, entry));
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

test('双语产品与发布入口互链，README 不罗列页脚装饰', async () => {
  const readme = await read('README.md');
  const english = await read('README.en.md');
  const publishing = await read('PUBLISHING.md');
  const publishingEnglish = await read('PUBLISHING.en.md');
  assert.match(readme, /\[English\]\(README\.en\.md\)/u);
  assert.match(english, /\[简体中文\]\(README\.md\)/u);
  assert.match(publishing, /\[English\]\(PUBLISHING\.en\.md\)/u);
  assert.match(publishingEnglish, /\[简体中文\]\(PUBLISHING\.md\)/u);
  assert.match(english, /PUBLISHING\.en\.md#upgrade-compatibility/u);
  assert.match(publishingEnglish, /\[README\]\(README\.en\.md\)/u);
  assert.doesNotMatch(readme, /\*\*项目链接\*\*/u);
  assert.doesNotMatch(english, /\*\*Project links\*\*/iu);
  for (const [name, text] of [['README.en.md', english], ['PUBLISHING.en.md', publishingEnglish]]) {
    assert.ok(guide.includes('`' + name + '`'), name);
    assert.ok(text.includes('[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md'), name);
  }
});

test('中英文 README 当前版本同源，英文不省略兼容、平台和隐私边界', async () => {
  const version = JSON.parse(await read('package.json')).version;
  const readme = await read('README.md');
  const english = await read('README.en.md');
  assert.ok(readme.includes(`**${version} 版本**`));
  assert.ok(english.includes(`**Version ${version}**`));
  for (const text of [readme, english]) {
    assert.ok(text.includes(`[\`v${version}\`](https://github.com/daftAI2026/PDSH/tree/v${version})`));
  }
  assert.match(english, /0\.3\.2[^\n]*normal load/iu);
  assert.match(english, /0\.5\.0[^\n]*does not support a no-restart upgrade/iu);
  assert.match(english, /Windows[^\n]*does not provide system wallpaper/iu);
  assert.match(english, /unverified/iu);
  for (const boundary of ['dark', 'Windows', 'English Desktop', 'alignment']) {
    assert.ok(english.includes(boundary), boundary);
  }
  assert.match(english, /does not provide session isolation, credential migration, or forensic privacy guarantees/iu);
  assert.match(english, /\[blobatar\]\(https:\/\/github\.com\/Alain00\/blobatar\)/u);
  assert.match(english, /generated locally[\s\S]*MIT License/u);
  assert.match(english, /\[Third-Party Notices\]\(THIRD_PARTY_NOTICES\.md\)/u);
});

test('英文发布指南完整保留现行门，历史原文只指向权威归档', async () => {
  const english = await read('PUBLISHING.en.md');
  for (const heading of ['Public Metadata and Tag Gate', 'Single Bundle and Native Artifacts',
    'Upgrade Compatibility', 'Temporary RC Packages', 'Separate Verification Gates',
    'System Wallpapers and Local Gallery', 'Standard Layered Gates', 'Historical Contracts']) {
    assert.ok(english.includes('## ' + heading) || english.includes('### ' + heading), heading);
  }
  assert.match(english, /GitHub Releases are disabled by default/u);
  assert.match(english, /npm publishing remains disabled/iu);
  assert.match(english, /fixed SHA/u);
  assert.match(english, /0\.5\.0[^\n]*v2 shell/u);
  assert.match(english, /user[\s\S]*click[\s\S]*upgrade/iu);
  assert.match(english, /PUBLISHING\.md#历史发布合同原文/u);
  assert.match(english, /Historical contracts do not authorize/u);
  assert.doesNotMatch(english, /pdsh:legacy-release-contracts:start/u);
});

test('项目 skill 强制公开文档成对同步，不要求改写历史原话', async () => {
  const skill = await read('.agents/skills/pdsh-release-lifecycle/SKILL.md');
  const stable = await read('.agents/skills/pdsh-release-lifecycle/references/stable.md');
  for (const text of [skill, stable]) {
    assert.ok(text.includes('README.md') && text.includes('README.en.md'));
    assert.ok(text.includes('PUBLISHING.md') && text.includes('PUBLISHING.en.md'));
  }
  assert.match(skill, /双语[^\n]*同步/u);
  assert.match(skill, /互链/u);
  assert.match(skill, /历史[^\n]*原文[^\n]*(?:保留|不改写)/u);
  assert.ok(skill.includes('tests/public-guides.test.ts'));
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
