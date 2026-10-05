/**
 * [INPUT]: 依赖调用方指定的 PDSH 根目录、只读文件系统访问与现有 TypeScript compiler API。
 * [OUTPUT]: 对外提供 assessHostCompatibility 与 HostCompatibilityAssessment，返回相对位置、预算缺口和待核验提示组成的静态盘点。
 * [POS]: tools 的本地只读评估器；以白名单源码为边界，不安装、不推断目标兼容性或运行可达性。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  closeSync, constants, fstatSync, lstatSync, openSync, opendirSync, readSync,
} from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const PACKAGE_NAME = '@daftai/pdsh';
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_FILES = 4096;
const MAX_DIRECTORIES = 512;
const MAX_DIRECTORY_ENTRIES = 4096;
const MAX_DEPTH = 32;
const MAX_SKIPPED_ITEMS = 2048;
const MAX_IMPORT_ITEMS = 200;
const MAX_RULE_POSITIONS = 20;

const ROOT_FILES = ['build.ts', 'cordis.patch.yml', 'package.json', 'pnpm-lock.yaml'] as const;
const SOURCE_ROOTS = ['src', 'native'] as const;
const EXCLUDED_NAMES = new Set([
  '.git', '.hg', '.svn', '.env', '.npmrc', 'credentials', 'credential', 'profiles', 'profile',
  'secrets', 'secret', 'tests', 'docs', 'output', 'node_modules',
]);
const TEXT_EXTENSIONS: Record<'src' | 'native', Set<string>> = {
  src: new Set(['.ts', '.tsx', '.css']),
  native: new Set(['.swift', '.cpp', '.h', '.mm', '.m', '.sh', '.ps1']),
};

const RULES = [
  {
    ruleId: 'PDSH-HOST-SOURCE-PATCH',
    pattern: /\b(?:sourcePatch|patchSource|applyPatch|patch(?:es)?|asar|Module\._extensions|require\.cache)\b/i,
  },
  {
    ruleId: 'PDSH-HOST-EVENT-CONFIG',
    pattern: /\b(?:ctx\.(?:on|off|emit|emitSync|dispose)|Schema\.|config(?:uration)?|on[A-Z]\w*)\b/,
  },
  {
    ruleId: 'PDSH-HOST-SERVICE-REMOTE',
    pattern: /\b(?:ctx\.(?:provide|inject)|ctx\.remote|services?|remotes?|rpc|Typert|namespace)\b/i,
  },
  {
    ruleId: 'PDSH-HOST-FILES',
    pattern: /\b(?:node:fs(?:\/promises)?|fs\/promises|(?:readFile|writeFile|open|mkdir|rename|unlink)(?:Sync)?|fsync|homedir|tmpdir|fileURLToPath)\b/,
  },
  {
    ruleId: 'PDSH-HOST-UI-REGISTRATION',
    pattern: /\b(?:ctx\.inject|plugins\.detail|PluginManager|ConfigEditor|Settings|defineConfig|clientEntry)\b/,
  },
  {
    ruleId: 'PDSH-HOST-DOM-CSS',
    pattern: /\b(?:document\.(?:querySelector|createElement)|MutationObserver|addEventListener|querySelector(?:All)?|classList|shadowRoot)\b|--dsw-|::part|\[data-[\w-]+\]/,
  },
  {
    ruleId: 'PDSH-HOST-SUBPROCESS',
    pattern: /\b(?:child_process|(?:spawn|execFile|exec)(?:Sync)?|NSTask|ProcessBuilder|CreateProcess|stdout|stderr|stdio|Electron|devicePixelRatio|visualViewport|pointPixelScale|CGWindow\w*|ScreenCaptureKit|GraphicsCapture\w*)\b/,
  },
] as const;

type DependencyDeclaration = { name: string; version: string };
type FileRecord = { file: string; bytes: number };
type SkippedRecord = { file: string; reason: string };
type Position = { file: string; line: number };
type RuleResult = { ruleId: string; total: number; shown: number; truncated: number; positions: Position[] };

export type HostCompatibilityAssessment = {
  readOnly: true;
  compatibility: 'unverified';
  scope: 'heuristic';
  package: { name: string; version: string | null };
  dependencies: {
    runtime: DependencyDeclaration[];
    dev: DependencyDeclaration[];
    peer: DependencyDeclaration[];
  };
  scan: {
    complete: boolean;
    files: FileRecord[];
    skipped: SkippedRecord[];
    skippedTotal: number;
    skippedTruncated: number;
    truncatedFiles: number;
    limits: {
      fileBytes: number;
      files: number;
      directories: number;
      entriesPerDirectory: number;
      depth: number;
    };
  };
  rules: RuleResult[];
  imports: { total: number; shown: number; truncated: number; items: Array<Position & { specifier: string }> };
  totalHits: number;
  truncatedCount: number;
  reviewHints: Array<{ file: string; reason: 'historical-header' | 'main-inspector-path'; runtimeReachability: 'unverified' }>;
  caveats: string[];
};

type LoadedText = { text: string; bytes: number };

function compareStrings(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }

function safeRelative(root: string, filePath: string): string {
  return relative(root, filePath).split(/[/\\]/).join('/') || '.';
}

function packageError(message: string): Error {
  return new Error(message);
}

function openTextFile(filePath: string): { loaded?: LoadedText; reason?: string } {
  let descriptor: number | undefined;
  try {
    const noFollow = constants.O_NOFOLLOW ?? 0;
    descriptor = openSync(filePath, constants.O_RDONLY | noFollow);
    const opened = fstatSync(descriptor);
    if (!opened.isFile()) return { reason: 'not-regular-file' };
    if (opened.size > MAX_FILE_BYTES) return { reason: 'too-large' };

    const chunks: Buffer[] = [];
    const buffer = Buffer.alloc(64 * 1024);
    let bytes = 0;
    while (bytes <= MAX_FILE_BYTES) {
      const length = Math.min(buffer.length, MAX_FILE_BYTES + 1 - bytes);
      const count = readSync(descriptor, buffer, 0, length, null);
      if (count === 0) break;
      bytes += count;
      if (bytes > MAX_FILE_BYTES) return { reason: 'too-large' };
      chunks.push(Buffer.from(buffer.subarray(0, count)));
    }
    return { loaded: { text: Buffer.concat(chunks, bytes).toString('utf8'), bytes } };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { reason: code === 'ELOOP' || code === 'EMLINK' ? 'symlink' : 'read-failed' };
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function deepseekDeclarations(manifest: Record<string, unknown>, section: string): DependencyDeclaration[] {
  const declarations = manifest[section];
  if (typeof declarations !== 'object' || declarations === null || Array.isArray(declarations)) return [];
  return Object.entries(declarations as Record<string, unknown>)
    .filter(([name]) => name === '@deepseek-ai' || name.startsWith('@deepseek-ai/'))
    .sort(([a], [b]) => compareStrings(a, b))
    .map(([name, version]) => ({
      name,
      version: typeof version === 'string' ? version : JSON.stringify(version) ?? String(version),
    }));
}

function isDeepseekSpecifier(specifier: string): boolean {
  return specifier === '@deepseek-ai' || specifier.startsWith('@deepseek-ai/');
}

function importSpecifier(node: ts.Node): string | undefined {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    const moduleSpecifier = node.moduleSpecifier;
    return moduleSpecifier && ts.isStringLiteralLike(moduleSpecifier) ? moduleSpecifier.text : undefined;
  }
  if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length === 1) {
    const argument = node.arguments[0];
    return ts.isStringLiteralLike(argument) ? argument.text : undefined;
  }
  return undefined;
}

function walkDirectory(
  root: string,
  absoluteDir: string,
  area: 'src' | 'native',
  depth: number,
  state: ScanState,
): void {
  const path = safeRelative(root, absoluteDir);
  if (state.fileLimitReached) { state.skip(path, 'file-limit-unvisited', true); return; }
  if (depth > MAX_DEPTH) {
    state.skip(path, 'depth-limit', true);
    return;
  }
  let stat;
  try { stat = lstatSync(absoluteDir); }
  catch { state.skip(path, 'stat-failed', true); return; }
  if (stat.isSymbolicLink()) { state.skip(path, 'symlink', true); return; }
  if (!stat.isDirectory()) { state.skip(path, 'not-directory', true); return; }
  if (state.directories >= MAX_DIRECTORIES) { state.skip(path, 'directory-limit', true); return; }
  state.directories += 1;

  const entries: string[] = [];
  let directory: ReturnType<typeof opendirSync> | undefined;
  try {
    directory = opendirSync(absoluteDir, { bufferSize: 64 });
    for (let entry = directory.readSync(); entry; entry = directory.readSync()) {
      if (entries.length >= MAX_DIRECTORY_ENTRIES) {
        state.skip(path, 'entry-limit', true);
        break;
      }
      entries.push(entry.name);
    }
  } catch { state.skip(path, 'read-directory-failed', true); return; }
  finally { directory?.closeSync(); }
  entries.sort(compareStrings);

  for (const name of entries) {
    const child = join(absoluteDir, name);
    const childRelative = safeRelative(root, child);
    if (isExcluded(name)) {
      state.skip(childRelative, 'excluded', false);
      continue;
    }
    let childStat;
    try { childStat = lstatSync(child); }
    catch { state.skip(childRelative, 'stat-failed', true); continue; }
    if (childStat.isSymbolicLink()) { state.skip(childRelative, 'symlink', true); continue; }
    if (childStat.isDirectory()) {
      walkDirectory(root, child, area, depth + 1, state);
      if (state.fileLimitReached) { state.skip(path, 'file-limit-unvisited', true); return; }
      continue;
    }
    if (!childStat.isFile()) { state.skip(childRelative, 'not-regular-file', true); continue; }
    if (!TEXT_EXTENSIONS[area].has(extname(name).toLowerCase())) {
      if (area === 'native' && isNativeBinaryName(name)) state.skip(childRelative, 'native-binary-not-read', false);
      continue;
    }
    state.scanFile(child, childRelative);
    if (state.fileLimitReached) { state.skip(path, 'file-limit-unvisited', true); return; }
  }
}

function isExcluded(name: string): boolean {
  const normalized = name.toLowerCase();
  const stem = normalized.split('.')[0];
  return normalized.startsWith('.') || EXCLUDED_NAMES.has(normalized) || EXCLUDED_NAMES.has(stem);
}

function isNativeBinaryName(name: string): boolean {
  return /\.(?:exe|dll|dylib|so|a|o|bin|wasm)$/i.test(name);
}

class ScanState {
  readonly files: FileRecord[] = [];
  readonly skipped: SkippedRecord[] = [];
  readonly rules: RuleResult[] = RULES.map(({ ruleId }) => ({ ruleId, total: 0, shown: 0, truncated: 0, positions: [] }));
  readonly imports: Array<Position & { specifier: string }> = [];
  readonly importCounts = { total: 0, truncated: 0 };
  readonly reviewHints: HostCompatibilityAssessment['reviewHints'] = [];
  skippedTotal = 0;
  skippedTruncated = 0;
  truncatedFiles = 0;
  directories = 0;
  complete = true;
  fileLimitReached = false;

  skip(file: string, reason: string, incomplete: boolean): void {
    this.skippedTotal += 1;
    if (this.skipped.length < MAX_SKIPPED_ITEMS) this.skipped.push({ file, reason });
    else this.skippedTruncated += 1;
    if (incomplete) this.complete = false;
  }

  seedFile(file: string, loaded: LoadedText): void {
    this.files.push({ file, bytes: loaded.bytes });
    this.inspect(file, loaded.text);
  }

  scanFile(absolutePath: string, file: string): void {
    if (this.files.length >= MAX_FILES) {
      this.fileLimitReached = true;
      this.skip(file, 'file-limit', true);
      return;
    }
    const read = openTextFile(absolutePath);
    if (!read.loaded) {
      this.skip(file, read.reason ?? 'read-failed', true);
      if (read.reason === 'too-large' || read.reason === 'read-failed') this.truncatedFiles += 1;
      return;
    }
    this.seedFile(file, read.loaded);
  }

  private inspect(file: string, text: string): void {
    const lines = text.split(/\r\n|\n|\r/);
    // +--- 历史线索不是可达性结论，纯工具也可能仍被现行入口复用 ---+
    if (/退役|退出|retired/i.test(lines.slice(0, 50).join('\n'))) {
      this.reviewHints.push({ file, reason: 'historical-header', runtimeReachability: 'unverified' });
    } else if (/(?:page-(?:capture|save)-main|capture-bootstrap|capture-control|inspector-ownership)\.ts$/.test(file)) {
      this.reviewHints.push({ file, reason: 'main-inspector-path', runtimeReachability: 'unverified' });
    }
    for (let index = 0; index < lines.length; index += 1) {
      for (let ruleIndex = 0; ruleIndex < RULES.length; ruleIndex += 1) {
        if (!RULES[ruleIndex].pattern.test(lines[index])) continue;
        const result = this.rules[ruleIndex];
        result.total += 1;
        if (result.positions.length < MAX_RULE_POSITIONS) result.positions.push({ file, line: index + 1 });
      }
    }

    if (!/\.tsx?$/.test(file)) return;
    const scriptKind = file.toLowerCase().endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind);
    const visit = (node: ts.Node): void => {
      const specifier = importSpecifier(node);
      if (specifier && isDeepseekSpecifier(specifier)) {
        this.importCounts.total += 1;
        if (this.imports.length < MAX_IMPORT_ITEMS) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          this.imports.push({ file, line: line + 1, specifier });
        } else this.importCounts.truncated += 1;
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
  }
}

function readManifest(root: string): { manifest: Record<string, unknown>; loaded: LoadedText } {
  const path = join(root, 'package.json');
  let stat;
  try { stat = lstatSync(path); }
  catch { throw packageError('package.json is missing or unreadable'); }
  if (stat.isSymbolicLink()) throw packageError('package.json symlink is refused');
  if (!stat.isFile()) throw packageError('package.json is not a regular file');
  if (stat.size > MAX_FILE_BYTES) throw packageError('package.json exceeds the file size limit');
  const result = openTextFile(path);
  if (!result.loaded) {
    if (result.reason === 'too-large') throw packageError('package.json exceeds the file size limit');
    throw packageError('package.json is missing or unreadable');
  }
  let manifest: unknown;
  try { manifest = JSON.parse(result.loaded.text); }
  catch { throw packageError('package.json is invalid JSON'); }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw packageError('package.json is invalid');
  const value = manifest as Record<string, unknown>;
  if (value.name !== PACKAGE_NAME) throw packageError('package identity must be @daftai/pdsh');
  return { manifest: value, loaded: result.loaded };
}

function collectRootFile(root: string, file: string, state: ScanState): void {
  const absolutePath = join(root, file);
  if (file === 'package.json') {
    // 身份 manifest 已经在拒绝符号链接的边界内读取并核对。
    return;
  }
  let stat;
  try { stat = lstatSync(absolutePath); }
  catch { state.skip(file, 'missing', true); return; }
  if (stat.isSymbolicLink()) { state.skip(file, 'symlink', true); return; }
  if (!stat.isFile()) { state.skip(file, 'not-regular-file', true); return; }
  state.scanFile(absolutePath, file);
}

function makeReport(manifest: Record<string, unknown>, state: ScanState): HostCompatibilityAssessment {
  for (const result of state.rules) {
    result.shown = result.positions.length;
    result.truncated = result.total - result.shown;
  }
  state.rules.sort((a, b) => compareStrings(a.ruleId, b.ruleId));
  state.imports.sort((a, b) => compareStrings(a.file, b.file) || a.line - b.line || compareStrings(a.specifier, b.specifier));
  state.files.sort((a, b) => compareStrings(a.file, b.file));
  state.skipped.sort((a, b) => compareStrings(a.file, b.file) || compareStrings(a.reason, b.reason));
  const totalHits = state.rules.reduce((sum, result) => sum + result.total, 0);
  const truncatedCount = state.rules.reduce((sum, result) => sum + result.truncated, 0) + state.importCounts.truncated;
  return {
    readOnly: true,
    compatibility: 'unverified',
    scope: 'heuristic',
    package: {
      name: PACKAGE_NAME,
      version: typeof manifest.version === 'string' ? manifest.version : null,
    },
    dependencies: {
      runtime: deepseekDeclarations(manifest, 'dependencies'),
      dev: deepseekDeclarations(manifest, 'devDependencies'),
      peer: deepseekDeclarations(manifest, 'peerDependencies'),
    },
    scan: {
      complete: state.complete,
      files: state.files,
      skipped: state.skipped,
      skippedTotal: state.skippedTotal,
      skippedTruncated: state.skippedTruncated,
      truncatedFiles: state.truncatedFiles,
      limits: {
        fileBytes: MAX_FILE_BYTES,
        files: MAX_FILES,
        directories: MAX_DIRECTORIES,
        entriesPerDirectory: MAX_DIRECTORY_ENTRIES,
        depth: MAX_DEPTH,
      },
    },
    rules: state.rules,
    imports: {
      total: state.importCounts.total,
      shown: state.imports.length,
      truncated: state.importCounts.truncated,
      items: state.imports,
    },
    totalHits,
    truncatedCount,
    reviewHints: state.reviewHints,
    caveats: [
      'scope=heuristic；零命中不代表兼容。',
      '本报告不运行 Host/Client；实际 Host/Client 行为与目标兼容性均未知。',
      '未提供目标 from/to 版本，不生成版本变更结论。',
      '静态命中与运行时可达性仍需主代理核验。',
      'Main/Inspector 路径和退役头部仅作历史核验线索，不证明文件已退出运行或不可复用。',
      '扫描受白名单、文件大小及遍历上限约束；缺口见 scan.skipped。',
    ],
  };
}

/** 只读扫描明确白名单中的 PDSH 文件，不跟随符号链接或启动任何子进程。 */
export function assessHostCompatibility(root: string): HostCompatibilityAssessment {
  if (typeof root !== 'string' || root.length === 0) throw packageError('scan root must be a non-empty path');
  const absoluteRoot = resolve(root);
  let rootStat;
  try { rootStat = lstatSync(absoluteRoot); }
  catch { throw packageError('scan root is missing or unreadable'); }
  if (rootStat.isSymbolicLink()) throw packageError('scan root symlink is refused');
  if (!rootStat.isDirectory()) throw packageError('scan root is not a directory');

  const { manifest, loaded } = readManifest(absoluteRoot);
  const state = new ScanState();
  state.seedFile('package.json', loaded);
  for (const file of ROOT_FILES) collectRootFile(absoluteRoot, file, state);
  for (const directory of SOURCE_ROOTS) {
    if (state.fileLimitReached) { state.skip(directory, 'file-limit-unvisited', true); continue; }
    const path = join(absoluteRoot, directory);
    try { lstatSync(path); }
    catch { state.skip(directory, 'missing', true); continue; }
    walkDirectory(absoluteRoot, path, directory, 0, state);
  }
  return makeReport(manifest, state);
}

function runCli(): void {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    process.stdout.write('Usage: node --experimental-strip-types tools/assess-host-compatibility.ts\n');
    return;
  }
  if (args.length !== 0) {
    process.stderr.write('Error: unsupported argument; this command is read-only and accepts no options.\n');
    process.exitCode = 2;
    return;
  }
  try {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    process.stdout.write(`${JSON.stringify(assessHostCompatibility(root), null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown error';
    process.stderr.write(`Error: host assessment failed: ${message}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) runCli();
