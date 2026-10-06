/**
 * [INPUT]: 依赖 verify-host.ts CLI、Node 子进程和独占创建的临时/生成目录。
 * [OUTPUT]: 验证官方验收器在导入 Host 前拒绝非临时目录、符号链接、凭据、未知候选身份及错误包管理器。
 * [POS]: 集成工具的安全前置回归；不启动 DSH、不读取用户 profile、不把拒绝用例冒充功能验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const verifier = process.env.PDSH_HOST_VERIFIER ?? join(root, 'verify-host.ts');

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'pdsh-host-safety-'));
  const host = join(dir, 'host');
  mkdirSync(host);
  writeFileSync(join(host, 'package.json'), '{"name":"empty-host-fixture"}\n');
  const tgz = join(dir, 'never-installed.tgz');
  writeFileSync(tgz, 'Not an installable package: preflight must reject first.\n');
  const fakePnpm = join(dir, 'old-pnpm.cjs');
  const argsPath = join(dir, 'observed-args.json');
  writeFileSync(fakePnpm, `#!/usr/bin/env node\nrequire('node:fs').writeFileSync(${JSON.stringify(argsPath)}, JSON.stringify(process.argv.slice(2)));\nprocess.stdout.write('10.0.0\\n');\n`, { mode: 0o700 });
  return {
    dir, argsPath,
    run(profile: string, command = { command: fakePnpm, args: [] as unknown[] }, candidateRoot?: string) {
      const result = spawnSync(process.execPath, ['--experimental-strip-types', verifier, host, profile, tgz, JSON.stringify(command),
        ...(candidateRoot ? ['green', candidateRoot] : [])], {
        encoding: 'utf8', timeout: 15_000,
      });
      assert.equal(result.error, undefined);
      assert.equal(result.signal, null);
      return { status: result.status, output: `${result.stdout}${result.stderr}` };
    },
    dispose() { rmSync(dir, { recursive: true, force: true }); },
  };
}

test('验收器拒绝非临时 profile，不能先写入再报错', () => {
  const h = fixture();
  mkdirSync(join(root, 'output'), { recursive: true });
  const ownOutput = mkdtempSync(join(root, 'output', 'host-safety-'));
  const sentinel = join(ownOutput, 'package.json');
  const bytes = '{"name":"owned-sentinel","private":true,"dependencies":{},"dsh":{"profile":{"bundles":[]}}}\n';
  writeFileSync(sentinel, bytes);
  try {
    const result = h.run(ownOutput);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /非 OS 临时目录/);
    assert.equal(readFileSync(sentinel, 'utf8'), bytes);
  } finally { h.dispose(); rmSync(ownOutput, { recursive: true, force: true }); }
});

test('隔离验收只接受 stable/RC 当前候选身份，不忽略额外候选目录', () => {
  const h = fixture();
  try {
    const candidateRoot = join(h.dir, 'foreign-candidate');
    mkdirSync(candidateRoot);
    const manifest = JSON.stringify({ name: '@example/foreign', version: '0.4.0', private: true });
    writeFileSync(join(candidateRoot, 'package.json'), manifest);
    const result = h.run(join(h.dir, 'consumer'), undefined, candidateRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /unsupported acceptance candidate identity/);
    assert.equal(readFileSync(join(candidateRoot, 'package.json'), 'utf8'), manifest);
  } finally { h.dispose(); }
});

test('验收器拒绝从临时目录链接到项目的 profile', () => {
  const h = fixture();
  try {
    const profile = join(h.dir, 'linked-profile');
    symlinkSync(root, profile, 'dir');
    const before = readFileSync(join(root, 'package.json'));
    const result = h.run(profile);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /非 OS 临时目录|符号链接/);
    assert.deepEqual(readFileSync(join(root, 'package.json')), before);
  } finally { h.dispose(); }
});

test('验收器拒绝已有 profile 中的配置文件符号链接', () => {
  const h = fixture();
  try {
    const profile = join(h.dir, 'consumer');
    mkdirSync(profile);
    const sentinel = join(h.dir, 'config-sentinel');
    writeFileSync(sentinel, 'owned sentinel\n');
    symlinkSync(sentinel, join(profile, 'cordis.patch.yml'));
    const result = h.run(profile);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /拒绝复用 cordis\.patch\.yml/);
    assert.equal(readFileSync(sentinel, 'utf8'), 'owned sentinel\n');
  } finally { h.dispose(); }
});

test('验收器拒绝本地 npm token，不把账户凭据交给安装进程', () => {
  const h = fixture();
  try {
    const profile = join(h.dir, 'consumer');
    mkdirSync(profile);
    writeFileSync(join(profile, '.npmrc'), '//example.invalid/:_authToken=fake-test-value\n');
    const result = h.run(profile);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /不得注入认证/);
  } finally { h.dispose(); }
});

test('可预置的 npmrc 也必须是普通文件，不能借链接跨目录读取', () => {
  const h = fixture();
  try {
    const profile = join(h.dir, 'consumer');
    mkdirSync(profile);
    const sentinel = join(h.dir, 'npmrc-sentinel');
    writeFileSync(sentinel, 'registry=https://example.invalid/\n');
    symlinkSync(sentinel, join(profile, '.npmrc'));
    const result = h.run(profile);
    assert.notEqual(result.status, 0);
    assert.match(result.output, /初始文件必须是普通文件: \.npmrc/);
    assert.equal(readFileSync(sentinel, 'utf8'), 'registry=https://example.invalid/\n');
  } finally { h.dispose(); }
});

test('合法临时 profile 通过路径门，但旧版包管理器不能冒充目标 PNPM', () => {
  const h = fixture();
  try {
    const result = h.run(join(h.dir, 'consumer'));
    assert.notEqual(result.status, 0);
    assert.match(result.output, /PNPM 11\.7/);
    assert.doesNotMatch(result.output, /非 OS 临时目录/);
    const args = JSON.parse(readFileSync(h.argsPath, 'utf8'));
    assert.ok(args.includes(`--store-dir=${join(h.dir, 'consumer', '.plugin-manager', 'pnpm-store')}`), '必须使用当前临时 profile 的独立 store，不改写全局缓存');
  } finally { h.dispose(); }
});

test('验收器拒绝非字符串的 PNPM 参数', () => {
  const h = fixture();
  try {
    const result = h.run(join(h.dir, 'consumer'), { command: process.execPath, args: [42] });
    assert.notEqual(result.status, 0);
    assert.match(result.output, /args 必须全为字符串/);
  } finally { h.dispose(); }
});


test('验收器拒绝其他用户可写的临时祖先、profile 和初始配置，且不修权限掩盖风险', () => {
  for (const target of ['parent', 'profile', 'file']) {
    const h = fixture();
    try {
      const profile = join(h.dir, 'consumer');
      mkdirSync(profile, { mode: 0o700 });
      const npmrc = join(profile, '.npmrc');
      writeFileSync(npmrc, '', { mode: 0o600 });
      const bad = target === 'parent' ? h.dir : target === 'profile' ? profile : npmrc;
      chmodSync(bad, target === 'file' ? 0o666 : 0o777);
      const result = h.run(profile);
      assert.notEqual(result.status, 0);
      assert.match(result.output, /必须属于当前用户且不可由其他用户写入/);
      assert.equal(lstatSync(bad).mode & 0o777, target === 'file' ? 0o666 : 0o777);
    } finally { h.dispose(); }
  }
});
