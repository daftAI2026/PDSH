/**
 * [INPUT]: 依赖仓库根目录的构建脚本、宿主入口与 package.json 的命令合同。
 * [OUTPUT]: 验证手写脚本均为 TypeScript，根目录 JavaScript 只剩宿主必须的生成产物。
 * [POS]: 源码/产物边界回归；避免把可维护逻辑藏回手写 JS，也不误删 Harness 入口。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

test('手写构建与发布脚本为TS；根目录JS只保留宿主生成入口', () => {
  const root = new URL('../', import.meta.url);
  const files = readdirSync(root);
  assert.deepEqual(files.filter(file => /\.(?:mjs|js)$/.test(file)).sort(), ['client.js', 'index.js']);
  assert.ok(files.includes('build.ts') && files.includes('check-release.ts'));
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(manifest.scripts.build, /build\.ts/);
  assert.match(manifest.scripts['release:check'], /check-release\.ts/);
});
