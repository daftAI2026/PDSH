/**
 * [INPUT]: 依赖官方 Typert、当前业务实例与共享壁纸 DTO。
 * [OUTPUT]: 提供当前业务版本、壁纸注册握手与壁纸流。
 * [POS]: 版本化业务的内部 Remote 面。根 Config 拥有权限，子 Fiber 拥有注册。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { WallpaperFrame, WallpaperRequest } from '../shared/system-wallpaper-protocol.ts'

export interface RuntimeCapabilityImplementation {
  readonly version: string
  wallpaper(request: WallpaperRequest, signal: AbortSignal): AsyncIterable<WallpaperFrame>
}

/** 新增业务接口随当前实现注册，不修改既运行的截图外壳。 */
export class RuntimeCapabilitiesService extends TypertRemoteService {
  private disposed = false

  constructor(ctx: Context, private readonly implementation: RuntimeCapabilityImplementation) {
    super(ctx, 'pdshRuntimeCapabilities', { namespace: 'pdshRuntimeCapabilities' })
    this.ctx.effect(() => () => { this.disposed = true }, 'pdsh runtime capabilities: revoke calls')
  }

  @Remote
  async implementationVersion(): Promise<string> {
    if (this.disposed) throw new Error('capture-runtime-unavailable')
    return this.implementation.version
  }

  /** 纯握手不读取系统目录，不启动媒体或原生助手。 */
  @Remote
  wallpaperRegistered(): boolean { return !this.disposed }

  @Remote({ mode: 'stream' })
  wallpaper(request: WallpaperRequest, signal: AbortSignal): AsyncIterable<WallpaperFrame> {
    const owner = this
    return { async *[Symbol.asyncIterator]() {
      if (owner.disposed) { yield { type: 'terminal', status: 'disposed' }; return }
      yield* owner.implementation.wallpaper(request, signal)
    } }
  }
}
