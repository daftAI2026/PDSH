/**
 * [INPUT]: 依赖 Host 活动目录已授权的材料 ID、同包 helper、固定系统 HEIC/Host 临时 MOV 与取消信号。
 * [OUTPUT]: 提供有界helper调用/JPEG校验与Host固定失败类型（下载证书码由网络层产生）；stderr上限1KiB且超限立即终止，不接收Renderer URL/path或暴露stderr。
 * [POS]: 系统素材Host与原生helper之间的窄适配；仅macOS显式调用，等待真实child close后才结算。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { spawn, type SpawnOptionsWithStdioTuple } from 'node:child_process'
import { relative, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import type { Readable } from 'node:stream'
import { SYSTEM_WALLPAPER_IDS, WALLPAPER_LIMITS, isSystemWallpaperId, isSystemWallpaperName } from '../shared/system-wallpaper-protocol.ts'
import type { SystemWallpaperId, WallpaperCatalogEntry } from '../shared/system-wallpaper-protocol.ts'
import { resolveNativeCaptureHelperPath } from './native-window-capture.ts'

const START_TIMEOUT = WALLPAPER_LIMITS.helperStartMs
const HELPER_TIMEOUT = WALLPAPER_LIMITS.helperMs
const FORCE_TIMEOUT = 2_000
const MAX_ERROR_BYTES = 1_024
const JPEG_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf])

export type NativeWallpaperFailureCode =
  | 'invalid-request' | 'unsupported-platform' | 'unavailable' | 'download-required'
  | 'download-failed' | 'download-certificate-failed' | 'decode-failed' | 'cancelled' | 'disposed' | 'busy'
  | 'protocol-invalid' | 'byte-budget-exceeded' | 'helper-start-failed'
  | 'helper-start-timeout' | 'helper-timeout' | 'helper-failed'

export class NativeWallpaperFailure extends Error {
  readonly code: NativeWallpaperFailureCode
  constructor(code: NativeWallpaperFailureCode) {
    super(code)
    this.code = code
    this.name = 'NativeWallpaperFailure'
  }
}

export interface NativeWallpaperImage {
  readonly id: SystemWallpaperId
  readonly sourceType: 'image' | 'video'
  readonly width: number
  readonly height: number
  readonly jpeg: Buffer
}

export type NativeWallpaperSpawnOptions = SpawnOptionsWithStdioTuple<'ignore', 'pipe', 'pipe'> & {
  readonly shell: false
}

export interface NativeWallpaperChild {
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

export type NativeWallpaperSpawner = (
  file: string,
  args: readonly string[],
  options: NativeWallpaperSpawnOptions,
) => NativeWallpaperChild

export interface NativeWallpaperTimer {
  readonly timer: ReturnType<typeof setTimeout> | number
}

export interface NativeWallpaperScheduler {
  set(callback: () => void, delayMs: number): NativeWallpaperTimer
  clear(timer: NativeWallpaperTimer): void
}

export interface NativeWallpaperRunOptions {
  readonly signal?: AbortSignal
  readonly helperPath?: string
  readonly platform?: string
  readonly arch?: string
  readonly bundleUrl?: string | URL
  readonly spawnProcess?: NativeWallpaperSpawner
  readonly scheduler?: NativeWallpaperScheduler
}

const defaultScheduler: NativeWallpaperScheduler = {
  set: (callback, delayMs) => ({ timer: setTimeout(callback, delayMs) }),
  clear: handle => clearTimeout(handle.timer),
}

const defaultSpawner: NativeWallpaperSpawner = (file, args, options) => spawn(file, args, options)

/** Helper目录和命名空间只在macOS暴露；Windows即使有capture helper也不能误显系统壁纸。 */
export function resolveSystemWallpaperHelperPath(
  platform: string,
  arch: string,
  bundleUrl: string | URL = import.meta.url,
): string | undefined {
  if (platform !== 'darwin' || !['arm64', 'x64'].includes(arch)) return undefined
  return resolveNativeCaptureHelperPath(platform, arch, bundleUrl)
}

