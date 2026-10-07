/**
 * [INPUT]: 依赖 release-metadata 的固定公开文案、临时双语 README 和元信息文件。
 * [OUTPUT]: 验证双语描述同源、受限同步和写入前结构校验。另验纯 GitHub 边界。
 * [POS]: 公开元信息的文件/远端校验回归；不请求 GitHub、不写远端、不改正式项目文件。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  PUBLIC_METADATA, syncGithubMetadata, syncPublicMetadata, validateGithubMetadata, validatePublicMetadata,
} from '../tools/release-metadata.ts';

const START = '<!-- pdsh:description:start -->';
const END = '<!-- pdsh:description:end -->';
const HOMEPAGE = 'https://github.com/daftAI2026/PDSH#readme';

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'pdsh-release-metadata-'));
  mkdirSync(join(root, 'locale'));
  const manifest = {
    name: '@daftai/pdsh', version: '0.4.0', description: PUBLIC_METADATA.description,
    homepage: HOMEPAGE, private: true, scripts: { build: 'keep-me' }, unrelated: { preserve: true },
  };
  const zh = { meta: { ...PUBLIC_METADATA.zh }, extra: { preserve: 'zh' } };
  const en = { meta: { ...PUBLIC_METADATA.en }, extra: { preserve: 'en' } };
  const readme = `# DSH 私密模式\n\nBefore block.\n${START}\n${PUBLIC_METADATA.zh.description}\n${END}\n\n**0.4.0 版本** · v0.4.0\nAfter block.\n`;
  const readmeEn = `# DSH Private Mode\n\nBefore English block.\n${START}\n${PUBLIC_METADATA.en.description}\n${END}\n\n**Version 0.4.0** · v0.4.0\nAfter English block.\n`;
  writeFileSync(join(root, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(root, 'locale/zh.json'), `${JSON.stringify(zh, null, 2)}\n`);
  writeFileSync(join(root, 'locale/en.json'), `${JSON.stringify(en, null, 2)}\n`);
  writeFileSync(join(root, 'README.md'), readme);
  writeFileSync(join(root, 'README.en.md'), readmeEn);
  return {
    root,
    dispose: () => rmSync(root, { recursive: true, force: true }),
    readme,
    readmeEn,
  };
}

function updateJson(root: string, path: string, update: (value: any) => void) {
  const absolute = join(root, path);
  const value = JSON.parse(readFileSync(absolute, 'utf8'));
  update(value);
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`);
}

test('公开元信息源保持指定中文/英文文案、GitHub简介和topics', () => {
  assert.deepEqual(PUBLIC_METADATA.zh, {
    title: 'DSH 私密模式',
    description: '遮挡侧栏标题、自定义昵称与头像，截取并打码编辑当前窗口。不提供会话隔离。',
  });
  assert.deepEqual(PUBLIC_METADATA.en, {
    title: 'DSH Private Mode',
    description: 'Mask sidebar titles, customize display aliases, and capture and redact this window. No session isolation.',
  });
  assert.equal(PUBLIC_METADATA.description,
    'DeepSeek Harness plugin for sidebar masking, display aliases, and local screenshot editing. No session isolation.');
  assert.deepEqual(PUBLIC_METADATA.topics,
    ['dsh-plugin', 'deepseek-harness', 'deepseek', 'screenshot', 'redaction', 'typescript']);
});

test('本地校验要求 package、zh/en locale 与README管理块同源', () => {
  const fixture = createFixture();
  try { assert.doesNotThrow(() => validatePublicMetadata(fixture.root)); }
  finally { fixture.dispose(); }
});

test('本地校验拒绝 package 描述和 locale 标题/描述漂移', () => {
  for (const mutate of [
    (root: string) => updateJson(root, 'package.json', value => { value.description = 'drift'; }),
    (root: string) => updateJson(root, 'locale/zh.json', value => { value.meta.title = 'drift'; }),
    (root: string) => updateJson(root, 'locale/zh.json', value => { value.meta.description = 'drift'; }),
    (root: string) => updateJson(root, 'locale/en.json', value => { value.meta.title = 'drift'; }),
    (root: string) => updateJson(root, 'locale/en.json', value => { value.meta.description = 'drift'; }),
  ]) {
    const fixture = createFixture();
    try { mutate(fixture.root); assert.throws(() => validatePublicMetadata(fixture.root)); }
    finally { fixture.dispose(); }
  }
});

test('README description 管理块必须且只能有一对匹配标记与固定单行文案', () => {
  for (const mutate of [
    (readme: string) => readme.replace(START, '<!-- other:start -->'),
    (readme: string) => `${readme}\n${START}\n${PUBLIC_METADATA.zh.description}\n${END}\n`,
    (readme: string) => readme.replace(END, `${END}\n${END}`),
    (readme: string) => readme.replace(PUBLIC_METADATA.zh.description, '错误文案'),
    (readme: string) => readme.replace(PUBLIC_METADATA.zh.description, `v0.4.0 ${PUBLIC_METADATA.zh.description}`),
    (readme: string) => readme.replace(`${START}\n${PUBLIC_METADATA.zh.description}\n${END}`, `${END}\n${PUBLIC_METADATA.zh.description}\n${START}`),
  ]) {
    const fixture = createFixture();
    try {
      writeFileSync(join(fixture.root, 'README.md'), mutate(fixture.readme));
      assert.throws(() => validatePublicMetadata(fixture.root), /README|marker|description/i);
    } finally { fixture.dispose(); }
  }
});

test('英文 README 缺失、描述漂移或标记损坏也须拒绝，不让中文绿灯掩盖漏译', () => {
  for (const defect of ['missing', 'drift', 'duplicate', 'reversed']) {
    const fixture = createFixture();
    try {
      const path = join(fixture.root, 'README.en.md');
      if (defect === 'missing') rmSync(path);
      else writeFileSync(path, defect === 'drift'
        ? fixture.readmeEn.replace(PUBLIC_METADATA.en.description, 'Stale English description.')
        : defect === 'duplicate' ? `${fixture.readmeEn}\n${START}\n${PUBLIC_METADATA.en.description}\n${END}\n`
          : fixture.readmeEn.replace(`${START}\n${PUBLIC_METADATA.en.description}\n${END}`, `${END}\n${PUBLIC_METADATA.en.description}\n${START}`));
      assert.throws(() => validatePublicMetadata(fixture.root), /README\.en\.md/iu, defect);
    } finally { fixture.dispose(); }
  }
});

test('sync 同步英文描述且保留 CRLF、版本和块外正文', () => {
  const fixture = createFixture();
  try {
    const stale = fixture.readmeEn.replace(PUBLIC_METADATA.en.description, 'Old English.').replaceAll('\n', '\r\n');
    writeFileSync(join(fixture.root, 'README.en.md'), stale);
    syncPublicMetadata(fixture.root);
    validatePublicMetadata(fixture.root);
    assert.equal(readFileSync(join(fixture.root, 'README.en.md'), 'utf8'), stale.replace('Old English.', PUBLIC_METADATA.en.description));
  } finally { fixture.dispose(); }
});

test('英文结构错误或文件缺失时 sync 在写入前失败，保留全部中文和 JSON 目标', () => {
  for (const missing of [false, true]) {
    const fixture = createFixture();
    try {
      updateJson(fixture.root, 'package.json', value => { value.description = 'stale package'; });
      updateJson(fixture.root, 'locale/zh.json', value => { value.meta.description = '旧描述'; });
      const path = join(fixture.root, 'README.en.md');
      if (missing) rmSync(path);
      else writeFileSync(path, fixture.readmeEn.replace(END, '<!-- missing end -->'));
      const targets = ['package.json', 'locale/zh.json', 'locale/en.json', 'README.md', ...(missing ? [] : ['README.en.md'])];
      const before = targets.map(name => readFileSync(join(fixture.root, name), 'utf8'));
      assert.throws(() => syncPublicMetadata(fixture.root), /README\.en\.md/iu);
      assert.deepEqual(targets.map(name => readFileSync(join(fixture.root, name), 'utf8')), before);
    } finally { fixture.dispose(); }
  }
});

test('sync 只更改允许的元信息字段与README块，保留版本、其他配置和块外文本', () => {
  const fixture = createFixture();
  try {
    updateJson(fixture.root, 'package.json', value => { value.description = 'old'; });
    updateJson(fixture.root, 'locale/zh.json', value => { value.meta.title = '旧标题'; value.meta.description = '旧描述'; });
    updateJson(fixture.root, 'locale/en.json', value => { value.meta.title = 'Old title'; value.meta.description = 'Old description'; });
    const staleReadme = fixture.readme.replace(PUBLIC_METADATA.zh.description, '旧README描述');
    writeFileSync(join(fixture.root, 'README.md'), staleReadme);

    assert.doesNotThrow(() => syncPublicMetadata(fixture.root));
    validatePublicMetadata(fixture.root);
    const manifest = JSON.parse(readFileSync(join(fixture.root, 'package.json'), 'utf8'));
    assert.equal(manifest.description, PUBLIC_METADATA.description);
    assert.equal(manifest.version, '0.4.0');
    assert.deepEqual(manifest.scripts, { build: 'keep-me' });
    assert.deepEqual(manifest.unrelated, { preserve: true });
    for (const locale of ['zh', 'en'] as const) {
      const value = JSON.parse(readFileSync(join(fixture.root, `locale/${locale}.json`), 'utf8'));
      assert.deepEqual(value.meta, PUBLIC_METADATA[locale]);
      assert.deepEqual(value.extra, { preserve: locale });
    }
    const readme = readFileSync(join(fixture.root, 'README.md'), 'utf8');
    assert.equal(readme.slice(0, readme.indexOf(START)), staleReadme.slice(0, staleReadme.indexOf(START)));
    assert.equal(readme.slice(readme.indexOf(END) + END.length), staleReadme.slice(staleReadme.indexOf(END) + END.length));
    assert.match(readme, new RegExp(`${START}\\n${PUBLIC_METADATA.zh.description}\\n${END}`));
  } finally { fixture.dispose(); }
});

test('sync 在任一目标结构/README标记不合格时先失败，不部分写文件', () => {
  const fixture = createFixture();
  try {
    updateJson(fixture.root, 'package.json', value => { value.description = 'old'; });
    updateJson(fixture.root, 'locale/zh.json', value => { value.meta.description = 'old zh'; });
    updateJson(fixture.root, 'locale/en.json', value => { value.meta.description = 'old en'; });
    writeFileSync(join(fixture.root, 'README.md'), fixture.readme.replace(END, '<!-- missing end -->'));
    const before = ['package.json', 'locale/zh.json', 'locale/en.json', 'README.md']
      .map(path => readFileSync(join(fixture.root, path), 'utf8'));

    assert.throws(() => syncPublicMetadata(fixture.root), /README|marker/i);
    const after = ['package.json', 'locale/zh.json', 'locale/en.json', 'README.md']
      .map(path => readFileSync(join(fixture.root, path), 'utf8'));
    assert.deepEqual(after, before);
  } finally { fixture.dispose(); }
});

test('RC 或错仓身份在稳定本地/GitHub 同步前拒绝且不产生副作用', () => {
  for (const name of ['@daftai/pdsh-rc', '@another/pdsh']) {
    const fixture = createFixture();
    let apiCalls = 0;
    try {
      updateJson(fixture.root, 'package.json', value => { value.name = name; });
      const paths = ['package.json', 'locale/zh.json', 'locale/en.json', 'README.md'];
      const before = paths.map(path => readFileSync(join(fixture.root, path), 'utf8'));
      assert.throws(() => syncPublicMetadata(fixture.root), /stable|package\.json name/i);
      assert.deepEqual(paths.map(path => readFileSync(join(fixture.root, path), 'utf8')), before);

      assert.throws(() => syncGithubMetadata(fixture.root, () => {
        apiCalls += 1;
        return '{}';
      }), /stable|package\.json name/i);
      assert.equal(apiCalls, 0);
      assert.deepEqual(paths.map(path => readFileSync(join(fixture.root, path), 'utf8')), before);
    } finally { fixture.dispose(); }
  }
});

test('GitHub About 字段精确匹配描述/homepage，topics按集合校验且不允许重复/漏/未知', () => {
  const fixture = createFixture();
  const valid = {
    description: PUBLIC_METADATA.description,
    homepage: HOMEPAGE,
    topics: [...PUBLIC_METADATA.topics].reverse(),
  };
  try {
    assert.doesNotThrow(() => validateGithubMetadata(fixture.root, valid));
    for (const invalid of [
      { ...valid, description: 'wrong description' },
      { ...valid, homepage: 'https://example.com/' },
      { ...valid, topics: [...PUBLIC_METADATA.topics, PUBLIC_METADATA.topics[0]] },
      { ...valid, topics: PUBLIC_METADATA.topics.slice(1) },
      { ...valid, topics: [...PUBLIC_METADATA.topics, 'unknown-topic'] },
      { ...valid, topics: 'not-an-array' },
    ]) assert.throws(() => validateGithubMetadata(fixture.root, invalid));
  } finally { fixture.dispose(); }
});

test('GitHub 同步通过注入 API 只 PATCH About、JSON PUT topics 并读取两个端点严格复核', () => {
  const fixture = createFixture();
  const requests: Array<{ args: string[]; input?: string }> = [];
  const remote = { description: 'old', homepage: 'https://old.example/', topics: [] as string[] };
  const fakeApi = (args: string[], input?: string): string => {
    requests.push({ args, ...(input === undefined ? {} : { input }) });
    if (args[0] === 'repos/daftAI2026/PDSH' && args.includes('--method')) {
      assert.deepEqual(args, [
        'repos/daftAI2026/PDSH', '--method', 'PATCH',
        '-f', `description=${PUBLIC_METADATA.description}`, '-f', `homepage=${HOMEPAGE}`,
      ]);
      remote.description = args[args.indexOf('-f') + 1].slice('description='.length);
      remote.homepage = args[args.indexOf('-f', args.indexOf('-f') + 1) + 1].slice('homepage='.length);
      return '{}';
    }
    if (args[0] === 'repos/daftAI2026/PDSH/topics' && args.includes('--method')) {
      assert.deepEqual(args, [
        'repos/daftAI2026/PDSH/topics', '--method', 'PUT',
        '-H', 'Accept: application/vnd.github+json', '--input', '-',
      ]);
      assert.deepEqual(JSON.parse(input ?? ''), { names: PUBLIC_METADATA.topics });
      remote.topics = [...JSON.parse(input ?? '').names];
      return JSON.stringify({ names: remote.topics });
    }
    if (args[0] === 'repos/daftAI2026/PDSH') return JSON.stringify({
      description: remote.description, homepage: remote.homepage,
    });
    if (args[0] === 'repos/daftAI2026/PDSH/topics') return JSON.stringify({ names: remote.topics });
    throw new Error(`unexpected gh api request: ${args.join(' ')}`);
  };
  try {
    assert.doesNotThrow(() => syncGithubMetadata(fixture.root, fakeApi));
    assert.deepEqual(requests.map(request => request.args[0]), [
      'repos/daftAI2026/PDSH', 'repos/daftAI2026/PDSH/topics',
      'repos/daftAI2026/PDSH', 'repos/daftAI2026/PDSH/topics',
    ]);
    assert.equal(requests[0].args[requests[0].args.indexOf('--method') + 1], 'PATCH');
    assert.equal(requests[1].args[requests[1].args.indexOf('--method') + 1], 'PUT');
    assert.equal(requests[1].input, JSON.stringify({ names: PUBLIC_METADATA.topics }));
  } finally { fixture.dispose(); }
});

test('导入模块不执行CLI或调用GitHub边界', () => {
  const source = pathToFileURL(join(process.cwd(), 'tools/release-metadata.ts')).href;
  const result = execFileSync(process.execPath,
    ['--experimental-strip-types', '--input-type=module', '-e', `await import(${JSON.stringify(source)})`],
    { cwd: tmpdir(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(result, '');
});
