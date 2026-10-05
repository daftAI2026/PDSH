/**
 * [INPUT]: 依赖 tools/assess-host-compatibility 的本地静态扫描 API 与隔离临时目录。
 * [OUTPUT]: 验证只读清单、七类触点、真实宿主 imports、边界缺口及 CLI/导入无副作用。
 * [POS]: 宿主依赖盘点器的黑盒合同；只读合成 fixture，不访问 DSH、远端或用户 profile。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assessHostCompatibility } from '../tools/assess-host-compatibility.ts';

const TOOL = fileURLToPath(new URL('../tools/assess-host-compatibility.ts', import.meta.url));

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'pdsh-host-assessment-'));
  mkdirSync(join(root, 'src'), { recursive: true });
  mkdirSync(join(root, 'native'), { recursive: true });
  writeFileSync(join(root, 'package.json'), JSON.stringify({
    name: '@daftai/pdsh', version: '9.8.7',
    dependencies: { '@deepseek-ai/runtime': '^1.2.3', ordinary: '1.0.0' },
    devDependencies: { '@deepseek-ai/build-tool': '2.0.0' },
    peerDependencies: { '@deepseek-ai/cordis': '~4.0.4' },
  }));
  writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9.0\n');
  writeFileSync(join(root, 'cordis.patch.yml'), 'patches: []\n');
  writeFileSync(join(root, 'build.ts'), 'export const build = true;\n');
  return {
    root,
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
}

function walkBytes(root: string, dir = root): Array<[string, string]> {
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) return [[relative(root, path), 'symlink']];
    if (entry.isDirectory()) return walkBytes(root, path);
    return [[relative(root, path), readFileSync(path).toString('base64')]];
  });
}

function byRule(report: any, ruleId: string) {
  return report.rules.find((rule: any) => rule.ruleId === ruleId);
}

test('metadata、七类宿主触点与真实 @deepseek-ai imports 均只返回相对位置', () => {
  const f = fixture();
  try {
    const source = `
import type { Cordis } from '@deepseek-ai/cordis';
export { Schema } from '@deepseek-ai/schemastery';
const lazy = import('@deepseek-ai/dsh-typert-protocol');
// import { Fake } from '@deepseek-ai/comment-only';
const text = "import('@deepseek-ai/string-only')";
const patch = 'sourcePatch';
ctx.on('dispose', cleanup);
ctx.provide('sample', service);
await writeFileSync(filePath, bytes);
ctx.inject('client', extension);
document.querySelector('[data-host-root]');
spawn('native-helper', args, { stdio: 'pipe' });
// SECRET_SOURCE_SENTINEL
`;
    writeFileSync(join(f.root, 'src/touchpoints.ts'), source);
    writeFileSync(join(f.root, 'src/style.css'), '.host-root { color: var(--dsw-text); }\n');
    const report = assessHostCompatibility(f.root) as any;

    assert.equal(report.readOnly, true);
    assert.equal(report.compatibility, 'unverified');
    assert.equal(report.scope, 'heuristic');
    assert.deepEqual(report.package, { name: '@daftai/pdsh', version: '9.8.7' });
    assert.deepEqual(report.dependencies, {
      runtime: [{ name: '@deepseek-ai/runtime', version: '^1.2.3' }],
      dev: [{ name: '@deepseek-ai/build-tool', version: '2.0.0' }],
      peer: [{ name: '@deepseek-ai/cordis', version: '~4.0.4' }],
    });
    for (const ruleId of [
      'PDSH-HOST-SOURCE-PATCH', 'PDSH-HOST-EVENT-CONFIG', 'PDSH-HOST-SERVICE-REMOTE',
      'PDSH-HOST-FILES', 'PDSH-HOST-UI-REGISTRATION', 'PDSH-HOST-DOM-CSS', 'PDSH-HOST-SUBPROCESS',
    ]) assert.ok(byRule(report, ruleId)?.total > 0, `missing ${ruleId}`);
    assert.deepEqual(report.imports.items.map((item: any) => [item.specifier, item.file, item.line]), [
      ['@deepseek-ai/cordis', 'src/touchpoints.ts', 2],
      ['@deepseek-ai/schemastery', 'src/touchpoints.ts', 3],
      ['@deepseek-ai/dsh-typert-protocol', 'src/touchpoints.ts', 4],
    ]);
    assert.ok(report.scan.files.some((file: any) => file.file === 'package.json'));
    assert.ok(report.scan.files.some((file: any) => file.file === 'native' || file.file === 'src/style.css'));
    const serialized = JSON.stringify(report);
    assert.equal(serialized.includes(f.root), false);
    assert.equal(serialized.includes('SECRET_SOURCE_SENTINEL'), false);
    assert.equal(serialized.includes('sourcePatch'), false);
    assert.match(report.caveats.join('\n'), /静态命中.*运行时可达性/);
    assert.match(report.caveats.join('\n'), /零命中.*兼容/);
    assert.match(report.caveats.join('\n'), /未提供.*from\/to/);
  } finally { f.dispose(); }
});

test('零命中保持 heuristic/unverified，明确运行行为和目标兼容性未知', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.root, 'cordis.patch.yml'), 'enabled: true\n');
    writeFileSync(join(f.root, 'src/quiet.ts'), 'export const value = 1;\n');
    const report = assessHostCompatibility(f.root) as any;
    assert.equal(report.totalHits, 0);
    assert.equal(report.compatibility, 'unverified');
    assert.equal(report.scope, 'heuristic');
    assert.equal(report.scan.complete, true);
    assert.match(report.caveats.join('\n'), /Host\/Client.*未知/);
  } finally { f.dispose(); }
});

test('七类规则保留总命中数，并将每类位置截断在二十条', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.root, 'cordis.patch.yml'), 'enabled: true\n');
    writeFileSync(join(f.root, 'src/repeated.ts'), `${Array.from({ length: 24 }, () => 'sourcePatch();').join('\n')}\n`);
    const report = assessHostCompatibility(f.root) as any;
    const rule = byRule(report, 'PDSH-HOST-SOURCE-PATCH');
    assert.equal(rule.total, 24);
    assert.equal(rule.shown, 20);
    assert.equal(rule.truncated, 4);
    assert.equal(report.truncatedCount, 4);
    assert.equal(report.totalHits, 24);
  } finally { f.dispose(); }
});

test('异步文件/进程调用与 patch 配置不因 Sync 后缀误漏', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.root, 'cordis.patch.yml'), 'patch: ./index.js\n');
    writeFileSync(join(f.root, 'src/async.ts'), 'spawn("helper");\nexecFile("helper");\nreadFile(file);\nwriteFile(file, data);\n');
    const report = assessHostCompatibility(f.root) as any;
    assert.equal(byRule(report, 'PDSH-HOST-SUBPROCESS').total, 2);
    assert.equal(byRule(report, 'PDSH-HOST-FILES').total, 2);
    assert.equal(byRule(report, 'PDSH-HOST-SOURCE-PATCH').total, 1);
  } finally { f.dispose(); }
});

test('symlink、超大文件、读取缺口与扫描上限均可见且不跟随', () => {
  const f = fixture();
  const outside = mkdtempSync(join(tmpdir(), 'pdsh-assessment-outside-'));
  try {
    writeFileSync(join(outside, 'secret.ts'), 'spawn("outside-secret");\n');
    symlinkSync(join(outside, 'secret.ts'), join(f.root, 'src/linked.ts'));
    symlinkSync(outside, join(f.root, 'src/linked-dir'));
    writeFileSync(join(f.root, 'src/large.ts'), 'x'.repeat(1024 * 1024 + 1));
    const report = assessHostCompatibility(f.root) as any;
    assert.ok(report.scan.skipped.some((item: any) => item.file === 'src/linked.ts' && item.reason === 'symlink'));
    assert.ok(report.scan.skipped.some((item: any) => item.file === 'src/linked-dir' && item.reason === 'symlink'));
    assert.ok(report.scan.skipped.some((item: any) => item.file === 'src/large.ts' && item.reason === 'too-large'));
    assert.equal(JSON.stringify(report).includes('outside-secret'), false);
    assert.equal(report.scan.complete, false);
  } finally {
    f.dispose();
    rmSync(outside, { recursive: true, force: true });
  }
});

test('拒绝错 package 身份；不读取敏感目录且全树字节保持不变', () => {
  const f = fixture();
  try {
    for (const name of ['@daftai/pdsh-rc', '@someone/other']) {
      writeFileSync(join(f.root, 'package.json'), JSON.stringify({ name, version: '0.4.0' }));
      assert.throws(() => assessHostCompatibility(f.root), /package identity/i);
    }
    writeFileSync(join(f.root, 'package.json'), JSON.stringify({ name: '@daftai/pdsh', version: '0.4.0' }));
    for (const excluded of ['tests', 'docs', 'output', 'node_modules', 'profile']) {
      mkdirSync(join(f.root, excluded), { recursive: true });
      writeFileSync(join(f.root, excluded, 'private.ts'), 'const privateValue = "do-not-read";');
    }
    writeFileSync(join(f.root, '.env'), 'SECRET=do-not-read');
    writeFileSync(join(f.root, '.npmrc'), '//registry.example/:_authToken=do-not-read');
    const before = walkBytes(f.root);
    const report = assessHostCompatibility(f.root) as any;
    const after = walkBytes(f.root);
    assert.deepEqual(after, before);
    const json = JSON.stringify(report);
    assert.equal(json.includes('do-not-read'), false);
    for (const excluded of ['tests/', 'docs/', 'output/', 'node_modules/', 'profile/', '.env', '.npmrc']) {
      assert.equal(report.scan.files.some((file: any) => file.file.startsWith(excluded)), false);
    }
  } finally { f.dispose(); }
});

test('根 package manifest symlink 与非法 CLI 参数拒绝；静态导入不执行 CLI', () => {
  const f = fixture();
  const outsideManifest = join(f.root, 'outside.json');
  try {
    writeFileSync(outsideManifest, JSON.stringify({ name: '@daftai/pdsh', version: '0.4.0' }));
    const linkedRoot = join(f.root, 'linked-root');
    mkdirSync(linkedRoot);
    symlinkSync(outsideManifest, join(linkedRoot, 'package.json'));
    assert.throws(() => assessHostCompatibility(linkedRoot), /package\.json.*symlink/i);

    const invalid = spawnSync(process.execPath, ['--experimental-strip-types', TOOL, '--write'], { encoding: 'utf8' });
    assert.equal(invalid.status, 2);
    assert.equal(invalid.stdout, '');
    assert.match(invalid.stderr, /unsupported argument/i);
    assert.equal(invalid.stderr.includes(f.root), false);

    const imported = execFileSync(process.execPath, [
      '--experimental-strip-types', '--input-type=module', '-e',
      `await import(${JSON.stringify(pathToFileURL(TOOL).href)})`,
    ], { encoding: 'utf8' });
    assert.equal(imported, '');
  } finally { f.dispose(); }
});

test('窗口几何与 Mac Objective-C++ 取像实现纳入触点，历史提示不判定运行可达性', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.root, 'src/candidate-mapping.ts'), 'const allowed = /Electron\\/44/.test(ua);\nconst scale = view.devicePixelRatio;\n');
    writeFileSync(join(f.root, 'native/window-capture.mm'), 'const window = CGWindowListCopyWindowInfo(options, windowId);\n');
    writeFileSync(join(f.root, 'src/page-capture-main.ts'), 'export const usefulPureHelper = true;\n');
    writeFileSync(join(f.root, 'src/old.ts'), '/** [POS]: 退役实验，不是运行时 fallback。 */\nexport const value = 1;\n');
    const report = assessHostCompatibility(f.root) as any;
    const positions = byRule(report, 'PDSH-HOST-SUBPROCESS').positions;
    assert.ok(positions.some((p: any) => p.file === 'src/candidate-mapping.ts'));
    assert.ok(positions.some((p: any) => p.file === 'native/window-capture.mm'));
    assert.ok(report.reviewHints.some((p: any) => p.file === 'src/page-capture-main.ts' && p.reason === 'main-inspector-path'));
    assert.ok(report.reviewHints.some((p: any) => p.file === 'src/old.ts' && p.reason === 'historical-header'));
    assert.ok(report.reviewHints.every((p: any) => p.runtimeReachability === 'unverified'));
  } finally { f.dispose(); }
});

