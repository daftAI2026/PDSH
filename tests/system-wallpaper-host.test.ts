/**
 * [INPUT]: 依赖系统壁纸Host helper/stream边界、动态shared素材ID语法、可控子进程/operation、node:test虚拟计时及人工MOV Range片段。
 * [OUTPUT]: 验证当前目录的available/downloadable元数据、显式缺素材下载门控、ID/JSON/JPEG硬边界、预算与取消真实结算；不触及真实网络、本机素材或helper。
 * [POS]: Native wallpaper Remote 的Host回归合同；独立于原生源码静态检查和Desktop验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { access, lstat, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import { PassThrough } from 'node:stream'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import { build } from 'esbuild'
import { runInNewContext } from 'node:vm'
import { SYSTEM_WALLPAPER_IDS } from '../src/shared/system-wallpaper-protocol.ts'
import {
  runNativeWallpaperImage,
  runNativeWallpaperList,
} from '../src/host/system-wallpaper-native.ts'
import type { NativeWallpaperScheduler, NativeWallpaperSpawnOptions } from '../src/host/system-wallpaper-native.ts'
import { createSystemWallpaperStream } from '../src/host/system-wallpaper-stream.ts'
import type { WallpaperReservation } from '../src/host/system-wallpaper-stream.ts'
import {
  APPLE_WALLPAPER_VIDEO_URLS,
  createAppleWallpaperDownloader,
} from '../src/host/system-wallpaper-download.ts'
import { SYSTEM_WALLPAPER_MOV_FIXTURE } from './system-wallpaper-mov-fixture.ts'

/** Host 生命周期合同使用合法小片段；HTTP畸形与单sample表在各自专项合同验证。 */
function appleRangeResponse(init: RequestInit): Response {
  const fixture = SYSTEM_WALLPAPER_MOV_FIXTURE
  const range = new Headers(init.headers).get('range')
  const start = Number(range?.match(/^bytes=(\d+)-/u)?.[1])
  const body = start === 0 ? fixture.headerPrefix
    : start === fixture.moovOffset ? fixture.moovBytes : fixture.sourceFirstSampleBytes
  return new Response(body, { status: 206, headers: {
    'content-length': String(body.byteLength),
    'content-range': `bytes ${start}-${start + body.byteLength - 1}/${fixture.sourceTotalBytes}`,
    etag: '"owned-test-object"',
  } })
}

class FakeChild extends EventEmitter {
  readonly stdout = new PassThrough()
  readonly stderr = new PassThrough()
  readonly kills: NodeJS.Signals[] = []
  closed = false
  kill(signal: NodeJS.Signals): boolean {
    this.kills.push(signal)
    return true
  }
}

function minimalJpeg(width = 2, height = 1): Buffer {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, ...Buffer.from('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0])
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x0b, 8, 0, height, 0, width, 1, 1, 0x11, 0])
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 63, 0])
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, sos, Buffer.from([0x00, 0xff, 0xd9])])
}

function catalogJson(entries = SYSTEM_WALLPAPER_IDS.map((id, index) => ({
  id,
  name: `Wallpaper ${index + 1}`,
  available: index < 2,
  downloadable: index >= 2,
}))): Buffer {
  return Buffer.from(`${JSON.stringify({ status: 'listed', entries })}\n`)
}

function nativeHarness(output: Buffer, exitCode = 0, errorOutput = Buffer.alloc(0)) {
  const child = new FakeChild()
  const calls: Array<{ file: string; args: readonly string[]; options: NativeWallpaperSpawnOptions }> = []
  return {
    child,
    calls,
    options: {
      platform: 'darwin',
      arch: 'arm64',
      helperPath: '/fixture/window-capture',
      spawnProcess: (file: string, args: readonly string[], options: NativeWallpaperSpawnOptions) => {
        calls.push({ file, args, options })
        queueMicrotask(() => {
          child.emit('spawn')
          child.stdout.end(output)
          child.stderr.end(errorOutput)
          setImmediate(() => {
            child.closed = true
            child.emit('close', exitCode, null)
          })
        })
        return child
      },
    },
  }
}

async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = []
  for await (const value of source) values.push(value)
  return values
}

