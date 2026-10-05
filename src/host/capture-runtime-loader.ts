/**
 * [INPUT]: 依赖当前安装包定位器、标准 ESM import 与同协议 capture 实现的真实 dispose。
 * [OUTPUT]: 提供按当前安装版本换载的单实例协调器，拒绝不兼容协议与卸载后复活。
 * [POS]: 稳定 Remote 外壳和可更新业务实现之间的边界；不改 Node cache、不启停 Bundle、不修改设置。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { lstat, readFile, realpath } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

export const CAPTURE_RUNTIME_CONTRACT = 'pdsh-capture-runtime-v1'
const VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\w.-]+)?$/

export interface CaptureRuntimeInstance {
  readonly version: string
  refreshCaptureEnabled(): void
  dispose(): Promise<void>
}

interface RuntimeModule {
  readonly version: string
  readonly contract: string
  create(context?: unknown): CaptureRuntimeInstance
}

/** realpath 绕开旧入口的 resolver 缓存，只读官方 Manager 当前管理的自身包。 */
export async function locateCaptureRuntime(packageLink: string): Promise<{ version: string; url: string }> {
  const root = await realpath(packageLink)
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  if (manifest.name !== '@daftai/pdsh' || !VERSION.test(manifest.version)) throw new Error('invalid capture runtime package')
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
  let loading: Promise<CaptureRuntimeInstance> | undefined
  let disposed = false
  let disposal: Promise<void> | undefined

  async function load(): Promise<CaptureRuntimeInstance> {
    let target = await options.locate()
    if (disposed) throw new Error('capture runtime disposed')
    if (active && activeUrl === target.url && active.version === target.version) return active
    let module = await (options.importModule ?? (url => import(url)))(target.url)
    if (disposed) throw new Error('capture runtime disposed')
    if (module.contract !== CAPTURE_RUNTIME_CONTRACT || module.version !== target.version || typeof module.create !== 'function') {
      throw new Error('incompatible capture runtime')
    }
    // +--- 新模块验证通过后撤回旧 generation，等待实际 helper/保存结算 ---+
    const previous = active
    active = undefined; activeUrl = undefined
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
      if (module.contract !== CAPTURE_RUNTIME_CONTRACT || module.version !== target.version || typeof module.create !== 'function') {
        throw new Error('incompatible capture runtime')
      }
    }
    const next = module.create(options.context)
    if (!next || next.version !== target.version || ['capture', 'save', 'refreshCaptureEnabled', 'dispose'].some(method => typeof next[method] !== 'function')) {
      if (typeof next?.dispose === 'function') await next.dispose()
      throw new Error('incompatible capture runtime instance')
    }
    active = next; activeUrl = target.url
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
    dispose(): Promise<void> {
      if (disposal) return disposal
      disposed = true
      const current = active; active = undefined; activeUrl = undefined
      disposal = Promise.all([current?.dispose(), loading?.catch(() => undefined)]).then(() => undefined)
      return disposal
    },
  }
}
