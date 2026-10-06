/**
 * [INPUT]: 依赖curl系统TLS、Host固定Apple Range请求、壁纸共享预算与AbortSignal；不读curlrc或配置TLS/proxy参数。
 * [OUTPUT]: 提供固定URL校验及严格单Range Response；验头后按Range预分配单Buffer，分片顺序拷入；分配失败映射固定码并等child close。
 * [POS]: downloader唯一系统curl传输适配；shell:false且等待child真实close，和DSH应用内fetch/proxy dispatcher明确隔离。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { spawn, type SpawnOptionsWithStdioTuple } from 'node:child_process'
import type { Readable } from 'node:stream'
import { WALLPAPER_LIMITS } from '../shared/system-wallpaper-protocol.ts'
import { NativeWallpaperFailure } from './system-wallpaper-native.ts'

const CURL_PATH = '/usr/bin/curl'
const MAX_HEADER_BYTES = 16 * 1024
const MAX_STDERR_BYTES = 1024
const FORCE_TIMEOUT_MS = 2_000
const START_TIMEOUT_MS = WALLPAPER_LIMITS.helperStartMs
const REQUEST_TIMEOUT_MS = WALLPAPER_LIMITS.downloadMs
const HEADER_END = Buffer.from('\r\n\r\n')
const STRONG_ETAG = /^"[\x21\x23-\x7e\x80-\xff]*"$/u
const RANGE = /^bytes=(0|[1-9]\d*)-(0|[1-9]\d*)$/u
const CONTENT_RANGE = /^bytes (0|[1-9]\d*)-(0|[1-9]\d*)\/([1-9]\d*)$/u
const STATUS_LINE = /^HTTP\/(?:1\.[01]|2|3) 206(?: [\x20-\x7e]*)?$/u
const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u
const APPLE_VIDEO_URL = /^https:\/\/sylvan\.apple\.com\/itunes-assets\/Aerials[0-9]+\/(?:[A-Za-z0-9._~-]+\/)*[A-Za-z0-9._~-]+\.mov$/u
const CERTIFICATE_EXIT_CODES = new Set([51, 60, 77])
const SUPPORTED_INIT_KEYS = new Set(['body', 'headers', 'method', 'redirect', 'signal'])

export interface WallpaperTransportChild {
  readonly stdout: Readable
  readonly stderr: Readable
  kill(signal: NodeJS.Signals): boolean
  on(event: 'spawn', listener: () => void): unknown
  on(event: 'error', listener: (error: Error) => void): unknown
  on(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown
  off(event: 'spawn', listener: () => void): unknown
  off(event: 'error', listener: (error: Error) => void): unknown
  off(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown
}

export type WallpaperTransportSpawnOptions = SpawnOptionsWithStdioTuple<'ignore', 'pipe', 'pipe'> & {
  readonly shell: false
}

export type WallpaperTransportSpawner = (
  file: string,
  args: readonly string[],
  options: WallpaperTransportSpawnOptions,
) => WallpaperTransportChild

export interface WallpaperTransportScheduler {
  set(callback: () => void, delayMs: number): unknown
  clear(handle: unknown): void
}

export interface WallpaperRangeFetcherOptions {
  readonly spawnProcess?: WallpaperTransportSpawner
  readonly scheduler?: WallpaperTransportScheduler
}

interface RequestPlan {
  readonly start: number
  readonly end: number
  readonly expectedBytes: number
  readonly ifMatch?: string
  readonly signal?: AbortSignal
}

interface ParsedHeaders {
  readonly values: ReadonlyMap<string, string>
  readonly contentRange: string
  readonly contentLength: number
  readonly etag: string
}

const defaultScheduler: WallpaperTransportScheduler = {
  set: (callback, delayMs) => setTimeout(callback, delayMs),
  clear: handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

const defaultSpawner: WallpaperTransportSpawner = (file, args, options) => spawn(file, [...args], options)

/** 固定来源允许未来Apple Aerial版本号前进，但不接收凭据、端口、查询、片段或编码路径。 */
export function isAppleWallpaperVideoUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !APPLE_VIDEO_URL.test(value)) return false
  const path = value.slice('https://sylvan.apple.com'.length).split(/[?#]/u, 1)[0] ?? ''
  if (path.split('/').some(segment => segment === '.' || segment === '..')) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && parsed.hostname === 'sylvan.apple.com'
      && parsed.username === '' && parsed.password === '' && parsed.port === ''
      && parsed.search === '' && parsed.hash === ''
      && parsed.pathname.split('/').every(segment => segment !== '.' && segment !== '..')
  } catch {
    return false
  }
}