function reservationHarness() {
  let reserved = false
  let released = 0
  let tracked: Promise<void> | undefined
  const reserve = (): WallpaperReservation | 'busy' | 'disposed' => {
    if (reserved) return 'busy'
    reserved = true
    return {
      track(operation) { tracked = operation },
      release() { reserved = false; released++ },
    }
  }
  return { reserve, get released() { return released }, get tracked() { return tracked } }
}

test('system wallpaper catalog uses only the list command and preserves Host download eligibility', async () => {
  const harness = nativeHarness(catalogJson())
  const result = await runNativeWallpaperList(harness.options)
  assert.deepEqual(result.map(entry => entry.id), [...SYSTEM_WALLPAPER_IDS])
  assert.deepEqual(result.map(entry => [entry.available, entry.downloadable]), [
    [true, false], [true, false], [false, true], [false, true],
  ], 'listing preserves Host catalog facts without downloading media')
  assert.deepEqual(harness.calls[0]?.args, ['--wallpaper-list'])
  assert.equal(harness.calls[0]?.options.shell, false)
  assert.equal(harness.calls[0]?.options.stdio.join(','), 'ignore,pipe,pipe')
})

test('native boundary rejects unknown IDs, malformed catalog entries, and caller-supplied paths before spawn', async () => {
  let spawns = 0
  const noSpawn = { platform: 'darwin', arch: 'arm64', helperPath: '/fixture/helper', spawnProcess: () => { spawns++; throw Error('must not spawn') } }
  await assert.rejects(runNativeWallpaperImage('file:///etc/passwd' as never, noSpawn), { code: 'invalid-request' })
  await assert.rejects(runNativeWallpaperList({ ...nativeHarness(catalogJson([{ id: '../escape', name: 'bad', available: true, downloadable: false }])).options }), { code: 'protocol-invalid' })
  assert.equal(spawns, 0)
})

test('download fallback requires the exact helper marker and matching downloadable ID metadata', async () => {
  const id = SYSTEM_WALLPAPER_IDS[1]!
  const allow = nativeHarness(Buffer.from(`${JSON.stringify({ status: 'unavailable', id, downloadable: true })}\n`), 1,
    Buffer.from('download-required\n'))
  await assert.rejects(runNativeWallpaperImage(id, allow.options), { code: 'download-required' })
  assert.deepEqual(allow.calls[0]?.args, ['--wallpaper', id])

  const wrongId = nativeHarness(Buffer.from(`${JSON.stringify({ status: 'unavailable', id: SYSTEM_WALLPAPER_IDS[0], downloadable: true })}\n`), 1,
    Buffer.from('download-required\n'))
  await assert.rejects(runNativeWallpaperImage(id, wrongId.options), { code: 'protocol-invalid' })

  const noToken = nativeHarness(Buffer.from(`${JSON.stringify({ status: 'unavailable', id, downloadable: true })}\n`), 1)
  await assert.rejects(runNativeWallpaperImage(id, noToken.options), { code: 'helper-failed' })
})

test('native helper still reads a locally available static wallpaper by closed ID', async () => {
  const id = SYSTEM_WALLPAPER_IDS[0]!
  const jpeg = minimalJpeg()
  const header = Buffer.from(`${JSON.stringify({ status: 'loaded', id, sourceType: 'image', width: 2, height: 1, jpegBytes: jpeg.length })}\n`)
  const harness = nativeHarness(Buffer.concat([header, jpeg]))
  const image = await runNativeWallpaperImage(id, harness.options)
  assert.equal(image.sourceType, 'image')
  assert.equal(image.jpeg.length, jpeg.length)
  assert.deepEqual(harness.calls[0]?.args, ['--wallpaper', id], 'local stills use no downloaded-video path')
})

test('JPEG metadata and bytes must agree; video helper receives only the closed ID and Host-owned path', async () => {
  const id = SYSTEM_WALLPAPER_IDS[0]!
  const jpeg = minimalJpeg()
  const header = Buffer.from(`${JSON.stringify({ status: 'loaded', id, sourceType: 'video', width: 2, height: 1, jpegBytes: jpeg.length })}\n`)
  const harness = nativeHarness(Buffer.concat([header, jpeg]))
  const videoPath = join(tmpdir(), 'pdsh-wallpaper-test', 'source.mov')
  const image = await runNativeWallpaperImage(id, { ...harness.options, videoPath })
  assert.equal(image.jpeg.length, jpeg.length)
  assert.deepEqual(harness.calls[0]?.args, ['--wallpaper-video', id, videoPath])

  const mismatch = nativeHarness(Buffer.concat([
    Buffer.from(`${JSON.stringify({ status: 'loaded', id, sourceType: 'image', width: 3, height: 1, jpegBytes: jpeg.length })}\n`), jpeg,
  ]))
  await assert.rejects(runNativeWallpaperImage(id, mismatch.options), { code: 'protocol-invalid' })
})