/** 历史 helper 目录兼容入口；当前活动目录由 Apple 元数据选择器提供。 */
export function runNativeWallpaperList(options: NativeWallpaperRunOptions = {}): Promise<WallpaperCatalogEntry[]> {
  const output = runHelper({ ...options, mode: 'list' })
  return output.then(parseCatalog)
}

/** 来源参数只由 Host 选择器/下载器生成；Remote 仍仅提供已列出的材料 ID。 */
export function runNativeWallpaperImage(
  id: string,
  options: NativeWallpaperRunOptions & { readonly videoPath?: string; readonly systemImagePath?: string } = {},
): Promise<NativeWallpaperImage> {
  if (!isSystemWallpaperId(id)) return Promise.reject(new NativeWallpaperFailure('invalid-request'))
  if (options.videoPath !== undefined && (typeof options.videoPath !== 'string' || !options.videoPath || !isHostTemporaryPath(options.videoPath))) {
    return Promise.reject(new NativeWallpaperFailure('invalid-request'))
  }
  if (options.systemImagePath !== undefined && (options.videoPath !== undefined
    || !isSystemImagePath(options.systemImagePath)
    || (id !== 'system-wallpaper-tahoe' && !id.startsWith('system-wallpaper-image-')))) {
    return Promise.reject(new NativeWallpaperFailure('invalid-request'))
  }
  const args = options.systemImagePath !== undefined
    ? ['--wallpaper-system-image', id, options.systemImagePath]
    : options.videoPath === undefined ? ['--wallpaper', id] : ['--wallpaper-video', id, options.videoPath]
  const allowDownload = options.videoPath === undefined
  return runHelper({ ...options, mode: 'image', args, expectedId: id, allowDownload }).then(output => parseImage(output, id))
}

function isSystemImagePath(path: string): boolean {
  return typeof path === 'string' && path.length < 4096
    && /^\/System\/Library\/ExtensionKit\/Extensions\/[A-Za-z0-9._-]+Wallpaper\.appex\/Contents\/Resources\/[A-Za-z0-9 _-]+Light\.heic$/u.test(path)
}

