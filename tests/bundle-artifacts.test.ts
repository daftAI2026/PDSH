/**
 * [INPUT]: 依赖单包产物校验器与隔离临时发布目录。
 * [OUTPUT]: 验证有效单包，并拒绝子依赖、缺失/链接产物、重复运行入口与版本漂移。
 * [POS]: 分发拓扑回归门；不读取用户配置、联网或运行安装脚本。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync, symlinkSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateBundleArtifacts, validatePackedBundle } from '../bundle-artifacts.ts';

function artifactFixture() {
  const root = mkdtempSync(join(tmpdir(), 'pdsh-artifacts-'));
  const manifest = { name: '@daftai/pdsh', private: true, version: '0.3.0',
    files: ['index.js', 'client.js', 'client.js.map', 'main.cjs', 'cordis.patch.yml', 'plugin-icon.svg', 'style-sources.json', 'THIRD_PARTY_NOTICES.md', 'LICENSE', 'locale/*.json'],
    exports: { '.': './index.js', './client': './client.js' }, dsh: { bundle: { patch: './cordis.patch.yml' } },
    dependencies: { '@deepseek-ai/schemastery': '3.18.4', blobatar: '2.7.0' }, scripts: {} };
  mkdirSync(join(root, 'locale'));
  const write = (file: string, value: string) => writeFileSync(join(root, file), value);
  const save = () => write('package.json', JSON.stringify(manifest));
  save();
  for (const file of ['style-sources.json', 'THIRD_PARTY_NOTICES.md', 'LICENSE', 'README.md']) write(file, 'fixture');
  write('cordis.patch.yml', '- insert:\n    - id: pdsh\n      name: "@daftai/pdsh"\n');
  for (const file of ['index.js', 'main.cjs']) write(file, '/* PDSH build "0.3.0" */');
  write('client.js', '/* PDSH build "0.3.0" */\nwindow.__ModuleLoader__.load({id:"@daftai/pdsh",factory:()=>({})});');
  for (const file of ['client.js.map', 'plugin-icon.svg', 'locale/zh.json', 'locale/en.json']) write(file, '{}');
  return { root, manifest, write, save, dispose: () => rmSync(root, { recursive: true, force: true }) };
}

test('单包完整产物不需要 tag、Git 子依赖或安装脚本', () => {
  const h = artifactFixture(); try { assert.doesNotThrow(() => validateBundleArtifacts(h.root)); } finally { h.dispose(); }
});
test('每种历史拓扑与漂移都确实触发守门失败', () => {
  const defects = {
    semver: h => { h.manifest.version = 'invalid'; h.save(); },
    child: h => { h.manifest.dependencies['@daftai/pdsh-capture'] = 'github:x/y'; h.save(); },
    optional: h => { h.manifest.optionalDependencies = {'@daftai/pdsh-capture':'0.3.0'}; h.save(); },
    broadFiles: h => { h.manifest.files = ['**']; h.save(); },
    hook: h => { h.manifest.scripts.prepare = 'node build.js'; h.save(); },
    archive: h => { h.manifest.files = h.manifest.files.filter(file => file !== 'main.cjs'); h.save(); },
    missing: h => unlinkSync(join(h.root, 'main.cjs')),
    link: h => { unlinkSync(join(h.root, 'main.cjs')); symlinkSync('index.js', join(h.root, 'main.cjs')); },
    version: h => h.write('main.cjs', '/* PDSH build "0.2.1" */'),
    patch: h => h.write('cordis.patch.yml', '- id: pdsh\n  name: "@daftai/pdsh-capture"'),
    duplicate: h => h.write('client.js', '/* PDSH build "0.3.0" */\nwindow.__ModuleLoader__.load({id:"@daftai/pdsh"});window.__ModuleLoader__.load({id:"other"});'),
  };
  for (const [name, defect] of Object.entries(defects)) {
    const h = artifactFixture(); try { defect(h); assert.throws(() => validateBundleArtifacts(h.root), /bundle/, name); } finally { h.dispose(); }
  }
});

test('真实 tgz 的成员、类型、字节与当前候选一致才通过；不删除旧归档', () => {
  for (const defect of ['none', 'stale', 'extra', 'link']) {
    const h = artifactFixture();
    try {
      const staging = join(h.root, 'staging');
      mkdirSync(join(staging, 'package/locale'), {recursive:true});
      const files = ['package.json','index.js','client.js','client.js.map','main.cjs','cordis.patch.yml','plugin-icon.svg','style-sources.json','THIRD_PARTY_NOTICES.md','LICENSE','README.md','locale/zh.json','locale/en.json'];
      for (const file of files) copyFileSync(join(h.root, file), join(staging, 'package', file));
      if (defect === 'stale') writeFileSync(join(staging,'package/main.cjs'), 'old candidate');
      if (defect === 'extra') { writeFileSync(join(staging,'package/unexpected'), 'x'); files.push('unexpected'); }
      if (defect === 'link') { unlinkSync(join(staging,'package/main.cjs')); symlinkSync('index.js',join(staging,'package/main.cjs')); }
      const archive = join(h.root,'candidate.tgz');
      execFileSync('tar',['-czf',archive,'-C',staging,...files.map(file=>`package/${file}`)]);
      if (defect === 'none') { const proof=validatePackedBundle(h.root,archive); assert.equal(proof.members,13); assert.equal(proof.version,'0.3.0'); assert.match(proof.sha256,/^[a-f0-9]{64}$/); }
      else assert.throws(()=>validatePackedBundle(h.root,archive), /bundle archive/, defect);
    } finally { h.dispose(); }
  }
});
