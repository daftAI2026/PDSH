/**
 * [INPUT]: 依赖显式公开源码白名单、稳定 package manifest、官方 build.ts 与归档验证器。
 * [OUTPUT]: 在私有 OS staging 中派生独立 @daftai/pdsh-rc 候选并拒绝覆盖输出。
 * [POS]: 只负责候选制作；不安装、不触碰 Desktop/profile，不能替代 Manager 或实机验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmod, copyFile, link, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBundleArtifacts, validatePackedBundle } from '../bundle-artifacts.ts';

// +--- 只复制参与本次公开构建的路径；工作区、用户数据和已有生成目录不在白名单。 ---+
export const RC_SOURCE_ALLOWLIST = Object.freeze([
  'package.json', 'README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md',
  'cordis.patch.yml', 'style-sources.json', 'build.ts', 'bundle-artifacts.ts',
  'tsconfig.json', 'tsconfig.remote-types.json', 'src', 'locale', 'native',
  'tools/generate-typert.ts', 'tools/typert-protocol-reference',
] as const);

const STABLE_PACKAGE = '@daftai/pdsh';
const RC_PACKAGE = '@daftai/pdsh-rc';
const PATCH_STABLE = '- insert:\n    - id: pdsh\n      name: "@daftai/pdsh"\n';
const PATCH_RC = '- insert:\n    - id: pdsh-rc\n      name: "@daftai/pdsh-rc"\n';
const RC_README_NOTICE = `> **RC 测试包：仅供当前候选的官方 Plugin Manager 共存测试。** 安装/启用前先停用正式 \`@daftai/pdsh\`；测试后只卸载 \`@daftai/pdsh-rc\`，再重新启用正式包。RC 自动身份打码尚未接入原生截图链路；请检查像素，勿将其当作隐私保证。构建成功不代表 Desktop UI 已验收。\n>\n> **RC candidate: official Plugin Manager test only.** Disable stable \`@daftai/pdsh\` before enabling this package; after testing, uninstall only \`@daftai/pdsh-rc\`, then re-enable stable. Automatic identity masking is not wired into native capture in this candidate; inspect pixels and do not treat it as a privacy guarantee. A successful build is not Desktop UI acceptance.\n\n`;
const DEFAULT_ROOT = fileURLToPath(new URL('../', import.meta.url));

export type RcIdentity = {
  baseVersion: string;
  version: string;
  packageName: typeof RC_PACKAGE;
  rootEntryId: 'pdsh-rc';
  candidate: number;
};

export type RcSourceReceipt = { dirty: boolean | null; sha256: string };
export type RcStage = {
  stageDir: string;
  identity: RcIdentity;
  source: RcSourceReceipt;
  dispose: () => Promise<void>;
};

export type CreateRcStageOptions = {
  rootDir?: string;
  candidate: number | string;
  stageParent?: string;
};

export type PackRcOptions = CreateRcStageOptions & {
  outputRoot?: string;
  build?: (stageDir: string) => void | Promise<void>;
  pack?: (stageDir: string, packDir: string, archivePath: string) => void | Promise<void>;
};

export type RcPackReceipt = RcIdentity & {
  archive: string;
  sha256: string;
  members: number;
  source: RcSourceReceipt;
};

/** 只从正式稳定 manifest 派生候选；RC 候选不能嵌套派生。 */
export function deriveRcIdentity(
  manifest: { name?: unknown; version?: unknown; private?: unknown },
  candidate: number | string,
): RcIdentity {
  if (manifest.name !== STABLE_PACKAGE || manifest.private !== true) {
    throw new Error('RC source must be the private stable @daftai/pdsh package');
  }
  if (typeof manifest.version !== 'string' || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(manifest.version)) {
    throw new Error('RC source version must be a stable semantic version triplet');
  }
  const value = typeof candidate === 'number'
    ? Number.isSafeInteger(candidate) ? String(candidate) : ''
    : candidate;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) throw new Error('RC candidate must be a positive canonical integer');
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error('RC candidate must be a positive safe integer');
  return {
    baseVersion: manifest.version,
    version: `${manifest.version}-rc.${number}`,
    packageName: RC_PACKAGE,
    rootEntryId: 'pdsh-rc',
    candidate: number,
  };
}

