/**
 * [INPUT]: 依赖官方 settings 生命周期/revision 和本机 home 的初始 Downloads 目录；Main 模块由当前 Host 的 import.meta.url 就近解析，取像连接由内部桥提供。
 * [OUTPUT]: 提供拍照导出 Config/apply/旧默认修正；保存方式独立于目录，首次点击才启动桥。
 * [POS]: 拍照 Host 入口，与身份/标题组件没有服务依赖，像素不进入配置。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { openCaptureBridge, readMainIdentity } from './capture-bootstrap.ts';
import { createCaptureRoute } from './capture-route.ts';
import z from '@deepseek-ai/schemastery';
import { CAPTURE_FILE_NAME_PATTERN, DEFAULT_CAPTURE_EXPORT } from '../shared/capture-export.ts';
import { createCaptureTrace } from '../shared/capture-trace.ts';
export const name = 'pdsh-capture';
const INITIAL_SAVE_DIRECTORY = join(homedir(), 'Downloads');
export const Config = z.object({
  saveBehavior: z.union(['ask', 'direct']).default(DEFAULT_CAPTURE_EXPORT.saveBehavior).volatile(),
  saveDirectory: z.string().pattern(/^(?:|\/(?!.*[\u0000-\u001f\u007f]).{0,4095})$/u).default(INITIAL_SAVE_DIRECTORY).volatile(),
  saveFormat: z.union(['png', 'jpeg', 'webp']).default(DEFAULT_CAPTURE_EXPORT.saveFormat).volatile(),
  fileNamePattern: z.string().pattern(CAPTURE_FILE_NAME_PATTERN).default(DEFAULT_CAPTURE_EXPORT.fileNamePattern).volatile(),
});
export async function normalizeLegacyCaptureExport(ctx, isDisposed = () => false) {
  await ctx.root.loader.await();
  if (isDisposed()) return;
  const section = ctx.settings.describe().find(view => view.ns === name);
  if (!section) return;
  const ops = [];
  if (section.value?.saveDirectory === '') ops.push({ op: 'set', path: ['saveDirectory'], value: INITIAL_SAVE_DIRECTORY });
  if (section.value?.fileNamePattern === 'DSH {date} at {time}') ops.push({ op: 'set', path: ['fileNamePattern'], value: DEFAULT_CAPTURE_EXPORT.fileNamePattern });
  // +--- 只修正旧默认；用户目录/自定义模板不动，并发修改交由 Host revision 拒绝 ---+
  if (ops.length && !isDisposed()) await ctx.settings.mutate(name, ops, section.revision);
}
const GUARD = Symbol.for('@daftai/pdsh.main-lifecycle-guard.v1');
function mainLifecycleGuard() {
  let identity;
  try { identity = readMainIdentity(process.ppid); } catch {}
  const previous = (globalThis as any)[GUARD];
  // +--- 同一 Main 世代的停用/重装不能抹去未知关闭；读取失败也不猜已恢复 ---+
  if (previous && (!identity || !previous.identity || previous.identity === identity)) return previous.guard;
  const guard = { error: null };
  (globalThis as any)[GUARD] = { identity, guard };
  return guard;
}
export function apply(ctx, config) {
  ctx.inject(['settings', 'connection'], child => {
    child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
    child.effect(() => {
      let disposed = false;
      void normalizeLegacyCaptureExport(child, () => disposed).catch(() => {
        if (!disposed) child.logger?.warn?.('PDSH export defaults were not updated; accepted preferences remain unchanged.');
      });
      return () => { disposed = true; };
    });
    const trace = createCaptureTrace(child.logger, 'host'), guard = mainLifecycleGuard();
    // +--- 安装位置以当前模块 URL 为准，交给 Node 转成本机路径，不猜 DSH 目录或盘符 ---+
    const controller = createCaptureRoute(() => true,
      (signal, requestId) => openCaptureBridge(fileURLToPath(new URL('./main.cjs', import.meta.url)), signal, phase => trace(phase, requestId)), child.logger, guard);
    child.effect(() => () => controller.dispose());
    child.connection.fetch.register(controller.route);
  });
}
