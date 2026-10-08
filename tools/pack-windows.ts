/**
 * [INPUT]: 依赖 Node 配套 npm CLI、其 tar 实现和自有候选目录。
 * [OUTPUT]: 用 npm 选成员，再在真实 tar 头写 Mac 助手 0755；不改变成员字节。
 * [POS]: Windows Bundle 的打包期权限适配；稳定包与 RC 共用，不增加安装 hook。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export async function packWindowsArchive(stageDir: string, packDir: string, archivePath: string): Promise<void> {
  const npmCli = join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  if (!existsSync(npmCli)) throw new Error('Windows packing requires the Node installation npm CLI.');
  execFileSync(process.execPath, [npmCli, 'pack', '--ignore-scripts', '--pack-destination', packDir],
    { cwd: stageDir, stdio: 'inherit' });
  if (!existsSync(archivePath)) throw new Error('npm pack did not produce the expected candidate archive.');
  const tar = createRequire(npmCli)('tar');
  const normalized = `${archivePath}.portable`;
  let helpers = 0;
  // +--- Windows stat 不能表达 POSIX 执行位；改写实际归档元数据，随后验字节和模式 ---+
  tar.create({ file: normalized, gzip: true, portable: true, sync: true,
    onWriteEntry(entry: { path: string; type: string; mode: number }) {
      if (entry.path !== 'package/native/window-capture') return;
      if (entry.type !== 'File') throw new Error('Mac helper must be a regular archive member.');
      entry.mode = 0o755;
      ++helpers;
    },
  }, [`@${archivePath}`]);
  if (helpers !== 1) throw new Error('Windows archive requires exactly one Mac helper.');
  await rename(normalized, archivePath);
}
