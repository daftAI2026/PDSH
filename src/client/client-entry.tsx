/**
 * [INPUT]: 依赖 component-runtime 的单一 Bundle 装配；identity/title/capture 是内部独立设置，不是运行时入口。
 * [OUTPUT]: 提供唯一 PDSH Client 的正式 Cordis inject 与 apply 入口。
 * [POS]: 根 Bundle 的薄入口；必需 UI/配置服务只声明一次，缺少可选拍照桥不阻塞其它能力。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { mountComponent } from './component-runtime.tsx';

export const inject = ['slots', 'locale', 'configForms', 'remote', 'remote.pluginManager'];
export function apply(ctx) { mountComponent(ctx); }
