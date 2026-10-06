/**
 * [INPUT]: 依赖shared壁纸DTO/硬预算、accepted capture开关、Host helper结果与共享capture生命周期预留。
 * [OUTPUT]: 提供惰性list/load AsyncIterable与含证书拒绝的固定失败终态；图像在helper真实结束后按32KiB发送，取消保留锁至settle。
 * [POS]: `pdshWindowCapture`中的壁纸流编排；不创建service、不联网、不持久化素材或用户配置。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { WALLPAPER_LIMITS, isSystemWallpaperId, isSystemWallpaperName } from '../shared/system-wallpaper-protocol.ts'
import type {
  SystemWallpaperId,
  WallpaperCatalogEntry,
  WallpaperFrame,
  WallpaperRequest,
  WallpaperStatus,
} from '../shared/system-wallpaper-protocol.ts'
import { NativeWallpaperFailure, readJpegDimensions } from './system-wallpaper-native.ts'
import type { NativeWallpaperImage } from './system-wallpaper-native.ts'

export interface WallpaperReservation {
  track(operation: Promise<void>): void
  release(): void
}

export interface SystemWallpaperStreamOptions {
  readonly request: WallpaperRequest
  readonly signal: AbortSignal
  readonly lifetimeSignal: AbortSignal
  readonly platform: string
  readonly enabled: () => boolean
  readonly disposed: () => boolean
  readonly reserve: () => WallpaperReservation | 'busy' | 'disposed'
  readonly list: (signal: AbortSignal) => Promise<WallpaperCatalogEntry[]>
  readonly load: (
    id: SystemWallpaperId,
    signal: AbortSignal,
    onPhase: (phase: 'downloading' | 'decoding') => void,
  ) => Promise<NativeWallpaperImage>
}

interface IteratorControl {
  returning: boolean
}

/** 创建流本身不调用helper、不联网、不读取设置；只在第一次next后进行工作。 */
export function createSystemWallpaperStream(options: SystemWallpaperStreamOptions): AsyncIterable<WallpaperFrame> {
  return {
    [Symbol.asyncIterator]() {
      const aborter = new AbortController()
      const control: IteratorControl = { returning: false }
      const iterator = iterateSystemWallpaper(options, aborter, control)
      return {
        next: (value?: unknown) => iterator.next(value),
        return: (value?: unknown) => {
          control.returning = true
          if (!aborter.signal.aborted) aborter.abort()
          return iterator.return(value as never)
        },
        throw: (error?: unknown) => {
          control.returning = true
          if (!aborter.signal.aborted) aborter.abort()
          return iterator.throw(error)
        },
      }
    },
  }
}

async function* iterateSystemWallpaper(
  options: SystemWallpaperStreamOptions,
  operationAborter: AbortController,
  control: IteratorControl,
): AsyncGenerator<WallpaperFrame> {
  const terminal = (status: WallpaperStatus): WallpaperFrame => ({ type: 'terminal', status })
  if (!isValidRequest(options.request)) { yield terminal('invalid-request'); return }
  if (options.platform !== 'darwin') { yield terminal('unsupported-platform'); return }
  if (options.signal.aborted) { yield terminal('cancelled'); return }
  if (safeBoolean(options.disposed)) { yield terminal('disposed'); return }
  if (!safeBoolean(options.enabled)) { yield terminal('not-enabled'); return }

  const reservation = options.reserve()
  if (reservation === 'busy') { yield terminal('busy'); return }
  if (reservation === 'disposed') {
    yield terminal(safeBoolean(options.disposed) ? 'disposed' : 'not-enabled')
    return
  }

  const phaseQueue: Array<Extract<WallpaperFrame, { type: 'phase' }>> = []
  const signals = [options.signal, options.lifetimeSignal]
  let wake: (() => void) | undefined
  let settled = false
  let result: WallpaperCatalogEntry[] | NativeWallpaperImage | undefined
  let operationFailure: unknown
  let failed = false
  const notify = (): void => { wake?.(); wake = undefined }
  const abortOperation = (): void => {
    if (!operationAborter.signal.aborted) operationAborter.abort()
    phaseQueue.length = 0
    notify()
  }
  for (const signal of signals) signal.addEventListener('abort', abortOperation, { once: true })
  if (signals.some(signal => signal.aborted)) abortOperation()

  const operation = Promise.resolve().then(async () => {
    if (operationAborter.signal.aborted) throw new NativeWallpaperFailure('cancelled')
    if (options.request.kind === 'list') return options.list(operationAborter.signal)
    return options.load(options.request.id as SystemWallpaperId, operationAborter.signal, phase => {
      if (operationAborter.signal.aborted) return
      if (phaseQueue.length >= 2 || !['downloading', 'decoding'].includes(phase)) {
        throw new NativeWallpaperFailure('protocol-invalid')
      }
      phaseQueue.push({ type: 'phase', phase })
      notify()
    })
  }).then(
    value => { if (!operationAborter.signal.aborted) result = value; settled = true; notify() },
    error => { operationFailure = error; failed = true; settled = true; notify() },
  )
  reservation.track(operation.then(() => undefined))

  try {
    while (phaseQueue.length || !settled) {
      if (control.returning) return
      if (phaseQueue.length) { yield phaseQueue.shift()!; continue }
      if (settled) break
      await new Promise<void>(resolve => {
        wake = resolve
        if (phaseQueue.length || settled || control.returning) notify()
      })
    }
    if (control.returning) return
    if (options.signal.aborted || options.lifetimeSignal.aborted) { yield terminal('cancelled'); return }
    if (safeBoolean(options.disposed)) { yield terminal('disposed'); return }
    if (failed) { yield terminal(failureStatus(operationFailure)); return }

    if (options.request.kind === 'list') {
      const entries = validateCatalog(result)
      yield { type: 'catalog', entries }
      yield terminal('listed')
      return
    }

    const image = validateImage(result, options.request.id)
    const chunkCount = Math.ceil(image.jpeg.length / WALLPAPER_LIMITS.chunkBytes)
    yield {
      type: 'image', id: image.id, sourceType: image.sourceType,
      width: image.width, height: image.height, jpegBytes: image.jpeg.length, chunkCount,
    }
    for (let index = 0; index < chunkCount; index++) {
      if (control.returning) return
      if (options.signal.aborted || options.lifetimeSignal.aborted) { yield terminal('cancelled'); return }
      const start = index * WALLPAPER_LIMITS.chunkBytes
      const end = Math.min(start + WALLPAPER_LIMITS.chunkBytes, image.jpeg.length)
      yield { type: 'chunk', index, base64: image.jpeg.subarray(start, end).toString('base64') }
    }
    if (control.returning) return
    if (options.signal.aborted || options.lifetimeSignal.aborted) { yield terminal('cancelled'); return }
    yield terminal('loaded')
  } finally {
    abortOperation()
    for (const signal of signals) signal.removeEventListener('abort', abortOperation)
    await operation
    result = undefined
    reservation.release()
  }
}