test('native helper cancellation sends SIGTERM but settles only after its real close event', async () => {
  const id = SYSTEM_WALLPAPER_IDS[0]!
  const child = new FakeChild()
  let settled = false
  const controller = new AbortController()
  const task = runNativeWallpaperImage(id, {
    ...nativeHarness(Buffer.alloc(0)).options,
    signal: controller.signal,
    spawnProcess: () => {
      queueMicrotask(() => child.emit('spawn'))
      return child
    },
  }).catch(error => error)
  void task.then(() => { settled = true })
  await new Promise(resolve => setImmediate(resolve))
  controller.abort()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(child.kills, ['SIGTERM'])
  assert.equal(settled, false, 'SIGTERM is only a request; the operation remains owned through close')
  child.closed = true
  child.emit('close', null, 'SIGTERM')
  const failure = await task
  assert.equal((failure as { code?: unknown }).code, 'cancelled')
  assert.equal(settled, true)
})

test('native stderr budget overflow terminates immediately and never exposes raw diagnostics', async () => {
  const child = new FakeChild()
  const task = runNativeWallpaperList({
    ...nativeHarness(Buffer.alloc(0)).options,
    spawnProcess: () => {
      queueMicrotask(() => {
        child.emit('spawn')
        child.stderr.write(Buffer.alloc(2_048, 0x78))
      })
      return child
    },
  }).catch(error => error)
  await new Promise(resolve => setImmediate(resolve))
  const terminatedBeforeClose = child.kills.includes('SIGTERM')
  child.stdout.end()
  child.stderr.end()
  child.emit('close', 0, null)
  const failure = await task
  assert.equal(terminatedBeforeClose, true, 'stderr beyond 1 KiB fails closed instead of buffering further')
  assert.equal((failure as { code?: unknown }).code, 'helper-failed')
  assert.doesNotMatch(String(failure), /x{8,}/u)
})

test('native start and execution deadlines are fixed failures but still wait for child close', async () => {
  const id = SYSTEM_WALLPAPER_IDS[0]!
  for (const scenario of ['start', 'run'] as const) {
    const child = new FakeChild()
    const timers: Array<{ callback: () => void; delay: number }> = []
    const scheduler: NativeWallpaperScheduler = {
      set(callback, delay) {
        timers.push({ callback, delay })
        return { timer: timers.length }
      },
      clear() {},
    }
    let settled = false
    const task = runNativeWallpaperImage(id, {
      ...nativeHarness(Buffer.alloc(0)).options,
      scheduler,
      spawnProcess: () => child,
    }).catch(error => error)
    if (scenario === 'run') child.emit('spawn')
    const deadline = scenario === 'start' ? timers[0] : timers[1]
    assert.ok(deadline, `${scenario} deadline is registered`)
    deadline.callback()
    void task.then(() => { settled = true })
    await new Promise(resolve => setImmediate(resolve))
    assert.deepEqual(child.kills, ['SIGTERM'])
    assert.equal(settled, false, 'timeout requests termination but does not forge process settlement')
    child.stdout.end()
    child.stderr.end()
    child.emit('close', null, 'SIGTERM')
    const failure = await task
    assert.equal((failure as { code?: unknown }).code, scenario === 'start' ? 'helper-start-timeout' : 'helper-timeout')
  }
})

