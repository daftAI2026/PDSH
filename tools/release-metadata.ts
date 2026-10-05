/**
 * [INPUT]: 依赖唯一 PUBLIC_METADATA、package.json homepage、zh/en locale 和 README 管理块；GitHub I/O 只经官方 gh CLI。
 * [OUTPUT]: 提供本地/远端元信息校验与受限同步；仅更新公开描述、语言元数据和 topics，不发布、不安装、不改版本。
 * [POS]: 项目公开文案的一致性边界；导入仅声明 API，显式 CLI 才能执行本地写入或 GitHub 请求。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

/** 唯一公开元信息源；package 与 GitHub About 共享 description。 */
export const PUBLIC_METADATA = Object.freeze({
  zh: Object.freeze({
    title: 'DSH 私密模式',
    description: '遮挡侧栏标题、自定义昵称与头像，截取并打码编辑当前窗口。不提供会话隔离。',
  }),
  en: Object.freeze({
    title: 'DSH Private Mode',
    description: 'Mask sidebar titles, customize display aliases, and capture and redact this window. No session isolation.',
  }),
  description: 'DeepSeek Harness plugin for sidebar masking, display aliases, and local screenshot editing. No session isolation.',
  topics: Object.freeze(['dsh-plugin', 'deepseek-harness', 'deepseek', 'screenshot', 'redaction', 'typescript']),
});

const README_START = '<!-- pdsh:description:start -->';
const README_END = '<!-- pdsh:description:end -->';
const GITHUB_REPOSITORY = 'daftAI2026/PDSH';
const GITHUB_ACCEPT = 'application/vnd.github+json';
const DEFAULT_ROOT = fileURLToPath(new URL('../', import.meta.url));

type JsonObject = Record<string, unknown>;
type GithubApi = (args: string[], input?: string) => string;
type LocalFiles = {
  packageText: string;
  packageJson: JsonObject;
  zhText: string;
  zhJson: JsonObject;
  enText: string;
  enJson: JsonObject;
  readme: string;
  readmeBlock: { start: number; end: number; content: string };
};

/** 校验项目内公开描述、导出语言 metadata 与 README 单一管理块。 */
export function validatePublicMetadata(root: string): void {
  validateLocalFiles(readLocalFiles(root));
}

function validateLocalFiles(files: LocalFiles): void {
  const packageDescription = files.packageJson.description;
  assertEqualString(packageDescription, PUBLIC_METADATA.description, 'package.json description');
  validateLocale(files.zhJson, PUBLIC_METADATA.zh, 'locale/zh.json');
  validateLocale(files.enJson, PUBLIC_METADATA.en, 'locale/en.json');
  if (!isCanonicalReadmeContent(files.readmeBlock.content, PUBLIC_METADATA.zh.description)) {
    throw new Error('README description block must contain exactly the fixed one-line Chinese description');
  }
}

/** 仅改公开描述目标；所有文件与唯一 README 标记先完整读取、校验，再开始写入。 */
export function syncPublicMetadata(root: string): void {
  const files = readLocalFiles(root);
  const nextPackage = { ...files.packageJson, description: PUBLIC_METADATA.description };
  const nextZh = replaceLocaleMetadata(files.zhJson, PUBLIC_METADATA.zh);
  const nextEn = replaceLocaleMetadata(files.enJson, PUBLIC_METADATA.en);
  const eol = files.readme.includes('\r\n') ? '\r\n' : '\n';
  const nextReadme = files.readme.slice(0, files.readmeBlock.start + README_START.length)
    + eol + PUBLIC_METADATA.zh.description + eol
    + files.readme.slice(files.readmeBlock.end);
  const paths = pathsFor(root);

  writeFileSync(paths.packageJson, serializeJson(nextPackage, files.packageText));
  writeFileSync(paths.zhLocale, serializeJson(nextZh, files.zhText));
  writeFileSync(paths.enLocale, serializeJson(nextEn, files.enText));
  writeFileSync(paths.readme, nextReadme);
}

/** 只读校验 GitHub Repo API 返回，不联网；topics 对顺序不敏感但拒绝重复/缺失/未知项。 */
export function validateGithubMetadata(root: string, repo: unknown): void {
  const files = readLocalFiles(root);
  validateGithubMetadataForFiles(files, repo);
}