/** 创建自有 0700 stage；任何复制/转换失败都只收回本次创建的目录。 */
export async function createRcStage(options: CreateRcStageOptions): Promise<RcStage> {
  const rootDir = resolve(options.rootDir ?? DEFAULT_ROOT);
  const packagePath = join(rootDir, 'package.json');
  const sourceManifest = parseJson(await readFile(packagePath, 'utf8'), 'source package.json');
  const identity = deriveRcIdentity(sourceManifest, options.candidate);
  const parent = resolve(options.stageParent ?? tmpdir());
  const stageDir = await mkdtemp(join(parent, 'pdsh-rc-stage-'));
  let disposed = false;
  try {
    await chmod(stageDir, 0o700);
    const digest = createHash('sha256');
    for (const relative of RC_SOURCE_ALLOWLIST) {
      await copySourceEntry(rootDir, stageDir, relative, digest);
    }

    const dependencies = join(rootDir, 'node_modules');
    const dependencyStat = await lstat(dependencies).catch(() => undefined);
    if (!dependencyStat?.isDirectory() || dependencyStat.isSymbolicLink()) {
      throw new Error('RC build requires a regular root node_modules directory');
    }
    // +--- 显式复用构建依赖；它是唯一 staging 链接，不会被 npm pack 白名单打包。 ---+
    await symlink(dependencies, join(stageDir, 'node_modules'), 'dir');

    await deriveManifest(stageDir, identity);
    await derivePatch(stageDir);
    await deriveLocales(stageDir);
    await deriveReadme(stageDir);
    const source = { dirty: readGitDirty(rootDir), sha256: digest.digest('hex') };
    return {
      stageDir,
      identity,
      source,
      dispose: async () => {
        if (disposed) return;
        disposed = true;
        await rm(stageDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await rm(stageDir, { recursive: true, force: true });
    throw error;
  }
}

/** 编译、静态/真实 tgz 校验后才以原子 hard-link 发布，任何已有候选均拒绝覆盖。 */
export async function packRc(options: PackRcOptions): Promise<RcPackReceipt> {
  const rootDir = resolve(options.rootDir ?? DEFAULT_ROOT);
  const rootManifest = parseJson(await readFile(join(rootDir, 'package.json'), 'utf8'), 'source package.json');
  const identity = deriveRcIdentity(rootManifest, options.candidate);
  const outputRoot = resolve(options.outputRoot ?? join(rootDir, 'output', 'rc'));
  await mkdir(outputRoot, { recursive: true });
  const outputStat = await lstat(outputRoot);
  if (!outputStat.isDirectory() || outputStat.isSymbolicLink()) throw new Error('RC output root must be a real directory');
  const finalArchive = join(outputRoot, archiveFilename(identity));
  if (await exists(finalArchive)) throw new Error(`RC archive already exists; refusing to overwrite: ${finalArchive}`);

  let stage: RcStage | undefined;
  let packDir: string | undefined;
  try {
    stage = await createRcStage({ rootDir, candidate: options.candidate, stageParent: options.stageParent });
    const build = options.build ?? buildStage;
    await build(stage.stageDir);
    validateBundleArtifacts(stage.stageDir);

    packDir = await mkdtemp(join(outputRoot, '.pdsh-rc-pack-'));
    const stagedArchive = join(packDir, archiveFilename(identity));
    await (options.pack ?? packStage)(stage.stageDir, packDir, stagedArchive);
    const proof = validatePackedBundle(stage.stageDir, stagedArchive);
    try {
      // hard link在同一 output filesystem 上是原子的，EEXIST 不会替换旧候选。
      await link(stagedArchive, finalArchive);
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
        throw new Error(`RC archive already exists; refusing to overwrite: ${finalArchive}`);
      }
      throw error;
    }
    return { ...identity, archive: finalArchive, sha256: proof.sha256, members: proof.members, source: stage.source };
  } finally {
    if (packDir) await rm(packDir, { recursive: true, force: true });
    await stage?.dispose();
  }
}

async function copySourceEntry(rootDir: string, stageDir: string, relative: string, digest: ReturnType<typeof createHash>): Promise<void> {
  if (relative.startsWith('/') || relative.split(/[\\/]/).some(part => !part || part === '.' || part === '..')) {
    throw new Error(`invalid RC source allowlist path: ${relative}`);
  }
  // +--- 显式叶路径也不能穿过 tools 等父级链接，避免绕过递归入口检查。 ---+
  let parent = rootDir;
  for (const part of relative.split('/').slice(0, -1)) {
    parent = join(parent, part);
    const stat = await lstat(parent);
    if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`RC source whitelist refuses symbolic link/non-directory parent: ${relative}`);
  }
  await copyEntry(join(rootDir, relative), join(stageDir, relative), relative, digest);
}

async function copyEntry(source: string, destination: string, relative: string, digest: ReturnType<typeof createHash>): Promise<void> {
  if (excludeDirectoryName(relative)) return;
  const stat = await lstat(source);
  if (stat.isSymbolicLink()) throw new Error(`RC source whitelist refuses symbolic link: ${relative}`);
  if (stat.isDirectory()) {
    await mkdir(destination, { recursive: true, mode: 0o755 });
    const names = (await readdir(source)).sort();
    for (const name of names) {
      const child = `${relative}/${name}`;
      if (!excludeDirectoryName(child)) await copyEntry(join(source, name), join(destination, name), child, digest);
    }
    return;
  }
  if (!includeDirectoryFile(relative)) return;
  if (!stat.isFile()) throw new Error(`RC source whitelist accepts regular files/directories only: ${relative}`);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
  const mode = stat.mode & 0o777;
  await chmod(destination, mode);
  // +--- 摘要绑定实际编译的 staging 字节，避免二次读取可变工作树。 ---+
  const bytes = await readFile(destination);
  digest.update(`file\0${relative}\0${mode.toString(8)}\0`);
  digest.update(bytes);
  digest.update('\0');
}

/** 目录白名单仍只带源码/构建资源；隐藏产物、局部地图和未知像素文件不进入 stage。 */
function excludeDirectoryName(relative: string): boolean {
  const name = relative.slice(relative.lastIndexOf('/') + 1);
  return name.startsWith('.') || name === 'CLAUDE.md' || name === 'AGENTS.md';
}

function includeDirectoryFile(relative: string): boolean {
  const name = relative.slice(relative.lastIndexOf('/') + 1);
  if (relative.startsWith('src/')) return /\.(?:ts|tsx|css|svg|jpg)$/.test(name);
  if (relative.startsWith('locale/')) return name.endsWith('.json');
  if (relative.startsWith('native/')) return name === 'window-capture' || /\.(?:sh|mm|exe|ps1|cpp|h|manifest)$/.test(name);
  return true;
}

async function deriveManifest(stageDir: string, identity: RcIdentity): Promise<void> {
  const path = join(stageDir, 'package.json');
  const manifest = parseJson(await readFile(path, 'utf8'), 'staged package.json');
  manifest.name = identity.packageName;
  manifest.version = identity.version;
  if (manifest.private !== true) throw new Error('RC package must remain private');
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function derivePatch(stageDir: string): Promise<void> {
  const path = join(stageDir, 'cordis.patch.yml');
  const original = await readFile(path, 'utf8');
  if (original !== PATCH_STABLE) throw new Error('RC source patch must be the sole canonical pdsh/@daftai/pdsh entry');
  await writeFile(path, PATCH_RC);
}

async function deriveLocales(stageDir: string): Promise<void> {
  const directory = join(stageDir, 'locale');
  const names = (await readdir(directory)).filter(name => name.endsWith('.json')).sort();
  for (const required of ['zh.json', 'en.json']) if (!names.includes(required)) throw new Error(`RC locale metadata missing ${required}`);
  for (const name of names) {
    const path = join(directory, name);
    const metadata = parseJson(await readFile(path, 'utf8'), `locale/${name}`);
    if (!metadata.meta || typeof metadata.meta.title !== 'string' || typeof metadata.meta.description !== 'string') {
      throw new Error(`RC locale/${name} must expose title and description metadata`);
    }
    metadata.meta.title = `${metadata.meta.title} RC`;
    const instruction = name === 'zh.json'
      ? 'RC 候选；启用前请先停用正式 PDSH 包。'
      : 'RC candidate; disable the stable PDSH package before enabling this candidate.';
    metadata.meta.description = `${metadata.meta.description} ${instruction}`;
    await writeFile(path, `${JSON.stringify(metadata, null, 2)}\n`);
  }
}

async function deriveReadme(stageDir: string): Promise<void> {
  const path = join(stageDir, 'README.md');
  const original = await readFile(path, 'utf8');
  if (original.startsWith('> **RC 测试包：')) throw new Error('RC source README must be derived from the stable user guide');
  await writeFile(path, `${RC_README_NOTICE}${original}`);
}

function parseJson(source: string, label: string): Record<string, any> {
  try {
    const value = JSON.parse(source);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not an object');
    return value;
  } catch { throw new Error(`${label} must be a valid JSON object`); }
}

function readGitDirty(rootDir: string): boolean | null {
  try {
    return execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: rootDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().length > 0;
  } catch { return null; }
}

function archiveFilename(identity: RcIdentity): string {
  return `${identity.packageName.replace(/^@/, '').replace('/', '-')}-${identity.version}.tgz`;
}

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return false;
    throw error;
  }
}

