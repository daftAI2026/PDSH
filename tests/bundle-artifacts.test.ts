/**
 * [INPUT]: 依赖单包产物校验器与隔离临时发布目录。
 * [OUTPUT]: 验证单包与私有能力面闭包，拒绝 ABI、helper 架构和归档执行位漂移。
 * [POS]: 分发拓扑回归门；不读取用户配置、联网或运行安装脚本。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, unlinkSync, symlinkSync, copyFileSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateBundleArtifacts, validatePackedBundle } from '../bundle-artifacts.ts';

import { artifactFixture } from './bundle-fixture.ts';

test('单包完整产物不需要 tag、Git 子依赖或安装脚本', () => {
  const h = artifactFixture(); try { assert.doesNotThrow(() => validateBundleArtifacts(h.root)); } finally { h.dispose(); }
});
test('能力面身份、版本、私有边界、独立 namespace 与 DTO 副本不可漂移', () => {
  type Fixture = ReturnType<typeof artifactFixture>;
  const defects: Record<string, (h: Fixture) => void> = {
    missingManifest: h => unlinkSync(join(h.root, 'lib/runtime-capabilities/package.json')),
    wrongOwner: h => {
      const path = join(h.root, 'lib/runtime-capabilities/package.json');
      const inner = JSON.parse(readFileSync(path, 'utf8')); inner.name = '@daftai/other-capabilities';
      h.write('lib/runtime-capabilities/package.json', JSON.stringify(inner));
    },
    wrongVersion: h => {
      const path = join(h.root, 'lib/runtime-capabilities/package.json');
      const inner = JSON.parse(readFileSync(path, 'utf8')); inner.version = '0.4.0';
      h.write('lib/runtime-capabilities/package.json', JSON.stringify(inner));
    },
    installable: h => {
      const path = join(h.root, 'lib/runtime-capabilities/package.json');
      const inner = JSON.parse(readFileSync(path, 'utf8')); inner.dependencies = { runtime: '1.2.3' };
      h.write('lib/runtime-capabilities/package.json', JSON.stringify(inner));
    },
    onlyBaseFace: h => {
      h.write('lib/runtime-capabilities/typert.host.js', readFileSync(join(h.root, 'lib/typert.host.js'), 'utf8'));
      h.write('lib/runtime-capabilities/typert.remote-client.js', readFileSync(join(h.root, 'lib/typert.remote-client.js'), 'utf8'));
    },
    dtoDrift: h => h.write('lib/runtime-capabilities/types/shared/system-wallpaper-protocol.d.ts', 'different DTO copy'),
  };
  for (const [name, defect] of Object.entries(defects)) {
    const h = artifactFixture();
    try { defect(h); assert.throws(() => validateBundleArtifacts(h.root), /bundle|runtime capability/i, name); }
    finally { h.dispose(); }
  }
});
test('壁纸候选须带完整 DTO、官方 Remote 方法和 v2 实现，不复用旧壳', () => {
  for (const defect of ['declaration', 'descriptor', 'runtime']) {
    const h = artifactFixture();
    try {
      if (defect === 'declaration') unlinkSync(join(h.root, 'lib/types/shared/system-wallpaper-protocol.d.ts'));
      if (defect === 'descriptor') h.write('lib/typert.remote-client.js', "method: 'capture' method: 'save' method: 'implementationVersion'");
      if (defect === 'runtime') h.write('lib/capture-runtime/0.3.0.js', '/* PDSH build "0.3.0" */ pdsh-capture-runtime-v1');
      assert.throws(() => validateBundleArtifacts(h.root), /bundle|Typert|runtime capability/i, defect);
    } finally { h.dispose(); }
  }
});
test('分发门拒绝非双架构helper、架构重复、截断与最低系统漂移', () => {
  for (const defect of ['text', 'single', 'duplicate', 'truncated', 'minimum']) {
    const h = artifactFixture();
    try {
      const path = join(h.root, 'native/window-capture');
      const bytes = readFileSync(path);
      if (defect === 'text') writeFileSync(path, 'not a Mach-O');
      else if (defect === 'single') { bytes.writeUInt32BE(1, 4); writeFileSync(path, bytes); }
      else if (defect === 'duplicate') { bytes.writeUInt32BE(bytes.readUInt32BE(8), 28); writeFileSync(path, bytes); }
      else if (defect === 'truncated') writeFileSync(path, bytes.subarray(0, 40));
      else { bytes.writeUInt32LE(0x000d0000, 48 + 32 + 12); writeFileSync(path, bytes); }
      assert.throws(() => validateBundleArtifacts(h.root), /native helper/, defect);
    } finally { h.dispose(); }
  }
});
test('Windows分发门拒绝非x64、非控制台和要求提权的PE', () => {
  for (const defect of ['machine', 'subsystem', 'manifest']) {
    const h = artifactFixture();
    try {
      const path = join(h.root, 'native/windows/window-capture-x64.exe');
      const bytes = readFileSync(path);
      if (defect === 'machine') bytes.writeUInt16LE(0xaa64, 68);
      else if (defect === 'subsystem') bytes.writeUInt16LE(2, 156);
      else { bytes.fill(0, 256); bytes.write('<requestedExecutionLevel level="requireAdministrator" uiAccess="false"/>', 256); }
      writeFileSync(path, bytes);
      assert.throws(() => validateBundleArtifacts(h.root), /Windows native helper/, defect);
    } finally { h.dispose(); }
  }
});
test('每种历史拓扑与漂移都确实触发守门失败', () => {
  const defects = {
    semver: h => { h.manifest.version = 'invalid'; h.save(); },
    child: h => { h.manifest.dependencies['@daftai/pdsh-capture'] = 'github:x/y'; h.save(); },
    optional: h => { h.manifest.optionalDependencies = {'@daftai/pdsh-capture':'0.3.0'}; h.save(); },
    broadFiles: h => { h.manifest.files = ['**']; h.save(); },
    hook: h => { h.manifest.scripts.prepare = 'node build.js'; h.save(); },
    archive: h => { h.manifest.files = h.manifest.files.filter(file => file !== 'native/window-capture'); h.save(); },
    missing: h => unlinkSync(join(h.root, 'index.js')),
    link: h => { unlinkSync(join(h.root, 'index.js')); symlinkSync('client.js', join(h.root, 'index.js')); },
    version: h => h.write('index.js', '/* PDSH build "0.2.1" */'),
    patch: h => h.write('cordis.patch.yml', '- id: pdsh\n  name: "@daftai/pdsh-capture"'),
    duplicate: h => h.write('client.js', '/* PDSH build "0.3.0" */\nwindow.__ModuleLoader__.load({id:"@daftai/pdsh"});window.__ModuleLoader__.load({id:"other"});'),
  };
  for (const [name, defect] of Object.entries(defects)) {
    const h = artifactFixture(); try { defect(h); assert.throws(() => validateBundleArtifacts(h.root), /bundle/, name); } finally { h.dispose(); }
  }
});

