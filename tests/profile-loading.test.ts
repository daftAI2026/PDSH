/**
 * [INPUT]: 依赖真实 Bundle patch/生成入口与隔离 profile；锚定规则对应 DSH rc.2 app-boot 的 anchorInsertedPluginNames。
 * [OUTPUT]: 验证 profile-root 解析模型与生成 Host；就近 manifest/locale 文件存在不代表官方展示元信息已发现。
 * [POS]: 安装边界回归；故意不给 profile 安装子包，禁止用根 Bundle 的 require 代替宿主入口。
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
function fixture() {
  const profile = mkdtempSync(join(tmpdir(), 'pdsh-profile-loading-'));
  const root = fileURLToPath(new URL('../', import.meta.url));
  mkdirSync(join(profile, 'node_modules/@daftai'), { recursive: true });
  symlinkSync(root, join(profile, 'node_modules/@daftai/pdsh'));
  const require = createRequire(join(profile, 'profile-anchor.cjs'));
  return { profile, root: join(profile, 'node_modules/@daftai/pdsh'), require, dispose: () => rmSync(profile, { recursive: true, force: true }) };
}

test('链接 profile 的解析模型可导入三生成 Host；Client manifest 文件完整', async () => {
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
            { entry: { options: { id: row.id, name: moduleUrl.href, config: {} } } },
          ] },
          settings: { describe: () => [{ ns: row.id, revision: 1 }], async mutate(...args) { mutations.push(args); } },
        });
        assert.deepEqual(mutations, [[row.id, [{ op: 'set', path: ['maskTitles'], value: true }], 1]], 'symlink 锚定 URL 也必须归属同一生成 Host');
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

test('坏入口正例：未安装的裸子包从 profile 确实失败', () => {
  const h = fixture();
  try {
    const bundle = createRequire(join(h.root, 'package.json'));
    assert.ok(bundle.resolve('@deepseek-ai/schemastery'), 'Bundle 普通依赖仍按自身位置解析');
    for (const name of ['@daftai/pdsh-titles', '@daftai/pdsh-capture']) {
      assert.throws(() => h.require.resolve(name), { code: 'MODULE_NOT_FOUND' });
    }
  } finally { h.dispose(); }
});
