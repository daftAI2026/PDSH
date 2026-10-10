/**
 * [INPUT]: 依赖官方 Manager 的自身安装链接、Cordis Registry/Entry 生命周期与 HMR 串行队列。
 * [OUTPUT]: 将唯一 pdsh 根实例换为已安装版本；保留 Config 地址与原始配置，失败恢复旧实例。
 * [POS]: 版本化业务到固定根 Host 的升级接续。标准版本 URL 避开旧模块缓存，不改 resolver 或缓存。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { Context, Fiber, Plugin } from '@deepseek-ai/cordis'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { dirname, join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { BUNDLE_NAME, ROOT_ENTRY_ID } from '../shared/components.ts'

type RootPlugin = Plugin.Object & { apply: Plugin.Function & { pdshVersion?: string } }
type RootEntry = {
  options: { id?: string; name?: string; config?: unknown; disabled?: unknown }
  fiber?: Fiber
}

/** 只有已运行旧桥加载了新业务时，才接续同一 Entry 的根换代。 */
export async function refreshRuntimeRoot(ctx: Context, version: string): Promise<void> {
  try { await reloadRuntimeRoot(ctx, version) }
  catch { throw new Error('runtime-root-unavailable') }
}

async function reloadRuntimeRoot(ctx: Context, version: string): Promise<void> {
  const profile = ctx.get('profileContext') as { dir?: string } | undefined
  // +--- 无 Loader 的后端合同没有根实例；生产 profile 不使用此分支。 ---+
  if (!profile) return
  const entry = (ctx.fiber as Fiber & { entry?: RootEntry }).entry
  if (!profile.dir || !entry || entry.options.id !== ROOT_ENTRY_ID || entry.options.name !== BUNDLE_NAME) {
    throw new Error('runtime-root-unavailable')
  }
  if (entry.options.disabled || entry.fiber?.state !== 2) throw new Error('runtime-root-unavailable')
  if (Reflect.get(entry.fiber.runtime.callback ?? {}, 'pdshVersion') === version) return
  const hmr = ctx.get('hmr') as { runExclusive<T>(operation: () => Promise<T>): Promise<T> } | undefined
  if (!hmr?.runExclusive) throw new Error('runtime-root-unavailable')
  const root = await realpath(join(profile.dir, 'node_modules', ...BUNDLE_NAME.split('/')))
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  if (manifest.name !== BUNDLE_NAME || manifest.version !== version) throw new Error('runtime-root-unavailable')
  const file = join(root, 'index.js')
  if (!(await lstat(file)).isFile()) throw new Error('runtime-root-unavailable')
  const physical = await realpath(file)
  const within = relative(root, physical)
  if (!within || within === '..' || within.startsWith(`..${sep}`) || dirname(physical) !== root) {
    throw new Error('runtime-root-unavailable')
  }
  // +--- 固定入口也有旧 URL 缓存；每个不可变发布版本使用唯一标准 ESM URL。 ---+
  const url = pathToFileURL(physical)
  url.searchParams.set('pdsh', version)
  const replacement = await import(url.href) as RootPlugin & { name?: string }
  if (replacement.name !== ROOT_ENTRY_ID || typeof replacement.apply !== 'function'
    || replacement.apply.pdshVersion !== version || !replacement.Config) throw new Error('runtime-root-unavailable')

  const hadCapture = Boolean(ctx.get('pdshWindowCapture'))
  await hmr.runExclusive(async () => {
    const previous = entry.fiber
    if (Reflect.get(previous?.runtime?.callback ?? {}, 'pdshVersion') === version) return
    if (!previous || previous.state !== 2 || ctx.fiber.state !== 2 || entry.options.disabled
      || previous.parent.fiber.state !== 2) throw new Error('runtime-root-unavailable')
    const installed = JSON.parse(await readFile(join(profile.dir!, 'node_modules', ...BUNDLE_NAME.split('/'), 'package.json'), 'utf8'))
    if (installed.name !== BUNDLE_NAME || installed.version !== version) throw new Error('runtime-root-unavailable')
    const runtime = ctx.registry.get(previous.runtime!.callback)
    if (!runtime || [...runtime.fibers].length !== 1 || [...runtime.fibers][0] !== previous) {
      throw new Error('runtime-root-unavailable')
    }
    // +--- 与官方 HMR 使用同一公开生命周期；删除 Registry 先于 dispose，避免写 disabled。 ---+
    const rollback = { name: runtime.name, Config: runtime.Config, apply: runtime.callback } as RootPlugin
    const parent = previous.parent
    const start = async (plugin: RootPlugin) => {
      if (parent.fiber.state !== 2 || entry.options.disabled) throw new Error('runtime-root-unavailable')
      const fiber = parent.registry.plugin(plugin, entry.options.config).ctx.fiber
      ;(fiber as Fiber & { entry?: RootEntry }).entry = entry
      entry.fiber = fiber
      await fiber.await()
      if (fiber.state !== 2) throw new Error('runtime-root-unavailable')
    }
    ctx.registry.delete(runtime.callback)
    await previous.await()
    try {
      await start(replacement)
      // +--- 根服务惰性加载业务；旧能力回复前，须完成新根的基础与子能力注册。 ---+
      if (hadCapture) {
        const capture = parent.get('pdshWindowCapture') as { implementationVersion(): Promise<string> } | undefined
        if (!capture || await capture.implementationVersion() !== version) throw new Error('runtime-root-unavailable')
      }
    } catch {
      const failed = entry.fiber
      ctx.registry.delete(replacement)
      await failed?.await().catch(() => undefined)
      if (parent.fiber.state === 2 && !entry.options.disabled) await start(rollback)
      throw new Error('runtime-root-unavailable')
    }
  })
}