function runHelper(
  input: NativeWallpaperRunOptions & {
    readonly mode: 'list' | 'image'
    readonly args?: readonly string[]
    readonly expectedId?: SystemWallpaperId
    readonly allowDownload?: boolean
  },
): Promise<Buffer> {
  const platform = input.platform ?? process.platform
  const arch = input.arch ?? process.arch
  if (platform !== 'darwin' || !['arm64', 'x64'].includes(arch)) {
    return Promise.reject(new NativeWallpaperFailure('unsupported-platform'))
  }
  if (input.signal?.aborted) return Promise.reject(new NativeWallpaperFailure('cancelled'))
  const helperPath = input.helperPath ?? resolveSystemWallpaperHelperPath(platform, arch, input.bundleUrl)
  if (!helperPath) return Promise.reject(new NativeWallpaperFailure('unavailable'))
  const args = input.mode === 'list' ? ['--wallpaper-list'] : input.args
  if (!args) return Promise.reject(new NativeWallpaperFailure('invalid-request'))
  const spawnProcess = input.spawnProcess ?? defaultSpawner
  const scheduler = input.scheduler ?? defaultScheduler
  const maxOutput = input.mode === 'list' ? WALLPAPER_LIMITS.maxCatalogBytes : WALLPAPER_LIMITS.maxBytes + 1_024

  return new Promise<Buffer>((resolve, reject) => {
    let child: NativeWallpaperChild
    try {
      child = spawnProcess(helperPath, args, { stdio: ['ignore', 'pipe', 'pipe'], shell: false })
    } catch {
      reject(new NativeWallpaperFailure('helper-start-failed'))
      return
    }

    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let outputBytes = 0
    let errorBytes = 0
    let settled = false
    let spawned = false
    let failure: NativeWallpaperFailure | undefined
    let startTimer: NativeWallpaperTimer | undefined
    let helperTimer: NativeWallpaperTimer | undefined
    let forceTimer: NativeWallpaperTimer | undefined

    const clear = (timer: NativeWallpaperTimer | undefined): void => { if (timer !== undefined) scheduler.clear(timer) }
    const kill = (signal: NodeJS.Signals): void => { try { child.kill(signal) } catch { /* 必须等待真实close，不虚报已结束。 */ } }
    const fail = (code: NativeWallpaperFailureCode, terminate = true): void => {
      if (failure || settled) return
      failure = new NativeWallpaperFailure(code)
      clear(startTimer); startTimer = undefined
      clear(helperTimer); helperTimer = undefined
      stdout.length = 0
      if (!terminate) return
      kill('SIGTERM')
      forceTimer = scheduler.set(() => { if (!settled) kill('SIGKILL') }, FORCE_TIMEOUT)
    }
    const onAbort = (): void => fail('cancelled')
    const onSpawn = (): void => {
      if (spawned || settled) return
      spawned = true
      clear(startTimer); startTimer = undefined
      helperTimer = scheduler.set(() => fail('helper-timeout'), HELPER_TIMEOUT)
    }
    const onError = (): void => fail(spawned ? 'helper-failed' : 'helper-start-failed')
    const onStdout = (chunk: Buffer | string): void => {
      if (failure || settled) return
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      outputBytes += bytes.length
      if (outputBytes > maxOutput) { fail('byte-budget-exceeded'); return }
      stdout.push(bytes)
    }
    const onStderr = (chunk: Buffer | string): void => {
      if (failure || settled) return
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      if (errorBytes + bytes.length > MAX_ERROR_BYTES) {
        stderr.length = 0
        errorBytes = 0
        fail('helper-failed')
        return
      }
      errorBytes += bytes.length
      stderr.push(bytes)
    }
    const onClose = (code: number | null, childSignal: NodeJS.Signals | null): void => {
      if (settled) return
      settled = true
      clear(startTimer); clear(helperTimer); clear(forceTimer)
      startTimer = undefined; helperTimer = undefined; forceTimer = undefined
      input.signal?.removeEventListener('abort', onAbort)
      child.off('spawn', onSpawn); child.off('error', onError); child.off('close', onClose)
      if (!spawned && !failure) failure = new NativeWallpaperFailure('helper-start-failed')
      if (failure) { reject(failure); return }
      const diagnostic = Buffer.concat(stderr, errorBytes)
      const errorStatus = parseErrorStatus(diagnostic)
      if (errorStatus === 'download-required') {
        const statusMatches = input.mode === 'image' && input.allowDownload === true && input.expectedId
          && validDownloadRequired(stdout.length ? Buffer.concat(stdout, outputBytes) : Buffer.alloc(0), input.expectedId)
        reject(new NativeWallpaperFailure(statusMatches ? 'download-required' : 'protocol-invalid'))
        return
      }
      if (errorStatus) { reject(new NativeWallpaperFailure(errorStatus)); return }
      if (diagnostic.length > 0) { reject(new NativeWallpaperFailure('helper-failed')); return }
      if (code !== 0 || childSignal !== null) { reject(new NativeWallpaperFailure('helper-failed')); return }
      resolve(Buffer.concat(stdout, outputBytes))
    }

    input.signal?.addEventListener('abort', onAbort, { once: true })
    startTimer = scheduler.set(() => fail('helper-start-timeout'), START_TIMEOUT)
    child.stdout.on('data', onStdout)
    child.stderr.on('data', onStderr)
    child.on('spawn', onSpawn)
    child.on('error', onError)
    child.on('close', onClose)
    if (input.signal?.aborted) onAbort()
  })
}

