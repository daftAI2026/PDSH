/**
 * [INPUT]: 依赖单包 manifest、唯一 Cordis patch 与 build.ts 生成的 Host/Client、壁纸/取像/保存 Typert DTO 及 helper。
 * [OUTPUT]: 提供 validateBundleArtifacts/validatePackedBundle；拒绝运行条目、平台架构/最低系统、权限或归档漂移。
 * [POS]: 构建与发布共用的静态分发门；支持独立临时 RC 身份且维持同一产物门；只读本包与明确版本 tgz，不执行 bundle/helper，不访问用户 profile。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { lstatSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { join } from 'node:path';

const ARCHIVE_FILES = [
  'index.js', 'client.js', 'client.js.map', 'lib/capture-runtime/*.js',
  'lib/typert.host.js', 'lib/typert.host.d.ts', 'lib/typert.remote-client.js', 'lib/typert.remote-client.d.ts',
  'lib/types/shared/capture-export.d.ts', 'lib/types/shared/remote-types.d.ts',
  'lib/types/shared/window-capture-protocol.d.ts', 'lib/types/shared/window-save-protocol.d.ts',
  'lib/types/shared/system-wallpaper-protocol.d.ts',
  'native/window-capture', 'native/windows/window-capture-x64.exe', 'cordis.patch.yml', 'plugin-icon.svg', 'style-sources.json',
  'THIRD_PARTY_NOTICES.md', 'LICENSE', 'locale/*.json',
];
const PACKAGED_TEXT = ARCHIVE_FILES.filter(file => !file.startsWith('native/') && !file.includes('*'));
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
  if (!['@daftai/pdsh', '@daftai/pdsh-rc'].includes(manifest.name) || typeof manifest.version !== 'string' || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\w.-]+)?$/.test(manifest.version)) throw new Error('bundle identity/version drift');
  const rc = manifest.name === '@daftai/pdsh-rc';
  if (rc && !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-rc\.[1-9]\d*$/.test(manifest.version)) throw new Error('RC bundle requires a numbered candidate version');
  const entryId = rc ? 'pdsh-rc' : 'pdsh';
  if (manifest.private !== true) throw new Error('bundle must remain private for GitHub distribution');
  if (manifest.bundledDependencies || manifest.bundleDependencies || manifest.files?.includes('components/')) throw new Error('bundle must not contain legacy component package topology');
  if (!Array.isArray(manifest.files) || manifest.files.length !== ARCHIVE_FILES.length || ARCHIVE_FILES.some(file => !manifest.files.includes(file))) throw new Error('bundle archive files must match the explicit single-package allowlist');

  if (Object.keys(manifest.optionalDependencies ?? {}).length) throw new Error('bundle must not add optional component/runtime dependencies');
  for (const [name, version] of Object.entries(manifest.dependencies ?? {})) {
    if (name.startsWith('@daftai/pdsh') || typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version)) throw new Error(`bundle dependency ${name} must be exact, not a component source or range`);
  }
  if (manifest.dependencies?.['@deepseek-ai/dsh-typert-protocol'] !== '0.2.0-rc.2' || manifest.dependencies?.zod !== '4.4.3') throw new Error('Host Typert runtime dependencies must stay on the verified rc.2 protocol and generated-schema version');
  if (manifest.devDependencies?.['@deepseek-ai/dsh-typert-generator'] !== '0.2.0-rc.2') throw new Error('Typert generation must use the exact official rc.2 compiler');
  if (manifest.peerDependencies?.['@deepseek-ai/cordis'] !== '~4.0.4') throw new Error('Host Cordis must resolve through the compatible official Host peer');
  for (const [name, version] of Object.entries(manifest.peerDependencies ?? {})) {
    if (name !== '@deepseek-ai/cordis' || version !== '~4.0.4') throw new Error(`unexpected bundle peer dependency ${name}`);
  }
  for (const hook of ['preinstall', 'install', 'postinstall', 'prepare']) if (manifest.scripts?.[hook]) throw new Error(`bundle must not require ${hook} installation hook`);
  for (const file of ['index.js', 'client.js', 'client.js.map', 'lib/typert.host.js', 'lib/typert.host.d.ts', 'lib/typert.remote-client.js', 'lib/typert.remote-client.d.ts', 'native/window-capture', 'cordis.patch.yml', 'plugin-icon.svg', 'locale/*.json']) {
    if (!manifest.files?.includes(file)) throw new Error(`bundle archive membership missing ${file}`);
  }

  const exports = manifest.exports ?? {};
  if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml' || exports['./client'] !== './client.js' || exports['.'] !== './index.js') throw new Error('bundle exported entry drift');
  if (!isDeepStrictEqual(exports['./typert'], { types: './lib/typert.host.d.ts', default: './lib/typert.host.js' })
    || !isDeepStrictEqual(exports['./remote'], { types: './lib/typert.remote-client.d.ts', default: './lib/typert.remote-client.js' })
    || !isDeepStrictEqual(exports['./types'], { types: './lib/types/shared/remote-types.d.ts' })) {
    throw new Error('official Typert/type subpath export drift');
  }
  const patch = read('cordis.patch.yml');
  if ([...patch.matchAll(/- id:/g)].length !== 1 || !new RegExp(`id: ${entryId}\\s+name: "${manifest.name}"`).test(patch)) throw new Error('bundle must retain the single pdsh root entry');

  for (const file of PACKAGED_TEXT) read(file);
  for (const file of ['index.js', 'client.js']) {
    if (!read(file).includes(`PDSH build ${JSON.stringify(manifest.version)}`)) throw new Error(`bundle artifact ${file} version drift; rebuild`);
  }
  const runtime = read(`lib/capture-runtime/${manifest.version}.js`);
  if (!runtime.includes(`PDSH build ${JSON.stringify(manifest.version)}`) || !runtime.includes('pdsh-capture-runtime-v2')) throw new Error('bundle capture runtime version/contract drift');
  const helper = lstatSync(join(root, 'native/window-capture'));
  if (!helper.isFile() || (helper.mode & 0o777) !== 0o755) throw new Error('native helper must be a packaged executable regular file with mode 0755');
  validateMacHelper(readFileSync(join(root, 'native/window-capture')));
  const windowsPath = join(root, 'native/windows/window-capture-x64.exe');
  if (!lstatSync(windowsPath).isFile()) throw new Error('Windows native helper must be a regular PE file');
  validateWindowsHelper(readFileSync(windowsPath));

  const host = read('index.js');
  if (!host.includes('@deepseek-ai/dsh-typert-protocol') || !host.includes('./native/window-capture')) throw new Error('Host must use official Typert runtime and root-relative packaged helper');
  for (const forbidden of ['capture-route', 'capture-bootstrap', 'inspector-ownership', 'page-capture-main', 'page-save-main', 'main.cjs']) {
    if (host.includes(forbidden)) throw new Error(`retired Main/Inspector path leaked into Host runtime: ${forbidden}`);
  }

  const hostTypert = read('lib/typert.host.js');
  const remote = read('lib/typert.remote-client.js');
  const remoteTypes = read('lib/typert.remote-client.d.ts');
  for (const method of ['capture', 'save', 'wallpaper', 'implementationVersion']) {
    if (!hostTypert.includes(`method: '${method}'`) || !remote.includes(`method: '${method}'`)) throw new Error(`generated Typert artifacts missing ${method}`);
  }
  if (!hostTypert.includes("service: 'pdshWindowCapture'") || !hostTypert.includes("namespace: 'pdshNativeWindowCapture'")) throw new Error('generated Host descriptor lost its owned-window service identity');
  if (!hostTypert.includes('uplink:') || !remoteTypes.includes('RemoteStreamHandle<WindowSaveFrame, WindowSaveInputFrame>')) throw new Error('generated save uplink codec/type missing');

  const client = read('client.js');
  if ([...client.matchAll(/window\.__ModuleLoader__\.load\(/g)].length !== 1 || !client.includes(`id:${JSON.stringify(manifest.name)}`)) throw new Error('bundle must provide exactly one root Client factory');
}

/** 只读 Mach-O 头部；不能把构建机架构或测试用文本当成双架构分发物。 */
function validateMacHelper(bytes: Buffer): void {
  const refuse = () => { throw new Error('native helper must contain arm64/x86_64 Mach-O slices with minimum macOS 14.0'); };
  if (bytes.length < 48 || bytes.readUInt32BE(0) !== 0xcafebabe || bytes.readUInt32BE(4) !== 2) refuse();
  const architectures = new Set<number>();
  const ranges: Array<[number, number]> = [];
  for (let index = 0; index < 2; index++) {
    const entry = 8 + index * 20;
    const cpu = bytes.readUInt32BE(entry);
    const start = bytes.readUInt32BE(entry + 8);
    const size = bytes.readUInt32BE(entry + 12);
    if (![0x01000007, 0x0100000c].includes(cpu) || architectures.has(cpu) || start < 48 || size < 32 || start + size > bytes.length) refuse();
    architectures.add(cpu);
    if (ranges.some(([otherStart, otherEnd]) => start < otherEnd && start + size > otherStart)) refuse();
    ranges.push([start, start + size]);
    if (bytes.readUInt32LE(start) !== 0xfeedfacf || bytes.readUInt32LE(start + 4) !== cpu) refuse();
    const commands = bytes.readUInt32LE(start + 16);
    const commandBytes = bytes.readUInt32LE(start + 20);
    if (commandBytes > size - 32 || commands > commandBytes / 8) refuse();
    let position = start + 32;
    const end = position + commandBytes;
    let foundMinimum = false;
    for (let command = 0; command < commands; command++) {
      if (position + 8 > end) refuse();
      const kind = bytes.readUInt32LE(position);
      const length = bytes.readUInt32LE(position + 4);
      if (length < 8 || position + length > end) refuse();
      if (kind === 0x32) {
        if (foundMinimum || length < 24 || bytes.readUInt32LE(position + 8) !== 1 || bytes.readUInt32LE(position + 12) !== 0x000e0000) refuse();
        foundMinimum = true;
      }
      position += length;
    }
    if (!foundMinimum || position !== end) refuse();
  }
}

