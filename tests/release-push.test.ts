/**
 * [INPUT]: 依赖版本化 pre-push hook、隔离 Git 仓与可观测的假 pnpm 检查命令。
 * [OUTPUT]: 验证稳定 tag 必须先经发布门、失败停止推送、旧 tag 不可改删；普通分支和 RC 不触发稳定发布。
 * [POS]: 本地发布入口回归；不连接远端，不创建真实 release 或操作用户 profile。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const hook = fileURLToPath(new URL('../.githooks/pre-push', import.meta.url));
const sha = '1'.repeat(40);
const zero = '0'.repeat(40);
const platformOptions = { skip: process.platform === 'win32' };

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'pdsh-release-push-'));
  const bin = join(root, 'bin');
  const calls = join(root, 'calls');
  mkdirSync(bin);
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  // +--- 假检查器故意读取 stdin，验证 hook 不会丢掉下一条推送记录。 ---+
  writeFileSync(join(bin, 'pnpm'), `#!/bin/sh\nprintf '%s\\n' "$*" >> ${JSON.stringify(calls)}\ncat > /dev/null\nexit "\${CHECK_EXIT:-0}"\n`);
  chmodSync(join(bin, 'pnpm'), 0o755);
  return {
    root, calls,
    run(input: string, exit = 0) {
      return spawnSync('sh', [hook], {
        cwd: root, input, encoding: 'utf8',
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, CHECK_EXIT: String(exit) },
      });
    },
    dispose() { rmSync(root, { recursive: true, force: true }); },
  };
}

test('稳定 tag 推送必须通过对应版本发布检查，失败保留非零退出', platformOptions, () => {
  const h = fixture();
  try {
    const input = `refs/tags/v0.5.0 ${sha} refs/tags/v0.5.0 ${zero}\n`;
    assert.equal(h.run(input).status, 0);
    assert.equal(readFileSync(h.calls, 'utf8'), 'release:check v0.5.0\n');
    assert.notEqual(h.run(input, 7).status, 0);
  } finally { h.dispose(); }
});

test('稳定旧 tag 改写/删除拒绝，普通分支与 RC 不调用发布门', platformOptions, () => {
  const h = fixture();
  try {
    assert.notEqual(h.run(`refs/tags/v0.4.0 ${sha} refs/tags/v0.4.0 ${'2'.repeat(40)}\n`).status, 0);
    assert.notEqual(h.run(`(delete) ${zero} refs/tags/v0.4.0 ${sha}\n`).status, 0);
    const normalPush = `refs/heads/main ${sha} refs/heads/main ${zero}\n`
      + `refs/tags/v0.5.0-rc.1 ${sha} refs/tags/v0.5.0-rc.1 ${zero}\n`;
    assert.equal(h.run(normalPush).status, 0);
    assert.equal(existsSync(h.calls), false);
  } finally { h.dispose(); }
});

test('禁止用其他 ref 改名发稳定 tag，发布检查不得吃掉后续推送记录', platformOptions, () => {
  const h = fixture();
  try {
    assert.notEqual(h.run(`refs/heads/main ${sha} refs/tags/v0.5.0 ${zero}\n`).status, 0);
    assert.equal(existsSync(h.calls), false);
    const tags = `refs/tags/v0.5.0 ${sha} refs/tags/v0.5.0 ${zero}\n`
      + `refs/tags/v0.6.0 ${sha} refs/tags/v0.6.0 ${zero}\n`;
    assert.equal(h.run(tags).status, 0);
    assert.equal(readFileSync(h.calls, 'utf8'), 'release:check v0.5.0\nrelease:check v0.6.0\n');
  } finally { h.dispose(); }
});