function parseCatalog(output: Buffer): WallpaperCatalogEntry[] {
  const value = parseSingleJsonLine(output, WALLPAPER_LIMITS.maxCatalogBytes)
  if (!isRecord(value) || exactKeys(value, ['entries', 'status']) !== true || value.status !== 'listed' || !Array.isArray(value.entries)) {
    throw new NativeWallpaperFailure('protocol-invalid')
  }
  const ids = new Set<string>()
  const entries: WallpaperCatalogEntry[] = []
  for (const item of value.entries) {
    if (!isRecord(item) || exactKeys(item, ['available', 'downloadable', 'id', 'name']) !== true
      || typeof item.id !== 'string' || !isSystemWallpaperId(item.id) || ids.has(item.id)
      || !isSystemWallpaperName(item.name)
      || typeof item.available !== 'boolean' || typeof item.downloadable !== 'boolean') {
      throw new NativeWallpaperFailure('protocol-invalid')
    }
    ids.add(item.id)
    entries.push({ id: item.id, name: item.name, available: item.available, downloadable: item.downloadable })
  }
  if (ids.size !== SYSTEM_WALLPAPER_IDS.length || SYSTEM_WALLPAPER_IDS.some(id => !ids.has(id))) {
    throw new NativeWallpaperFailure('protocol-invalid')
  }
  return entries
}

function parseImage(output: Buffer, expectedId: SystemWallpaperId): NativeWallpaperImage {
  const newline = output.indexOf(0x0a)
  if (newline <= 0 || newline > 1_024) throw new NativeWallpaperFailure('protocol-invalid')
  let value: unknown
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(output.subarray(0, newline))) as unknown }
  catch { throw new NativeWallpaperFailure('protocol-invalid') }
  if (!isRecord(value) || exactKeys(value, ['height', 'id', 'jpegBytes', 'sourceType', 'status', 'width']) !== true
    || value.status !== 'loaded' || !isSystemWallpaperId(value.id) || value.id !== expectedId) {
    throw new NativeWallpaperFailure('protocol-invalid')
  }
  const id = value.id
  const sourceType = value.sourceType
  const width = value.width
  const height = value.height
  const jpegBytes = value.jpegBytes
  if ((sourceType !== 'image' && sourceType !== 'video')
    || typeof width !== 'number' || typeof height !== 'number' || typeof jpegBytes !== 'number'
    || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1
    || width > WALLPAPER_LIMITS.maxDimension || height > WALLPAPER_LIMITS.maxDimension
    || !Number.isSafeInteger(jpegBytes) || jpegBytes < 12 || jpegBytes > WALLPAPER_LIMITS.maxBytes
    || output.length - newline - 1 !== jpegBytes) {
    throw new NativeWallpaperFailure(output.length - newline - 1 > WALLPAPER_LIMITS.maxBytes
      ? 'byte-budget-exceeded' : 'protocol-invalid')
  }
  const jpeg = output.subarray(newline + 1)
  const actualSize = readJpegDimensions(jpeg)
  if (actualSize.width !== width || actualSize.height !== height) {
    throw new NativeWallpaperFailure('protocol-invalid')
  }
  return { id, sourceType, width, height, jpeg: Buffer.from(jpeg) }
}

function parseSingleJsonLine(output: Buffer, maxBytes: number): unknown {
  if (output.length > maxBytes || output.length < 2 || output[output.length - 1] !== 0x0a
    || output.subarray(0, output.length - 1).includes(0x0a)) throw new NativeWallpaperFailure('protocol-invalid')
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(output.subarray(0, output.length - 1))) as unknown }
  catch { throw new NativeWallpaperFailure('protocol-invalid') }
}

