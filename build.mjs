/**
 * [INPUT]: 依赖 esbuild、包名、entry-icon.svg 与来源账中的自包含图稿色板；共享库由宿主解析。
 * [OUTPUT]: 生成 lazy-CJS client.js/映射，以及官方插件元信息使用的 plugin-icon.svg。
 * [POS]: PDSH 浏览器构建边界；不内嵌第二套 React 或官方 feature plugin。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
const { name } = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
const { artwork } = JSON.parse(await readFile(new URL('./style-sources.json', import.meta.url), 'utf8'));
const glyph = (await readFile(new URL('./entry-icon.svg', import.meta.url), 'utf8')).replace(/<!--[\s\S]*?-->\s*/, '');
// 独立img不能读取宿主变量：只给包标识加固定明底，不冻结侧栏入口颜色。
const icon = glyph.replace('stroke="currentColor"', `stroke="${artwork.foreground.value}"`).replace(/(<svg[^>]*>)/, `$1\n  <rect width="100%" height="100%" fill="${artwork.background.value}" stroke="none"/>`);
await writeFile(new URL('./plugin-icon.svg', import.meta.url), `<!--\n[INPUT]: 依赖 entry-icon.svg 图形和 style-sources.json 图稿色板，由 build.mjs 生成。\n[OUTPUT]: 提供 package.json.icon 的自包含帽子眼镜图稿。\n[POS]: PDSH 官方包标识资产，不手工修改。\n[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md\n-->\n${icon}`);
await build({
  entryPoints: ['client-entry.jsx'], outfile: 'client.js', bundle: true, format: 'cjs', platform: 'browser',
  target: 'es2022', sourcemap: true, minify: true, loader: { '.css': 'text', '.svg': 'text' },
  external: ['react', 'react/jsx-runtime', 'react-dom/client', '@deepseek-ai/dsh-client-ui-primitives'],
  banner: { js: `/**\n * [INPUT]: 依赖 client-entry.jsx 及宿主共享 module table；由 build.mjs 生成。\n * [OUTPUT]: 提供 @daftai/pdsh 的浏览器 lazy factory，不手工修改此产物。\n * [POS]: PDSH 安装入口；提交预构建产物，使 Git/目录安装不需要运行构建脚本。\n * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md\n */\nwindow.__ModuleLoader__.load({id:${JSON.stringify(name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;` },
  footer: { js: 'return module.exports;}});' },
});
