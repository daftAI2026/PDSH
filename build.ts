/**
 * [INPUT]: 依赖 esbuild、三个 Host 入口、同一 Client 装配器与根 manifest 唯一版本；共享库由宿主解析。
 * [OUTPUT]: 生成根兼容入口与 components/ 三个功能子包、各自 manifest/locale/图标和拍照 Main 桥。
 * [POS]: 唯一构建和 Bundle 分发边界；根兼容 factory 保留品牌 ID，三子包各有功能 ID，身份配置地址保持 pdsh。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { BUNDLE_NAME, COMPONENTS, type ComponentKind } from './src/shared/components.ts';
const manifest = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8'));
const { version } = manifest;
const { artwork } = JSON.parse(await readFile(new URL('./style-sources.json', import.meta.url), 'utf8'));
const glyph = (await readFile(new URL('./src/client/entry-icon.svg', import.meta.url), 'utf8')).replace(/<!--[\s\S]*?-->\s*/, '');
// +--- 独立 img 不能继承宿主变量：仅固化包标识前景，不添加背景 ---+
const icon = `<!--\n[INPUT]: 依赖 src/client/entry-icon.svg 和 style-sources.json，由 build.ts 生成。\n[OUTPUT]: 提供透明底帽子眼镜图稿。\n[POS]: Bundle 及组件标识，不手工修改。\n[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md\n-->\n${glyph.replace('stroke="currentColor"', `stroke="${artwork.foreground.value}"`)}`;
await writeFile('plugin-icon.svg', icon);
const titles = { identity: { zh: '侧栏身份', en: 'Sidebar Identity' }, titles: { zh: '侧栏标题遮挡', en: 'Sidebar Title Masking' }, capture: { zh: '窗口拍照', en: 'Window Capture' } };
const descriptions = { identity: { zh: '自定义侧栏头像与昵称。', en: 'Customize the sidebar avatar and nickname.' }, titles: { zh: '遮挡侧栏标题；独立启停，不影响拍照临时遮挡。', en: 'Mask sidebar titles independently of capture-time redaction.' }, capture: { zh: '截取当前 DSH 页面并在本地编辑。', en: 'Capture the current DSH page and edit it locally.' } };
await mkdir('components', { recursive: true });
await writeFile('components/CLAUDE.md', `# components/\n> L2 | 父级: ../CLAUDE.md\n\n- identity/: 包内身份入口；头像与昵称独立功能命名，配置地址保持 pdsh，根入口仅为兼容而不形成第四个 patch 行。\n- titles/: 包内标题入口；构建派生 manifest/Host/Client/locale，同仓库固定 SHA 的普通传递依赖由官方 hoisted profile 同时发现 Host/Client/元信息，不作为用户管理的 Bundle 独立安装/发布。\n- capture/: 包内拍照入口；桥属于其内部生命周期，不要求身份和标题开启。\n\n[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md\n`);
const kinds = Object.keys(COMPONENTS) as ComponentKind[];
for (const { kind, directory, module } of [
  { kind: 'identity' as ComponentKind, directory: '.', module: BUNDLE_NAME },
  ...kinds.map(kind => ({ kind, directory: `components/${kind}`, module: COMPONENTS[kind].module })),
]) {
  const source = kind === 'identity' ? 'index' : kind;
  if (directory !== '.') {
    await mkdir(`${directory}/locale`, { recursive: true });
    const child = { name: module, version, private: true, type: 'module', main: './index.js',
      files: ['index.js', 'client.js', 'client.js.map', 'plugin-icon.svg', 'locale/*.json', ...(kind === 'capture' ? ['main.cjs'] : [])],
      exports: { '.': './index.js', './client': './client.js', './package.json': './package.json', './locale/*.json': './locale/*.json' },
      dsh: { client: manifest.dsh.client }, license: manifest.license, icon: './plugin-icon.svg' };
    await writeFile(`${directory}/package.json`, `${JSON.stringify(child, null, 2)}\n`);
    await writeFile(`${directory}/plugin-icon.svg`, icon);
    for (const language of ['zh', 'en']) await writeFile(`${directory}/locale/${language}.json`, `${JSON.stringify({ meta: { title: titles[kind][language], description: descriptions[kind][language] } }, null, 2)}\n`);
    await writeFile(`${directory}/CLAUDE.md`, `# components/${kind}/\n> L2 | 父级: ../CLAUDE.md\n\n- package.json: Host 文件的就近 Client/离线元信息归属；版本仅由根 manifest 派生。\n- index.js: src/host/${source}.ts 的生成 Host 配置与生命周期。\n- client.js: 同一装配器编译为 ${kind} 功能；独立启停，按页面共享资源。\n- client.js.map: 生成产物到 TypeScript 的调试映射。\n${kind === 'capture' ? '- main.cjs: 内部 Main 原生取像桥，拍照组件启用后的首次点击加载，资源由组件生命周期归还。\n' : ''}- plugin-icon.svg: Bundle 图稿的派生标识。\n- locale/: 包内翻译文件；真实组件包公开 locale 子路径供官方行 metadata 离线读取，独立于组件启停。\n\n[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md\n`);
    await writeFile(`${directory}/locale/CLAUDE.md`, `# components/${kind}/locale/\n> L2 | 父级: ../CLAUDE.md\n\n- zh.json: 中文组件元信息，由 build.ts 生成。\n- en.json: 英文组件元信息，由 build.ts 生成。\n\n[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md\n`);
  }
  if (kind === 'capture') await build({ entryPoints: ['src/host/page-capture-main.ts'], outfile: `${directory}/main.cjs`, bundle: true,
    format: 'cjs', platform: 'node', target: 'es2022',
    banner: { js: '/** [INPUT]: src/host/page-capture-main.ts，由 build.ts 生成。\n * [OUTPUT]: Main startMainBridge；像素只交付原页面。\n * [POS]: 拍照包内部非视觉桥，不手工修改。\n * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md\n */' } });
  const protocol = '[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md';
  await build({ entryPoints: [`src/host/${source}.ts`], outfile: `${directory}/index.js`, bundle: true, format: 'esm', platform: 'node',
    target: 'es2022', external: ['@deepseek-ai/schemastery', 'blobatar/uri'],
    banner: { js: `/**\n * [INPUT]: 依赖 src/host/${source}.ts，由 build.ts 生成。\n * [OUTPUT]: 提供 ${module} 的 Config/name/apply。\n * [POS]: ${kind} Host 入口，不手工修改。\n * ${protocol}\n */` } });
  await build({ entryPoints: ['src/client/client-entry.tsx'], outfile: `${directory}/client.js`, bundle: true, format: 'cjs', platform: 'browser',
    target: 'es2022', sourcemap: true, minify: true, loader: { '.css': 'text', '.svg': 'text', '.jpg': 'dataurl' },
    define: { __PDSH_VERSION__: JSON.stringify(version), __PDSH_COMPONENT__: JSON.stringify(kind) },
    external: ['react', 'react/jsx-runtime', 'react-dom/client', '@deepseek-ai/dsh-client-ui-primitives'],
    banner: { js: `/**\n * [INPUT]: 依赖 src/client/client-entry.tsx 与宿主 module table，由 build.ts 生成。\n * [OUTPUT]: 提供 ${module} 的 lazy factory。\n * [POS]: ${kind} 独立 Client 入口，不手工修改。\n * ${protocol}\n */\nwindow.__ModuleLoader__.load({id:${JSON.stringify(module)},factory:(require)=>{var module={exports:{}};var exports=module.exports;` },
    footer: { js: 'return module.exports;}});' } });
}
