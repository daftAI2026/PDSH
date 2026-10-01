/**
 * [INPUT]: 一 Bundle 三个官方组件的配置/安装合同，无运行时服务依赖。
 * [OUTPUT]: 提供 COMPONENTS、ComponentKind 与唯一 Bundle 名。
 * [POS]: Host/Client/构建共用的组件身份；三个子包具有独立元信息，身份仅保留旧 pdsh 配置地址，Bundle 名不充当功能名称。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export const BUNDLE_NAME = '@daftai/pdsh';
export const COMPONENTS = {
  identity: { id: 'pdsh', module: '@daftai/pdsh-identity', locale: 'pdsh.identity' },
  titles: { id: 'pdsh-titles', module: '@daftai/pdsh-titles', locale: 'pdsh.titles' },
  capture: { id: 'pdsh-capture', module: '@daftai/pdsh-capture', locale: 'pdsh.capture' },
} as const;
export type ComponentKind = keyof typeof COMPONENTS;
