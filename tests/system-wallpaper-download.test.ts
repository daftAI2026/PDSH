/**
 * [INPUT]: 依赖固定 Apple 下载器、shared 预算、人工 MOV fixture 与 Windows 测试视图。
 * [OUTPUT]: 验证协议/预算/取消；测试视图不证明真实 Windows ACL，POSIX mode 只在 POSIX stat 平台断言。
 * [POS]: 网络到本地首帧文件的窄合同；不联网或运行 native，不把人工 sample 当作真实解码证据。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import { lstat, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { APPLE_WALLPAPER_VIDEO_URLS, createAppleWallpaperDownloader } from '../src/host/system-wallpaper-download.ts'
import { WALLPAPER_LIMITS } from '../src/shared/system-wallpaper-protocol.ts'
import { createSystemWallpaperMovFixture } from './system-wallpaper-mov-fixture.ts'

const id = 'system-wallpaper-golden-gate-sunset'
const etag = '"fixed-apple-object"'
const mutableFsPromises = createRequire(import.meta.url)('node:fs/promises') as { lstat: (...args: any[]) => Promise<any> }
const realLstat = mutableFsPromises.lstat

async function withWindowsPosixMetadata<T>(run: () => Promise<T>): Promise<T> {
  if (process.platform !== 'win32') return run()
  mutableFsPromises.lstat = async (...args: any[]) => {
    const info = await realLstat(...args)
    const mode = (info.mode & ~0o777) | (info.isDirectory() ? 0o700 : 0o600)
    Object.defineProperty(info, 'mode', { value: mode, configurable: true })
    return info
  }
  syncBuiltinESMExports()
  try { return await run() }
  finally {
    mutableFsPromises.lstat = realLstat
    syncBuiltinESMExports()
  }
}

function rangeHarness(sourceLength = 600 * 1024 * 1024) {
  const fixture = createSystemWallpaperMovFixture(sourceLength)
  const requests: Array<{ url: string; init: RequestInit; headers: Headers }> = []
  const bodies = [fixture.headerPrefix, fixture.moovBytes, fixture.sourceFirstSampleBytes]
  const starts = [0, fixture.moovOffset, fixture.sourceFirstSampleOffset]
  const respond = (index: number, headers: Record<string, string> = {}, body = bodies[index], status = 206) => new Response(body, {
    status,
    headers: {
      'content-range': `bytes ${starts[index]}-${starts[index] + bodies[index].byteLength - 1}/${fixture.sourceTotalBytes}`,
      'content-length': String(bodies[index].byteLength),
      etag,
      ...headers,
    },
  })
  return {
    fixture, requests, respond,
    fetcher: async (url: string, init: RequestInit) => {
      const index = requests.length
      requests.push({ url, init, headers: new Headers(init.headers) })
      assert.ok(index < 3, 'the downloader never falls back to full GET')
      return respond(index)
    },
  }
}

async function withRoot(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'pdsh-range-test-'))
  try { await withWindowsPosixMetadata(() => run(directory)) }
  finally { await rm(directory, { recursive: true, force: true }) }
}

async function withRawRoot(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'pdsh-range-posix-test-'))
  try { await run(directory) }
  finally { await rm(directory, { recursive: true, force: true }) }
}

async function waitForSignal(signal: Promise<void>, label: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      signal,
      new Promise<void>((_resolve, reject) => { timer = setTimeout(() => reject(new Error(`${label} did not settle within 2000ms`)), 2000) }),
    ])
  } finally { if (timer) clearTimeout(timer) }
}

test('known certificate rejection is distinguishable without changing trust, retrying or leaking raw errors', async t => {
  for (const code of ['UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID']) {
    await t.test(code, async () => withRoot(async directory => {
      const cause = Object.assign(new Error('private certificate details /Users/name/key.pem'), { code })
      let calls = 0
      const download = createAppleWallpaperDownloader({ tempDirectory: directory, fetcher: async (_url, init) => {
        calls++
        assert.deepEqual(Object.keys(init).sort(), ['headers', 'method', 'redirect', 'signal'])
        throw new TypeError('fetch failed with private details', { cause })
      } })
      await assert.rejects(download(id, new AbortController().signal), error => {
        assert.equal((error as { code?: unknown }).code, 'download-certificate-failed')
        assert.doesNotMatch(String(error), /private|Users|key\.pem|fetch failed/)
        return true
      })
      assert.equal(calls, 1, '证书拒绝不能自动重试或换网络策略')
      assert.deepEqual(await readdir(directory), [], '归还本次自有临时目录')
    }))
  }
})

test('raw TLS-looking text and unknown transport codes cannot masquerade as a certificate diagnosis', async () => withRoot(async directory => {
  for (const failure of [new Error('UNABLE_TO_GET_ISSUER_CERT_LOCALLY at /private/key.pem'),
    new TypeError('private failure', { cause: Object.assign(new Error('private details'), { code: 'ECONNRESET' }) })]) {
    const download = createAppleWallpaperDownloader({ tempDirectory: directory, fetcher: async () => { throw failure } })
    await assert.rejects(download(id, new AbortController().signal), error => {
      assert.equal((error as { code?: unknown }).code, 'download-failed')
      assert.doesNotMatch(String(error), /private|key\.pem|ECONNRESET/)
      return true
    })
  }
  assert.deepEqual(await readdir(directory), [])
}))

test('large fixed Apple source uses only three bounded ranges and produces a complete single-sample file', async () => withRoot(async directory => {
  const h = rangeHarness()
  const video = await createAppleWallpaperDownloader({ tempDirectory: directory, fetcher: h.fetcher })(id, new AbortController().signal)
  assert.equal(h.requests.length, 3)
  assert.deepEqual(h.requests.map(request => request.headers.get('range')), [
    'bytes=0-63',
    `bytes=${h.fixture.moovOffset}-${h.fixture.sourceTotalBytes - 1}`,
    `bytes=${h.fixture.sourceFirstSampleOffset}-${h.fixture.sourceFirstSampleOffset + h.fixture.sourceFirstSampleSize - 1}`,
  ])
  assert.deepEqual(h.requests.map(request => request.headers.get('if-match')), [null, etag, etag])
  for (const request of h.requests) {
    assert.equal(request.url, APPLE_WALLPAPER_VIDEO_URLS[id])
    assert.equal(request.init.method, 'GET')
    assert.equal(request.init.redirect, 'error')
    assert.equal(request.headers.get('accept-encoding'), 'identity')
  }
  const info = await lstat(video.path)
  assert.equal(info.isFile(), true)
  const bytes = await readFile(video.path)
  const types: string[] = []
  for (let offset = 0; offset < bytes.length;) {
    const size = bytes.readUInt32BE(offset)
    assert.ok(size >= 8 && offset + size <= bytes.length)
    types.push(bytes.toString('ascii', offset + 4, offset + 8))
    offset += size
    if (offset === bytes.length) assert.deepEqual(bytes.subarray(offset - h.fixture.sourceFirstSampleSize), Buffer.from(h.fixture.sourceFirstSampleBytes))
  }
  assert.deepEqual(types, ['ftyp', 'moov', 'mdat'])
  assert.ok(bytes.length < 4096, 'a 600 MiB logical source does not become a 600 MiB local allocation')
  await video.cleanup()
  await video.cleanup()
  assert.deepEqual(await readdir(directory), [])
}))

test('POSIX 临时目录与媒体文件权限分别保持0700和0600', {
  skip: process.platform === 'win32' ? 'Windows 不提供系统壁纸；Win32 stat 无法表达 POSIX 权限门，且此断言不验证 Windows ACL' : false,
}, async () => withRawRoot(async directory => {
  const h = rangeHarness()
  const video = await createAppleWallpaperDownloader({ tempDirectory: directory, fetcher: h.fetcher })(id, new AbortController().signal)
  assert.equal((await lstat(video.path)).mode & 0o777, 0o600)
  assert.equal((await lstat(join(video.path, '..'))).mode & 0o777, 0o700)
  await video.cleanup()
}))

test('range replies reject full GET, inconsistent addresses/objects, compression, malformed lengths and weak ETags', async t => {
  const scenarios = [
    { name: 'full response', index: 0, status: 200 },
    { name: 'wrong start', index: 0, headers: { 'content-range': 'bytes 1-64/629145600' } },
    { name: 'wrong end', index: 0, headers: { 'content-range': 'bytes 0-64/629145600' } },
    { name: 'unknown total', index: 0, headers: { 'content-range': 'bytes 0-63/*' } },
    { name: 'weak ETag', index: 0, headers: { etag: 'W/"weak"' } },
    { name: 'missing ETag', index: 0, headers: { etag: '' } },
    { name: 'compressed', index: 0, headers: { 'content-encoding': 'gzip' } },
    { name: 'missing length', index: 0, headers: { 'content-length': '' } },
    { name: 'different length', index: 0, headers: { 'content-length': '63' } },
    { name: 'object changed', index: 1, headers: { etag: '"new-object"' } },
    { name: 'total changed', index: 1, totalChanged: true },
    { name: 'precondition failed', index: 1, status: 412 },
    { name: 'fetcher ignored redirect policy', index: 0, redirected: true },
    { name: 'response came from another URL', index: 0, foreignUrl: true },
  ]
  for (const scenario of scenarios) await t.test(scenario.name, async () => withRoot(async directory => {
    const h = rangeHarness()
    let calls = 0
    const downloader = createAppleWallpaperDownloader({ tempDirectory: directory, fetcher: async () => {
      const index = calls++
      if (index !== scenario.index) return h.respond(index)
      const headers: Record<string, string> = { ...scenario.headers }
      if (scenario.totalChanged) headers['content-range'] = `bytes ${h.fixture.moovOffset}-${h.fixture.sourceTotalBytes - 1}/${h.fixture.sourceTotalBytes + 1}`
      const response = h.respond(index, headers, undefined, scenario.status)
      if (scenario.redirected) Object.defineProperty(response, 'redirected', { value: true })
      if (scenario.foreignUrl) Object.defineProperty(response, 'url', { value: 'https://other.invalid/redirected.mov' })
      return response
    } })
    await assert.rejects(downloader(id, new AbortController().signal), { code: 'download-failed' })
    assert.equal(calls, scenario.index + 1, 'reject before requesting any following range')
    assert.deepEqual(await readdir(directory), [])
  }))
})

test('actual body size and accumulated range budgets are hard gates with no whole-source fallback', async () => withRoot(async directory => {
  for (const kind of ['overflow', 'truncated', 'aggregate'] as const) {
    const h = rangeHarness()
    let calls = 0
    const downloader = createAppleWallpaperDownloader({ tempDirectory: directory,
      maxBytes: kind === 'aggregate' ? WALLPAPER_LIMITS.videoHeaderBytes : undefined,
      fetcher: async () => {
        const index = calls++
        if (kind === 'overflow') return h.respond(index, {}, new Uint8Array(65))
        if (kind === 'truncated') return h.respond(index, {}, new Uint8Array(63))
        return h.respond(index)
      },
    })
    await assert.rejects(downloader(id, new AbortController().signal), {
      code: kind === 'truncated' ? 'download-failed' : 'byte-budget-exceeded',
    })
    assert.equal(calls, 1)
    assert.deepEqual(await readdir(directory), [])
  }
}))

test('empty chunks cannot accumulate an unbounded fragment list within the byte budget', async () => withRoot(async directory => {
  const h = rangeHarness()
  let calls = 0
  const downloader = createAppleWallpaperDownloader({ tempDirectory: directory, fetcher: async (_url, init) => {
    const index = calls++
    if (index !== 0) return h.respond(index)
    const body = new ReadableStream<Uint8Array>({ start(stream) {
      stream.enqueue(new Uint8Array(0))
      stream.enqueue(h.fixture.headerPrefix)
      stream.close()
    } })
    return new Response(body, { status: 206, headers: h.respond(0).headers })
  } })
  await assert.rejects(downloader(id, new AbortController().signal), { code: 'download-failed' })
  assert.equal(calls, 1)
  assert.deepEqual(await readdir(directory), [])
}))

test('abort waits for actual body cancellation settlement before releasing owned media', async () => withRoot(async directory => {
  const h = rangeHarness()
  const controller = new AbortController()
  let reading!: () => void
  let cancellation!: () => void
  let finishCancellation!: () => void
  const started = new Promise<void>(resolve => { reading = resolve })
  const cancelStarted = new Promise<void>(resolve => { cancellation = resolve })
  const cancelPending = new Promise<void>(resolve => { finishCancellation = resolve })
  const body = new ReadableStream<Uint8Array>({
    pull() { reading() },
    cancel() { cancellation(); return cancelPending },
  }, { highWaterMark: 0 })
  const initial = h.respond(0)
  const downloader = createAppleWallpaperDownloader({ tempDirectory: directory, fetcher: async () => new Response(body, {
    status: 206, headers: initial.headers,
  }) })
  let settled = false
  const operation = downloader(id, controller.signal).catch(error => error)
  void operation.then(() => { settled = true })
  await waitForSignal(started, 'body read')
  controller.abort()
  await waitForSignal(cancelStarted, 'body cancellation')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(settled, false)
  assert.equal((await readdir(directory)).length, 1)
  finishCancellation()
  assert.equal((await operation).code, 'cancelled')
  assert.deepEqual(await readdir(directory), [])
}))
