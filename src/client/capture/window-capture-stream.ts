/**
 * [INPUT]: 依赖一个生成的 RemoteStreamHandle、fixed CaptureFrame 与浏览器 Image/Blob URL。
 * [OUTPUT]: 单次校验 PNG 后交付本地 URL；可选几何查询绑定同张 PNG 摘要，扩展失败保留照片。
 * [POS]: Client 数据边界；载荷只驻留内存，失败/取消撤销临时 URL，不做重连或再次采集。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { RemoteStreamHandle } from '@deepseek-ai/dsh-typert-protocol'
import { CAPTURE_LIMITS, CAPTURE_FAILURE_CODES } from '../../shared/window-capture-protocol.ts'
import type { CaptureFailureCode, CaptureFrame, CapturePhase } from '../../shared/window-capture-protocol.ts'
import { isCaptureGeometry, CAPTURE_GEOMETRY_QUERY_TIMEOUT_MS, type CaptureGeometry } from '../../shared/capture-geometry.ts'

/** 经净化的固定 Client 结果码；原始 carrier error 不越过此边界。 */
export type CaptureClientErrorCode = CaptureFailureCode | 'invalid-capture' | 'stream-failed' | 'runtime-not-current'

/** 只包含公开结果码的固定错误对象，版本不匹配为 Client 本地码，不改变 Host wire。 */
export class CaptureClientError extends Error {
  readonly code: CaptureClientErrorCode

  constructor(code: CaptureClientErrorCode) {
    super(code)
    this.name = 'CaptureClientError'
    this.code = code
  }
}

/** 一个已由浏览器接受、由调用方管理的本地 Blob URL。 */
export interface LocalCapture {
  readonly url: string
  readonly width: number
  readonly height: number
  readonly pointPixelScale: number
  readonly scope: 'owned-window'
  readonly geometry?: CaptureGeometry
  release(): void
}

/** 注入接缝只替换浏览器 API，不引入新网络或持久化路径。 */
export interface ConsumeCaptureOptions {
  readonly signal?: AbortSignal
  readonly createObjectURL?: (blob: Blob) => string
  readonly revokeObjectURL?: (url: string) => void
  readonly decode?: (url: string, expected: { width: number; height: number }, signal?: AbortSignal) => Promise<{ width: number; height: number }>
  readonly onProgress?: (phase: CapturePhase) => void
  readonly crypto?: Pick<Crypto, 'subtle'>
  readonly readGeometry?: (pngSha256: string, signal?: AbortSignal) => Promise<unknown>
}

interface CaptureRemoteMethod {
  (signal?: AbortSignal): RemoteStreamHandle<CaptureFrame, never>
}

/** 只打开一次 endpoint、持有一个 handle 并校验单张图片；不重试、不走 supervisor 路径。 */
export async function consumeCaptureOnce(
  open: CaptureRemoteMethod,
  options: ConsumeCaptureOptions = {},
): Promise<LocalCapture> {
  const signal = options.signal
  if (signal?.aborted) throw new CaptureClientError('cancelled')
  let handle: RemoteStreamHandle<CaptureFrame, never> | undefined
  let url: string | undefined
  let succeeded = false
  let primaryError: CaptureClientError | undefined
  try {
    handle = open(signal)
    const png = await receiveFrames(handle, signal, options.onProgress)
    validatePngEnvelope(png.bytes, png.width, png.height)
    const blobBytes = new Uint8Array(png.bytes.byteLength)
    blobBytes.set(png.bytes)
    const blob = new Blob([blobBytes.buffer], { type: 'image/png' })
    const create = options.createObjectURL ?? (value => URL.createObjectURL(value))
    const revoke = options.revokeObjectURL ?? (value => URL.revokeObjectURL(value))
    url = create(blob)
    const decoded = await awaitDecode(
      options.decode ?? decodeBrowserImage,
      url,
      { width: png.width, height: png.height },
      signal,
    )
    if (signal?.aborted) throw new CaptureClientError('cancelled')
    if (decoded.width !== png.width || decoded.height !== png.height) {
      throw new CaptureClientError('invalid-capture')
    }
    const geometry = await readOptionalGeometry(png, options)
    if (signal?.aborted) throw new CaptureClientError('cancelled')
    succeeded = true
    let released = false
    return {
      url,
      width: png.width,
      height: png.height,
      scope: 'owned-window',
      pointPixelScale: png.pointPixelScale,
      ...(geometry ? { geometry } : {}),
      release() {
        if (released) return
        released = true
        revoke(url as string)
      },
    }
  } catch (error) {
    primaryError = sanitizeError(error, signal)
    throw primaryError
  } finally {
    if (handle !== undefined) {
      try { await handle.dispose() } catch {
        if (primaryError === undefined && succeeded) {
          if (url !== undefined) (options.revokeObjectURL ?? URL.revokeObjectURL)(url)
          throw new CaptureClientError('stream-failed')
        }
      }
    }
    if (!succeeded && url !== undefined) {
      try { (options.revokeObjectURL ?? URL.revokeObjectURL)(url) } catch { /* 仅释放本地 Blob URL。 */ }
    }
  }
}

