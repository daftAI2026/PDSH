/**
 * [INPUT]: 依赖受信 native PNG/可选 viewport 结果、shared 硬预算与 Remote carrier/lifetime signal。
 * [OUTPUT]: 提供惰性、单航班 capture iterable；viewport 只留 Host 内部，完整结束后才通知终态。
 * [POS]: Host capture effect 的纯编排边界；不创建 service、不认窗口、不写截图文件。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { CAPTURE_LIMITS, CAPTURE_FAILURE_CODES } from '../shared/window-capture-protocol.ts'
import type { CaptureFailureCode, CaptureFrame, CapturePhase } from '../shared/window-capture-protocol.ts'

export interface NativeCaptureResult {
  readonly png: Buffer
  readonly width: number
  readonly height: number
  readonly pointPixelScale: number
  readonly scope: 'owned-window'
  readonly viewport?: NativeCaptureViewport
}

export interface NativeCaptureViewport {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export type CaptureOperation = (options: {
  readonly signal: AbortSignal
  readonly onPhase: (phase: CapturePhase) => void
}) => Promise<NativeCaptureResult>

export interface CaptureReservation {
  track(operation: Promise<void>): void
  release(): void
}

export interface CaptureServiceLifetime {
  readonly signal: AbortSignal
  reserve(): CaptureReservation | 'busy' | 'disposed'
  setEnabled(enabled: boolean): void
  dispose(): Promise<void>
}

export interface CaptureFrameStreamOptions {
  readonly signal: AbortSignal
  readonly lifetimeSignal: AbortSignal
  readonly capture: CaptureOperation
  readonly reserve: () => CaptureReservation | 'busy' | 'disposed'
}

/** Service 活跃期间最多一张 native capture；设置撤回以同步 abort 开新 generation。 */
export function createCaptureServiceLifetime(): CaptureServiceLifetime {
  let state: 'active' | 'disposing' | 'disposed' = 'active'
  let enabled = true
  let generation = new AbortController()
  let reserved = false
  let operation: Promise<void> | undefined
  let releaseFlight: (() => void) | undefined
  let disposal: Promise<void> | undefined

  const release = (): void => {
    reserved = false
    operation = undefined
    releaseFlight = undefined
    if (state === 'disposing') state = 'disposed'
  }

  return {
    get signal() { return generation.signal },
    reserve() {
      if (state !== 'active' || !enabled) return 'disposed'
      if (reserved) return 'busy'
      reserved = true
      let released = false
      const unlock = (): void => {
        if (released) return
        released = true
        release()
      }
      releaseFlight = unlock
      return {
        track(pending) { operation = pending.then(() => undefined, () => undefined) },
        release: unlock,
      }
    },
    setEnabled(value) {
      if (state !== 'active' || value === enabled) return
      enabled = value
      if (!enabled) generation.abort()
      else generation = new AbortController()
    },
    dispose() {
      if (disposal) return disposal
      if (state === 'disposed') return Promise.resolve()
      state = 'disposing'
      generation.abort()
      disposal = (async () => {
        const current = operation
        if (current) await current
        releaseFlight?.()
        state = 'disposed'
      })()
      return disposal
    },
  }
}

/** 创建不触发采集的 AsyncIterable；权限/像素只在首个 next 后请求。 */
export function createCaptureFrameStream(options: CaptureFrameStreamOptions): AsyncIterable<CaptureFrame> {
  return { [Symbol.asyncIterator]: () => iterateCaptureFrames(options) }
}

// +--- 仅自然结束提交终态；return/throw 都撤销待提交候选。 ---+
export async function* observeCaptureFrameCompletion(
  frames: AsyncIterable<CaptureFrame>,
  onSettle: (status: Extract<CaptureFrame, { type: 'terminal' }>['status'] | undefined) => void,
): AsyncGenerator<CaptureFrame> {
  let terminalStatus: Extract<CaptureFrame, { type: 'terminal' }>['status'] | undefined
  let completed = false
  try {
    for await (const frame of frames) {
      if (frame.type === 'terminal') terminalStatus = frame.status
      yield frame
    }
    completed = true
  } finally {
    onSettle(completed ? terminalStatus : undefined)
  }
}

