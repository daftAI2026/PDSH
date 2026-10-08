/**
 * [INPUT]: 依赖官方 Typert、当前业务实例与共享壁纸/取像几何 DTO。
 * [OUTPUT]: 提供当前业务版本、壁纸接口及按 PNG 摘要查询视口几何的独立握手。
 * [POS]: 版本化业务的内部 Remote 面。根 Config 拥有权限，子 Fiber 拥有注册。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { CAPTURE_GEOMETRY_CONTRACT } from '../shared/capture-runtime-contract.ts'
import { isCaptureGeometry, isCapturePngSha256 } from '../shared/capture-geometry.ts'
import type { CaptureGeometry } from '../shared/capture-geometry.ts'
import type { WallpaperFrame, WallpaperRequest } from '../shared/system-wallpaper-protocol.ts'

export interface RuntimeCapabilityImplementation {
  readonly version: string
  readonly geometryContract?: string
  wallpaper(request: WallpaperRequest, signal: AbortSignal): AsyncIterable<WallpaperFrame>
  captureGeometry?(pngSha256: string): Promise<CaptureGeometry | null>
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

  @Remote
  captureGeometryRegistered(): boolean {
    return !this.disposed && this.implementation.geometryContract === CAPTURE_GEOMETRY_CONTRACT
      && typeof this.implementation.captureGeometry === 'function'
  }

  @Remote
  async captureGeometry(pngSha256: string): Promise<CaptureGeometry | null> {
    if (!this.captureGeometryRegistered() || !isCapturePngSha256(pngSha256)) return null
    try {
      const geometry = await this.implementation.captureGeometry(pngSha256)
      return isCaptureGeometry(geometry) ? geometry : null
    } catch {
      return null
    }
  }

  @Remote({ mode: 'stream' })
  wallpaper(request: WallpaperRequest, signal: AbortSignal): AsyncIterable<WallpaperFrame> {
    const owner = this
    return { async *[Symbol.asyncIterator]() {
      if (owner.disposed) { yield { type: 'terminal', status: 'disposed' }; return }
      yield* owner.implementation.wallpaper(request, signal)
    } }
  }
}