interface ReceivedPng { readonly bytes: Uint8Array; readonly width: number; readonly height: number; readonly pointPixelScale: number }

/** 元数据超时只撤回候选；取消仍归还 carrier 和 Blob URL。 */
async function readOptionalGeometry(png: ReceivedPng, options: ConsumeCaptureOptions): Promise<CaptureGeometry | undefined> {
  if (!options.readGeometry) return undefined
  const crypto = options.crypto ?? globalThis.crypto
  if (!crypto?.subtle || options.signal?.aborted) return undefined
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout>, onAbort: (() => void) | undefined, active = true
  const stopped = new Promise<undefined>(resolve => {
    onAbort = () => { controller.abort(); resolve(undefined) }
    timer = setTimeout(onAbort, CAPTURE_GEOMETRY_QUERY_TIMEOUT_MS)
    options.signal?.addEventListener('abort', onAbort, { once: true })
    if (options.signal?.aborted) onAbort()
  })
  try {
    const pending = (async () => {
      const digest = await crypto.subtle.digest('SHA-256', png.bytes as Uint8Array<ArrayBuffer>)
      if (!active || options.signal?.aborted) return undefined
      const sha = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
      const value = await options.readGeometry(sha, controller.signal)
      return isCaptureGeometry(value, png) ? { ...value } : undefined
    })().catch(() => undefined)
    return await Promise.race([pending, stopped])
  } finally {
    active = false
    controller.abort()
    clearTimeout(timer)
    if (onAbort) options.signal?.removeEventListener('abort', onAbort)
  }
}