/** Runtime只走固定系统curl；测试注入仅替换child与时钟，不替换URL规则或TLS参数。 */
export function fetchAppleWallpaperRange(url: string, init: RequestInit): Promise<Response> {
  return defaultRangeFetcher(url, init)
}

/** Fake child/时钟窄注入面，生产URL与curl选项仍由本模块封闭。 */
export function createAppleWallpaperRangeFetcher(options: WallpaperRangeFetcherOptions = {}) {
  const spawnProcess = options.spawnProcess ?? defaultSpawner
  const scheduler = options.scheduler ?? defaultScheduler

  return function fetchRange(url: string, init: RequestInit): Promise<Response> {
    let plan: RequestPlan
    try {
      plan = validateRequest(url, init)
    } catch (error) {
      return Promise.reject(error)
    }
    if (plan.signal?.aborted) return Promise.reject(new NativeWallpaperFailure('cancelled'))

    const args = curlArgs(url, plan)
    let child: WallpaperTransportChild
    try {
      child = spawnProcess(CURL_PATH, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false })
    } catch {
      return Promise.reject(new NativeWallpaperFailure('download-failed'))
    }

    return new Promise<Response>((resolve, reject) => {
      let failure: NativeWallpaperFailure | undefined
      let responseHeaders: ParsedHeaders | undefined
      let headerBytes: Buffer = Buffer.alloc(0)
      let body: Buffer<ArrayBuffer> | undefined
      let bodyBytes = 0
      let stdoutBytes = 0
      let stderrBytes = 0
      let settled = false
      let sawSpawn = false
      let startTimer: unknown
      let requestTimer: unknown
      let forceTimer: unknown

      const clearTimer = (handle: unknown): void => {
        if (handle !== undefined) scheduler.clear(handle)
      }
      const stopTimers = (): void => {
        clearTimer(startTimer); startTimer = undefined
        clearTimer(requestTimer); requestTimer = undefined
        clearTimer(forceTimer); forceTimer = undefined
      }
      const kill = (signal: NodeJS.Signals): void => {
        try { child.kill(signal) } catch { /* 不以kill返回值冒充child已关闭。 */ }
      }
      const fail = (code: 'cancelled' | 'download-failed' | 'byte-budget-exceeded'): void => {
        if (failure || settled) return
        failure = new NativeWallpaperFailure(code)
        clearTimer(startTimer); startTimer = undefined
        clearTimer(requestTimer); requestTimer = undefined
        body = undefined
        bodyBytes = 0
        headerBytes = Buffer.alloc(0)
        kill('SIGTERM')
        forceTimer = scheduler.set(() => {
          if (!settled) kill('SIGKILL')
        }, FORCE_TIMEOUT_MS)
      }
      const onAbort = (): void => fail('cancelled')
      const onSpawn = (): void => {
        if (sawSpawn || settled) return
        sawSpawn = true
        clearTimer(startTimer); startTimer = undefined
        requestTimer = scheduler.set(() => fail('download-failed'), REQUEST_TIMEOUT_MS)
      }
      const onProcessError = (): void => fail('download-failed')
      const onStdoutError = (): void => fail('download-failed')
      const onStderrError = (): void => fail('download-failed')

      const appendBody = (bytes: Buffer): void => {
        if (failure || settled || bytes.length === 0) return
        if (!body || bytes.length > plan.expectedBytes - bodyBytes) {
          fail('byte-budget-exceeded')
          return
        }
        bytes.copy(body, bodyBytes)
        bodyBytes += bytes.length
      }

      const onStdout = (chunk: Buffer | string): void => {
        if (failure || settled) return
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        stdoutBytes += bytes.length
        if (stdoutBytes > MAX_HEADER_BYTES + plan.expectedBytes) {
          fail('byte-budget-exceeded')
          return
        }
        if (responseHeaders) { appendBody(bytes); return }

        const pending = headerBytes.length === 0 ? bytes : Buffer.concat([headerBytes, bytes])
        const delimiter = pending.indexOf(HEADER_END)
        if (delimiter < 0) {
          if (pending.length > MAX_HEADER_BYTES) { fail('byte-budget-exceeded'); return }
          headerBytes = pending
          return
        }
        const completeHeaderBytes = delimiter + HEADER_END.length
        if (completeHeaderBytes > MAX_HEADER_BYTES) { fail('byte-budget-exceeded'); return }
        try {
          responseHeaders = parseResponseHeaders(pending.subarray(0, completeHeaderBytes), plan)
        } catch {
          fail('download-failed')
          return
        }
        try {
          body = Buffer.allocUnsafe(plan.expectedBytes)
        } catch {
          fail('download-failed')
          return
        }
        headerBytes = Buffer.alloc(0)
        appendBody(pending.subarray(completeHeaderBytes))
      }

      const onStderr = (chunk: Buffer | string): void => {
        if (failure || settled) return
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
        stderrBytes += bytes.length
        if (stderrBytes > MAX_STDERR_BYTES) fail('download-failed')
      }

      const removeListeners = (): void => {
        plan.signal?.removeEventListener('abort', onAbort)
        child.stdout.off('data', onStdout)
        child.stdout.off('error', onStdoutError)
        child.stderr.off('data', onStderr)
        child.stderr.off('error', onStderrError)
        child.off('spawn', onSpawn)
        child.off('error', onProcessError)
        child.off('close', onClose)
      }

      const onClose = (exitCode: number | null, exitSignal: NodeJS.Signals | null): void => {
        if (settled) return
        settled = true
        stopTimers()
        removeListeners()
        if (!sawSpawn && !failure) failure = new NativeWallpaperFailure('download-failed')
        if (!failure && exitCode !== 0) {
          failure = new NativeWallpaperFailure(exitCode !== null && CERTIFICATE_EXIT_CODES.has(exitCode)
            ? 'download-certificate-failed'
            : 'download-failed')
        }
        if (!failure && exitSignal !== null) failure = new NativeWallpaperFailure('download-failed')
        if (!failure && (!responseHeaders || headerBytes.length > 0 || bodyBytes !== plan.expectedBytes)) {
          failure = new NativeWallpaperFailure('download-failed')
        }
        if (failure || !body) {
          body = undefined
          reject(failure ?? new NativeWallpaperFailure('download-failed'))
          return
        }
        const responseBody = body
        body = undefined
        const headers = new Headers({
          'content-range': responseHeaders!.contentRange,
          'content-length': String(responseHeaders!.contentLength),
          etag: responseHeaders!.etag,
        })
        const encoding = responseHeaders!.values.get('content-encoding')
        if (encoding !== undefined) headers.set('content-encoding', encoding)
        resolve(new Response(responseBody, { status: 206, headers }))
      }

      child.stdout.on('data', onStdout)
      child.stdout.on('error', onStdoutError)
      child.stderr.on('data', onStderr)
      child.stderr.on('error', onStderrError)
      child.on('spawn', onSpawn)
      child.on('error', onProcessError)
      child.on('close', onClose)
      plan.signal?.addEventListener('abort', onAbort, { once: true })
      startTimer = scheduler.set(() => fail('download-failed'), START_TIMEOUT_MS)
      if (plan.signal?.aborted) onAbort()
    })
  }
}

