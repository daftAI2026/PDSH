/**
 * [INPUT]: 依赖 package.json 的唯一版本号、Git 工作树和 build.ts 生成的 Client 产物。
 * [OUTPUT]: 校验候选 tag 与包版本相同、产物嵌入该版本且工作树无未提交变更。
 * [POS]: 发布前防漂移门；不自行推送、打 tag、发布 npm 或修改任何版本号。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
const expected = `v${manifest.version}`;
const tag = process.argv[2] ?? expected;
if (tag !== expected) throw new Error(`tag ${tag} does not match package.json ${expected}`);
if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) throw new Error('release tag must be stable semver');
const client = readFileSync(new URL('./client.js', import.meta.url), 'utf8');
if (!client.includes(JSON.stringify(manifest.version))) throw new Error('client.js does not embed the package version; rebuild');
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
