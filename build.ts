/**
 * [INPUT]: 依赖 esbuild、src/ 的 TypeScript 入口与来源账色板；共享库由宿主解析。
 * [OUTPUT]: 生成 Host index.js、lazy-CJS client.js/映射及 plugin-icon.svg。
 * [POS]: PDSH 唯一构建边界；源码保持 TypeScript，安装包保留宿主所需 JavaScript。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
const { name, version } = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8')) as { name: string; version: string };
const { artwork } = JSON.parse(await readFile(new URL('./style-sources.json', import.meta.url), 'utf8')) as { artwork: { foreground: { value: string }; background: { value: string } } };
const glyph = (await readFile(new URL('./src/client/entry-icon.svg', import.meta.url), 'utf8')).replace(/<!--[\s\S]*?-->\s*/, '');
// 独立img不能读取宿主变量：只给包标识加固定明底，不冻结侧栏入口颜色。
const icon = glyph.replace('stroke="currentColor"', `stroke="${artwork.foreground.value}"`).replace(/(<svg[^>]*>)/, `$1\n  <rect width="100%" height="100%" fill="${artwork.background.value}" stroke="none"/>`);
await writeFile(new URL('./plugin-icon.svg', import.meta.url), `<!--\n[INPUT]: 依赖 src/client/entry-icon.svg 图形和 style-sources.json 图稿色板，由 build.ts 生成。\n[OUTPUT]: 提供 package.json.icon 的自包含帽子眼镜图稿。\n[POS]: PDSH 官方包标识资产，不手工修改。\n[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md\n-->\n${icon}`);
await build({
  entryPoints: ['src/host/index.ts'], outfile: 'index.js', bundle: true, format: 'esm', platform: 'node',
  target: 'es2022', external: ['@deepseek-ai/schemastery', 'blobatar/uri'],
  banner: { js: `/**\n * [INPUT]: 依赖 src/host/index.ts，由 build.ts 生成。\n * [OUTPUT]: 提供 Cordis Host 的 Config/name/apply。\n * [POS]: PDSH 安装入口；TypeScript 源码是唯一手写实现。\n * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md\n */` },
});
await build({
  entryPoints: ['src/client/client-entry.tsx'], outfile: 'client.js', bundle: true, format: 'cjs', platform: 'browser',
  target: 'es2022', sourcemap: true, minify: true, loader: { '.css': 'text', '.svg': 'text', '.jpg': 'dataurl' },
  define: { __PDSH_VERSION__: JSON.stringify(version) },
  external: ['react', 'react/jsx-runtime', 'react-dom/client', '@deepseek-ai/dsh-client-ui-primitives'],
  banner: { js: `/**\n * [INPUT]: 依赖 src/client/client-entry.tsx 及宿主共享 module table；由 build.ts 生成。\n * [OUTPUT]: 提供 @daftai/pdsh 的浏览器 lazy factory，不手工修改此产物。\n * [POS]: PDSH 安装入口；提交预构建产物，使 Git/目录安装不需要运行构建脚本。\n * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md\n */\nwindow.__ModuleLoader__.load({id:${JSON.stringify(name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;` },
  footer: { js: 'return module.exports;}});' },
});