test('真实 tgz 的成员、类型、字节与当前候选一致才通过；不删除旧归档', () => {
  const wrongHelperModes = { 'helper-mode': 0o644, 'helper-partial-mode': 0o744, 'helper-open-mode': 0o777 };
  for (const defect of ['none', 'stale', 'extra', 'link', ...Object.keys(wrongHelperModes)]) {
    const h = artifactFixture();
    try {
      const staging = join(h.root, 'staging');
      mkdirSync(join(staging, 'package/locale'), {recursive:true});
      const files = [...h.files];
      for (const file of files) { mkdirSync(join(staging, 'package', file, '..'), {recursive:true}); copyFileSync(join(h.root, file), join(staging, 'package', file)); }
      if (defect === 'stale') writeFileSync(join(staging,'package/index.js'), 'old candidate');
      if (defect === 'extra') { writeFileSync(join(staging,'package/unexpected'), 'x'); files.push('unexpected'); }
      if (defect === 'link') { unlinkSync(join(staging,'package/index.js')); symlinkSync('client.js',join(staging,'package/index.js')); }
      if (wrongHelperModes[defect]) chmodSync(join(staging,'package/native/window-capture'), wrongHelperModes[defect]);
      const archive = join(h.root,'candidate.tgz');
      execFileSync('tar',['-czf',archive,'-C',staging,...files.map(file=>`package/${file}`)]);
      if (defect === 'none') { const proof=validatePackedBundle(h.root,archive); assert.equal(proof.members,h.files.length); assert.equal(proof.version,'0.3.0'); assert.match(proof.sha256,/^[a-f0-9]{64}$/); }
      else assert.throws(()=>validatePackedBundle(h.root,archive), /bundle archive/, defect);
    } finally { h.dispose(); }
  }
});
