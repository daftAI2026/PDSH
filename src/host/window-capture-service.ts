/**
 * [INPUT]: 依赖官方 Typert 固定 Remote ABI、Manager 当前自身包位置与版本实现协调器。
 * [OUTPUT]: 提供唯一 capture/save service 与只读 implementationVersion；每次调用选择实际已安装后台版本。
 * [POS]: 稳定 Cordis/Remote 外壳；业务实现可热换，Config、service key 和 wire 合同不随业务版本更名。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { RemoteStream } from '@deepseek-ai/dsh-typert-protocol'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCaptureRuntimeLoader, locateCaptureRuntime } from './capture-runtime-loader.ts'
import type { CaptureRuntime } from './capture-runtime.ts'
import type { CaptureFrame } from '../shared/window-capture-protocol.ts'
import type { WindowSaveFrame, WindowSaveInputFrame, WindowSaveRequest } from '../shared/window-save-protocol.ts'
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
      ? join(profile.dir, 'node_modules', '@daftai', 'pdsh')
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

  @Remote({ mode: 'stream' })
  capture(signal: AbortSignal): AsyncIterable<CaptureFrame> {
    const owner = this
    return { async *[Symbol.asyncIterator]() {
      if (owner.disposed) { yield { type: 'terminal', status: 'disposed' }; return }
      let runtime: CaptureRuntime
      try { runtime = await owner.runtime.current() as CaptureRuntime }
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
      let runtime: CaptureRuntime
      try { runtime = await owner.runtime.current() as CaptureRuntime }
      catch {
        yield { type: 'terminal', requestId: isCaptureId(request?.requestId) ? request.requestId : '', code: owner.disposed ? 'disposed' : 'save-failed' }
        return
      }
      yield* runtime.save(request, signal, uplink)
    })() as RemoteStream<WindowSaveFrame, WindowSaveInputFrame>
  }

  refreshCaptureEnabled(): void { this.runtime.refreshCaptureEnabled() }
}

export type { CaptureFrame }
