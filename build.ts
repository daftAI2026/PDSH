/**
 * [INPUT]: 依赖 esbuild、单一 Host/Client 装配器、包内 Main 模块与根 manifest 唯一版本。
 * [OUTPUT]: 生成 index.js、client.js/map、main.cjs 和包图，不生成独立功能依赖包。
 * [POS]: GitHub 单 Bundle 的唯一构建边界；身份/标题/拍照只在源码内部按职责拆分。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const { version } = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
const { artwork } = JSON.parse(await readFile(new URL('./style-sources.json', import.meta.url), 'utf8'));
const glyph = (await readFile(new URL('./src/client/entry-icon.svg', import.meta.url), 'utf8')).replace(/<!--[\s\S]*?-->\s*/, '');
// +--- 官方 img 不继承宿主变量：只固化标识前景，不添加背景 ---+
await writeFile(join(root, 'plugin-icon.svg'), `<!--\n[INPUT]: src/client/entry-icon.svg 与 style-sources.json，由 build.ts 生成。\n[OUTPUT]: 透明底帽子图稿。\n[POS]: 单 Bundle 标识，不手工修改。\n[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md\n-->\n${glyph.replace('stroke="currentColor"', `stroke="${artwork.foreground.value}"`)}`);
const banner = (source: string, output: string) => `/**\n * [INPUT]: ${source}，由 build.ts 生成。\n * [OUTPUT]: ${output}。\n * [POS]: 单包运行产物；PDSH build ${JSON.stringify(version)}，不手工修改。\n * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md\n */`;
await build({ absWorkingDir: root, entryPoints: ['src/host/index.ts'], outfile: 'index.js', bundle: true, format: 'esm', platform: 'node', target: 'es2022',
  external: ['@deepseek-ai/schemastery', 'blobatar/uri'], banner: { js: banner('src/host/index.ts', 'pdsh Config/name/apply') } });
await build({ absWorkingDir: root, entryPoints: ['src/host/page-capture-main.ts'], outfile: 'main.cjs', bundle: true, format: 'cjs', platform: 'node', target: 'es2022',
  banner: { js: banner('src/host/page-capture-main.ts', 'Main startMainBridge；像素只交付原页面') } });
await build({ absWorkingDir: root, entryPoints: ['src/client/client-entry.tsx'], outfile: 'client.js', bundle: true, format: 'cjs', platform: 'browser', target: 'es2022', sourcemap: true, minify: true,
  loader: { '.css': 'text', '.svg': 'text', '.jpg': 'dataurl' }, define: { __PDSH_VERSION__: JSON.stringify(version) },
  external: ['react', 'react/jsx-runtime', 'react-dom/client', '@deepseek-ai/dsh-client-ui-primitives'],
  banner: { js: `${banner('src/client/client-entry.tsx 与宿主 module table', '唯一 @daftai/pdsh lazy factory')}\nwindow.__ModuleLoader__.load({id:"@daftai/pdsh",factory:(require)=>{var module={exports:{}};var exports=module.exports;` },
  footer: { js: 'return module.exports;}});' } });