test('白名单根内隐藏文件和 profile/凭据子目录也不读取', () => {
  const f = fixture();
  try {
    for (const name of ['.dsh', '.config', '.credentials', 'credentials.local']) {
      mkdirSync(join(f.root, 'src', name));
      writeFileSync(join(f.root, 'src', name, 'private.ts'), 'sourcePatch();\n');
    }
    writeFileSync(join(f.root, 'src/.npmrc.local.ts'), 'sourcePatch();\n');
    writeFileSync(join(f.root, 'cordis.patch.yml'), 'enabled: true\n');
    const report = assessHostCompatibility(f.root) as any;
    assert.equal(report.totalHits, 0);
    assert.equal(report.scan.files.some((p: any) => p.file.startsWith('src/')), false);
    assert.equal(report.scan.skipped.length, 5);
  } finally { f.dispose(); }
});

test('文件预算耗尽后祖先和其它源码根停止，并保留未扫描区域', () => {
  const f = fixture();
  try {
    mkdirSync(join(f.root, 'src/a'));
    mkdirSync(join(f.root, 'src/z'));
    for (let i = 0; i < 4094; ++i) writeFileSync(join(f.root, `src/a/${String(i).padStart(4, '0')}.ts`), '');
    writeFileSync(join(f.root, 'src/z/late.ts'), 'sourcePatch();\n');
    writeFileSync(join(f.root, 'native/late.cpp'), 'CreateProcess();\n');
    const report = assessHostCompatibility(f.root) as any;
    assert.equal(report.scan.files.length, report.scan.limits.files);
    assert.equal(report.scan.complete, false);
    assert.equal(report.scan.files.some((p: any) => p.file === 'src/z/late.ts' || p.file === 'native/late.cpp'), false);
    assert.ok(report.scan.skipped.some((p: any) => p.file === 'src' && p.reason === 'file-limit-unvisited'));
    assert.ok(report.scan.skipped.some((p: any) => p.file === 'native' && p.reason === 'file-limit-unvisited'));
  } finally { f.dispose(); }
});

