/**
 * [INPUT]: 依赖 component-runtime 的独立组件生命周期与官方 Host namespace。
 * [OUTPUT]: 提供身份、标题或拍照之一的 Cordis Client 入口，由构建常量选择。
 * [POS]: 一 Bundle 三运行时的薄装配层；共享基础设施不构成功能启停依赖。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { mountComponent } from './component-runtime.tsx';
export { inject } from './component-runtime.tsx';
export function apply(ctx) { mountComponent(ctx); }
