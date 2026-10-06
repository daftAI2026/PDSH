/**
 * [INPUT]: 依赖稳定service上下文、accepted Settings、同包 helper、Apple 元数据选择器/有界系统下载器与同 namespace 保存。
 * [OUTPUT]: 提供 v2 capture/save/wallpaper 业务；目录来自 Apple 顺序/代表关联，每个 load 重核对活动 ID，本机优先/缺失才下载。
 * [POS]: 可更新Host业务闭包；复用唯一captureEnabled generation，在途壁纸下载/子进程真实settle后才释放；不注册service或改Config身份。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { ROOT_ENTRY_ID } from '../shared/components.ts'
import type { Context } from '@deepseek-ai/cordis'
import type { RemoteStream } from '@deepseek-ai/dsh-typert-protocol'
import { createClickCapture, resolveNativeCaptureHelperPath, runNativeCapture, isNativeCaptureFailureCode } from './native-window-capture.ts'
import type { NativeCaptureFailureCode } from './native-window-capture.ts'
import { createWindowSaveBackend } from './window-save-backend.ts'
import type { WindowSavePreferences } from './window-save-backend.ts'
import type { WindowSaveFrame, WindowSaveInputFrame, WindowSaveRequest } from '../shared/window-save-protocol.ts'
import type { SystemWallpaperId, WallpaperFrame, WallpaperRequest } from '../shared/system-wallpaper-protocol.ts'
import { CAPTURE_FAILURE_CODES } from '../shared/window-capture-protocol.ts'
import type { CaptureFrame } from '../shared/window-capture-protocol.ts'
import { createCaptureFrameStream, createCaptureServiceLifetime } from './window-capture-stream.ts'
import type { CaptureServiceLifetime } from './window-capture-stream.ts'
import { createSystemWallpaperStream } from './system-wallpaper-stream.ts'
import { resolveSystemWallpaperHelperPath, runNativeWallpaperImage, NativeWallpaperFailure } from './system-wallpaper-native.ts'
import type { NativeWallpaperImage } from './system-wallpaper-native.ts'
import { downloadAppleWallpaperVideo } from './system-wallpaper-download.ts'
import { discoverSystemWallpaperSources } from './system-wallpaper-catalog.ts'

type HostServiceContext = Context & {
  readonly settings: {
    describe(): Array<{ readonly ns: string; readonly value?: Record<string, unknown> }>
  }
}

type CaptureObservation = 'service-mounted' | 'enabled' | 'invocation' | 'phase' | 'native-result' | 'terminal'

const CAPTURE_TERMINAL_CODES: ReadonlySet<string> = new Set(CAPTURE_FAILURE_CODES)

/** 只输出固定事件与有限枚举；不格式化异常对象，也不让 logger 故障改变取像结果。 */
function logCaptureObservation(ctx: Context, event: CaptureObservation, value?: unknown): void {
  try {
    const logger = (ctx as Context & { logger?: { info?: (message: string, ...args: unknown[]) => unknown } }).logger
    if (!logger?.info) return
    if (event === 'service-mounted' || event === 'enabled') {
      logger.info(`PDSH capture event=${event} enabled=%s`, value === true)
      return
    }
    if (event === 'invocation') {
      logger.info('PDSH capture event=invocation')
      return
    }
    if (event === 'phase') {
      if (value === 'authorization-required' || value === 'capture-ready') {
        logger.info('PDSH capture event=phase phase=%s', value)
      }
      return
    }
    if (event === 'native-result') {
      const code = nativeFailureCode(value)
      logger.info('PDSH capture event=native-result code=%s', code)
      return
    }
    const code = value === 'captured' || (typeof value === 'string' && CAPTURE_TERMINAL_CODES.has(value))
      ? value
      : 'helper-failed'
    logger.info('PDSH capture event=terminal code=%s', code)
  } catch { /* 诊断日志不得成为 Host 采集链的失败源。 */ }
}

