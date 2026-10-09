/**
 * [INPUT]: 依赖 pack-rc 的显式公开源白名单、主题图标生成器与隔离 staging。
 * [OUTPUT]: 验证 RC 副本含双语说明、主题图标构建闭包且不改稳定源。
 * [POS]: 独立测试分发合同；不运行 SDK GUI、不改用户 profile，也不冒充 Manager/Desktop 验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync,
  realpathSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { createRcStage, deriveRcIdentity, packRc, RC_SOURCE_ALLOWLIST } from '../tools/pack-rc.ts';

function sourceFixture() {
  const rootDir = mkdtempSync(join(tmpdir(), 'pdsh-rc-source-'));
  const stageParent = mkdtempSync(join(tmpdir(), 'pdsh-rc-stage-parent-'));
  const outputRoot = mkdtempSync(join(tmpdir(), 'pdsh-rc-output-'));
  const files = {
    'package.json': JSON.stringify({ name: '@daftai/pdsh', version: '0.3.0', private: true, files: [] }, null, 2),
    'README.md': '# PDSH\n',
    'README.en.md': '# DSH Private Mode\n',
    'LICENSE': 'MIT\n',
    'THIRD_PARTY_NOTICES.md': 'Notices\n',
    'cordis.patch.yml': '- insert:\n    - id: pdsh\n      name: "@daftai/pdsh"\n',
    'style-sources.json': '{"fixture":true}\n',
    'build.ts': 'build source\n',
    'bundle-artifacts.ts': 'validator source\n',
    'tsconfig.json': '{}\n',
    'tsconfig.remote-types.json': '{}\n',
    'tools/generate-typert.ts': 'generator source\n',
    'tools/native-baseline.ts': 'baseline source\n',
    'tools/plugin-icon.ts': 'export function createThemeAwarePluginIcon() {}\n',
    'tools/typert-protocol-reference/package.json': '{"name":"fixture"}\n',
    'tools/typert-protocol-reference/src/index.ts': 'export {}\n',
    'src/host/index.ts': 'export {}\n',
    'src/shared/types.ts': 'export {}\n',
    'src/client/assets/capture.jpg': 'public-content\n',
    'native/build.sh': '#!/bin/sh\n',
    'native/window-capture': 'mac helper bytes\n',
    'native/window-capture.mm': 'native source\n',
    'native/windows/window-capture-x64.exe': 'windows helper bytes\n',
    'locale/zh.json': JSON.stringify({ meta: { title: 'DSH 私密模式', description: '中文功能说明。' } }, null, 2),
    'locale/en.json': JSON.stringify({ meta: { title: 'DSH Private Mode', description: 'English description.' } }, null, 2),
  };
  for (const [path, body] of Object.entries(files)) {
    const absolute = join(rootDir, path);
    mkdirSync(join(absolute, '..'), { recursive: true });
    writeFileSync(absolute, body);
  }
  writeFileSync(join(rootDir, 'src/client/user-pixels.png'), 'private pixel sentinel');
  for (const path of ['native/window-capture', 'native/windows/window-capture-x64.exe', 'native/build.sh']) {
    chmodSync(join(rootDir, path), 0o755);
  }
  mkdirSync(join(rootDir, 'node_modules'), { recursive: true });
  writeFileSync(join(rootDir, 'node_modules/private-sentinel'), 'dependency target, never copied');
  writeFileSync(join(rootDir, 'AGENTS.md'), 'private policy sentinel');
  mkdirSync(join(rootDir, '.internal-docs'), { recursive: true });
  writeFileSync(join(rootDir, '.internal-docs/research'), 'private research sentinel');
  mkdirSync(join(rootDir, 'output'), { recursive: true });
  writeFileSync(join(rootDir, 'output/user-image.png'), 'pixel sentinel');
  mkdirSync(join(rootDir, '.git'), { recursive: true });
  writeFileSync(join(rootDir, '.git/config'), 'git sentinel');
  mkdirSync(join(rootDir, '.playwright-cli'), { recursive: true });
  writeFileSync(join(rootDir, '.playwright-cli/state'), 'browser sentinel');
  writeFileSync(join(stageParent, 'caller-owned.txt'), 'must survive cleanup');
  return { rootDir, stageParent, outputRoot, dispose: () => {
    rmSync(rootDir, { recursive: true, force: true });
    rmSync(stageParent, { recursive: true, force: true });
    rmSync(outputRoot, { recursive: true, force: true });
  } };
}

test('从稳定语义版本派生独立 RC 身份，只接受正整数候选号', () => {
  assert.deepEqual(deriveRcIdentity({ name: '@daftai/pdsh', version: '0.3.0', private: true }, 1), {
    baseVersion: '0.3.0', version: '0.3.0-rc.1', packageName: '@daftai/pdsh-rc', rootEntryId: 'pdsh-rc', candidate: 1,
  });
  assert.equal(deriveRcIdentity({ name: '@daftai/pdsh', version: '2.10.4', private: true }, '27').version, '2.10.4-rc.27');
  for (const candidate of [0, -1, 1.5, NaN, Infinity, '0', '-1', '01', '1.0', '1x', '9007199254740992', '']) {
    assert.throws(() => deriveRcIdentity({ name: '@daftai/pdsh', version: '0.3.0', private: true }, candidate), /candidate/i, String(candidate));
  }
  for (const manifest of [
    { name: '@daftai/pdsh', version: '0.3', private: true },
    { name: '@daftai/pdsh', version: '0.3.0-beta.1', private: true },
    { name: '@daftai/pdsh', version: '01.3.0', private: true },
    { name: '@daftai/pdsh-rc', version: '0.3.0', private: true },
    { name: '@daftai/pdsh', version: '0.3.0', private: false },
  ]) assert.throws(() => deriveRcIdentity(manifest, 1), /source|version|private|stable/i);
});

test('stage 只复制公开白名单，在私有副本派生包/patch/locale，保留 helper 位且不改稳定源', async () => {
  const h = sourceFixture();
  const stableFiles = ['package.json', 'README.md', 'cordis.patch.yml', 'README.en.md', 'locale/zh.json', 'locale/en.json'];
  const before = new Map(stableFiles.map(path => [path, readFileSync(join(h.rootDir, path))]));
  let stage;
  try {
    assert.ok(RC_SOURCE_ALLOWLIST.includes('src') && RC_SOURCE_ALLOWLIST.includes('native'));
    stage = await createRcStage({ rootDir: h.rootDir, candidate: 3, stageParent: h.stageParent });
    assert.equal(resolve(stage.stageDir).startsWith(resolve(h.stageParent) + sep), true);
    if (process.platform !== 'win32') assert.equal(statSync(stage.stageDir).mode & 0o777, 0o700);
    assert.deepEqual(JSON.parse(readFileSync(join(stage.stageDir, 'package.json'), 'utf8')), {
      name: '@daftai/pdsh-rc', version: '0.3.0-rc.3', private: true, files: [],
    });
    assert.equal(readFileSync(join(stage.stageDir, 'cordis.patch.yml'), 'utf8'),
      '- insert:\n    - id: pdsh-rc\n      name: "@daftai/pdsh-rc"\n');
    const zh = JSON.parse(readFileSync(join(stage.stageDir, 'locale/zh.json'), 'utf8')).meta;
    const en = JSON.parse(readFileSync(join(stage.stageDir, 'locale/en.json'), 'utf8')).meta;
    assert.equal(zh.title, 'DSH 私密模式 RC');
    assert.match(zh.description, /先停用正式|先.*停用.*正式/);
    assert.equal(en.title, 'DSH Private Mode RC');
    assert.match(en.description, /disable.*stable|stable.*disable/i);
    const readme = readFileSync(join(stage.stageDir, 'README.md'), 'utf8');
    assert.match(readme, /official Plugin Manager test only/i);
    assert.match(readme, /uninstall only `@daftai\/pdsh-rc`/);
    assert.match(readme, /final native pixel alignment still requires acceptance/i);
    assert.match(readme, /not Desktop UI acceptance/i);
    const readmeEn = readFileSync(join(stage.stageDir, 'README.en.md'), 'utf8');
    assert.match(readmeEn, /official Plugin Manager test only/i);
    assert.match(readmeEn, /uninstall only `@daftai\/pdsh-rc`/u);
    assert.match(readmeEn, /# DSH Private Mode/u);
    for (const helper of ['native/window-capture', 'native/windows/window-capture-x64.exe']) {
      if (process.platform !== 'win32') assert.equal(statSync(join(stage.stageDir, helper)).mode & 0o777, 0o755, helper);
    }
    assert.equal(lstatSync(join(stage.stageDir, 'node_modules')).isSymbolicLink(), true);
    assert.equal(realpathSync(join(stage.stageDir, 'node_modules')), realpathSync(join(h.rootDir, 'node_modules')));
    for (const path of ['AGENTS.md', '.internal-docs', 'output', '.git', '.playwright-cli', 'src/client/user-pixels.png']) {
      assert.equal(lstatSync(join(stage.stageDir, path), { throwIfNoEntry: false }), undefined, `${path} excluded`);
    }
    assert.match(stage.source.sha256, /^[a-f0-9]{64}$/);
    assert.equal(typeof stage.source.dirty === 'boolean' || stage.source.dirty === null, true);
    for (const path of stableFiles) assert.deepEqual(readFileSync(join(h.rootDir, path)), before.get(path), `${path} unchanged`);
    assert.equal(readFileSync(join(h.stageParent, 'caller-owned.txt'), 'utf8'), 'must survive cleanup');
  } finally {
    await stage?.dispose();
    h.dispose();
  }
});

test('RC 白名单闭合主题图标生成器的 build import', async () => {
  const h = sourceFixture();
  const build = readFileSync(new URL('../build.ts', import.meta.url), 'utf8');
  let stage;
  try {
    assert.match(build, /from ['"]\.\/tools\/plugin-icon\.ts['"]/);
    assert.ok(RC_SOURCE_ALLOWLIST.includes('tools/plugin-icon.ts'), 'RC 必须复制 build.ts 的主题图标依赖');
    stage = await createRcStage({ rootDir: h.rootDir, candidate: 1, stageParent: h.stageParent });
    assert.deepEqual(readFileSync(join(stage.stageDir, 'tools/plugin-icon.ts')),
      readFileSync(join(h.rootDir, 'tools/plugin-icon.ts')));
  } finally {
    await stage?.dispose();
    h.dispose();
  }
});

test('stage 拒绝白名单内部符号链接并回收自己创建的临时目录', async () => {
  const h = sourceFixture();
  const outside = mkdtempSync(join(tmpdir(), 'pdsh-rc-outside-'));
  try {
    rmSync(join(h.rootDir, 'src/host'), { recursive: true, force: true });
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, 'secret.ts'), 'do not follow');
    symlinkSync(outside, join(h.rootDir, 'src/host'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(createRcStage({ rootDir: h.rootDir, candidate: 1, stageParent: h.stageParent }), /symbolic link|symlink/i);
    assert.deepEqual(readdirSync(h.stageParent).sort(), ['caller-owned.txt']);
  } finally {
    rmSync(outside, { recursive: true, force: true });
    h.dispose();
  }
});

test('同名归档预先存在时拒绝，不调用构建、不覆盖、不创建 staging', async () => {
  const h = sourceFixture();
  const archive = join(h.outputRoot, 'daftai-pdsh-rc-0.3.0-rc.2.tgz');
  writeFileSync(archive, 'caller archive sentinel');
  try {
    await assert.rejects(packRc({ rootDir: h.rootDir, candidate: 2, stageParent: h.stageParent, outputRoot: h.outputRoot,
      build: () => assert.fail('existing candidate must fail before build') }), /already exists|refuse|exist/i);
    assert.equal(readFileSync(archive, 'utf8'), 'caller archive sentinel');
    assert.deepEqual(readdirSync(h.stageParent).sort(), ['caller-owned.txt']);
  } finally { h.dispose(); }
});

test('显式 tools 叶路径不能通过符号链接父目录读取外部源码', async () => {
  const h = sourceFixture();
  const outside = mkdtempSync(join(tmpdir(), 'pdsh-rc-tools-outside-'));
  try {
    const externalTools = join(outside, 'tools');
    renameSync(join(h.rootDir, 'tools'), externalTools);
    symlinkSync(externalTools, join(h.rootDir, 'tools'), process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(createRcStage({ rootDir: h.rootDir, candidate: 1, stageParent: h.stageParent }), /symbolic link|symlink/i);
    assert.deepEqual(readdirSync(h.stageParent).sort(), ['caller-owned.txt']);
  } finally {
    h.dispose();
    rmSync(outside, { recursive: true, force: true });
  }
});

test('编译失败时只清理本次 staging，不清理调用方临时父目录或输出目录', async () => {
  const h = sourceFixture();
  writeFileSync(join(h.outputRoot, 'caller-output.txt'), 'preserve');
  let createdStage = '';
  try {
    await assert.rejects(packRc({ rootDir: h.rootDir, candidate: 4, stageParent: h.stageParent, outputRoot: h.outputRoot,
      build: (stageDir) => { createdStage = stageDir; throw new Error('injected compile failure'); } }), /injected compile failure/);
    assert.ok(createdStage);
    assert.equal(lstatSync(createdStage, { throwIfNoEntry: false }), undefined);
    assert.deepEqual(readdirSync(h.stageParent).sort(), ['caller-owned.txt']);
    assert.deepEqual(readdirSync(h.outputRoot).sort(), ['caller-output.txt']);
  } finally { h.dispose(); }
});