async function* iterateCaptureFrames({ signal, lifetimeSignal, capture, reserve }: CaptureFrameStreamOptions): AsyncGenerator<CaptureFrame> {
  const reservation = reserve()
  if (reservation === 'busy' || reservation === 'disposed') {
    yield { type: 'terminal', status: reservation }
    return
  }

  const aborter = new AbortController()
  let phase: CapturePhase | undefined
  const phaseFrames: Extract<CaptureFrame, { type: 'phase' }>[] = []
  let result: NativeCaptureResult | undefined
  let failure: unknown
  let settled = false
  let wake: (() => void) | undefined
  const notify = (): void => { wake?.(); wake = undefined }
  const abort = (): void => {
    if (!aborter.signal.aborted) aborter.abort()
    result = undefined
    phaseFrames.length = 0
    notify()
  }
  const signals = [signal, lifetimeSignal]
  for (const source of signals) source.addEventListener('abort', abort, { once: true })
  if (signals.some(source => source.aborted)) abort()

  const capturePromise = Promise.resolve().then(() => {
    if (aborter.signal.aborted) throw new CaptureFailure('cancelled')
    return capture({
      signal: aborter.signal,
      onPhase(next) {
        if (aborter.signal.aborted) return
        if (!['authorization-required', 'capture-ready'].includes(next)
          || (next === 'authorization-required' && phase !== undefined)
          || (next === 'capture-ready' && phase === 'capture-ready')) {
          throw new CaptureFailure('helper-protocol-invalid')
        }
        phase = next
        phaseFrames.push({ type: 'phase', phase: next })
        notify()
      },
    })
  }).then(
    value => { if (!aborter.signal.aborted) result = value; settled = true; notify() },
    error => { failure = error; settled = true; notify() },
  )
  reservation.track(capturePromise)

  try {
    while (phaseFrames.length > 0 || !settled) {
      if (aborter.signal.aborted) { phaseFrames.length = 0; break }
      if (phaseFrames.length) { yield phaseFrames.shift()!; continue }
      if (settled) break
      await new Promise<void>(resolve => {
        wake = resolve
        if (phaseFrames.length || settled || aborter.signal.aborted) notify()
      })
    }
    if (aborter.signal.aborted) { yield { type: 'terminal', status: 'cancelled' }; return }
    if (failure !== undefined) { yield { type: 'terminal', status: failureCode(failure) }; return }
    if (result === undefined || phase !== 'capture-ready' || !validResult(result)) {
      yield { type: 'terminal', status: 'metadata-mismatch' }
      return
    }

    const chunkCount = Math.ceil(result.png.length / CAPTURE_LIMITS.pngChunkBytes)
    yield {
      type: 'image', scope: 'owned-window', width: result.width, height: result.height,
      pointPixelScale: result.pointPixelScale, pngBytes: result.png.length, chunkCount,
    }
    for (let index = 0; index < chunkCount; index++) {
      if (aborter.signal.aborted) { yield { type: 'terminal', status: 'cancelled' }; return }
      const start = index * CAPTURE_LIMITS.pngChunkBytes
      const end = Math.min(start + CAPTURE_LIMITS.pngChunkBytes, result.png.length)
      yield { type: 'chunk', index, base64: result.png.subarray(start, end).toString('base64') }
    }
    if (aborter.signal.aborted) { yield { type: 'terminal', status: 'cancelled' }; return }
    yield { type: 'terminal', status: 'captured' }
  } finally {
    abort()
    for (const source of signals) source.removeEventListener('abort', abort)
    await capturePromise
    reservation.release()
  }
}

function validResult(result: NativeCaptureResult): boolean {
  return Buffer.isBuffer(result.png)
    && result.png.length >= 33
    && result.png.length <= CAPTURE_LIMITS.maxBytes
    && Number.isSafeInteger(result.width) && result.width > 0
    && Number.isSafeInteger(result.height) && result.height > 0
    && result.width <= CAPTURE_LIMITS.maxPixels / result.height
    && Number.isFinite(result.pointPixelScale) && result.pointPixelScale > 0
    && result.scope === 'owned-window'
    && Math.ceil(result.png.length / CAPTURE_LIMITS.pngChunkBytes) <= CAPTURE_LIMITS.maxChunks
}

const FAILURE_CODES = new Set<CaptureFailureCode>(CAPTURE_FAILURE_CODES)

function failureCode(error: unknown): CaptureFailureCode {
  const code = (error as { code?: unknown })?.code
  return typeof code === 'string' && FAILURE_CODES.has(code as CaptureFailureCode)
    ? code as CaptureFailureCode
    : 'helper-failed'
}

class CaptureFailure extends Error {
  readonly code: CaptureFailureCode | 'helper-protocol-invalid'
  constructor(code: CaptureFailureCode | 'helper-protocol-invalid') {
    super(code)
    this.code = code
  }
}
