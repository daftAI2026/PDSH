/**
 * [INPUT]: 依赖 Schemastery、Node 文件 URL/realpath 与官方合成配置及 revision 围栏；规范化 symlink 后核对模块所有权。
 * [OUTPUT]: 提供独立标题 Config/apply；新字段未配置时继承旧 pdsh.maskTitles，原配置不删除。
 * [POS]: 标题运行时所有者；旧身份停用也不影响该 namespace，迁移不覆盖用户已设置的新值。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import z from '@deepseek-ai/schemastery';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
function ownsModule(specifier) {
  try {
    const url = new URL(specifier);
    return url.protocol === 'file:' && realpathSync(fileURLToPath(url)) === realpathSync(fileURLToPath(import.meta.url));
  } catch { return false; }
}
export const name = 'pdsh-titles';
export const Config = z.object({ maskTitles: z.boolean().default(false).description('Mask sidebar titles / 遮挡侧栏标题').volatile() });
export async function inheritLegacyTitles(ctx, isDisposed = () => false) {
  await ctx.root.loader.await();
  if (isDisposed()) return;
  const rows = ctx.configEditor.configuration();
  const own = rows.find(row => row.entry.options.id === 'pdsh-titles' && ownsModule(row.entry.options.name));
  const legacy = rows.find(row => row.entry.options.id === 'pdsh' && row.entry.options.name === '@daftai/pdsh');
  if (!own || !legacy || Object.hasOwn(own.entry.options.config ?? {}, 'maskTitles')) return;
  const raw = legacy.entry.options.config?.maskTitles;
  if (typeof raw !== 'boolean') return;
  const descriptor = ctx.settings.describe().find(view => view.ns === 'pdsh-titles');
  if (!descriptor || isDisposed()) return;
  // +--- 一次性转移字段所有权；并发用户写入由宿主 revision 拒绝，保留旧行不擦偏好 ---+
  await ctx.settings.mutate('pdsh-titles', [{ op: 'set', path: ['maskTitles'], value: raw }], descriptor.revision);
}
export function apply(ctx) {
  ctx.inject(['settings', 'configEditor'], child => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
    child.effect(() => {
      let disposed = false;
      void inheritLegacyTitles(child, () => disposed).catch(() => {
        if (!disposed) child.logger.warn('PDSH title preferences were not migrated; existing configuration was left intact.');
      });
      // Loader/HMR 的稳定等待不能反过来阻塞当前 Fiber 卸载。
      return () => { disposed = true; };
    });
  });
}
