/**
 * [INPUT]: 依赖官方基础/内部能力 Remote 面与单一 Bundle 装配。
 * [OUTPUT]: 提供唯一 PDSH Client 的正式 Cordis inject 与 apply 入口。
 * [POS]: 根 Bundle 的薄入口；必需 UI/配置服务只声明一次，缺少可选拍照桥不阻塞其它能力。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { TYPERT_REMOTE } from '../../lib/typert.remote-client.js';
import { TYPERT_REMOTE as RUNTIME_CAPABILITIES_REMOTE } from '../../lib/runtime-capabilities/typert.remote-client.js';
import { mountComponent } from './component-runtime.tsx';

export const inject = ['slots', 'locale', 'configForms', 'remote', 'remote.pluginManager'];
export function apply(ctx) {
  // +--- 描述挂载只注册能力；不会请求权限、取像或保存 ---+
  ctx.effect(async () => {
    const disposers = [];
    try {
      disposers.push(await ctx.remote.$mount(TYPERT_REMOTE));
      try { disposers.push(await ctx.remote.$mount(RUNTIME_CAPABILITIES_REMOTE)); }
      catch { ctx.logger.warn('PDSH runtime capabilities Remote contribution unavailable.'); }
      return async () => { for (const off of disposers.reverse()) await off(); };
    }
    catch { ctx.logger.warn('PDSH capture Remote contribution unavailable.'); }
  }, 'pdsh official capture remote');
  mountComponent(ctx);
}