async function receiveFrames(
  handle: RemoteStreamHandle<CaptureFrame, never>,
  signal: AbortSignal | undefined,
  onProgress: ConsumeCaptureOptions['onProgress'],
): Promise<ReceivedPng> {
  let authorizationSeen = false
  let captureReady = false
  let metadata: Extract<CaptureFrame, { type: 'image' }> | undefined
  let chunks: Uint8Array[] = []
  let receivedBytes = 0
  let terminal = false
  let completed: ReceivedPng | undefined
  try {
    for await (const frame of handle) {
      if (signal?.aborted) throw new CaptureClientError('cancelled')
      if (terminal) throw new CaptureClientError('invalid-capture')
      if (frame.type === 'phase') {
        if (frame.phase === 'authorization-required') {
          if (authorizationSeen || captureReady || metadata !== undefined) throw new CaptureClientError('invalid-capture')
          authorizationSeen = true
        } else if (frame.phase === 'capture-ready') {
          if (captureReady || metadata !== undefined) throw new CaptureClientError('invalid-capture')
          captureReady = true
        } else throw new CaptureClientError('invalid-capture')
        try { onProgress?.(frame.phase) } catch { /* UI 回调不得改变传输结果。 */ }
        continue
      }
      if (frame.type === 'image') {
        if (!captureReady || metadata !== undefined || frame.scope !== 'owned-window'
          || !Number.isSafeInteger(frame.width) || frame.width < 1
          || !Number.isSafeInteger(frame.height) || frame.height < 1
          || frame.width > CAPTURE_LIMITS.maxPixels / frame.height
          || !Number.isFinite(frame.pointPixelScale) || frame.pointPixelScale <= 0
          || !Number.isSafeInteger(frame.pngBytes) || frame.pngBytes < 33 || frame.pngBytes > CAPTURE_LIMITS.maxBytes
          || !Number.isSafeInteger(frame.chunkCount) || frame.chunkCount < 1 || frame.chunkCount > CAPTURE_LIMITS.maxChunks
          || frame.chunkCount !== Math.ceil(frame.pngBytes / CAPTURE_LIMITS.pngChunkBytes)) {
          throw new CaptureClientError('invalid-capture')
        }
        metadata = frame
        chunks = []
        continue
      }
      if (frame.type === 'chunk') {
        if (metadata === undefined || chunks.length >= metadata.chunkCount || frame.index !== chunks.length) {
          throw new CaptureClientError('invalid-capture')
        }
        const expectedBytes = Math.min(
          CAPTURE_LIMITS.pngChunkBytes,
          metadata.pngBytes - receivedBytes,
        )
        const decoded = decodeBase64Chunk(frame.base64, expectedBytes)
        receivedBytes += decoded.length
        if (receivedBytes > metadata.pngBytes || receivedBytes > CAPTURE_LIMITS.maxBytes) {
          throw new CaptureClientError('invalid-capture')
        }
        chunks.push(decoded)
        continue
      }
      if (frame.type === 'terminal') {
        terminal = true
        if (frame.status !== 'captured') {
          if (!isCaptureFailure(frame.status)) throw new CaptureClientError('invalid-capture')
          throw new CaptureClientError(frame.status)
        }
        if (metadata === undefined || chunks.length !== metadata.chunkCount || receivedBytes !== metadata.pngBytes) {
          throw new CaptureClientError('invalid-capture')
        }
        const bytes = new Uint8Array(receivedBytes)
        let offset = 0
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
        chunks = []
        completed = { bytes, width: metadata.width, height: metadata.height, pointPixelScale: metadata.pointPixelScale }
        continue
      }
      throw new CaptureClientError('invalid-capture')
    }
  } catch (error) {
    chunks = []
    if (error instanceof CaptureClientError) throw error
    if (signal?.aborted) throw new CaptureClientError('cancelled')
    throw new CaptureClientError('stream-failed')
  }
  if (completed === undefined) throw new CaptureClientError('invalid-capture')
  return completed
}

