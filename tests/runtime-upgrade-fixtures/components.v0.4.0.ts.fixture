/**
 * [INPUT]: 依赖 build.ts 从当前 staging manifest 注入的安装包标识；源码合同默认正式身份。
 * [OUTPUT]: 提供 BUNDLE_NAME、ROOT_ENTRY_ID、IS_RC_BUNDLE，统一安装、配置和临时 RC 更新边界。
 * [POS]: 共享安装身份；正式包始终单入口，临时 RC 使用独立命名空间，不复制业务实现。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
declare const __PDSH_BUNDLE_NAME__: string;
export const BUNDLE_NAME = typeof __PDSH_BUNDLE_NAME__ === 'string' ? __PDSH_BUNDLE_NAME__ : '@daftai/pdsh';
export const IS_RC_BUNDLE = BUNDLE_NAME === '@daftai/pdsh-rc';
export const ROOT_ENTRY_ID = IS_RC_BUNDLE ? 'pdsh-rc' : 'pdsh';