function validateGithubMetadataForFiles(files: LocalFiles, repo: unknown): void {
  validateLocalFiles(files);
  if (!isObject(repo)) throw new Error('GitHub repository response must be an object');
  assertEqualString(repo.description, PUBLIC_METADATA.description, 'GitHub About description');
  assertEqualString(repo.homepage, files.packageJson.homepage, 'GitHub homepage');
  validateTopics(repo.topics);
}

/** 经唯一 gh API 边界读取 About 与独立 topics 端点，再执行严格校验。 */
export function checkGithubMetadata(root: string): void {
  const files = readLocalFiles(root);
  validateLocalFiles(files);
  validateGithubMetadataForFiles(files, readGithubRepository());
}

function readLocalFiles(root: string): LocalFiles {
  const paths = pathsFor(root);
  const packageText = readText(paths.packageJson, 'package.json');
  const packageJson = parseObject(packageText, 'package.json');
  if (packageJson.name !== '@daftai/pdsh') {
    throw new Error('package.json name must be @daftai/pdsh for stable metadata operations');
  }
  const zhText = readText(paths.zhLocale, 'locale/zh.json');
  const enText = readText(paths.enLocale, 'locale/en.json');
  const readme = readText(paths.readme, 'README.md');
  const zhJson = parseObject(zhText, 'locale/zh.json');
  const enJson = parseObject(enText, 'locale/en.json');
  // +--- 先验证每个本地写目标结构；README 标记失败时不得提前写 JSON。 ---+
  requiredObject(zhJson.meta, 'locale/zh.json meta');
  requiredObject(enJson.meta, 'locale/en.json meta');
  const readmeBlock = locateReadmeBlock(readme);
  return { packageText, packageJson, zhText, zhJson, enText, enJson, readme, readmeBlock };
}

function pathsFor(root: string) {
  const base = resolve(root);
  return {
    packageJson: join(base, 'package.json'),
    zhLocale: join(base, 'locale', 'zh.json'),
    enLocale: join(base, 'locale', 'en.json'),
    readme: join(base, 'README.md'),
  };
}

function readText(path: string, label: string): string {
  try { return readFileSync(path, 'utf8'); }
  catch { throw new Error(`unable to read ${label}`); }
}

function parseObject(text: string, label: string): JsonObject {
  try {
    const value: unknown = JSON.parse(text);
    if (!isObject(value)) throw new Error('not an object');
    return value;
  } catch { throw new Error(`${label} must be a JSON object`); }
}

function requiredObject(value: unknown, label: string): JsonObject {
  if (!isObject(value)) throw new Error(`${label} must be an object`);
  return value;
}

function validateLocale(value: JsonObject, expected: { title: string; description: string }, label: string): void {
  const meta = requiredObject(value.meta, `${label} meta`);
  assertEqualString(meta.title, expected.title, `${label} meta.title`);
  assertEqualString(meta.description, expected.description, `${label} meta.description`);
}

function replaceLocaleMetadata(value: JsonObject, expected: { title: string; description: string }): JsonObject {
  const meta = requiredObject(value.meta, 'locale meta');
  return { ...value, meta: { ...meta, title: expected.title, description: expected.description } };
}

function locateReadmeBlock(readme: string): { start: number; end: number; content: string } {
  if (count(readme, README_START) !== 1 || count(readme, README_END) !== 1) {
    throw new Error('README must contain exactly one description start/end marker pair');
  }
  const start = readme.indexOf(README_START);
  const end = readme.indexOf(README_END);
  if (start < 0 || end < start + README_START.length
    || !isLineStart(readme, start) || !isLineEnd(readme, start + README_START.length)
    || !isLineStart(readme, end) || !isLineEnd(readme, end + README_END.length)) {
    throw new Error('README description markers must be ordered and occupy their own lines');
  }
  return { start, end, content: readme.slice(start + README_START.length, end) };
}

function isCanonicalReadmeContent(content: string, expected: string): boolean {
  const lines = content.split(/\r\n|\n|\r/);
  return lines.length === 3 && lines[0] === '' && lines[1] === expected && lines[2] === '';
}

function isLineStart(text: string, index: number): boolean {
  return index === 0 || text[index - 1] === '\n' || text[index - 1] === '\r';
}

