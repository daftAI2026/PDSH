/**
 * [INPUT]: 依赖 esbuild 和 package.json 包名；共享库由 Harness module table 解析。
 * [OUTPUT]: 生成官方 lazy-CJS factory 格式的 client.js 与源码映射。
 * [POS]: PDSH 浏览器构建边界；不内嵌第二套 React 或官方 feature plugin。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
const { name } = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
await build({
  entryPoints: ['client-entry.jsx'], outfile: 'client.js', bundle: true, format: 'cjs', platform: 'browser',
  target: 'es2022', sourcemap: true, loader: { '.css': 'text' },
  external: ['react', 'react/jsx-runtime', 'react-dom/client', '@deepseek-ai/dsh-client-ui-primitives'],
  banner: { js: `/**\n * [INPUT]: 依赖 client-entry.jsx 及宿主共享 module table；由 build.mjs 生成。\n * [OUTPUT]: 提供 @daftai/pdsh 的浏览器 lazy factory，不手工修改此产物。\n * [POS]: PDSH 安装入口；提交预构建产物，使 Git/目录安装不需要运行构建脚本。\n * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md\n */\nwindow.__ModuleLoader__.load({id:${JSON.stringify(name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;` },
  footer: { js: 'return module.exports;}});' },
});
