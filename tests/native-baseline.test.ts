/**
 * [INPUT]: 依赖固定 Mac 原生闭包和自有临时副本。
 * [OUTPUT]: 验证 Windows RC 只复用原字节助手，拒绝每项输入漂移。
 * [POS]: 构建来源合同；不编译 Mac、不运行助手，不证明 Mac 实机。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { MAC_BASELINE, assertReusableMacBaseline } from '../tools/native-baseline.ts';

test('当前 Mac 闭包可复用；助手和每项编译输入变动均拒绝', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pdsh-mac-baseline-test-'));
  try {
    for (const file of Object.keys(MAC_BASELINE)) {
      await mkdir(dirname(join(root, file)), { recursive: true });
      await writeFile(join(root, file), await readFile(new URL(`../${file}`, import.meta.url)));
    }
    await assert.doesNotReject(assertReusableMacBaseline(root));
    for (const file of Object.keys(MAC_BASELINE)) {
      const original = await readFile(join(root, file));
      await writeFile(join(root, file), Buffer.concat([original, Buffer.from([0])]));
      await assert.rejects(assertReusableMacBaseline(root), /Mac native baseline changed/);
      await writeFile(join(root, file), original);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