test('imports 截断保留总量；目录、单目录条目和深度预算显式留下缺口', () => {
  const fixtures = [fixture(), fixture(), fixture(), fixture()];
  try {
    const [imports, directories, entries, depth] = fixtures;
    writeFileSync(join(imports.root, 'src/imports.ts'), Array.from({ length: 205 }, (_, i) =>
      `import { value${i} } from '@deepseek-ai/test';`).join('\n'));
    const imported = assessHostCompatibility(imports.root);
    assert.equal(imported.imports.total, 205);
    assert.equal(imported.imports.shown, 200);
    assert.equal(imported.imports.truncated, 5);

    for (let i = 0; i < 513; ++i) mkdirSync(join(directories.root, `src/d${i}`));
    for (let i = 0; i < 4097; ++i) writeFileSync(join(entries.root, `src/a${i}.txt`), '');
    let path = join(depth.root, 'src');
    for (let i = 0; i < 34; ++i) { path = join(path, 'child'); mkdirSync(path); }
    for (const [f, reason] of [[directories, 'directory-limit'], [entries, 'entry-limit'], [depth, 'depth-limit']] as const) {
      const report = assessHostCompatibility(f.root);
      assert.equal(report.scan.complete, false);
      assert.ok(report.scan.skipped.some(p => p.reason === reason), reason);
    }
  } finally { for (const f of fixtures) f.dispose(); }
});
