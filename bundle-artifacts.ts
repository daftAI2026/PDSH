/**
 * [INPUT]: 依赖单包 manifest、唯一 Cordis patch 和 build.ts 生成的 Host/Client/Main。
 * [OUTPUT]: 提供 validateBundleArtifacts/validatePackedBundle，拒绝旧子依赖拓扑、缺失/链接产物及版本漂移。
 * [POS]: 构建与发布共用的静态分发门；只读本包与明确版本的实际 tgz，用 tar 校验成员/类型/字节；不访问 Git、网络或用户 profile。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { lstatSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { join } from 'node:path';

const ARCHIVE_FILES = ['index.js', 'client.js', 'client.js.map', 'main.cjs', 'cordis.patch.yml', 'plugin-icon.svg', 'style-sources.json', 'THIRD_PARTY_NOTICES.md', 'LICENSE', 'locale/*.json'];
const MAX_ARTIFACT_BYTES = 32 * 1024 * 1024;

export function validateBundleArtifacts(root: string): void {
  const read = (file: string): string => {
    try {
      const path = join(root, file);
      if (!lstatSync(path).isFile()) throw new Error('not regular');
      const value = readFileSync(path, 'utf8');
      if (!value.trim()) throw new Error('empty');
      return value;
    } catch { throw new Error(`bundle artifact ${file} must be a nonempty regular file`); }
  };
  const manifest = JSON.parse(read('package.json'));
  if (manifest.name !== '@daftai/pdsh' || typeof manifest.version !== 'string' || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\w.-]+)?$/.test(manifest.version)) throw new Error('bundle identity/version drift');
  if (manifest.private !== true) throw new Error('bundle must remain private for GitHub distribution');
  if (manifest.bundledDependencies || manifest.bundleDependencies || manifest.files?.includes('components/')) throw new Error('bundle must not contain legacy component package topology');
  if (!Array.isArray(manifest.files) || manifest.files.length !== ARCHIVE_FILES.length || ARCHIVE_FILES.some(file => !manifest.files.includes(file))) throw new Error('bundle archive files must match the explicit single-package allowlist');
  for (const [name, source] of Object.entries({ ...manifest.dependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies })) {
    if (name.startsWith('@daftai/pdsh') || typeof source !== 'string' || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(source)) throw new Error(`bundle dependency ${name} must be an ordinary exact library version, not a component source`);
  }
  for (const hook of ['preinstall', 'install', 'postinstall', 'prepare']) if (manifest.scripts?.[hook]) throw new Error(`bundle must not require ${hook} installation hook`);
  for (const file of ['index.js', 'client.js', 'client.js.map', 'main.cjs', 'cordis.patch.yml', 'plugin-icon.svg', 'locale/*.json']) {
    if (!manifest.files?.includes(file)) throw new Error(`bundle archive membership missing ${file}`);
  }
  if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml' || manifest.exports?.['./client'] !== './client.js' || manifest.exports?.['.'] !== './index.js') throw new Error('bundle exported entry drift');
  const patch = read('cordis.patch.yml');
  if ([...patch.matchAll(/- id:/g)].length !== 1 || !/id: pdsh\s+name: "@daftai\/pdsh"/.test(patch)) throw new Error('bundle must retain the single pdsh root entry');
  for (const file of ['index.js', 'client.js', 'main.cjs']) {
    if (!read(file).includes(`PDSH build ${JSON.stringify(manifest.version)}`)) throw new Error(`bundle artifact ${file} version drift; rebuild`);
  }
  for (const file of ['client.js.map', 'plugin-icon.svg', 'locale/zh.json', 'locale/en.json']) read(file);
  const client = read('client.js');
  if ([...client.matchAll(/window\.__ModuleLoader__\.load\(/g)].length !== 1 || !client.includes('id:"@daftai/pdsh"')) throw new Error('bundle must provide exactly one root Client factory');
}

/** 只读核对本次明确版本的真实归档；不清空历史产物，不执行包代码。 */
export function validatePackedBundle(root: string, archive?: string): { archive: string; version: string; sha256: string; members: number } {
  validateBundleArtifacts(root);
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  archive ??= join(root, 'output', `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`);
  const stat = lstatSync(archive);
  if (!stat.isFile() || stat.size > MAX_ARTIFACT_BYTES) throw new Error('bundle archive must be a bounded regular file');
  const tar = (...args: string[]) => execFileSync('tar', args, { encoding: 'utf8', maxBuffer: MAX_ARTIFACT_BYTES });
  const members = tar('-tzf', archive).trim().split('\n');
  const expected = [...ARCHIVE_FILES.filter(file => file !== 'locale/*.json'), 'locale/zh.json', 'locale/en.json', 'package.json', 'README.md'].map(file => `package/${file}`);
  if (members.length !== expected.length || new Set(members).size !== members.length || expected.some(file => !members.includes(file))) throw new Error('bundle archive contains missing, duplicate or unexpected members');
  if (tar('-tvzf', archive).trim().split('\n').some(line => !line.startsWith('-'))) throw new Error('bundle archive must contain regular files only');
  for (const member of expected) {
    const packed = execFileSync('tar', ['-xOzf', archive, member], { maxBuffer: MAX_ARTIFACT_BYTES });
    const source = readFileSync(join(root, member.slice('package/'.length)));
    if (!(member === 'package/package.json' ? isDeepStrictEqual(JSON.parse(packed.toString()), JSON.parse(source.toString())) : packed.equals(source))) throw new Error(`bundle archive bytes drift: ${member}; repack current candidate`);
  }
  return { archive, version: manifest.version, sha256: createHash('sha256').update(readFileSync(archive)).digest('hex'), members: members.length };
}
