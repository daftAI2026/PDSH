/**
 * [INPUT]: 一 Bundle 三个官方组件的配置/安装合同，无运行时服务依赖。
 * [OUTPUT]: 提供 COMPONENTS、ComponentKind 与唯一 Bundle 名。
 * [POS]: Host/Client/构建共用的组件身份；包标识不等于 Loader 路径；身份保留旧 pdsh 裸名，子入口由 Bundle 真实 bundled dependencies 和官方传递依赖解析。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export const BUNDLE_NAME = '@daftai/pdsh';
export const COMPONENTS = {
  identity: { id: 'pdsh', module: BUNDLE_NAME, locale: 'pdsh.identity' },
  titles: { id: 'pdsh-titles', module: '@daftai/pdsh-titles', locale: 'pdsh.titles' },
  capture: { id: 'pdsh-capture', module: '@daftai/pdsh-capture', locale: 'pdsh.capture' },
} as const;
export type ComponentKind = keyof typeof COMPONENTS;