test('system wallpaper load is lazy, gated by accepted captureEnabled and image frames stay bounded', async () => {
  const h = reservationHarness()
  let loads = 0
  let lists = 0
  const list = createSystemWallpaperStream({
    request: { kind: 'list' }, signal: new AbortController().signal, lifetimeSignal: new AbortController().signal,
    platform: 'darwin', enabled: () => true, disposed: () => false, reserve: h.reserve,
    list: async () => { lists++; return SYSTEM_WALLPAPER_IDS.map(id => ({ id, name: id, available: true, downloadable: false })) },
    load: async id => { loads++; return { id, sourceType: 'image', width: 2, height: 1, jpeg: minimalJpeg() } },
  })
  assert.equal(lists, 0, 'constructing Remote iterable must not invoke helper')
  const listed = await collect(list)
  assert.deepEqual(listed.at(-1), { type: 'terminal', status: 'listed' })
  assert.equal(lists, 1)
  assert.equal(loads, 0, 'catalog must never load pixels or download assets')

  const notEnabled = await collect(createSystemWallpaperStream({
    request: { kind: 'load', id: SYSTEM_WALLPAPER_IDS[0]! }, signal: new AbortController().signal,
    lifetimeSignal: new AbortController().signal, platform: 'darwin', enabled: () => false, disposed: () => false,
    reserve: h.reserve, list: async () => [], load: async id => { loads++; return { id, sourceType: 'image', width: 2, height: 1, jpeg: minimalJpeg() } },
  }))
  assert.deepEqual(notEnabled, [{ type: 'terminal', status: 'not-enabled' }])
  assert.equal(loads, 0)
})

test('unsupported platform and malformed Remote payload fail closed without helper work', async () => {
  const h = reservationHarness()
  let operations = 0
  const base = {
    signal: new AbortController().signal, lifetimeSignal: new AbortController().signal,
    enabled: () => true, disposed: () => false, reserve: h.reserve,
    list: async () => { operations++; return [] },
    load: async (id: string) => { operations++; return { id, sourceType: 'image', width: 2, height: 1, jpeg: minimalJpeg() } },
  }
  assert.deepEqual(await collect(createSystemWallpaperStream({ ...base, request: { kind: 'list' }, platform: 'win32' })), [
    { type: 'terminal', status: 'unsupported-platform' },
  ])
  assert.deepEqual(await collect(createSystemWallpaperStream({ ...base, request: { kind: 'load', id: '../tmp/a.mov', path: '/tmp/a.mov' } as never, platform: 'darwin' })), [
    { type: 'terminal', status: 'invalid-request' },
  ])
  assert.equal(operations, 0)
})

test('cancellation waits for actual helper settlement and retains single-flight until close', async () => {
  const h = reservationHarness()
  let release!: () => void
  let called!: (signal: AbortSignal) => void
  const entered = new Promise<AbortSignal>(resolve => { called = resolve })
  const operation = new Promise<void>(resolve => { release = resolve })
  const controller = new AbortController()
  const stream = createSystemWallpaperStream({
    request: { kind: 'load', id: SYSTEM_WALLPAPER_IDS[0]! }, signal: controller.signal,
    lifetimeSignal: new AbortController().signal, platform: 'darwin', enabled: () => true, disposed: () => false,
    reserve: h.reserve, list: async () => [], load: async (id, signal) => {
      called(signal)
      await operation
      return { id, sourceType: 'image', width: 2, height: 1, jpeg: minimalJpeg() }
    },
  })
  // The injected loader must receive the per-operation signal, not just the request's signal.
  const task = collect(stream)
  const operationSignal = await entered
  controller.abort()
  assert.equal(operationSignal.aborted, true)
  assert.equal(h.released, 0, 'abort must not release the reservation before helper settlement')
  const duringClose = await collect(createSystemWallpaperStream({
    request: { kind: 'load', id: SYSTEM_WALLPAPER_IDS[1]! }, signal: new AbortController().signal,
    lifetimeSignal: new AbortController().signal, platform: 'darwin', enabled: () => true, disposed: () => false,
    reserve: h.reserve, list: async () => [], load: async id => ({ id, sourceType: 'image', width: 2, height: 1, jpeg: minimalJpeg() }),
  }))
  assert.deepEqual(duringClose.at(-1), { type: 'terminal', status: 'busy' })
  release()
  assert.deepEqual((await task).at(-1), { type: 'terminal', status: 'cancelled' })
  assert.equal(h.released, 1)
})

