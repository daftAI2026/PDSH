/**
 * [INPUT]: 依赖安装身份、标准 ESM、稳定基础合同与独立壁纸扩展合同。
 * [OUTPUT]: 协调基础实现换载与壁纸能力；旧操作结算后才换载。
 * [POS]: 固定壳与业务模块的边界。接受已发布 v2 的兼容基础面，不给旧壳新增 Remote。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { BUNDLE_NAME } from '../shared/components.ts'
import { CAPTURE_RUNTIME_CONTRACT, CAPTURE_WALLPAPER_CONTRACT } from '../shared/capture-runtime-contract.ts'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { WallpaperFrame, WallpaperRequest } from '../shared/system-wallpaper-protocol.ts'
import type { CaptureFrame } from '../shared/window-capture-protocol.ts'
import type { WindowSaveFrame, WindowSaveInputFrame, WindowSaveRequest } from '../shared/window-save-protocol.ts'
import type { RemoteStream } from '@deepseek-ai/dsh-typert-protocol'

export { CAPTURE_RUNTIME_CONTRACT, CAPTURE_WALLPAPER_CONTRACT }
const LEGACY_V2_CONTRACT = 'pdsh-capture-runtime-v2'
const VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\w.-]+)?$/

export interface CaptureRuntimeInstance {
  readonly version: string
  capture(signal: AbortSignal): AsyncIterable<CaptureFrame>
  save(request: WindowSaveRequest, signal: AbortSignal, uplink: AsyncIterable<WindowSaveInputFrame>): RemoteStream<WindowSaveFrame, WindowSaveInputFrame>
  refreshCaptureEnabled(): void
  wallpaper?(request: WallpaperRequest, signal: AbortSignal): AsyncIterable<WallpaperFrame>
  dispose(): Promise<void>
}

interface RuntimeModule {
  readonly version: string
  readonly contract: string
  readonly wallpaperContract?: string
  create(context?: unknown): CaptureRuntimeInstance
}

function matchesBase(module: RuntimeModule, version: string): boolean {
  return (module.contract === CAPTURE_RUNTIME_CONTRACT || module.contract === LEGACY_V2_CONTRACT)
    && module.version === version && typeof module.create === 'function'
}

function matchesWallpaper(module: RuntimeModule): boolean {
  return module.wallpaperContract === CAPTURE_WALLPAPER_CONTRACT
    || (module.contract === LEGACY_V2_CONTRACT && module.wallpaperContract === undefined)
}

/** realpath 绕开旧入口的 resolver 缓存，只读官方 Manager 当前管理的自身包。 */
export async function locateCaptureRuntime(packageLink: string): Promise<{ version: string; url: string }> {
  const root = await realpath(packageLink)
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  if (manifest.name !== BUNDLE_NAME || !VERSION.test(manifest.version)) throw new Error('invalid capture runtime package')
  const path = join(root, 'lib', 'capture-runtime', `${manifest.version}.js`)
  if (!(await lstat(path)).isFile()) throw new Error('invalid capture runtime file')
  const physical = await realpath(path)
  const inside = relative(root, physical)
  if (!inside || inside === '..' || inside.startsWith(`..${sep}`)) throw new Error('invalid capture runtime location')
  return { version: manifest.version, url: pathToFileURL(physical).href }
}

export function createCaptureRuntimeLoader(options: {
  locate(): Promise<{ version: string; url: string }>
  importModule?(url: string): Promise<RuntimeModule>
  context?: unknown
}) {
  let active: CaptureRuntimeInstance | undefined
  let activeUrl: string | undefined
  let activeWallpaper = false
  let loading: Promise<CaptureRuntimeInstance> | undefined
  let disposed = false
  let disposal: Promise<void> | undefined

  async function load(): Promise<CaptureRuntimeInstance> {
    let target = await options.locate()
    if (disposed) throw new Error('capture runtime disposed')
    if (active && activeUrl === target.url && active.version === target.version) return active
    let module = await (options.importModule ?? (url => import(url)))(target.url)
    if (disposed) throw new Error('capture runtime disposed')
    if (!matchesBase(module, target.version)) {
      throw new Error('incompatible capture runtime')
    }
    // +--- 新模块验证通过后撤回旧 generation，等待实际 helper/保存结算 ---+
    const previous = active
    active = undefined; activeUrl = undefined; activeWallpaper = false
    await previous?.dispose()
    if (disposed) throw new Error('capture runtime disposed')
    // +--- 结算可能跨越第二次安装；重新定位，不能把中间版本冒充当前版本 ---+
    for (let attempt = 0; ; attempt++) {
      const latest = await options.locate()
      if (disposed) throw new Error('capture runtime disposed')
      if (latest.version === target.version && latest.url === target.url) break
      if (attempt >= 2) throw new Error('capture runtime installation changed')
      target = latest
      module = await (options.importModule ?? (url => import(url)))(target.url)
      if (disposed) throw new Error('capture runtime disposed')
      if (!matchesBase(module, target.version)) {
        throw new Error('incompatible capture runtime')
      }
    }
    const next = module.create(options.context)
    if (!next || next.version !== target.version
      || ['capture', 'save', 'refreshCaptureEnabled', 'dispose'].some(method => typeof next[method] !== 'function')) {
      if (typeof next?.dispose === 'function') await next.dispose()
      throw new Error('incompatible capture runtime instance')
    }
    active = next; activeUrl = target.url
    activeWallpaper = matchesWallpaper(module) && typeof next.wallpaper === 'function'
    return next
  }

  return {
    current(): Promise<CaptureRuntimeInstance> {
      if (disposed) return Promise.reject(new Error('capture runtime disposed'))
      if (!loading) {
        const task = load()
        loading = task
        task.then(() => { if (loading === task) loading = undefined }, () => { if (loading === task) loading = undefined })
      }
      return loading
    },
    refreshCaptureEnabled() { if (!disposed) active?.refreshCaptureEnabled() },
    supportsWallpaper(instance: CaptureRuntimeInstance): boolean {
      return !disposed && active === instance && activeWallpaper
    },
    dispose(): Promise<void> {
      if (disposal) return disposal
      disposed = true
      const current = active; active = undefined; activeUrl = undefined; activeWallpaper = false
      disposal = Promise.all([current?.dispose(), loading?.catch(() => undefined)]).then(() => undefined)
      return disposal
    },
  }
}
