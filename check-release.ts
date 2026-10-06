/**
 * [INPUT]: 依赖唯一版本、README、长期指南、Git 和产物门。依赖只读 GitHub 元信息。
 * [OUTPUT]: 核对版本、Release 章节、产物和 HEAD。拒绝元信息漂移、脏树和非 main 发布。
 * [POS]: 发布前防漂移门；不推送、打 tag、发布 npm 或修改版本。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateBundleArtifacts } from './bundle-artifacts.ts';
import { validatePublicMetadata, checkGithubMetadata } from './tools/release-metadata.ts';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('.', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
if (manifest.name !== '@daftai/pdsh') throw new Error('stable release cannot use the temporary RC identity');
const expected = `v${manifest.version}`;
const tag = process.argv[2] ?? expected;
if (tag !== expected) throw new Error(`tag ${tag} does not match package.json ${expected}`);
if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(tag)) throw new Error('release tag must be stable semver');
validateBundleArtifacts(root);
validatePublicMetadata(root);
const readme = readFileSync(new URL('./README.md', import.meta.url), 'utf8');
const guide = readFileSync(new URL('./AGENTS.md', import.meta.url), 'utf8');
if (!readme.includes(tag) || !readme.includes(`**${manifest.version} `)) throw new Error('README active release does not match package.json');
if (!/^## Release\r?$/mu.test(guide)) throw new Error('AGENTS must include a version-independent Release section');
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
if (git('branch', '--show-current') !== 'main') throw new Error('stable release must be checked on main, never the RC branch');
const existing = git('tag', '--list', tag);
if (existing && git('rev-list', '-n', '1', tag) !== git('rev-parse', 'HEAD')) throw new Error(`${tag} already points to another commit`);
if (git('status', '--porcelain')) throw new Error('release working tree must be clean');
// +--- 公开仓库状态也属于发布件；离线、鉴权失败或漂移均不能冒充通过。 ---+
checkGithubMetadata(root);
process.stdout.write(existing
  ? `${tag} matches package.json, generated artifacts and HEAD.\n`
  : `${tag} candidate matches package.json and generated artifacts; tag not created.\n`);
