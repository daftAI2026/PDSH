/**
 * [INPUT]: 依赖真实 Bundle patch/生成入口、正常依赖与隔离 hoisted profile；锚定规则对应 DSH rc.2 app-boot 的 anchorInsertedPluginNames。
 * [OUTPUT]: 验证正常 hoisted 依赖可从 profile 加载，缺子包则失败；真实子包同时解析组件 manifest/locale/client；官方展示仍需 exact Host 与 Desktop 验证。
 * [POS]: 安装边界回归；根依赖的 hoisted 链接结构桩不代替官方 runtime interception/Client graph 验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

// +--- 仅读取本项目固定格式；不实现通用 YAML 或宿主 Loader ---+
function entries(patch: string) {
  const rows = [...patch.matchAll(/- id: ([\w-]+)\s+name: "([^"]+)"/g)].map(([, id, name]) => ({ id, name }));
  assert.equal(rows.length, 3, '三行入口必须全部被读取');
  return rows;
}
function fixture({ installed = true } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'pdsh-profile-loading-'));
  const root = fileURLToPath(new URL('../', import.meta.url));
  mkdirSync(join(profile, 'node_modules/@daftai'), { recursive: true });
  symlinkSync(root, join(profile, 'node_modules/@daftai/pdsh'));
  const bundleRequire=createRequire(join(root,'package.json'));
  if(installed) for(const kind of ['titles','capture']) symlinkSync(dirname(bundleRequire.resolve(`@daftai/pdsh-${kind}/package.json`)),join(profile,`node_modules/@daftai/pdsh-${kind}`));
  const require = createRequire(join(profile, 'profile-anchor.cjs'));
  return { profile, root: join(profile, 'node_modules/@daftai/pdsh'), require, dispose: () => rmSync(profile, { recursive: true, force: true }) };
}

test('模拟 hoisted profile 结构可直接解析三个 Host/Client/元信息', async () => {
  const h = fixture();
  try {
    for (const row of entries(readFileSync(join(h.root, 'cordis.patch.yml'), 'utf8'))) {
      // 相对插入路径由 app-boot 在读 patch 时锚定；裸名称保持字面值，从 profile 加载。
      const moduleUrl = row.name.startsWith('.')
        ? new URL(row.name, pathToFileURL(join(h.root, 'cordis.patch.yml')))
        : pathToFileURL(h.require.resolve(row.name));
      const host = await import(moduleUrl.href);
      assert.equal(typeof host.apply, 'function', `${row.id} Host 未加载`);
      if (row.id === 'pdsh-titles') {
        const mutations = [];
        await host.inheritLegacyTitles({
          root: { loader: { await: async () => {} } },
          configEditor: { configuration: () => [
            { entry: { options: { id: 'pdsh', name: '@daftai/pdsh', config: { maskTitles: true } } } },
            { entry: { options: { id: row.id, name: row.name, config: {} } } },
          ] },
          settings: { describe: () => [{ ns: row.id, revision: 1 }], async mutate(...args) { mutations.push(args); } },
        });
        assert.deepEqual(mutations, [[row.id, [{ op: 'set', path: ['maskTitles'], value: true }], 1]], '真实包名经 symlink 也必须归属同一生成 Host');
      }
      const owner = dirname(fileURLToPath(moduleUrl));
      const manifest = JSON.parse(readFileSync(join(owner, 'package.json'), 'utf8'));
      assert.equal(manifest.name, row.id === 'pdsh' ? '@daftai/pdsh' : `@daftai/${row.id}`);
      assert.equal(manifest.dsh.client.platform, 'web');
      const client = readFileSync(join(owner, manifest.exports['./client']), 'utf8');
      assert.ok(client.includes(`id:${JSON.stringify(manifest.name)}`), 'Client table ID 必须对应其 manifest，而非路径');
      for (const lang of ['zh', 'en']) assert.ok(JSON.parse(readFileSync(join(owner, `locale/${lang}.json`), 'utf8')).meta.title);
    }
  } finally { h.dispose(); }
});

test('坏入口正例：没有正常依赖的裸子包从 profile 确实失败', () => {
  const h = fixture({installed:false});
  try {
    const bundle = createRequire(join(h.root, 'package.json'));
    assert.ok(bundle.resolve('@deepseek-ai/schemastery'), 'Bundle 普通依赖仍按自身位置解析');
    for (const name of ['@daftai/pdsh-titles', '@daftai/pdsh-capture']) {
      assert.throws(() => h.require.resolve(name), { code: 'MODULE_NOT_FOUND' });
    }
  } finally { h.dispose(); }
});


test('三组件用真实包名同时满足 Client 与名称元信息发现，不回退文件地址', () => {
  const h = fixture();
  try {
    const rows = entries(readFileSync(join(h.root, 'cordis.patch.yml'), 'utf8'));
    for (const [id, specifier, title] of [
      ['pdsh-titles', '@daftai/pdsh-titles', '侧栏标题遮挡'],
      ['pdsh-capture', '@daftai/pdsh-capture', '窗口拍照'],
    ]) {
      assert.equal(rows.find(row => row.id === id)?.name, specifier);
      const rootManifest = JSON.parse(readFileSync(join(h.root, 'package.json'), 'utf8'));
      const kind = id === 'pdsh-titles' ? 'titles' : 'capture';
      assert.match(rootManifest.dependencies[specifier],new RegExp(`^github:daftAI2026/PDSH#[a-f0-9]{40}&path:/components/${kind}$`));
      assert.equal(rootManifest.bundledDependencies,undefined);
      const bundleRequire = createRequire(join(h.root, 'package.json'));
      const manifestPath = bundleRequire.resolve(`${specifier}/package.json`);
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      for (const language of ['zh', 'en']) {
        const meta = JSON.parse(readFileSync(bundleRequire.resolve(`${specifier}/locale/${language}.json`), 'utf8')).meta;
        assert.ok(meta.title); assert.ok(meta.description);
        if (language === 'zh') assert.equal(meta.title, title);
      }
      assert.ok(readFileSync(join(dirname(manifestPath), manifest.icon), 'utf8').includes('<svg'));
      assert.equal(bundleRequire.resolve(specifier), join(dirname(manifestPath), 'index.js'));
      assert.equal(bundleRequire.resolve(`${specifier}/client`), join(dirname(manifestPath), 'client.js'));
    }
  } finally { h.dispose(); }
});