function nativeFailureCode(error: unknown): NativeCaptureFailureCode {
  try {
    const code = error && typeof error === 'object' ? (error as { readonly code?: unknown }).code : undefined
    return isNativeCaptureFailureCode(code)
      ? code as NativeCaptureFailureCode
      : 'helper-failed'
  } catch { return 'helper-failed' }
}

/** 包装不提前迭代的 AsyncIterable；for-await return 仍透传并等待原 capture settle。 */
async function* observeCaptureFrames(
  frames: AsyncIterable<CaptureFrame>,
  ctx: Context,
): AsyncGenerator<CaptureFrame> {
  for await (const frame of frames) {
    if (frame.type === 'phase') logCaptureObservation(ctx, 'phase', frame.phase)
    else if (frame.type === 'terminal') logCaptureObservation(ctx, 'terminal', frame.status)
    yield frame
  }
}

/** 单 Cordis service 拥有capture/save/wallpaper；壁纸只经同一官方Remote stream返回静态JPEG。 */
declare const __PDSH_VERSION__: string
export const version = __PDSH_VERSION__
export const contract = 'pdsh-capture-runtime-v2'
export function create(ctx: Context): CaptureRuntime { return new CaptureRuntime(ctx) }

export class CaptureRuntime {
  readonly version = version

  private readonly lifetime: CaptureServiceLifetime = createCaptureServiceLifetime()
  private readonly saveBackend = createWindowSaveBackend({
    preferences: () => acceptedWindowSavePreferences(this.ctx as HostServiceContext),
  })
  private disposal: Promise<void> | undefined

  constructor(private readonly ctx: Context) {
    const serviceContext = this.ctx as HostServiceContext
    const enabled = acceptedWindowSavePreferences(serviceContext).captureEnabled === true
    this.lifetime.setEnabled(enabled)
    logCaptureObservation(this.ctx, 'service-mounted', enabled)
  }

  /** 权限只在该 Remote iterable 首次被拉取时经原生 helper 请求。 */
  capture(signal: AbortSignal): AsyncIterable<CaptureFrame> {
    // +--- 固定外壳不能把异版本实现当成当前业务执行 ---+
    if (this.version !== version) throw new Error('capture-runtime-version-mismatch')
    // +--- 子 Service 可先于 Config owner ACTIVE；挂载时的空投影不是永久撤权 ---+
    this.refreshCaptureEnabled()
    const serviceContext = this.ctx
    logCaptureObservation(serviceContext, 'invocation')
    const frames = createCaptureFrameStream({
      signal,
      lifetimeSignal: this.lifetime.signal,
      reserve: () => this.lifetime.reserve(),
      capture: ({ signal: operationSignal, onPhase }) => {
        const clickCapture = createClickCapture({
          runner: options => runNativeCapture({
            ...options,
            helperPath: resolveNativeCaptureHelperPath(process.platform, process.arch, new URL('../../index.js', import.meta.url).href),
            platform: process.platform,
            arch: process.arch,
            onPhase,
          }),
        })
        return clickCapture.capture(operationSignal).catch(error => {
          logCaptureObservation(serviceContext, 'native-result', error)
          throw error
        }).finally(() => clickCapture.dispose())
      },
    })
    return observeCaptureFrames(frames, serviceContext)
  }

  /** 保存仅接受当前 Config 目录与模板；wire 不含 path/name，像素走有界 uplink。 */
  save(request: WindowSaveRequest, signal: AbortSignal, uplink: AsyncIterable<WindowSaveInputFrame>): RemoteStream<WindowSaveFrame, WindowSaveInputFrame> {
    this.refreshCaptureEnabled()
    return this.saveBackend.save(request, {
      signal,
      lifetimeSignal: this.lifetime.signal,
      uplink,
    }) as RemoteStream<WindowSaveFrame, WindowSaveInputFrame>
  }