/** 仅接纳成功元数据外的固定token；stderr正文不进入调用方、日志或终态。 */
function parseErrorStatus(stderr: Buffer): NativeWallpaperFailureCode | undefined {
  if (!stderr.length) return undefined
  if (stderr.length > MAX_ERROR_BYTES || stderr[stderr.length - 1] !== 0x0a || stderr.subarray(0, stderr.length - 1).includes(0x0a)) {
    return undefined
  }
  const token = stderr.toString('ascii')
  if (token === 'download-required\n') return 'download-required'
  if (token === 'wallpaper-unavailable\n') return 'unavailable'
  if (token === 'wallpaper-decode-failed\n') return 'decode-failed'
  if (token === 'wallpaper-byte-budget-exceeded\n') return 'byte-budget-exceeded'
  if (token === 'wallpaper-invalid-request\n') return 'invalid-request'
  if (token === 'wallpaper-read-failed\n' || token === 'wallpaper-jpeg-encode-failed\n'
    || token === 'wallpaper-output-failed\n') return 'helper-failed'
  return stderr.length ? 'helper-failed' : undefined
}

function validDownloadRequired(output: Buffer, expectedId: SystemWallpaperId): boolean {
  try {
    const value = parseSingleJsonLine(output, 1_024)
    return isRecord(value) && exactKeys(value, ['downloadable', 'id', 'status'])
      && value.status === 'unavailable' && value.id === expectedId && value.downloadable === true
  } catch { return false }
}

/** JPEG来自原生ImageIO；Host核对有界首帧与SOF尺寸，不把metadata/source路径交给Client。 */
export function readJpegDimensions(bytes: Buffer): { width: number; height: number } {
  if (!Buffer.isBuffer(bytes) || bytes.length < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8
    || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    throw new NativeWallpaperFailure('protocol-invalid')
  }
  let offset = 2
  let segments = 0
  let dimensions: { width: number; height: number } | undefined
  while (offset < bytes.length - 2) {
    if (++segments > 8_192 || bytes[offset] !== 0xff) throw new NativeWallpaperFailure('protocol-invalid')
    while (bytes[offset] === 0xff) offset++
    if (offset >= bytes.length - 2) throw new NativeWallpaperFailure('protocol-invalid')
    const marker = bytes[offset++]!
    if (marker === 0xd9 || marker === 0xd8 || marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
      throw new NativeWallpaperFailure('protocol-invalid')
    }
    if (offset + 2 > bytes.length - 2) throw new NativeWallpaperFailure('protocol-invalid')
    const length = bytes.readUInt16BE(offset)
    if (length < 2 || offset + length > bytes.length) throw new NativeWallpaperFailure('protocol-invalid')
    if (JPEG_MARKERS.has(marker)) {
      if (dimensions || length < 8) throw new NativeWallpaperFailure('protocol-invalid')
      const height = bytes.readUInt16BE(offset + 3)
      const width = bytes.readUInt16BE(offset + 5)
      const components = bytes[offset + 7]!
      if (!width || !height || width > WALLPAPER_LIMITS.maxDimension || height > WALLPAPER_LIMITS.maxDimension
        || components < 1 || components > 4 || length !== 8 + components * 3) {
        throw new NativeWallpaperFailure('protocol-invalid')
      }
      dimensions = { width, height }
    }
    offset += length
    if (marker === 0xda) {
      if (!dimensions || length < 6) throw new NativeWallpaperFailure('protocol-invalid')
      // JPEG entropy bytes are opaque here; the helper owns ImageIO decoding and final EOI.
      break
    }
  }
  if (!dimensions || offset > bytes.length - 2) throw new NativeWallpaperFailure('protocol-invalid')
  return dimensions
}

function isHostTemporaryPath(value: string): boolean {
  if (!value || !resolve(value).endsWith(`${sep}source.mov`)) return false
  const relativePath = relative(resolve(tmpdir()), resolve(value))
  const parts = relativePath.split(sep)
  return parts.length === 2 && /^pdsh-wallpaper-[A-Za-z0-9]+$/u.test(parts[0]!) && parts[1] === 'source.mov'
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return Object.keys(value).sort().join(',') === [...expected].sort().join(',')
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