const defaultRangeFetcher = createAppleWallpaperRangeFetcher()

function validateRequest(url: string, init: RequestInit): RequestPlan {
  if (!isAppleWallpaperVideoUrl(url) || !init || typeof init !== 'object'
    || Object.keys(init).some(key => !SUPPORTED_INIT_KEYS.has(key))
    || (init.method !== undefined && init.method !== 'GET') || init.redirect !== 'error'
    || (init.body !== undefined && init.body !== null)) {
    throw new NativeWallpaperFailure('invalid-request')
  }
  let headers: Headers
  try { headers = new Headers(init.headers) }
  catch { throw new NativeWallpaperFailure('invalid-request') }
  const entries = [...headers.keys()]
  if (entries.some(name => !['accept-encoding', 'if-match', 'range'].includes(name))
    || headers.get('accept-encoding') !== 'identity') {
    throw new NativeWallpaperFailure('invalid-request')
  }
  const match = headers.get('range')?.match(RANGE)
  if (!match) throw new NativeWallpaperFailure('invalid-request')
  const start = Number(match[1])
  const end = Number(match[2])
  const expectedBytes = end - start + 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start
    || end >= WALLPAPER_LIMITS.maxVideoSourceLength
    || !Number.isSafeInteger(expectedBytes) || expectedBytes < 1
    || expectedBytes > WALLPAPER_LIMITS.maxVideoSampleBytes) {
    throw new NativeWallpaperFailure('invalid-request')
  }
  const ifMatch = headers.get('if-match') ?? undefined
  if (ifMatch !== undefined && !STRONG_ETAG.test(ifMatch)) throw new NativeWallpaperFailure('invalid-request')
  if (headers.get('range') !== `bytes=${start}-${end}`) throw new NativeWallpaperFailure('invalid-request')
  const signal = init.signal ?? undefined
  if (signal !== undefined && (typeof signal.aborted !== 'boolean'
    || typeof signal.addEventListener !== 'function' || typeof signal.removeEventListener !== 'function')) {
    throw new NativeWallpaperFailure('invalid-request')
  }
  return { start, end, expectedBytes, ifMatch, signal }
}

