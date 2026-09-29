/**
 * [INPUT]: 依赖 build.ts 的 JPEG dataurl loader。
 * [OUTPUT]: 为离线背景图片导入提供 TypeScript 字符串契约。
 * [POS]: capture 静态资产类型边界，避免编辑器感知构建器。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
declare module '*.jpg' {
  const url: string;
  export default url;
}
