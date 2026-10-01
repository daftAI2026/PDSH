/**
 * [INPUT]: 依赖根唯一版本、Git 工作树和 build.ts 的三个入口及 真实子包加载/元信息与分发自链接。
 * [OUTPUT]: 校验 tag/三包版本、生成入口完整及 patch 加载路径，拒绝脏发布树。
 * [POS]: 发布前防漂移门；不自行推送、打 tag、发布 npm 或修改任何版本号。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string; files?: string[]; dependencies?: Record<string, string>; bundledDependencies?: string[] };
if (!manifest.files?.includes('components/')) throw new Error('archive component membership missing');
const expected = `v${manifest.version}`;
const tag = process.argv[2] ?? expected;
if (tag !== expected) throw new Error(`tag ${tag} does not match package.json ${expected}`);
if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) throw new Error('release tag must be stable semver');
const client = readFileSync(new URL('./client.js', import.meta.url), 'utf8');
if (!client.includes(JSON.stringify(manifest.version))) throw new Error('client.js does not embed the package version; rebuild');
// +--- 一个 Bundle 的三个真实入口必须同时完整，不能只验证根 Client ---+
for (const kind of ['titles', 'capture']) {
  const name = `@daftai/pdsh-${kind}`;
  if (manifest.dependencies?.[name] !== `file:./components/${kind}` || !manifest.bundledDependencies?.includes(name)) throw new Error(`${kind} component dependency drift`);
  const base = new URL(`./components/${kind}/`, import.meta.url);
  const child = JSON.parse(readFileSync(new URL('package.json', base), 'utf8'));
  if (child.name !== `@daftai/pdsh-${kind}` || child.version !== manifest.version) throw new Error(`${kind} package version/name drift; rebuild`);
  for (const file of ['index.js', 'client.js', 'client.js.map', 'plugin-icon.svg', 'locale/zh.json', 'locale/en.json', ...(kind === 'capture' ? ['main.cjs'] : [])]) {
    if (!readFileSync(new URL(file, base)).length) throw new Error(`${kind}/${file} is empty`);
  }
  if (!readFileSync(new URL('client.js', base), 'utf8').includes(JSON.stringify(manifest.version))) throw new Error(`${kind} Client version drift; rebuild`);
  const patch = readFileSync(new URL('./cordis.patch.yml', import.meta.url), 'utf8');
  if (!patch.includes(`id: pdsh-${kind}\n      name: "@daftai/pdsh-${kind}"`)) throw new Error(`${kind} profile loading path drift`);
}
const readme = readFileSync(new URL('./README.md', import.meta.url), 'utf8');
const guide = readFileSync(new URL('./AGENTS.md', import.meta.url), 'utf8');
if (!readme.includes(tag) || !readme.includes(`**${manifest.version} `)) throw new Error('README active release does not match package.json');
if (!guide.includes(`## ${manifest.version} release contract`)) throw new Error('AGENTS release contract does not match package.json');
const existing = execFileSync('git', ['tag', '--list', tag], { encoding: 'utf8' }).trim();
if (existing) {
  const tagged = execFileSync('git', ['rev-list', '-n', '1', tag], { encoding: 'utf8' }).trim();
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (tagged !== head) throw new Error(`${tag} already points to another commit`);
}
if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) throw new Error('release working tree must be clean');
process.stdout.write(existing
  ? `${tag} matches package.json, embedded client version and HEAD.\n`
  : `${tag} candidate matches package.json and embedded client version; tag not created.\n`);
