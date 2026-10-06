/**
 * [INPUT]: 依赖 Host 活动目录已授权的材料 ID/Apple URL、shared 预算、纯 MOV 解析器与 macOS 默认系统网络传输。
 * [OUTPUT]: 三次严格206/强ETag一致的有限Range重建完整单帧MOV；fetch证书拒绝仅分类为固定码，不改变信任或重试；自有文件在网络/写入/helper结算后清理。
 * [POS]: 唯一壁纸下载编排；系统 curl 仅是同进程树的窄 Range transport，不另开桥/服务或改 TLS；目录/挂载/缓存选择不联网。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { lstat, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WALLPAPER_LIMITS, isSystemWallpaperId } from '../shared/system-wallpaper-protocol.ts'
import type { SystemWallpaperId } from '../shared/system-wallpaper-protocol.ts'
import { NativeWallpaperFailure } from './system-wallpaper-native.ts'
import { AppleWallpaperMovError, parseAppleWallpaperFirstSample, parseAppleWallpaperMovHeader } from './system-wallpaper-mov.ts'
import { fetchAppleWallpaperRange, isAppleWallpaperVideoUrl } from './system-wallpaper-transport.ts'

/** 旧测试/身份兼容的已核验源；生产 sourceUrl 来自当前 Apple 目录，静态缺失也可用其对应 MOV。 */
export const APPLE_WALLPAPER_VIDEO_URLS: Readonly<Partial<Record<SystemWallpaperId, string>>> = Object.freeze({
  'system-wallpaper-golden-gate': 'https://sylvan.apple.com/itunes-assets/Aerials116/v4/cb/5b/50/cb5b5035-6701-619f-9065-3d7d0e5fbef4/GG_LM_H_v063_240fps-TSA.mov',
  'system-wallpaper-golden-gate-sunset': 'https://sylvan.apple.com/itunes-assets/Aerials116/v4/cb/5b/50/cb5b5035-6701-619f-9065-3d7d0e5fbef4/GG_A_SUNSET_MarshallsBeach_c28_v7_24comp_HFR_16Mbps.mov',
  'system-wallpaper-tahoe-day': 'https://sylvan.apple.com/itunes-assets/Aerials116/v4/cb/5b/50/cb5b5035-6701-619f-9065-3d7d0e5fbef4/LIGHT02_20250613_V2_sdr_4k_rate12000_240p_t2160_grover74_tsa_MTE-Modified.mov',
})

/** 仅识别TLS库结构化证书码；异常正文不能成为诊断或信任输入。 */
const CERTIFICATE_REJECTION_CODES = new Set([
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID',
])

export interface DownloadedWallpaperVideo {
  readonly path: string
  cleanup(): Promise<void>
}

export interface AppleWallpaperDownloadOptions {
  readonly fetcher?: (url: string, init: RequestInit) => Promise<Response>
  /** 实际三段总获取预算；测试只可收紧，不能扩大生产上限。 */
  readonly maxBytes?: number
  readonly timeoutMs?: number
  readonly tempDirectory?: string
  readonly removeDirectory?: (directory: string) => Promise<void>
}

/** 生产来源由 Host 当前目录选定；Remote不能设置 sourceUrl 或测试注入端口。 */
export function downloadAppleWallpaperVideo(
  id: string,
  signal: AbortSignal,
  sourceUrl?: string,
): Promise<DownloadedWallpaperVideo> {
  return createAppleWallpaperDownloader({ fetcher: fetchAppleWallpaperRange })(id, signal, sourceUrl)
}

