/**
 * [INPUT]: 依赖根 manifest、components 唯一生成字节与本地 Git 固定提交对象。
 * [OUTPUT]: 提供 validateComponentSources，拒绝子包来源、版本或运行字节漂移。
 * [POS]: 两阶段分发的构建/发布守门；只读验证，不 fetch、不安装、不改全局解析。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { lstatSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const KINDS = ['identity', 'titles', 'capture'] as const;
const COMMON_FILES = ['package.json', 'index.js', 'client.js', 'client.js.map', 'plugin-icon.svg', 'locale/zh.json', 'locale/en.json'];
const MAX_GIT_BYTES = 64 * 1024 * 1024;

/** 所有来源必须固定同一组件提交；根分发提交可以晚一步引用它。 */
export function validateComponentSources(root: string): void {
  const read = (file: string): Buffer => {
    try {
      const path = join(root, file);
      if (!lstatSync(path).isFile()) throw new Error('not a regular file');
      return readFileSync(path);
    } catch { throw new Error(`component source ${file} must be a local regular file`); }
  };
  const manifest = JSON.parse(read('package.json').toString());
  if (typeof manifest.version !== 'string' || !manifest.version) throw new Error('component source root version missing');
  if (Object.hasOwn(manifest, 'bundledDependencies') || Object.hasOwn(manifest, 'bundleDependencies')) throw new Error('component source must use ordinary dependencies, not bundled packages');
  let sha: string | undefined;
  for (const kind of KINDS) {
    const declaration = manifest.dependencies?.[`@daftai/pdsh-${kind}`];
    const match = typeof declaration === 'string'
      ? new RegExp(`^github:daftAI2026/PDSH#([a-f0-9]{40})&path:/components/${kind}$`).exec(declaration)
      : null;
    if (!match) throw new Error(`component source ${kind} must pin the own repository, full SHA and exact subdirectory`);
    if (sha !== undefined && sha !== match[1]) throw new Error('component source child SHA generations differ');
    sha = match[1];
  }
  const git = (...args: string[]): Buffer => {
    try { return execFileSync('git', args, { cwd: root, stdio: 'pipe', maxBuffer: MAX_GIT_BYTES }); }
    catch { throw new Error(`component source local Git object unavailable: ${args.at(-1)}`); }
  };
  git('cat-file', '-e', `${sha}^{commit}`);
  for (const kind of KINDS) {
    const child = JSON.parse(read(`components/${kind}/package.json`).toString());
    if (child.name !== `@daftai/pdsh-${kind}` || child.version !== manifest.version) throw new Error(`component source ${kind} child name/version drift`);
    for (const file of [...COMMON_FILES, ...(kind === 'capture' ? ['main.cjs'] : [])]) {
      const path = `components/${kind}/${file}`;
      const bytes = read(path);
      if (!bytes.length) throw new Error(`component source ${kind}/${file} is empty`);
      if (!bytes.equals(git('show', `${sha}:${path}`))) throw new Error(`component source ${kind}/${file} differs from fixed SHA; publish matching components first`);
    }
  }
}
