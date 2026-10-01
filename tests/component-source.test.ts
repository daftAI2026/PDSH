/**
 * [INPUT]: 依赖固定 SHA 组件验证器与独立临时 Git 树，不读取用户 profile。
 * [OUTPUT]: 验证同仓库子目录来源、版本及全部运行字节；拒绝漂移与链接。
 * [POS]: 两阶段 Bundle 分发的源契约；本地对象验证不代表网络或 Desktop 验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateComponentSources } from '../component-source.ts';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'pdsh-component-source-')), version = '0.3.0-rc.10';
  const write = (file: string, bytes: string) => writeFileSync(join(root, file), bytes);
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, stdio: 'pipe', encoding: 'utf8' });
  const manifest = { name: '@daftai/pdsh', version, dependencies: {} as Record<string, string> };
  write('package.json', JSON.stringify(manifest));
  for (const kind of ['titles', 'capture']) {
    mkdirSync(join(root, `components/${kind}/locale`), { recursive: true });
    write(`components/${kind}/package.json`, JSON.stringify({ name: `@daftai/pdsh-${kind}`, version }));
    for (const file of ['index.js', 'client.js', 'client.js.map', 'plugin-icon.svg', 'locale/zh.json', 'locale/en.json', ...(kind === 'capture' ? ['main.cjs'] : [])]) write(`components/${kind}/${file}`, `${kind}/${file}\n`);
  }
  git('init', '-q'); git('add', '.'); git('-c', 'user.name=PDSH Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'component source');
  const sha = git('rev-parse', 'HEAD').trim();
  const source = (kind: string, revision = sha) => `github:daftAI2026/PDSH#${revision}&path:/components/${kind}`;
  for (const kind of ['titles', 'capture']) manifest.dependencies[`@daftai/pdsh-${kind}`] = source(kind);
  const save = () => write('package.json', JSON.stringify(manifest)); save();
  return { root, manifest, sha, source, save, write, git, dispose: () => rmSync(root, { recursive: true, force: true }) };
}

test('两个普通依赖固定同仓库同 SHA，版本与完整组件字节相同', () => {
  const h = fixture(); try { validateComponentSources(h.root); } finally { h.dispose(); }
});

for (const defect of ['wrong-repo', 'branch', 'different-sha', 'missing-object', 'stale-bytes', 'child-version', 'child-name', 'symlink', 'bundled', 'file-dependency']) {
  test(`组件源拒绝 ${defect}，不获取网络对象或修改生成产物`, () => {
    const h = fixture();
    try {
      if (defect === 'wrong-repo') h.manifest.dependencies['@daftai/pdsh-titles'] = h.source('titles').replace('daftAI2026/PDSH', 'another/PDSH');
      if (defect === 'branch') h.manifest.dependencies['@daftai/pdsh-titles'] = h.source('titles', 'main');
      if (defect === 'different-sha') { h.write('README.md', 'second source generation'); h.git('add', 'README.md'); h.git('-c', 'user.name=PDSH Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'next generation'); h.manifest.dependencies['@daftai/pdsh-capture'] = h.source('capture', h.git('rev-parse', 'HEAD').trim()); }
      if (defect === 'missing-object') for (const kind of ['titles', 'capture']) h.manifest.dependencies[`@daftai/pdsh-${kind}`] = h.source(kind, 'f'.repeat(40));
      if (defect === 'stale-bytes') h.write('components/capture/main.cjs', 'changed Main');
      if (defect === 'child-version') h.write('components/capture/package.json', JSON.stringify({ name: '@daftai/pdsh-capture', version: '0.2.1' }));
      if (defect === 'child-name') h.write('components/titles/package.json', JSON.stringify({ name: '@daftai/other', version: h.manifest.version }));
      if (defect === 'symlink') { const file = join(h.root, 'components/titles/client.js'); unlinkSync(file); symlinkSync('index.js', file); }
      if (defect === 'bundled') Object.assign(h.manifest, { bundledDependencies: ['@daftai/pdsh-titles'] });
      if (defect === 'file-dependency') h.manifest.dependencies['@daftai/pdsh-titles'] = 'file:./components/titles';
      h.save(); assert.throws(() => validateComponentSources(h.root), /component source/);
    } finally { h.dispose(); }
  });
}

test('固定提交与当前字节都为空时仍拒绝空运行入口', () => {
  const h = fixture();
  try {
    h.write('components/capture/main.cjs', '');
    h.git('add', 'components/capture/main.cjs');
    h.git('-c', 'user.name=PDSH Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'empty artifact');
    const sha = h.git('rev-parse', 'HEAD').trim();
    for (const kind of ['titles', 'capture']) h.manifest.dependencies[`@daftai/pdsh-${kind}`] = h.source(kind, sha);
    h.save();
    assert.throws(() => validateComponentSources(h.root), /component source.*empty/);
  } finally { h.dispose(); }
});
