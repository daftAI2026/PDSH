/**
 * [INPUT]: 依赖仓库根目录的构建脚本、宿主入口与 package.json 的命令合同。
 * [OUTPUT]: 验证手写脚本均为 TypeScript，根目录 JavaScript 只剩宿主必须的生成产物。
 * [POS]: 源码/产物边界回归；避免把可维护逻辑藏回手写 JS，也不误删 Harness 入口。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, readlinkSync, lstatSync } from 'node:fs';

test('手写构建与发布脚本为TS；根目录JS只保留宿主生成入口', () => {
  const root = new URL('../', import.meta.url);
  const files = readdirSync(root);
  assert.deepEqual(files.filter(file => /\.(?:mjs|js)$/.test(file)).sort(), ['client.js', 'index.js']);
  assert.ok(files.includes('build.ts') && files.includes('check-release.ts'));
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(manifest.scripts.build, /build\.ts/);
  assert.match(manifest.scripts['release:check'], /check-release\.ts/);
});


test('一个 Bundle 发布三个包内入口；身份兼容旧模块名和 namespace', () => {
  const root = new URL('../', import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
  assert.deepEqual(manifest.bundledDependencies, ['@daftai/pdsh-titles', '@daftai/pdsh-capture']);
  assert.ok(manifest.files.includes('components/'), '归档必须包含两个包内入口与其所有资源');
  for (const kind of ['titles', 'capture']) {
    const child = JSON.parse(readFileSync(new URL(`components/${kind}/package.json`, root), 'utf8'));
    assert.equal(child.name, `@daftai/pdsh-${kind}`);
    assert.equal(child.version, manifest.version);
    assert.equal(manifest.dependencies[child.name], `file:./components/${kind}`, '根 Bundle 声明真实传递依赖，不写 profile 顶层依赖');
    assert.ok(child.dsh.client, '就近 manifest 声明 Client 节点，声明真实独立 Client table 身份');
    assert.match(readFileSync(new URL(`components/${kind}/client.js`, root), 'utf8'), new RegExp(child.name));
    for (const lang of ['zh', 'en']) assert.ok(JSON.parse(readFileSync(new URL(`components/${kind}/locale/${lang}.json`, root), 'utf8')).meta.title);
  }
  const patch = readFileSync(new URL('cordis.patch.yml', root), 'utf8');
  for (const [id, module] of [['pdsh', '@daftai/pdsh'], ['pdsh-titles', '@daftai/pdsh-titles'], ['pdsh-capture', '@daftai/pdsh-capture']]) {
    assert.match(patch, new RegExp(`id: ${id}\n +name: "${module}"`));
  }
});
test('只有拍照 Client 带编辑器离线壁纸，身份/标题不复制其重资产',()=>{
  for(const path of ['../client.js','../components/titles/client.js'])assert.doesNotMatch(readFileSync(new URL(path,import.meta.url),'utf8'),/data:image\/jpeg;base64,/);
  assert.match(readFileSync(new URL('../components/capture/client.js',import.meta.url),'utf8'),/data:image\/jpeg;base64,/);
});

test('Git 分发只使用两条已知包内自链接；与真实 bundled dependencies 同源', () => {
  for (const kind of ['titles', 'capture']) {
    const path = new URL(`../node_modules/@daftai/pdsh-${kind}`, import.meta.url);
    assert.ok(lstatSync(path).isSymbolicLink());
    assert.equal(readlinkSync(path), `../../components/${kind}`);
  }
});