  /** 列表只读系统目录；素材只在明确load后按固定ID取回并像素化。 */
  wallpaper(request: WallpaperRequest, signal: AbortSignal): AsyncIterable<WallpaperFrame> {
    if (this.version !== version) throw new Error('capture-runtime-version-mismatch')
    this.refreshCaptureEnabled()
    const helperPath = resolveSystemWallpaperHelperPath(
      process.platform,
      process.arch,
      new URL('../../index.js', import.meta.url).href,
    )
    return createSystemWallpaperStream({
      request,
      signal,
      lifetimeSignal: this.lifetime.signal,
      platform: process.platform,
      enabled: () => acceptedWindowSavePreferences(this.ctx as HostServiceContext).captureEnabled === true,
      disposed: () => Boolean(this.disposal),
      reserve: () => this.lifetime.reserve(),
      list: async operationSignal => {
        if (!helperPath) throw new NativeWallpaperFailure('unavailable')
        const sources = await discoverSystemWallpaperSources(operationSignal)
        return sources.map(({ id, name, available, downloadable }) => ({ id, name, available, downloadable }))
      },
      load: (id, operationSignal, onPhase) => this.loadWallpaperImage(id, operationSignal, onPhase, helperPath),
    })
  }

  private async loadWallpaperImage(
    id: SystemWallpaperId,
    signal: AbortSignal,
    onPhase: (phase: 'downloading' | 'decoding') => void,
    helperPath: string | undefined,
  ): Promise<NativeWallpaperImage> {
    if (!helperPath) throw new NativeWallpaperFailure('unavailable')
    const sources = await discoverSystemWallpaperSources(signal)
    const source = sources.find(entry => entry.id === id)
    if (!source) throw new NativeWallpaperFailure('invalid-request')
    try {
      return await runNativeWallpaperImage(id, {
        signal, helperPath, platform: process.platform, arch: process.arch,
        ...(source.imagePath ? { systemImagePath: source.imagePath } : {}),
      })
    } catch (error) {
      if (!(error instanceof NativeWallpaperFailure) || error.code !== 'download-required') throw error
    }

    if (!source.downloadable || !source.url) throw new NativeWallpaperFailure('unavailable')
    onPhase('downloading')
    const video = await downloadAppleWallpaperVideo(id, signal, source.url)
    try {
      if (signal.aborted) throw new NativeWallpaperFailure('cancelled')
      onPhase('decoding')
      return await runNativeWallpaperImage(id, {
        signal,
        helperPath,
        platform: process.platform,
        arch: process.arch,
        videoPath: video.path,
      })
    } finally {
      await video.cleanup()
    }
  }

  /** 显式调用先核对 accepted 设置；owner-scoped listener 继续负责在途同步撤权。 */
  refreshCaptureEnabled(): void {
    if (this.disposal) return
    const preferences = acceptedWindowSavePreferences(this.ctx as HostServiceContext)
    const enabled = preferences.captureEnabled === true
    this.lifetime.setEnabled(enabled)
    logCaptureObservation(this.ctx, 'enabled', enabled)
  }

  dispose(): Promise<void> {
    if (!this.disposal) {
      // +--- capture/save/wallpaper在同一个 synchronous turn撤权；关闭等待真实helper/write settle ---+
      this.disposal = Promise.all([this.lifetime.dispose(), this.saveBackend.dispose()]).then(() => undefined)
    }
    return this.disposal
  }
}

function acceptedWindowSavePreferences(ctx: HostServiceContext): WindowSavePreferences {
  const accepted = ctx.settings.describe().find(section => section.ns === ROOT_ENTRY_ID)?.value
  const read = (field: unknown): unknown => {
    if (field && typeof field === 'object' && 'get' in field && typeof field.get === 'function') return field.get()
    return field
  }
  // 不补默认值：缺少的 accepted Setting 由 Backend fail closed，而不是替用户猜值。
  return {
    captureEnabled: read(accepted?.captureEnabled),
    saveDirectory: read(accepted?.saveDirectory),
    saveFormat: read(accepted?.saveFormat),
    fileNamePattern: read(accepted?.fileNamePattern),
  } as WindowSavePreferences
}

export type { CaptureFrame }