function buildStage(stageDir: string): void {
  execFileSync(process.execPath, ['--experimental-strip-types', 'build.ts'], { cwd: stageDir, stdio: 'inherit' });
}

async function packStage(stageDir: string, packDir: string, archivePath: string): Promise<void> {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  execFileSync(npm, ['pack', '--ignore-scripts', '--pack-destination', packDir], { cwd: stageDir, stdio: 'inherit' });
  const manifest = parseJson(await readFile(join(stageDir, 'package.json'), 'utf8'), 'staged package.json');
  const expected = `${manifest.name.replace(/^@/, '').replace('/', '-')}-${manifest.version}.tgz`;
  if (basename(archivePath) !== expected) throw new Error('RC archive name drift');
  if (!await exists(archivePath)) throw new Error('npm pack did not emit the expected RC archive');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const candidate = process.argv[2];
  if (!candidate || process.argv.length > 3) {
    console.error('Usage: node --experimental-strip-types tools/pack-rc.ts <positive-candidate-number>');
    process.exitCode = 2;
  } else {
    try {
      const receipt = await packRc({ candidate });
      console.log(`RC archive: ${receipt.archive}\nSHA-256: ${receipt.sha256}\nIdentity: ${receipt.packageName}@${receipt.version} (${receipt.rootEntryId})\nSource: ${receipt.source.dirty === null ? 'git status unavailable' : receipt.source.dirty ? 'dirty' : 'clean'}; tree-sha256 ${receipt.source.sha256}`);
    } catch (error) {
      console.error(`RC packaging failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  }
}
