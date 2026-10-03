/**
 * [INPUT]: 依赖根 Bundle manifest、唯一构建入口和提交的 Host/Client/Typert/native 产物。
 * [OUTPUT]: 验证一个安装包、一个 Cordis 入口、一个 Client factory；三个功能不得再次变成 Git 子依赖。
 * [POS]: 分发回归门；模块化不改变安装拓扑，原生整窗Helper和生成 Remote face同包，旧 Main不参与运行。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);

test('手写脚本保持 TypeScript；唯一 Host/Client 是生成产物，手写脚本仍为TS', () => {
  const files = readdirSync(root);
  assert.deepEqual(files.filter(file => /\.(?:mjs|js)$/.test(file)).sort(), ['client.js', 'index.js']);
  assert.ok(files.includes('build.ts') && files.includes('check-release.ts'));
  const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
  assert.match(manifest.scripts.build, /build\.ts/);
  assert.match(manifest.scripts['release:check'], /check-release\.ts/);
});

test('三个功能是源码模块，不是三个安装依赖或 Cordis 插件', () => {
  const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
  assert.equal(manifest.name, '@daftai/pdsh');
  assert.equal(manifest.private, true);
  assert.deepEqual(Object.keys(manifest.dependencies).filter(name => name.startsWith('@daftai/pdsh')), []);
  assert.equal(manifest.bundledDependencies, undefined);
  assert.equal(manifest.files.includes('components/'), false);
  assert.equal(manifest.files.includes('main.cjs'),false);
  assert.ok(manifest.files.some(path=>path.includes('typert')));
  assert.ok(manifest.files.some(path=>path.includes('native')));
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(manifest.exports['./client'], './client.js');
  const patch = readFileSync(new URL('cordis.patch.yml', root), 'utf8');
  assert.equal([...patch.matchAll(/- id:/g)].length, 1);
  assert.match(patch, /id: pdsh\s+name: "@daftai\/pdsh"/);
  for (const hook of ['preinstall', 'install', 'postinstall', 'prepare']) assert.equal(manifest.scripts[hook], undefined);
});

test('唯一 Client factory 包含内部功能，不能再加载子包或编译时选择运行身份', () => {
  const client = readFileSync(new URL('client.js', root), 'utf8');
  assert.equal([...client.matchAll(/window\.__ModuleLoader__\.load\(/g)].length, 1);
  assert.match(client, /id:"@daftai\/pdsh"/);
  assert.doesNotMatch(client, /@daftai\/pdsh-(?:identity|titles|capture)/);
  assert.match(client, /data:image\/jpeg;base64,/, '离线编辑素材只属于这份 Client，不复制为三个包');
  const entry = readFileSync(new URL('src/client/client-entry.tsx', root), 'utf8');
  const assembly = readFileSync(new URL('src/client/component-runtime.tsx', root), 'utf8');
  assert.doesNotMatch(entry + assembly, /__PDSH_COMPONENT__/);
});
