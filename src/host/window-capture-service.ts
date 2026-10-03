/**
 * [INPUT]: 依赖官方 Typert Remote stream、accepted pdsh Settings、universal macOS/Windows x64 helper、Host logger 与同 namespace 保存后端。
 * [OUTPUT]: 提供 `pdshNativeWindowCapture.capture/save` 与不含内容/路径的固定状态诊断；按 Host 平台解析包内 helper，构造不授权、不取像、不写文件。
 * [POS]: 唯一 capture capability adapter；统一拥有 captureEnabled generation，原生失败在协议折叠前仅记白名单码。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { RemoteStream } from '@deepseek-ai/dsh-typert-protocol'
import { createClickCapture, resolveNativeCaptureHelperPath, runNativeCapture, isNativeCaptureFailureCode } from './native-window-capture.ts'
import type { NativeCaptureFailureCode } from './native-window-capture.ts'
import { createWindowSaveBackend } from './window-save-backend.ts'
import type { WindowSavePreferences } from './window-save-backend.ts'
import type { WindowSaveFrame, WindowSaveInputFrame, WindowSaveRequest } from '../shared/window-save-protocol.ts'
import { CAPTURE_FAILURE_CODES } from '../shared/window-capture-protocol.ts'
import type { CaptureFrame } from '../shared/window-capture-protocol.ts'
import { createCaptureFrameStream, createCaptureServiceLifetime } from './window-capture-stream.ts'
import type { CaptureServiceLifetime } from './window-capture-stream.ts'

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

/** 单 Cordis service 拥有 camera 与 save；二者只通过官方 Remote stream 传递像素。 */
export class WindowCaptureService extends TypertRemoteService {
  static inject = ['typert', 'settings']

  private readonly lifetime: CaptureServiceLifetime = createCaptureServiceLifetime()
  private readonly saveBackend = createWindowSaveBackend({
    preferences: () => acceptedWindowSavePreferences(this.ctx as HostServiceContext),
  })
  private disposal: Promise<void> | undefined

  constructor(ctx: Context) {
    super(ctx, 'pdshWindowCapture', { namespace: 'pdshNativeWindowCapture' })
    const serviceContext = this.ctx as HostServiceContext
    const enabled = acceptedWindowSavePreferences(serviceContext).captureEnabled === true
    this.lifetime.setEnabled(enabled)
    logCaptureObservation(this.ctx, 'service-mounted', enabled)
    serviceContext.effect(() => () => this.dispose(), 'pdsh-window-capture: close streams and helper')
  }

  /** 权限只在该 Remote iterable 首次被拉取时经原生 helper 请求。 */
  @Remote({ mode: 'stream' })
  capture(signal: AbortSignal): AsyncIterable<CaptureFrame> {
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
            helperPath: resolveNativeCaptureHelperPath(process.platform, process.arch, import.meta.url),
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
  @Remote({ mode: 'stream' })
  save(request: WindowSaveRequest, signal: AbortSignal): RemoteStream<WindowSaveFrame, WindowSaveInputFrame> {
    const ctx = this.ctx as HostServiceContext
    const invocation = ctx.invocation
    if (!invocation) throw new Error('Window save requires an active Remote invocation')
    return this.saveBackend.save(request, {
      signal,
      lifetimeSignal: this.lifetime.signal,
      uplink: invocation.uplink<WindowSaveInputFrame>(),
    }) as RemoteStream<WindowSaveFrame, WindowSaveInputFrame>
  }

  /** 由 Config owner 的 owner-scoped volatile listener 同步调用。 */
  refreshCaptureEnabled(): void {
    const preferences = acceptedWindowSavePreferences(this.ctx as HostServiceContext)
    const enabled = preferences.captureEnabled === true
    this.lifetime.setEnabled(enabled)
    logCaptureObservation(this.ctx, 'enabled', enabled)
  }

  private dispose(): Promise<void> {
    if (!this.disposal) {
      // +--- 两路在同一个 synchronous turn 收到 abort；关闭等待真实 helper/write settle ---+
      this.disposal = Promise.all([this.lifetime.dispose(), this.saveBackend.dispose()]).then(() => undefined)
    }
    return this.disposal
  }
}

function acceptedWindowSavePreferences(ctx: HostServiceContext): WindowSavePreferences {
  const accepted = ctx.settings.describe().find(section => section.ns === 'pdsh')?.value
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
