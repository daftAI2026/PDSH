/**
 * [INPUT]: 依赖 esbuild、官方 Typert workspace generator、当前 staging manifest 身份、唯一 Host/Client 源与 macOS helper 编译器。
 * [OUTPUT]: 生成唯一 Host/Client bundle、版本 Host 业务闭包、官方 Typert faces、公开 DTO 声明和包内 native helper；不生成 Main route。
 * [POS]: 单 Bundle 的唯一构建边界；身份、截图、保存与壁纸共用 Host service 和 Client entry。新增 Remote ABI 必须正常加载。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { execFileSync } from 'node:child_process';
import { build } from 'esbuild';
import { mkdir, readdir, rm, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { generateTypertArtifacts } from './tools/generate-typert.ts';
const root = fileURLToPath(new URL('.', import.meta.url));
const { name: packageName, version } = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
if (!['@daftai/pdsh', '@daftai/pdsh-rc'].includes(packageName) ||
  (packageName === '@daftai/pdsh-rc' && !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)-rc\.[1-9]\d*$/.test(version))) throw new Error('unsupported build identity');
const identityDefine = { __PDSH_BUNDLE_NAME__: JSON.stringify(packageName) };
const { artwork } = JSON.parse(await readFile(new URL('./style-sources.json', import.meta.url), 'utf8'));
// +--- 先发射同源协议声明/官方反射，再构建 bundle；源码和 runtime map 不分叉。 ---+
await generateTypertArtifacts(root);
execFileSync(join(root, 'node_modules/.bin/tsc'), ['-p', 'tsconfig.remote-types.json'], { cwd: root, stdio: 'inherit' });
if (process.platform !== 'darwin') throw new Error('PDSH native-window bundle must be built with the macOS SDK');
execFileSync('/bin/sh', ['native/build.sh'], { cwd: root, stdio: 'inherit' });
const glyph = (await readFile(new URL('./src/client/entry-icon.svg', import.meta.url), 'utf8')).replace(/<!--[\s\S]*?-->\s*/, '');
// +--- 官方 img 不继承宿主变量：只固化标识前景，不添加背景 ---+
await writeFile(join(root, 'plugin-icon.svg'), `<!--\n[INPUT]: src/client/entry-icon.svg 与 style-sources.json，由 build.ts 生成。\n[OUTPUT]: 透明底帽子图稿。\n[POS]: 单 Bundle 标识，不手工修改。\n[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md\n-->\n${glyph.replace('stroke="currentColor"', `stroke="${artwork.foreground.value}"`)}`);
const banner = (source: string, output: string) => `/**\n * [INPUT]: ${source}，由 build.ts 生成。\n * [OUTPUT]: ${output}。\n * [POS]: 单包运行产物；PDSH build ${JSON.stringify(version)}，不手工修改。\n * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md\n */`;
await build({ absWorkingDir: root, entryPoints: ['src/host/index.ts'], outfile: 'index.js', bundle: true, format: 'esm', define: identityDefine, platform: 'node', target: 'es2022',
  external: ['@deepseek-ai/cordis', '@deepseek-ai/dsh-typert-protocol', '@deepseek-ai/schemastery', 'blobatar/uri'], banner: { js: banner('src/host/index.ts 与官方 Typert service', '唯一 pdsh Config/name/apply 与 owned-window capture/save/wallpaper') } });
// +--- 只保留当前版本闭包；版本文件名让标准 ESM 缓存区分升级前后代码 ---+
const runtimeDirectory = join(root, 'lib/capture-runtime');
await mkdir(runtimeDirectory, { recursive: true });
await writeFile(join(runtimeDirectory, 'CLAUDE.md'), `# lib/capture-runtime/\n> L2 | 父级: ../CLAUDE.md\n\n- \`${version}.js\`: 取像、保存与壁纸业务闭包，由 src/host/capture-runtime.ts 生成。Remote 外壳从 Manager 当前自身包载入。旧操作实际结算后才换载。v2 新增 wallpaper ABI，旧 v1 外壳不能热加载。正常加载 v2 后，同合同实现才可换载。不手工修改，不保留其他版本产物。\n\n[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md\n`);
for (const file of await readdir(runtimeDirectory)) if (/^\d+\.\d+\.\d+(?:-[\w.-]+)?\.js$/.test(file) && file !== `${version}.js`) await rm(join(runtimeDirectory, file));
await build({ absWorkingDir: root, entryPoints: ['src/host/capture-runtime.ts'], outfile: `lib/capture-runtime/${version}.js`, bundle: true, format: 'esm', platform: 'node', target: 'es2022',
  define: { ...identityDefine, __PDSH_VERSION__: JSON.stringify(version) }, external: ['@deepseek-ai/cordis', '@deepseek-ai/dsh-typert-protocol'],
  banner: { js: banner('src/host/capture-runtime.ts 与原生/保存后端', '同协议版本业务实现，不注册第二个 service') } });
await build({ absWorkingDir: root, entryPoints: ['src/client/client-entry.tsx'], outfile: 'client.js', bundle: true, format: 'cjs', platform: 'browser', target: 'es2022', sourcemap: true, minify: true,
  loader: { '.css': 'text', '.svg': 'text', '.jpg': 'dataurl' }, define: { ...identityDefine, __PDSH_VERSION__: JSON.stringify(version) },
  external: ['react', 'react/jsx-runtime', 'react-dom/client', '@deepseek-ai/dsh-client-ui-primitives'],
  banner: { js: `${banner('src/client/client-entry.tsx 与宿主 module table', `${packageName} 唯一 lazy factory`)}\nwindow.__ModuleLoader__.load({id:${JSON.stringify(packageName)},factory:(require)=>{var module={exports:{}};var exports=module.exports;` },
  footer: { js: 'return module.exports;}});' } });