function isLineEnd(text: string, index: number): boolean {
  return index === text.length || text[index] === '\n' || text[index] === '\r';
}

function count(text: string, value: string): number { return text.split(value).length - 1; }

function serializeJson(value: JsonObject, original: string): string {
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  return `${JSON.stringify(value, null, 2).replace(/\n/g, eol)}${eol}`;
}

function validateTopics(value: unknown): void {
  if (!Array.isArray(value) || !value.every(topic => typeof topic === 'string')) {
    throw new Error('GitHub topics must be an array of strings');
  }
  const actual = value as string[];
  const actualSet = new Set(actual);
  if (actualSet.size !== actual.length) throw new Error('GitHub topics must not contain duplicates');
  const expectedSet = new Set<string>(PUBLIC_METADATA.topics);
  if (actualSet.size !== expectedSet.size
    || [...expectedSet].some(topic => !actualSet.has(topic))
    || actual.some(topic => !expectedSet.has(topic))) {
    throw new Error('GitHub topics differ from PUBLIC_METADATA');
  }
}

function assertEqualString(actual: unknown, expected: unknown, label: string): asserts actual is string {
  if (typeof expected !== 'string' || typeof actual !== 'string' || actual !== expected) {
    throw new Error(`${label} differs from PUBLIC_METADATA/package homepage`);
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function githubApi(args: string[], input?: string): string {
  return execFileSync('gh', ['api', ...args], {
    encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...(input === undefined ? {} : { input }),
  });
}

function readGithubRepository(api: GithubApi = githubApi): unknown {
  try {
    const repo = JSON.parse(api([`repos/${GITHUB_REPOSITORY}`, '-H', `Accept: ${GITHUB_ACCEPT}`]));
    const topics = JSON.parse(api([`repos/${GITHUB_REPOSITORY}/topics`, '-H', `Accept: ${GITHUB_ACCEPT}`]));
    if (!isObject(repo) || !isObject(topics)) throw new Error('invalid GitHub response');
    return { ...repo, topics: topics.names };
  } catch { throw new Error('unable to read GitHub repository metadata via gh api'); }
}

/** 仅同步 GitHub About 描述/homepage 与 topics；不触及本地文件、版本或发布。 */
export function syncGithubMetadata(root: string, api: GithubApi = githubApi): void {
  const files = readLocalFiles(root);
  validateLocalFiles(files);
  const packageJson = files.packageJson;
  if (typeof packageJson.homepage !== 'string') throw new Error('package.json homepage must be a string');
  try {
    api([
      `repos/${GITHUB_REPOSITORY}`, '--method', 'PATCH',
      '-f', `description=${PUBLIC_METADATA.description}`,
      '-f', `homepage=${packageJson.homepage}`,
    ]);
    api([
      `repos/${GITHUB_REPOSITORY}/topics`, '--method', 'PUT',
      '-H', `Accept: ${GITHUB_ACCEPT}`, '--input', '-',
    ], JSON.stringify({ names: PUBLIC_METADATA.topics }));
  } catch { throw new Error('unable to sync GitHub repository metadata via gh api'); }
  validateGithubMetadata(root, readGithubRepository(api));
}

function runCli(args: string[]): void {
  const mode = args[0] ?? 'check';
  const root = DEFAULT_ROOT;
  if (args.length > 1 || !['check', 'sync-local', 'check-github', 'sync-github'].includes(mode)) {
    throw new Error('usage: release-metadata.ts [check|sync-local|check-github|sync-github]');
  }
  if (mode === 'sync-local') {
    syncPublicMetadata(root);
    validatePublicMetadata(root);
    process.stdout.write('Local public metadata synchronized and verified.\n');
  } else if (mode === 'check-github') {
    checkGithubMetadata(root);
    process.stdout.write('Local and GitHub public metadata verified.\n');
  } else if (mode === 'sync-github') {
    syncGithubMetadata(root);
    process.stdout.write('GitHub public metadata synchronized and verified; no release action was taken.\n');
  } else {
    validatePublicMetadata(root);
    process.stdout.write('Local public metadata verified.\n');
  }
}

// +--- 导入只声明工具；只有 Node 直接执行此文件时才进入 CLI。 ---+
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runCli(process.argv.slice(2)); }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'release metadata check failed'}\n`);
    process.exitCode = 1;
  }
}
