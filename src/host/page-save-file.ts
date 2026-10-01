/**
 * [INPUT]: 依赖用户已确认目标、编码字节、提交前生命周期围栏与 Node 文件系统能力。
 * [OUTPUT]: 提供已确认覆盖与自动编号保存；完整临时文件提交后才可见，直接保存永不覆盖。
 * [POS]: Main 保存的唯一磁盘提交边界；取消发生在提交前则只归还临时文件，不扫描目录或记录路径。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { open, rename, link, unlink } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
const MAX_NAME_ATTEMPTS = 1000;
async function commitImage(target: string, bytes: Uint8Array, commit: (temporary: string) => Promise<void>) {
  const temporary = join(dirname(target), `.pdsh-save-${randomBytes(16).toString('hex')}.tmp`);
  let file, owned = false;
  try {
    file = await open(temporary, 'wx', 0o600); owned = true;
    await file.writeFile(bytes); await file.sync(); await file.close(); file = null;
    await commit(temporary);
  } finally {
    if (file) await file.close().catch(() => {});
    if (owned) await unlink(temporary).catch(() => {});
  }
}
export function writeConfirmedImage(target: string, bytes: Uint8Array, beforeCommit = () => {}) {
  return commitImage(target, bytes, async temporary => { beforeCommit(); await rename(temporary, target); });
}
export function writeUniqueImage(target: string, bytes: Uint8Array, beforeCommit = () => {}) {
  const extension = extname(target), stem = basename(target, extension);
  return commitImage(target, bytes, async temporary => {
    for (let attempt = 0; attempt < MAX_NAME_ATTEMPTS; ++attempt) {
      const candidate = attempt ? join(dirname(target), `${stem} (${attempt})${extension}`) : target;
      beforeCommit();
      try { await link(temporary, candidate); return; }
      catch (error) { if (error.code !== 'EEXIST') throw error; }
    }
    throw new Error('PDSH export name budget exhausted');
  });
}