function curlArgs(url: string, plan: RequestPlan): string[] {
  const args = [
    '--disable', '--silent', '--include',
    '--range', `${plan.start}-${plan.end}`,
    '--header', 'Accept-Encoding: identity',
  ]
  if (plan.ifMatch !== undefined) args.push('--header', `If-Match: ${plan.ifMatch}`)
  args.push(
    '--max-filesize', String(plan.expectedBytes),
    '--max-time', String(Math.ceil(REQUEST_TIMEOUT_MS / 1000)),
    '--suppress-connect-headers',
    '--output', '-',
    url,
  )
  return args
}

function parseResponseHeaders(bytes: Buffer, request: RequestPlan): ParsedHeaders {
  const text = bytes.toString('latin1')
  if (!text.endsWith('\r\n\r\n')) throw new NativeWallpaperFailure('download-failed')
  const lines = text.slice(0, -4).split('\r\n')
  const status = lines.shift()
  if (!status || !STATUS_LINE.test(status)) throw new NativeWallpaperFailure('download-failed')
  const values = new Map<string, string>()
  for (const line of lines) {
    const colon = line.indexOf(':')
    if (colon <= 0) throw new NativeWallpaperFailure('download-failed')
    const name = line.slice(0, colon)
    const lowerName = name.toLowerCase()
    const rawValue = line.slice(colon + 1)
    const duplicateIsUnsafe = lowerName.startsWith('content-')
      || ['etag', 'location', 'transfer-encoding'].includes(lowerName)
    if (!HEADER_NAME.test(name) || /[\x00-\x08\x0a-\x1f\x7f]/u.test(rawValue)
      || (values.has(lowerName) && duplicateIsUnsafe)) {
      throw new NativeWallpaperFailure('download-failed')
    }
    const value = rawValue.replace(/^[ \t]+|[ \t]+$/gu, '')
    if (lowerName === 'location') throw new NativeWallpaperFailure('download-failed')
    if (!values.has(lowerName)) values.set(lowerName, value)
  }

  const contentRange = values.get('content-range') ?? ''
  const address = contentRange.match(CONTENT_RANGE)
  const contentLengthText = values.get('content-length') ?? ''
  const contentLength = Number(contentLengthText)
  const etag = values.get('etag') ?? ''
  const encoding = values.get('content-encoding')
  if (!address || Number(address[1]) !== request.start || Number(address[2]) !== request.end
    || !Number.isSafeInteger(Number(address[3])) || Number(address[3]) <= request.end
    || Number(address[3]) > WALLPAPER_LIMITS.maxVideoSourceLength
    || !/^[1-9]\d*$/u.test(contentLengthText) || contentLength !== request.expectedBytes
    || !STRONG_ETAG.test(etag) || (request.ifMatch !== undefined && etag !== request.ifMatch)
    || (encoding !== undefined && encoding.toLowerCase() !== 'identity')
    || values.has('transfer-encoding')) {
    throw new NativeWallpaperFailure('download-failed')
  }
  return { values, contentRange, contentLength, etag }
}