/** 流与预算测试的窄注入边界；URL映射仍由本模块独占。 */
export function createAppleWallpaperDownloader(options: AppleWallpaperDownloadOptions = {}) {
  const fetcher = options.fetcher ?? ((url, init) => fetch(url, init))
  const maxBytes = options.maxBytes ?? WALLPAPER_LIMITS.maxVideoDownloadBytes
  const timeoutMs = options.timeoutMs ?? WALLPAPER_LIMITS.downloadMs
  const tempDirectory = options.tempDirectory ?? tmpdir()
  const removeDirectory = options.removeDirectory ?? (directory => rm(directory, { recursive: true, force: true }))

  return async function download(id: string, signal: AbortSignal, sourceUrl?: string): Promise<DownloadedWallpaperVideo> {
    if (!isSystemWallpaperId(id) || !Number.isSafeInteger(maxBytes) || maxBytes < 1
      || maxBytes > WALLPAPER_LIMITS.maxVideoDownloadBytes
      || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new NativeWallpaperFailure('invalid-request')
    if (signal.aborted) throw new NativeWallpaperFailure('cancelled')
    const url = sourceUrl ?? APPLE_WALLPAPER_VIDEO_URLS[id]
    if (!url || !isAppleWallpaperVideoUrl(url)) throw new NativeWallpaperFailure('unavailable')

    let directory: string | undefined
    let cleanupStarted: Promise<void> | undefined
    const cleanupDirectory = (): Promise<void> => {
      if (!cleanupStarted) {
        const ownedDirectory = directory
        cleanupStarted = ownedDirectory
          ? Promise.resolve().then(() => removeDirectory(ownedDirectory)).then(
            () => undefined,
            () => { throw new NativeWallpaperFailure('download-failed') },
          )
          : Promise.resolve()
      }
      return cleanupStarted
    }
    const controller = new AbortController()
    const onAbort = (): void => controller.abort()
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) onAbort()
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)

    try {
      if (controller.signal.aborted) throw new NativeWallpaperFailure('cancelled')
      directory = await mkdtemp(join(tempDirectory, 'pdsh-wallpaper-'))
      const file = join(directory, 'source.mov')
      const rootInfo = await lstat(directory)
      if (!rootInfo.isDirectory() || (rootInfo.mode & 0o777) !== 0o700
        || (typeof process.getuid === 'function' && rootInfo.uid !== process.getuid())) {
        throw new NativeWallpaperFailure('download-failed')
      }
      const budget = { received: 0, maxBytes }
      const range = (start: number, end: number, total?: number, etag?: string) => readRange(
        fetcher, url, start, end, budget, controller.signal, total, etag,
      )
      const prefix = await range(0, WALLPAPER_LIMITS.videoHeaderBytes - 1)
      const layout = parseAppleWallpaperMovHeader(prefix.bytes, prefix.total)
      const metadata = await range(layout.moovOffset, layout.sourceLength - 1, prefix.total, prefix.etag)
      const plan = parseAppleWallpaperFirstSample(layout, metadata.bytes)
      const sample = await range(plan.sourceOffset, plan.sourceOffset + plan.sampleSize - 1, prefix.total, prefix.etag)
      checkAbort(controller.signal)
      const movie = plan.rebuild(sample.bytes)
      if (movie.byteLength > WALLPAPER_LIMITS.maxVideoBytes) throw new NativeWallpaperFailure('byte-budget-exceeded')
      await writeFile(file, movie, { flag: 'wx', mode: 0o600, signal: controller.signal })
      checkAbort(controller.signal)
      const info = await lstat(file)
      if (!info.isFile() || info.size !== movie.byteLength || (info.mode & 0o777) !== 0o600
        || (typeof process.getuid === 'function' && info.uid !== process.getuid())) {
        throw new NativeWallpaperFailure('download-failed')
      }
      return {
        path: file,
        async cleanup() {
          await cleanupDirectory()
        },
      }
    } catch (error) {
      try { await cleanupDirectory() }
      catch { throw new NativeWallpaperFailure('download-failed') }
      if (signal.aborted) throw new NativeWallpaperFailure('cancelled')
      if (timedOut) throw new NativeWallpaperFailure('download-failed')
      if (isWallpaperFailure(error)) throw error
      if (error instanceof AppleWallpaperMovError) {
        throw new NativeWallpaperFailure(error.code === 'budget-exceeded' ? 'byte-budget-exceeded' : 'download-failed')
      }
      throw new NativeWallpaperFailure('download-failed')
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
    }
  }
}

interface RangeBudget { received: number; readonly maxBytes: number }
interface RangeBytes { readonly bytes: Uint8Array; readonly total: number; readonly etag: string }