function decodeBase64Chunk(value: string, expectedBytes: number): Uint8Array {
  if (typeof value !== 'string' || value.length === 0 || value.length > Math.ceil(CAPTURE_LIMITS.pngChunkBytes / 3) * 4
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)
    || value.length !== Math.ceil(expectedBytes / 3) * 4) throw new CaptureClientError('invalid-capture')
  let binary: string
  try { binary = atob(value) } catch { throw new CaptureClientError('invalid-capture') }
  if (binary.length !== expectedBytes) throw new CaptureClientError('invalid-capture')
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function validatePngEnvelope(bytes: Uint8Array, expectedWidth: number, expectedHeight: number): void {
  const fail = (): never => { throw new CaptureClientError('invalid-capture') }
  if (bytes.length < 33 || bytes.length > CAPTURE_LIMITS.maxBytes
    || !bytes.subarray(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index])) fail()
  let offset = 8, count = 0, seenData = false, dataEnded = false, dataBytes = 0, palette = false
  while (offset < bytes.length) {
    if (++count > 65_536 || bytes.length - offset < 12) fail()
    const length = readU32(bytes, offset)
    const end = offset + length + 12
    if (end > bytes.length) fail()
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    if (!/^[A-Za-z]{4}$/.test(type) || (bytes[offset + 6] & 32) !== 0
      || crc32(bytes.subarray(offset + 4, end - 4)) !== readU32(bytes, end - 4)) fail()
    if (count === 1) {
      if (type !== 'IHDR' || length !== 13) fail()
      const width = readU32(bytes, offset + 8), height = readU32(bytes, offset + 12)
      const depth = bytes[offset + 16], color = bytes[offset + 17]
      const legalDepth: Record<number, readonly number[]> = {
        0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16],
      }
      if (width !== expectedWidth || height !== expectedHeight || !legalDepth[color]?.includes(depth)
        || bytes[offset + 18] !== 0 || bytes[offset + 19] !== 0 || ![0, 1].includes(bytes[offset + 20])) fail()
    } else if (type === 'IHDR') fail()
    else if (type === 'PLTE') {
      if (palette || seenData || length < 3 || length > 768 || length % 3) fail()
      palette = true
    } else if (type === 'IDAT') {
      if (dataEnded) fail()
      seenData = true; dataBytes += length
    } else if (type === 'IEND') {
      if (length !== 0 || !seenData || dataBytes === 0 || end !== bytes.length) fail()
      return
    } else {
      if (seenData) dataEnded = true
      if (/^[A-Z]/.test(type) || ['acTL', 'fcTL', 'fdAT'].includes(type)) fail()
    }
    offset = end
  }
  fail()
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1)
  return crc >>> 0
})

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const value of bytes) crc = CRC_TABLE[(crc ^ value) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function readU32(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
}

function isCaptureFailure(value: unknown): value is CaptureFailureCode {
  return typeof value === 'string' && (CAPTURE_FAILURE_CODES as readonly string[]).includes(value)
}

function sanitizeError(error: unknown, signal?: AbortSignal): CaptureClientError {
  if (error instanceof CaptureClientError) return error
  if (signal?.aborted) return new CaptureClientError('cancelled')
  return new CaptureClientError('stream-failed')
}

async function awaitDecode(
  decode: NonNullable<ConsumeCaptureOptions['decode']>,
  url: string,
  expected: { width: number; height: number },
  signal?: AbortSignal,
): Promise<{ width: number; height: number }> {
  if (signal?.aborted) throw new CaptureClientError('cancelled')
  const pending = Promise.resolve().then(() => {
    if (signal?.aborted) throw new CaptureClientError('cancelled')
    return decode(url, expected, signal)
  })
  if (signal === undefined) return pending
  let onAbort: (() => void) | undefined
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(new CaptureClientError('cancelled'))
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
  })
  try {
    return await Promise.race([pending, aborted])
  } finally {
    if (onAbort !== undefined) signal.removeEventListener('abort', onAbort)
  }
}

function decodeBrowserImage(
  url: string,
  _expected: { width: number; height: number },
  signal?: AbortSignal,
): Promise<{ width: number; height: number }> {
  const image = new Image()
  return new Promise((resolve, reject) => {
    let finished = false
    const cleanup = (): void => {
      signal?.removeEventListener('abort', cancel)
      image.onload = null
      image.onerror = null
    }
    const cancel = (): void => {
      if (finished) return
      finished = true
      cleanup()
      image.removeAttribute('src')
      reject(new CaptureClientError('cancelled'))
    }
    signal?.addEventListener('abort', cancel, { once: true })
    if (signal?.aborted) { cancel(); return }
    image.src = url
    void image.decode().then(() => {
      if (finished) return
      if (signal?.aborted) { cancel(); return }
      const size = { width: image.naturalWidth, height: image.naturalHeight }
      finished = true
      cleanup()
      resolve(size)
    }, () => {
      if (finished) return
      finished = true
      cleanup()
      reject(new CaptureClientError('invalid-capture'))
    })
  })
}
