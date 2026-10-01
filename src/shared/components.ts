/**
 * [INPUT]: 单一 GitHub Bundle 的稳定包标识，无运行时服务依赖。
 * [OUTPUT]: 提供 BUNDLE_NAME，供唯一 Client 绑定官方设置与更新入口。
 * [POS]: 共享安装身份；身份、标题、拍照的功能边界不再映射为依赖包。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export const BUNDLE_NAME = '@daftai/pdsh';