/** 三段分别校验地址/对象和body；不使用arrayBuffer，不按逻辑源length分配。 */
async function readRange(
  fetcher: NonNullable<AppleWallpaperDownloadOptions['fetcher']>,
  url: string, start: number, end: number, budget: RangeBudget, signal: AbortSignal,
  expectedTotal?: number, expectedEtag?: string,
): Promise<RangeBytes> {
  checkAbort(signal)
  const expectedBytes = end - start + 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || expectedBytes < 1) {
    throw new NativeWallpaperFailure('download-failed')
  }
  if (expectedBytes > budget.maxBytes - budget.received) throw new NativeWallpaperFailure('byte-budget-exceeded')
  const headers: Record<string, string> = { Range: `bytes=${start}-${end}`, 'Accept-Encoding': 'identity' }
  if (expectedEtag !== undefined) headers['If-Match'] = expectedEtag
  let response: Response
  try {
    response = await fetcher(url, { method: 'GET', redirect: 'error', headers, signal })
  } catch (error) {
    if (isCertificateRejection(error)) throw new NativeWallpaperFailure('download-certificate-failed')
    throw error
  }
  let total: number
  let etag: string
  try {
    checkAbort(signal)
    const address = response.headers.get('content-range')?.match(/^bytes (0|[1-9]\d*)-(0|[1-9]\d*)\/([1-9]\d*)$/u)
    const encoding = response.headers.get('content-encoding')
    const length = response.headers.get('content-length')
    etag = response.headers.get('etag') ?? ''
    total = Number(address?.[3])
    if (response.status !== 206 || response.redirected || (response.url !== '' && response.url !== url)
      || !response.body || !address || Number(address[1]) !== start || Number(address[2]) !== end
      || !Number.isSafeInteger(total) || total <= end || (expectedTotal !== undefined && total !== expectedTotal)
      || (encoding !== null && encoding.toLowerCase() !== 'identity')
      || length === null || !/^[1-9]\d*$/u.test(length) || Number(length) !== expectedBytes
      || !/^"[\x21\x23-\x7e\x80-\xff]*"$/u.test(etag) || (expectedEtag !== undefined && etag !== expectedEtag)) {
      throw new NativeWallpaperFailure('download-failed')
    }
    if (total > WALLPAPER_LIMITS.maxVideoSourceLength) throw new NativeWallpaperFailure('byte-budget-exceeded')
  } catch (error) {
    await cancelBody(response.body)
    throw error
  }

  const reader = response.body!.getReader()
  let cancellation: Promise<void> | undefined
  const cancel = (): Promise<void> => cancellation ??= reader.cancel().catch(() => undefined)
  const onAbort = (): void => { void cancel() }
  signal.addEventListener('abort', onAbort, { once: true })
  if (signal.aborted) onAbort()
  let completed = false
  try {
    // +--- 只按已验证的小Range预分配；片段数量不能绕过字节门放大对象内存。 ---+
    const bytes = new Uint8Array(expectedBytes)
    let received = 0
    for (;;) {
      checkAbort(signal)
      const part = await reader.read()
      checkAbort(signal)
      if (part.done) break
      if (!(part.value instanceof Uint8Array) || part.value.byteLength === 0) throw new NativeWallpaperFailure('download-failed')
      received += part.value.byteLength
      budget.received += part.value.byteLength
      if (received > expectedBytes || budget.received > budget.maxBytes) throw new NativeWallpaperFailure('byte-budget-exceeded')
      bytes.set(part.value, received - part.value.byteLength)
    }
    if (received !== expectedBytes) throw new NativeWallpaperFailure('download-failed')
    completed = true
    return { bytes, total, etag }
  } finally {
    signal.removeEventListener('abort', onAbort)
    if (!completed) await cancel()
    else if (cancellation) await cancellation
    reader.releaseLock()
  }
}

function checkAbort(signal: AbortSignal): void {
  if (signal.aborted) throw new NativeWallpaperFailure('cancelled')
}

function isCertificateRejection(error: unknown): boolean {
  for (const failure of [error, error instanceof Error ? error.cause : undefined]) {
    if (failure instanceof Error && 'code' in failure && typeof failure.code === 'string'
      && CERTIFICATE_REJECTION_CODES.has(failure.code)) return true
  }
  return false
}

async function cancelBody(body: ReadableStream<Uint8Array> | null): Promise<void> {
  if (!body) return
  try { await body.cancel() } catch { /* Body关闭失败不传播原始传输错误。 */ }
}

function isWallpaperFailure(error: unknown): error is NativeWallpaperFailure {
  return error instanceof NativeWallpaperFailure
}
