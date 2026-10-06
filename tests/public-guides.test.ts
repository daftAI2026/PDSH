/**
 * [INPUT]: 依赖根指南、发布 skill、README 和许可。依赖 Node 文件与摘要接口。
 * [OUTPUT]: 验证指南边界、skill 导航、历史原文和头像致谢。
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

// -------------------- 开源致谢 --------------------
test('README 点名离线头像上游并保留完整许可声明', async () => {
  const readme = await read('README.md');
  assert.match(readme, /\[blobatar\]\(https:\/\/github\.com\/Alain00\/blobatar\)/u);
  assert.match(readme, /## 致谢[\s\S]*本地生成[\s\S]*MIT/u);
  assert.match(readme, /\[第三方声明\]\(THIRD_PARTY_NOTICES\.md\)/u);
  const license = await read('node_modules/blobatar/LICENSE');
  assert.ok((await read('THIRD_PARTY_NOTICES.md')).includes(license.trim()));
});
