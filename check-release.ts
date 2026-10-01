/**
 * [INPUT]: 依赖根唯一版本、Git 工作树与单包运行产物验证器。
 * [OUTPUT]: 校验稳定 tag、文档版本、生成产物与 HEAD，拒绝脏发布树与非 main 稳定发布。
 * [POS]: 发布前防漂移门；不推送、打 tag、发布 npm 或修改版本。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateBundleArtifacts } from './bundle-artifacts.ts';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('.', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const expected = `v${manifest.version}`;
const tag = process.argv[2] ?? expected;
if (tag !== expected) throw new Error(`tag ${tag} does not match package.json ${expected}`);
if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) throw new Error('release tag must be stable semver');
validateBundleArtifacts(root);
const readme = readFileSync(new URL('./README.md', import.meta.url), 'utf8');
const guide = readFileSync(new URL('./AGENTS.md', import.meta.url), 'utf8');
if (!readme.includes(tag) || !readme.includes(`**${manifest.version} `)) throw new Error('README active release does not match package.json');
if (!guide.includes(`## ${manifest.version} release contract`)) throw new Error('AGENTS release contract does not match package.json');
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
if (git('branch', '--show-current') !== 'main') throw new Error('stable release must be checked on main, never the RC branch');
const existing = git('tag', '--list', tag);
if (existing && git('rev-list', '-n', '1', tag) !== git('rev-parse', 'HEAD')) throw new Error(`${tag} already points to another commit`);
if (git('status', '--porcelain')) throw new Error('release working tree must be clean');
process.stdout.write(existing
  ? `${tag} matches package.json, generated artifacts and HEAD.\n`
  : `${tag} candidate matches package.json and generated artifacts; tag not created.\n`);
