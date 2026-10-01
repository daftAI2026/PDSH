/**
 * [INPUT]: 依赖 components/ 完整预读的唯一生成产物与 Node 文件系统；只管理两个固定自有包目录。
 * [OUTPUT]: 提供 materializeComponentPackages，生成 GitHub 归档可携带的普通文件子包。
 * [POS]: build.ts 的分发边界；拒绝未知目录/成员/符号链接，原子替换不改共享 hardlink 的另一端。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { lstat, mkdir, readFile, readdir, readlink, unlink, writeFile, rename } from 'node:fs/promises';
import type { Stats } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
const MARKER = '.pdsh-generated';
const OWNER = 'PDSH build.ts generated component package v1\n';
const stat = (path: string): Promise<Stats | undefined> => lstat(path).catch(error => { if (error.code === 'ENOENT') return undefined; throw error; });
async function directory(path) {
  const existing = await stat(path);
  if (existing && !existing.isDirectory()) throw new Error('PDSH package directory ownership rejected');
  if (!existing) await mkdir(path);
}
export async function materializeComponentPackages(root: string) {
  await directory(join(root, 'node_modules'));
  await directory(join(root, 'node_modules/@daftai'));
  for (const kind of ['titles', 'capture']) {
    const target = join(root, `node_modules/@daftai/pdsh-${kind}`);
    // +--- 源成员全部就绪后才改目标；缺产物不会毁掉旧链接或留下无主目录 ---+
    const files = ['package.json', 'index.js', 'client.js', 'client.js.map', 'plugin-icon.svg', 'CLAUDE.md', 'locale/zh.json', 'locale/en.json', 'locale/CLAUDE.md', ...(kind === 'capture' ? ['main.cjs'] : [])];
    const contents = new Map<string, Uint8Array>();
    for (const file of files) {
      const source = join(root, `components/${kind}/${file}`);
      if (!(await stat(source))?.isFile()) throw new Error('PDSH package file ownership rejected');
      const bytes = await readFile(source);
      contents.set(file, file === 'CLAUDE.md'
        ? Buffer.from(bytes.toString().replace(`# components/${kind}/`, `# node_modules/@daftai/pdsh-${kind}/`).replace('父级: ../CLAUDE.md', '父级: ../../../CLAUDE.md'))
        : bytes);
    }
    let existing = await stat(target);
    if (existing?.isSymbolicLink()) {
      const link = await readlink(target);
      if (link !== `../../components/${kind}` && link !== `../.pnpm/@daftai+pdsh-${kind}@file+components+${kind}/node_modules/@daftai/pdsh-${kind}`) throw new Error('PDSH package link ownership rejected');
      await unlink(target); existing = undefined;
    }
    if (existing) {
      if (!existing.isDirectory() || !(await stat(join(target, MARKER)))?.isFile() || await readFile(join(target, MARKER), 'utf8') !== OWNER) throw new Error('PDSH package ownership rejected');
    } else {
      await mkdir(target);
      await writeFile(join(target, MARKER), OWNER, { flag: 'wx' });
    }
    // +--- 完整白名单先于写入；不能清除或接管陌生成员 ---+
    for (const entry of await readdir(target)) if (![MARKER, 'locale', ...files.filter(x => !x.includes('/'))].includes(entry)) throw new Error('PDSH package unknown member');
    await directory(join(target, 'locale'));
    for (const entry of await readdir(join(target, 'locale'))) if (!['zh.json', 'en.json', 'CLAUDE.md'].includes(entry)) throw new Error('PDSH package unknown locale member');
    for (const file of files) {
      const destination = join(target, file), existing = await stat(destination);
      if (existing && !existing.isFile()) throw new Error('PDSH package file ownership rejected');
    }
    if ((await stat(join(target, MARKER)))?.isSymbolicLink()) throw new Error('PDSH package marker ownership rejected');
    contents.set(MARKER, Buffer.from(OWNER));
    for (const [file, bytes] of contents) {
      const temporary = join(target, `.pdsh-${randomUUID()}.tmp`);
      try { await writeFile(temporary, bytes, { flag: 'wx' }); await rename(temporary, join(target, file)); }
      finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    }
  }
}