/** Windows只分发x64控制台PE；asInvoker保持调用者权限，禁止静默提权。 */
function validateWindowsHelper(bytes: Buffer): void {
  const refuse = () => { throw new Error('Windows native helper must be a bounded x64 console PE with asInvoker manifest'); };
  if (bytes.length < 256 || bytes.length > MAX_ARTIFACT_BYTES || bytes.readUInt16LE(0) !== 0x5a4d) refuse();
  const pe = bytes.readUInt32LE(0x3c);
  if (pe < 64 || pe + 96 > bytes.length || bytes.readUInt32LE(pe) !== 0x00004550 || bytes.readUInt16LE(pe + 4) !== 0x8664) refuse();
  const optional = pe + 24;
  if (bytes.readUInt16LE(pe + 20) < 70 || bytes.readUInt16LE(optional) !== 0x20b || bytes.readUInt16LE(optional + 68) !== 3) refuse();
  const text = bytes.toString('utf8');
  if (!/<requestedExecutionLevel\b[^>]*\blevel=["']asInvoker["'][^>]*\buiAccess=["']false["']/u.test(text)
    || /\blevel=["'](?:requireAdministrator|highestAvailable)["']/u.test(text)) refuse();
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
  const expected = [...ARCHIVE_FILES.filter(file => !file.includes('*')), `lib/capture-runtime/${manifest.version}.js`, 'locale/zh.json', 'locale/en.json', 'package.json', 'README.md'].map(file => `package/${file}`);
  if (members.length !== expected.length || new Set(members).size !== expected.length || expected.some(file => !members.includes(file))) throw new Error('bundle archive contains missing, duplicate or unexpected members');
  if (tar('-tvzf', archive).trim().split('\n').some(line => !line.startsWith('-'))) throw new Error('bundle archive must contain regular files only');
  const helperMode = tar('-tvzf', archive, 'package/native/window-capture').slice(0, 10);
  if (!/^-rwxr-xr-x$/.test(helperMode)) throw new Error('bundle archive native helper must preserve mode 0755');
  for (const member of expected) {
    const packed = execFileSync('tar', ['-xOzf', archive, member], { maxBuffer: MAX_ARTIFACT_BYTES });
    const source = readFileSync(join(root, member.slice('package/'.length)));
    if (!(member === 'package/package.json' ? isDeepStrictEqual(JSON.parse(packed.toString()), JSON.parse(source.toString())) : packed.equals(source))) throw new Error(`bundle archive bytes drift: ${member}; repack current candidate`);
  }
  return { archive, version: manifest.version, sha256: createHash('sha256').update(readFileSync(archive)).digest('hex'), members: members.length };
}
