/**
 * [INPUT]: 依赖官方 Typert、Manager 包位置与基础/扩展分离的业务协调器。
 * [OUTPUT]: 提供截图、保存、可选壁纸、纯注册握手与实际实现版本；扩展不适配不阻断基础。
 * [POS]: 固定基础外壳。只依赖稳定 Loader 接口；新能力由业务子 Fiber 注册。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { BUNDLE_NAME } from '../shared/components.ts'
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { RemoteStream } from '@deepseek-ai/dsh-typert-protocol'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCaptureRuntimeLoader, locateCaptureRuntime } from './capture-runtime-loader.ts'
import type { CaptureRuntimeInstance } from './capture-runtime-loader.ts'
import type { CaptureFrame } from '../shared/window-capture-protocol.ts'
import type { WindowSaveFrame, WindowSaveInputFrame, WindowSaveRequest } from '../shared/window-save-protocol.ts'
import type { WallpaperFrame, WallpaperRequest } from '../shared/system-wallpaper-protocol.ts'
import { isCaptureId } from '../shared/capture-bridge.ts'

export class WindowCaptureService extends TypertRemoteService {
  static inject = ['typert', 'settings']
  private readonly runtime: ReturnType<typeof createCaptureRuntimeLoader>
  private disposed = false

  constructor(ctx: Context) {
    super(ctx, 'pdshWindowCapture', { namespace: 'pdshNativeWindowCapture' })
    const profile = ctx.get('profileContext') as { dir?: string } | undefined
    // +--- Host profile link 是安装器所有的稳定地址；无 profile 的独立 Cordis 合同使用本包 ---+
    const packageLink = profile?.dir
      ? join(profile.dir, 'node_modules', ...BUNDLE_NAME.split('/'))
      : dirname(fileURLToPath(import.meta.url))
    this.runtime = createCaptureRuntimeLoader({ locate: () => locateCaptureRuntime(packageLink), context: this.ctx })
    this.ctx.effect(() => () => {
      this.disposed = true
      return this.runtime.dispose()
    }, 'pdsh-window-capture: settle versioned implementation')
  }

  /** 仅载入无副作用的后台并返回真实版本；不请求权限、像素或文件。 */
  @Remote
  async implementationVersion(): Promise<string> {
    try { return (await this.runtime.current()).version }
    catch { throw new Error('capture-runtime-unavailable') }
  }

  /** 只证明运行壳已注册壁纸 Remote；不载入 payload、读取配置或请求素材。 */
  @Remote
  wallpaperRegistered(): boolean { return true }

  @Remote({ mode: 'stream' })
  capture(signal: AbortSignal): AsyncIterable<CaptureFrame> {
    const owner = this
    return { async *[Symbol.asyncIterator]() {
      if (owner.disposed) { yield { type: 'terminal', status: 'disposed' }; return }
      let runtime: CaptureRuntimeInstance
      try { runtime = await owner.runtime.current() }
      catch { yield { type: 'terminal', status: owner.disposed ? 'disposed' : 'helper-failed' }; return }
      if (owner.disposed) { yield { type: 'terminal', status: 'disposed' }; return }
      yield* runtime.capture(signal)
    } }
  }

  @Remote({ mode: 'stream' })
  save(request: WindowSaveRequest, signal: AbortSignal): RemoteStream<WindowSaveFrame, WindowSaveInputFrame> {
    // invocation 只在 Remote 同步调用上下文有效；必须在异步载入前保留原 carrier。
    const invocation = this.ctx.invocation
    if (!invocation) throw new Error('Window save requires an active Remote invocation')
    const uplink = invocation.uplink<WindowSaveInputFrame>()
    const owner = this
    return (async function* () {
      let runtime: CaptureRuntimeInstance
      try { runtime = await owner.runtime.current() }
      catch {
        yield { type: 'terminal', requestId: isCaptureId(request?.requestId) ? request.requestId : '', code: owner.disposed ? 'disposed' : 'save-failed' }
        return
      }
      yield* runtime.save(request, signal, uplink)
    })() as RemoteStream<WindowSaveFrame, WindowSaveInputFrame>
  }

  @Remote({ mode: 'stream' })
  wallpaper(request: WallpaperRequest, signal: AbortSignal): AsyncIterable<WallpaperFrame> {
    const owner = this
    return { async *[Symbol.asyncIterator]() {
      if (owner.disposed) { yield { type: 'terminal', status: 'disposed' }; return }
      let runtime: CaptureRuntimeInstance
      try { runtime = await owner.runtime.current() }
      catch { yield { type: 'terminal', status: owner.disposed ? 'disposed' : 'helper-failed' }; return }
      if (owner.disposed) { yield { type: 'terminal', status: 'disposed' }; return }
      if (!owner.runtime.supportsWallpaper(runtime)) { yield { type: 'terminal', status: 'unavailable' }; return }
      yield* runtime.wallpaper(request, signal)
    } }
  }

  refreshCaptureEnabled(): void { this.runtime.refreshCaptureEnabled() }
}

export type { CaptureFrame }