function isValidRequest(request: unknown): request is WallpaperRequest {
  if (!isRecord(request)) return false
  if (request.kind === 'list') return Object.keys(request).length === 1 && Object.hasOwn(request, 'kind')
  return request.kind === 'load' && Object.keys(request).length === 2
    && Object.hasOwn(request, 'kind') && Object.hasOwn(request, 'id') && isSystemWallpaperId(request.id)
}

function validateCatalog(value: unknown): WallpaperCatalogEntry[] {
  if (!Array.isArray(value) || value.length > WALLPAPER_LIMITS.maxCatalogEntries) {
    throw new NativeWallpaperFailure('protocol-invalid')
  }
  const entries: WallpaperCatalogEntry[] = []
  const seen = new Set<string>()
  for (const entry of value) {
    if (!isRecord(entry) || !isSystemWallpaperId(entry.id) || seen.has(entry.id)
      || !isSystemWallpaperName(entry.name)
      || typeof entry.available !== 'boolean' || typeof entry.downloadable !== 'boolean') {
      throw new NativeWallpaperFailure('protocol-invalid')
    }
    seen.add(entry.id)
    entries.push({ id: entry.id, name: entry.name, available: entry.available, downloadable: entry.downloadable })
  }
  return entries
}

function validateImage(value: unknown, expectedId: string): NativeWallpaperImage {
  if (!isRecord(value) || !isSystemWallpaperId(value.id) || value.id !== expectedId
    || (value.sourceType !== 'image' && value.sourceType !== 'video')
    || !Buffer.isBuffer(value.jpeg) || value.jpeg.length < 12 || value.jpeg.length > WALLPAPER_LIMITS.maxBytes
    || typeof value.width !== 'number' || typeof value.height !== 'number'
    || !Number.isSafeInteger(value.width) || !Number.isSafeInteger(value.height)
    || value.width < 1 || value.height < 1 || value.width > WALLPAPER_LIMITS.maxDimension
    || value.height > WALLPAPER_LIMITS.maxDimension) throw new NativeWallpaperFailure('protocol-invalid')
  const actual = readJpegDimensions(value.jpeg)
  if (actual.width !== value.width || actual.height !== value.height) throw new NativeWallpaperFailure('protocol-invalid')
  return { id: value.id, sourceType: value.sourceType, width: value.width, height: value.height, jpeg: value.jpeg }
}

const PUBLIC_FAILURES = new Set<WallpaperStatus>([
  'unavailable', 'download-failed', 'download-certificate-failed', 'decode-failed', 'protocol-invalid', 'byte-budget-exceeded', 'helper-failed',
])

function failureStatus(error: unknown): WallpaperStatus {
  const code = error && typeof error === 'object' ? (error as { code?: unknown }).code : undefined
  return typeof code === 'string' && PUBLIC_FAILURES.has(code as WallpaperStatus)
    ? code as WallpaperStatus
    : 'helper-failed'
}

function safeBoolean(read: () => boolean): boolean {
  try { return read() === true } catch { return false }
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
