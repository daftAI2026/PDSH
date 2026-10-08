/**
 * [INPUT]: 依赖 Node 配套 npm/tar、静态包夹具和真实归档门。
 * [OUTPUT]: Windows npm 原归档必须被权限门拒绝；权限适配后验所有字节，并拒绝模式漂移。
 * [POS]: Windows RC 打包合同。假助手不执行，不安装插件或读取用户数据。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { artifactFixture } from './bundle-fixture.ts';
import { packWindowsArchive } from '../tools/pack-windows.ts';
import { validatePackedBundle } from '../bundle-artifacts.ts';

test('Windows RC 写真实 0755 元数据，保持 npm 成员和字节门', { skip: process.platform !== 'win32' }, async () => {
  const h = artifactFixture();
  try {
    // +--- 大成员覆盖 tar 流背压；小包不能证明候选体积下会完成 ---+
    h.write('client.js', `/* PDSH build "0.3.0" */\nwindow.__ModuleLoader__.load({id:"@daftai/pdsh",factory:()=>({})});\n/*${randomBytes(3_000_000).toString('base64')}*/`);
    const packDir = join(h.root, 'output');
    mkdirSync(packDir);
    const archive = join(packDir, 'daftai-pdsh-0.3.0.tgz');
    const npmCli = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
    execFileSync(process.execPath, [npmCli, 'pack', '--ignore-scripts', '--pack-destination', packDir],
      { cwd: h.root, stdio: 'pipe' });
    assert.throws(() => validatePackedBundle(h.root, archive), /helper must preserve mode 0755/);
    await packWindowsArchive(h.root, packDir, archive);
    assert.equal(validatePackedBundle(h.root, archive).members, h.files.length);
    const tar = createRequire(npmCli)('tar');
    for (const mode of [0o644, 0o744, 0o777]) {
      const bad = join(packDir, `bad-${mode}.tgz`);
      await tar.create({ file: bad, gzip: true, portable: true,
        onWriteEntry(entry: { path: string; mode: number }) {
          if (entry.path === 'package/native/window-capture') entry.mode = mode;
        },
      }, [`@${archive}`]);
      assert.throws(() => validatePackedBundle(h.root, bad), /helper must preserve mode 0755/);
    }
    h.write('index.js', 'changed-after-pack');
    assert.throws(() => validatePackedBundle(h.root, archive), /version drift|bytes drift/);
  } finally { h.dispose(); }
});
