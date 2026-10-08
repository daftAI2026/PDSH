/**
 * [INPUT]: 当前构建产物、npm、Windows 私有临时目录及 tar 元数据适配。
 * [OUTPUT]: 生成当前稳定身份的真实 tgz，验成员、字节和 0755；拒绝覆盖。
 * [POS]: 稳定 Bundle 的打包入口，复用 RC 的平台适配，不编译或安装插件。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, link, rm, lstat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { validateBundleArtifacts, validatePackedBundle } from '../bundle-artifacts.ts';
import { packWindowsArchive } from './pack-windows.ts';
import { protectWindowsOwnedDirectory, assertWindowsPrivateOwnership } from './windows-temp-ownership.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
if (manifest.name !== '@daftai/pdsh' || !/^\d+\.\d+\.\d+$/.test(manifest.version))
  throw new Error('Stable packing requires the stable Bundle identity.');
validateBundleArtifacts(root);
// +--- Windows 工作区不保证私有 ACL；归档始终留在已验的自有临时目录 ---+
const output = process.platform === 'win32'
  ? await mkdtemp(join(tmpdir(), `pdsh-bundle-${manifest.version}-`)) : join(root, 'output');
if (process.platform === 'win32') {
  protectWindowsOwnedDirectory(output);
  await writeFile(join(output, 'owner.json'), JSON.stringify({ task: 'pdsh-stable-bundle', version: manifest.version }) + '\n', { flag: 'wx' });
}
await mkdir(output, { recursive: true });
const entry = await lstat(output);
if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('Bundle output must be a regular directory.');
const archive = join(output, `daftai-pdsh-${manifest.version}.tgz`);
if (existsSync(archive)) throw new Error('Bundle archive already exists; refusing to overwrite.');
const packing = await mkdtemp(join(output, '.pdsh-bundle-pack-'));
try {
  const staged = join(packing, `daftai-pdsh-${manifest.version}.tgz`);
  if (process.platform === 'win32') await packWindowsArchive(root, packing, staged);
  else execFileSync('npm', ['pack', '--ignore-scripts', '--pack-destination', packing], { cwd: root, stdio: 'inherit' });
  const proof = validatePackedBundle(root, staged);
  if (process.platform === 'win32') assertWindowsPrivateOwnership(output);
  await link(staged, archive);
  process.stdout.write(JSON.stringify({ ...proof, archive }) + '\n');
} finally {
  await rm(packing, { recursive: true, force: true });
}
