/**
 * [INPUT]: 依赖 shared export/跨平台目录语法与官方 accepted Settings revision；不再依赖 Fetch、Main 或 Inspector。
 * [OUTPUT]: 提供 root Config 的拍照身份遮挡/导出字段与仅修正历史默认值的配置 effect。
 * [POS]: Host 配置适配边界；截图身份开关与常驻 maskIdentity 独立，Native Remote 生命周期由 service 单独持有。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import z from '@deepseek-ai/schemastery'
import { CAPTURE_FILE_NAME_PATTERN, CAPTURE_SAVE_DIRECTORY_PATTERN, DEFAULT_CAPTURE_EXPORT } from '../shared/capture-export.ts'

const INITIAL_SAVE_DIRECTORY = join(homedir(), 'Downloads')
const ROOT_NAMESPACE = 'pdsh'

// +--- 字段只声明一次，再由 root Host Config 原位合并 ---+
export const CAPTURE_CONFIG_FIELDS = {
  captureEnabled: z.boolean().default(true).description('Enable owned-window capture / 启用所属窗口拍摄').volatile(),
  captureMaskIdentity: z.boolean().default(true).description('Mask sidebar avatar and name in captures / 截图时遮挡头像和名称').volatile(),
  saveBehavior: z.union(['ask', 'direct']).default(DEFAULT_CAPTURE_EXPORT.saveBehavior).volatile(),
  saveDirectory: z.string().pattern(CAPTURE_SAVE_DIRECTORY_PATTERN).default(INITIAL_SAVE_DIRECTORY).volatile(),
  saveFormat: z.union(['png', 'jpeg', 'webp']).default(DEFAULT_CAPTURE_EXPORT.saveFormat).volatile(),
  fileNamePattern: z.string().pattern(CAPTURE_FILE_NAME_PATTERN).default(DEFAULT_CAPTURE_EXPORT.fileNamePattern).volatile(),
}

/** 保留已有 Host revision-fenced 默认修正，不把其它用户路径或模板重写。 */
export async function normalizeLegacyCaptureExport(ctx: any, isDisposed = () => false): Promise<void> {
  await ctx.root.loader.await()
  if (isDisposed()) return
  const section = ctx.settings.describe().find((view: { ns: string }) => view.ns === ROOT_NAMESPACE)
  if (!section) return
  const operations = []
  if (section.value?.saveDirectory === '') operations.push({ op: 'set', path: ['saveDirectory'], value: INITIAL_SAVE_DIRECTORY })
  if (section.value?.fileNamePattern === 'DSH {date} at {time}') {
    operations.push({ op: 'set', path: ['fileNamePattern'], value: DEFAULT_CAPTURE_EXPORT.fileNamePattern })
  }
  if (operations.length && !isDisposed()) await ctx.settings.mutate(ROOT_NAMESPACE, operations, section.revision)
}

/** 必须由 Config owner 调用：Loader 把 volatile 事件限定为 owner fiber，而非子 Service。 */
export function observeCaptureEnabled(ctx: {
  on(event: 'loader/volatile-update', listener: (paths: readonly (readonly string[])[]) => void): () => boolean
  get(name: 'pdshWindowCapture'): { refreshCaptureEnabled(): void } | undefined
}): () => boolean {
  return ctx.on('loader/volatile-update', paths => {
    if (paths.some(path => path.length === 1 && path[0] === 'captureEnabled')) {
      ctx.get('pdshWindowCapture')?.refreshCaptureEnabled()
    }
  })
}

/** root Config 持有旧设置迁移；不挂载额外 Host route/服务。 */
export function apply(ctx: any): void {
  ctx.inject(['settings'], (settings: any) => {
    settings.effect(() => {
      let disposed = false
      void normalizeLegacyCaptureExport(settings, () => disposed).catch(() => {
        if (!disposed) settings.logger?.warn?.('PDSH export defaults were not updated; accepted preferences remain unchanged.')
      })
      return () => { disposed = true }
    })
  })
}
