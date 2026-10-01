/**
 * [INPUT]: 依赖 root pdsh Settings revision、Loader 所属 Fiber 的 volatile-update、capture-route/bootstrap/trace 与本机 Downloads 默认目录。
 * [OUTPUT]: 提供可并入 root Config 的拍照字段、旧默认修正，以及仅随 captureEnabled 事件同步撤回/重挂的 exact Fetch route。
 * [POS]: 单 Host 的拍照控制面；route 同步撤回、在途 Main 桥异步归还且未知关闭隔离跨重挂载保留。
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

const INITIAL_SAVE_DIRECTORY = join(homedir(), 'Downloads');

// +--- 字段仅声明一次，由 index.ts 合入唯一 pdsh Config ---+
export const CAPTURE_CONFIG_FIELDS = {
  captureEnabled: z.boolean().default(true).description('Enable current-page capture / 启用当前页面拍摄').volatile(),
  saveBehavior: z.union(['ask', 'direct']).default(DEFAULT_CAPTURE_EXPORT.saveBehavior).volatile(),
  saveDirectory: z.string().pattern(/^(?:|\/(?!.*[\u0000-\u001f\u007f]).{0,4095})$/u).default(INITIAL_SAVE_DIRECTORY).volatile(),
  saveFormat: z.union(['png', 'jpeg', 'webp']).default(DEFAULT_CAPTURE_EXPORT.saveFormat).volatile(),
  fileNamePattern: z.string().pattern(CAPTURE_FILE_NAME_PATTERN).default(DEFAULT_CAPTURE_EXPORT.fileNamePattern).volatile(),
};

const ROOT_NAMESPACE = 'pdsh';
export async function normalizeLegacyCaptureExport(ctx, isDisposed = () => false) {
  await ctx.root.loader.await();
  if (isDisposed()) return;
  const section = ctx.settings.describe().find(view => view.ns === ROOT_NAMESPACE);
  if (!section) return;
  const ops = [];
  if (section.value?.saveDirectory === '') ops.push({ op: 'set', path: ['saveDirectory'], value: INITIAL_SAVE_DIRECTORY });
  if (section.value?.fileNamePattern === 'DSH {date} at {time}') ops.push({ op: 'set', path: ['fileNamePattern'], value: DEFAULT_CAPTURE_EXPORT.fileNamePattern });
  // +--- 只修正旧默认；用户路径/模板与并发 revision 均由官方 Settings 保留 ---+
  if (ops.length && !isDisposed()) await ctx.settings.mutate(ROOT_NAMESPACE, ops, section.revision);
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

function isCaptureEnabled(config) {
  const value = config?.captureEnabled;
  return (typeof value?.get === 'function' ? value.get() : value) !== false;
}

export function apply(ctx, config) {
  let syncCapture = () => {};
  // +--- Loader 只把 volatile-only 修改通知给所属 Fiber；core Volatile 本身没有 subscribe ---+
  (ctx as { on(event: 'loader/volatile-update', listener: (paths: readonly (readonly string[])[]) => void): unknown })
    .on('loader/volatile-update', paths => {
      if (paths.some(path => path.length === 1 && path[0] === 'captureEnabled')) syncCapture();
    });

  ctx.inject(['settings'], settings => {
    settings.effect(() => {
      let disposed = false;
      void normalizeLegacyCaptureExport(settings, () => disposed).catch(() => {
        if (!disposed) settings.logger?.warn?.('PDSH export defaults were not updated; accepted preferences remain unchanged.');
      });
      return () => { disposed = true; };
    });

    settings.inject(['connection'], child => {
      child.effect(() => {
        let disposed = false;
        let active: { controller: ReturnType<typeof createCaptureRoute>; unregister: () => unknown } | undefined;
        let retirement = Promise.resolve();
        let retirementPending = false;
        let retirementFailed = false;

        const logRetirementFailure = (_error?: unknown) => {
          retirementFailed = true;
          try { child.logger?.warn?.('PDSH capture cleanup was not confirmed; capture remains paused.'); } catch {}
        };

        const retire = (controller: ReturnType<typeof createCaptureRoute>) => {
          retirementPending = true;
          let closing: Promise<void>;
          try { closing = Promise.resolve(controller.dispose()); }
          catch (error) { logRetirementFailure(error); closing = Promise.resolve(); }
          let current: Promise<void>;
          current = Promise.all([retirement.catch(logRetirementFailure), closing.catch(logRetirementFailure)]).then(() => {
            if (retirement === current) retirementPending = false;
          });
          retirement = current;
        };

        const unmount = () => {
          const resource = active;
          if (!resource) return;
          active = undefined;
          // +--- Exact route 先同步退出；controller.dispose 随即 abort 在途桥并等待归还 ---+
          try { resource.unregister(); } catch (error) { logRetirementFailure(error); }
          retire(resource.controller);
        };

        const mount = () => {
          if (disposed || active || !isCaptureEnabled(config)) return;
          const trace = createCaptureTrace(child.logger, 'host');
          const guard = mainLifecycleGuard();
          // +--- Main 相对包根入口解析；停用到重新归还的屏障内不接纳新桥 ---+
          const controller = createCaptureRoute(
            () => isCaptureEnabled(config) && !retirementPending && !retirementFailed,
            (signal, requestId) => openCaptureBridge(fileURLToPath(new URL('./main.cjs', import.meta.url)), signal, phase => trace(phase, requestId)),
            child.logger, guard,
          );
          try {
            const unregister = child.connection.fetch.register(controller.route);
            active = { controller, unregister };
          } catch (error) {
            retire(controller);
            throw error;
          }
        };

        const reconcile = () => {
          if (disposed) return;
          if (isCaptureEnabled(config)) mount();
          else unmount();
        };

        syncCapture = reconcile;
        reconcile();
        return async () => {
          disposed = true;
          if (syncCapture === reconcile) syncCapture = () => {};
          unmount();
          await retirement;
        };
      });
    });
  });
}