test('Apple first-sample download is ID-mapped, click-only, redirect-free, private and explicitly cleaned', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pdsh-wallpaper-download-test-'))
  const id = SYSTEM_WALLPAPER_IDS[0]!
  let fetchCalls = 0
  let requestUrl = ''
  let requestInit: RequestInit | undefined
  try {
    const downloader = createAppleWallpaperDownloader({
      tempDirectory: directory,
      fetcher: async (url, init) => {
        fetchCalls++
        requestUrl = url
        requestInit = init
        return appleRangeResponse(init)
      },
    })
    const signal = new AbortController().signal
    const video = await downloader(id, signal)
    assert.equal(fetchCalls, 3, 'three finite requests begin only from the explicit acquisition path')
    assert.equal(requestUrl, APPLE_WALLPAPER_VIDEO_URLS[id])
    assert.equal(requestInit?.method, 'GET')
    assert.equal(requestInit?.redirect, 'error')
    assert.equal(video.path.startsWith(directory), true)
    const info = await lstat(video.path)
    assert.equal(info.isFile(), true)
    assert.equal(info.mode & 0o777, 0o600)
    assert.ok(info.size < 4096)
    assert.deepEqual((await readFile(video.path)).subarray(-SYSTEM_WALLPAPER_MOV_FIXTURE.sourceFirstSampleSize),
      Buffer.from(SYSTEM_WALLPAPER_MOV_FIXTURE.sourceFirstSampleBytes))
    await video.cleanup()
    await assert.rejects(access(video.path))
    assert.deepEqual((await readdir(directory)), [])
    await assert.rejects(downloader('file:///tmp/owned.mov', signal), { code: 'invalid-request' })
    assert.equal(fetchCalls, 3, 'an unknown ID cannot smuggle a URL')
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('requested Range and actual streamed bytes enforce the hard budget without leaking HTTP errors', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pdsh-wallpaper-budget-test-'))
  const signal = new AbortController().signal
  try {
    const declaredTooLarge = createAppleWallpaperDownloader({
      tempDirectory: directory,
      maxBytes: 4,
      fetcher: async () => new Response(Buffer.from('never-read'), { status: 200, headers: { 'content-length': '5' } }),
    })
    await assert.rejects(declaredTooLarge(SYSTEM_WALLPAPER_IDS[0]!, signal), { code: 'byte-budget-exceeded' })
    assert.deepEqual(await readdir(directory), [], 'preflight rejection removes the Host temporary root')

    const actualTooLarge = createAppleWallpaperDownloader({
      tempDirectory: directory,
      maxBytes: 64,
      fetcher: async (_url, init) => new Response(new Uint8Array(65), { status: 206, headers: appleRangeResponse(init).headers }),
    })
    await assert.rejects(actualTooLarge(SYSTEM_WALLPAPER_IDS[0]!, signal), { code: 'byte-budget-exceeded' })
    assert.deepEqual(await readdir(directory), [])

    const redirects = createAppleWallpaperDownloader({
      tempDirectory: directory,
      fetcher: async () => { throw new Error('redirect target https://evil.invalid/raw/path') },
    })
    await assert.rejects(redirects(SYSTEM_WALLPAPER_IDS[0]!, signal), error => {
      assert.equal((error as { code?: unknown }).code, 'download-failed')
      assert.doesNotMatch(String(error), /evil\.invalid|raw\/path/)
      return true
    })
    assert.deepEqual(await readdir(directory), [])
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('cancellation waits for the download request to actually settle before deleting its temporary root', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pdsh-wallpaper-cancel-test-'))
  const controller = new AbortController()
  let started!: () => void
  const fetchStarted = new Promise<void>(resolve => { started = resolve })
  let finishFetch!: (error: Error) => void
  const fetchPending = new Promise<Response>((_resolve, reject) => { finishFetch = reject })
  let settled = false
  const downloader = createAppleWallpaperDownloader({
    tempDirectory: directory,
    fetcher: async (_url, init) => {
      init.signal?.addEventListener('abort', () => setTimeout(() => finishFetch(new Error('settled after abort')), 20), { once: true })
      started()
      return fetchPending
    },
  })
  const task = downloader(SYSTEM_WALLPAPER_IDS[0]!, controller.signal).catch(error => error)
  void task.then(() => { settled = true })
  await fetchStarted
  controller.abort()
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(settled, false, 'abort signal does not pretend that the fetch operation has settled')
  const failure = await task
  assert.equal((failure as { code?: unknown }).code, 'cancelled')
  assert.equal(settled, true)
  assert.deepEqual(await readdir(directory), [], 'temporary root is removed only after the actual download settles')
  await rm(directory, { recursive: true, force: true })
})

test('download timeout is bounded and cleanup waits for the timed-out request to settle', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const directory = await mkdtemp(join(tmpdir(), 'pdsh-wallpaper-timeout-test-'))
  let started!: () => void
  const fetchStarted = new Promise<void>(resolve => { started = resolve })
  let aborted!: () => void
  const abortRequested = new Promise<void>(resolve => { aborted = resolve })
  let finishFetch!: (error: Error) => void
  const fetchPending = new Promise<Response>((_resolve, reject) => { finishFetch = reject })
  let settled = false
  const downloader = createAppleWallpaperDownloader({
    tempDirectory: directory,
    timeoutMs: 1,
    fetcher: async (_url, init) => {
      const onAbort = () => {
        aborted()
        setTimeout(() => finishFetch(new Error('private timeout path')), 20)
      }
      if (init.signal?.aborted) onAbort()
      else init.signal?.addEventListener('abort', onAbort, { once: true })
      started()
      return fetchPending
    },
  })
  const task = downloader(SYSTEM_WALLPAPER_IDS[0]!, new AbortController().signal).catch(error => error)
  void task.then(() => { settled = true })
  // +--- 先确认网络已开始，再推进时钟；不依赖临时目录I/O能在1ms内完成。 ---+
  await fetchStarted
  t.mock.timers.tick(1)
  await abortRequested
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(settled, false, 'timeout abort is not mistaken for completed network I/O')
  assert.equal((await readdir(directory)).length, 1, 'temporary root remains owned while fetch is unsettled')
  t.mock.timers.tick(20)
  const failure = await task
  assert.equal((failure as { code?: unknown }).code, 'download-failed')
  assert.doesNotMatch(String(failure), /private timeout path|pdsh-wallpaper-timeout-test/)
  assert.deepEqual(await readdir(directory), [])
  await rm(directory, { recursive: true, force: true })
})

test('certificate rejection crosses the official wallpaper stream as only a fixed terminal code', async () => {
  const stream = createSystemWallpaperStream({
    request: { kind: 'load', id: SYSTEM_WALLPAPER_IDS[1]! },
    signal: new AbortController().signal,
    lifetimeSignal: new AbortController().signal,
    platform: 'darwin', enabled: () => true, disposed: () => false,
    reserve: reservationHarness().reserve,
    list: async () => [],
    load: async () => { throw Object.assign(new Error('private certificate details'), { code: 'download-certificate-failed' }) },
  })
  assert.deepEqual(await collect(stream), [{ type: 'terminal', status: 'download-certificate-failed' }])
})

test('temporary MOV cleanup failure is fixed and cannot produce an image or loaded terminal', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pdsh-wallpaper-cleanup-test-'))
  let removeCalls = 0
  const downloader = createAppleWallpaperDownloader({
    tempDirectory: directory,
    fetcher: async (_url, init) => appleRangeResponse(init),
    removeDirectory: async path => {
      removeCalls++
      throw new Error(`raw cleanup failure at ${path}`)
    },
  })
  try {
    const video = await downloader(SYSTEM_WALLPAPER_IDS[0]!, new AbortController().signal)
    await assert.rejects(video.cleanup(), error => {
      assert.equal((error as { code?: unknown }).code, 'download-failed')
      assert.doesNotMatch(String(error), /raw cleanup failure|pdsh-wallpaper-cleanup-test/)
      return true
    })
    assert.equal(removeCalls, 1)

    const stream = createSystemWallpaperStream({
      request: { kind: 'load', id: SYSTEM_WALLPAPER_IDS[0]! },
      signal: new AbortController().signal,
      lifetimeSignal: new AbortController().signal,
      platform: 'darwin', enabled: () => true, disposed: () => false,
      reserve: reservationHarness().reserve,
      list: async () => [],
      load: async id => {
        const downloaded = await downloader(id, new AbortController().signal)
        try { return { id, sourceType: 'video' as const, width: 2, height: 1, jpeg: minimalJpeg() } }
        finally { await downloaded.cleanup() }
      },
    })
    const frames = await collect(stream)
    assert.deepEqual(frames, [{ type: 'terminal', status: 'download-failed' }])
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('versioned CaptureRuntime revalidates captureEnabled with a fake catalog; revocation waits for wallpaper helper close', async () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')
  const childProcess = createRequire(import.meta.url)('node:child_process') as { spawn: (...args: any[]) => unknown }
  const originalSpawn = childProcess.spawn
  const accepted = { captureEnabled: false }
  const child = new FakeChild()
  const argsSeen: string[][] = []
  let spawned!: () => void
  const spawnSeen = new Promise<void>(resolve => { spawned = resolve })
  let settled = false
  const testHost = async () => {
    const compiled = await build({ entryPoints: ['src/host/capture-runtime.ts'], bundle: true, write: false,
      platform: 'node', format: 'cjs', target: 'es2022', logLevel: 'silent',
      plugins: [{
        name: 'fixture-system-wallpaper-catalog',
        setup(pluginBuild) {
          pluginBuild.onResolve({ filter: /system-wallpaper-catalog\.ts$/ }, args => ({
            path: args.path,
            namespace: 'pdsh-system-wallpaper-catalog-fixture',
          }))
          pluginBuild.onLoad({ filter: /.*/, namespace: 'pdsh-system-wallpaper-catalog-fixture' }, () => ({
            contents: `export async function discoverSystemWallpaperSources() {
              return [{ id: 'system-wallpaper-golden-gate', name: 'Golden Gate', available: true, downloadable: false }];
            }`,
            loader: 'js',
          }))
        },
      }],
      define: {
        __PDSH_BUNDLE_NAME__: JSON.stringify('@daftai/pdsh-rc'),
        __PDSH_VERSION__: JSON.stringify('0.4.0-rc.1'),
        'import.meta.url': JSON.stringify(new URL('../src/host/capture-runtime.ts', import.meta.url).href),
      } })
    const module = { exports: {} as Record<string, any> }
    Object.defineProperty(process, 'platform', { ...platformDescriptor, value: 'darwin' })
    childProcess.spawn = (_file: string, args: string[]) => {
      argsSeen.push(Array.from(args))
      queueMicrotask(() => { child.emit('spawn'); spawned() })
      return child
    }
    syncBuiltinESMExports()
    runInNewContext(compiled.outputFiles[0]!.text, {
      module, exports: module.exports, AbortController, Buffer, URL, process,
      setTimeout, clearTimeout, require: createRequire(import.meta.url),
    })
    const { CaptureRuntime, contract, wallpaperContract } = module.exports
    assert.equal(contract, 'pdsh-capture-runtime-v1')
    assert.equal(wallpaperContract, 'pdsh-wallpaper-runtime-v1')
    const ctx = {
      settings: { describe: () => [{ ns: 'pdsh-rc', value: accepted }] },
      logger: { info() {} },
    }
    const runtime = new CaptureRuntime(ctx as never)
    try {
      const initiallyDisabled = await collect(runtime.wallpaper({ kind: 'list' }, new AbortController().signal))
      assert.equal(JSON.stringify(initiallyDisabled), JSON.stringify([{ type: 'terminal', status: 'not-enabled' }]))
      assert.equal(argsSeen.length, 0, 'accepted false does not start even a directory helper')

      accepted.captureEnabled = true
      const request = collect(runtime.wallpaper({ kind: 'load', id: SYSTEM_WALLPAPER_IDS[0] }, new AbortController().signal))
      await spawnSeen
      accepted.captureEnabled = false
      runtime.refreshCaptureEnabled()
      assert.deepEqual(child.kills, ['SIGTERM'], 'the root accepted-Settings transition aborts the in-flight child')
      void request.then(() => { settled = true })
      await new Promise(resolve => setImmediate(resolve))
      assert.equal(settled, false, 'Host revocation does not release until native close')
      assert.deepEqual(argsSeen, [['--wallpaper', SYSTEM_WALLPAPER_IDS[0]]])
      child.closed = true
      child.stdout.end()
      child.stderr.end()
      child.emit('close', null, 'SIGTERM')
      assert.equal(JSON.stringify((await request).at(-1)), JSON.stringify({ type: 'terminal', status: 'cancelled' }))
      assert.equal(settled, true)
      assert.equal(JSON.stringify(await collect(runtime.wallpaper({ kind: 'list' }, new AbortController().signal))),
        JSON.stringify([{ type: 'terminal', status: 'not-enabled' }]))
      assert.equal(argsSeen.length, 1, 'the new disabled generation cannot start another helper')
    } finally {
      if (!child.closed) {
        child.closed = true
        child.stdout.end()
        child.stderr.end()
        child.emit('close', null, 'SIGTERM')
      }
      await runtime.dispose()
    }
  }
  try { await testHost() }
  finally {
    childProcess.spawn = originalSpawn
    syncBuiltinESMExports()
    if (platformDescriptor) Object.defineProperty(process, 'platform', platformDescriptor)
  }
})
