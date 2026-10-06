/**
 * [INPUT]: 依赖系统curl Range transport、Host壁纸固定错误码与共享取样预算。
 * [OUTPUT]: 锁定固定Apple URL/参数、stdout预算、碎片正文单Buffer、分配失败固定码与取消真实close结算。
 * [POS]: system-wallpaper-download 的单Range传输合同；fake child不联网，不改TLS/proxy，也不证明Desktop网络。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import type { Readable } from 'node:stream'
import test from 'node:test'
import {
  createAppleWallpaperRangeFetcher,
  isAppleWallpaperVideoUrl,
  type WallpaperTransportChild,
  type WallpaperTransportScheduler,
} from '../src/host/system-wallpaper-transport.ts'
import type { NativeWallpaperFailureCode } from '../src/host/system-wallpaper-native.ts'
import { WALLPAPER_LIMITS } from '../src/shared/system-wallpaper-protocol.ts'

const url = 'https://sylvan.apple.com/itunes-assets/Aerials116/v4/a/b/c/video.mov'
const etag = '"fixed-apple-object"'
const range = 'bytes=0-3'
const expectedBody = Buffer.from([0, 1, 2, 3])

class FakeChild extends EventEmitter implements WallpaperTransportChild {
  readonly stdout = new PassThrough()
  readonly stderr = new PassThrough()
  readonly signals: NodeJS.Signals[] = []
  kill(signal: NodeJS.Signals): boolean { this.signals.push(signal); return true }
  close(code: number | null = 0, signal: NodeJS.Signals | null = null): void {
    this.stdout.end()
    this.stderr.end()
    this.emit('close', code, signal)
  }
}

function responseHeader(overrides: Record<string, string> = {}): Buffer {
  const values: Record<string, string> = {
    'Content-Range': 'bytes 0-3/100',
    'Content-Length': '4',
    ETag: etag,
    ...overrides,
  }
  return Buffer.from(`HTTP/1.1 206 Partial Content\r\n${Object.entries(values).map(([name, value]) => `${name}: ${value}\r\n`).join('')}\r\n`, 'latin1')
}

function request(init: Partial<RequestInit> = {}): RequestInit {
  return {
    method: 'GET',
    redirect: 'error',
    headers: { Range: range, 'Accept-Encoding': 'identity' },
    ...init,
  }
}

function scriptedChild(options: {
  readonly header?: Buffer
  readonly body?: Buffer
  readonly stdoutChunks?: readonly Buffer[]
  readonly exitCode?: number
  readonly stderr?: Buffer
} = {}) {
  const child = new FakeChild()
  const calls: Array<{ file: string; args: readonly string[]; options: { shell: false } }> = []
  const spawnProcess = (file: string, args: readonly string[], spawnOptions: { shell: false }): FakeChild => {
    calls.push({ file, args, options: spawnOptions })
    queueMicrotask(() => {
      child.emit('spawn')
      if (options.stdoutChunks) {
        for (const chunk of options.stdoutChunks) child.stdout.write(chunk)
      } else {
        if (options.header) child.stdout.write(options.header)
        if (options.body) child.stdout.write(options.body)
      }
      if (options.stderr) child.stderr.write(options.stderr)
      child.close(options.exitCode ?? 0)
    })
    return child
  }
  return { child, calls, spawnProcess }
}

function codeIs(code: NativeWallpaperFailureCode) {
  return (error: unknown): boolean => Boolean(error && typeof error === 'object' && 'code' in error
    && (error as { code?: unknown }).code === code)
}

test('合法单Range以固定curl参数返回206；stdout头体分片不改变字节', async () => {
  const headers = responseHeader()
  const full = Buffer.concat([headers, expectedBody])
  const fixture = scriptedChild({
    stdoutChunks: [full.subarray(0, 9), full.subarray(9, headers.length - 2), full.subarray(headers.length - 2)],
  })
  const fetchRange = createAppleWallpaperRangeFetcher({ spawnProcess: fixture.spawnProcess })
  const response = await fetchRange(url, request({ headers: { Range: range, 'Accept-Encoding': 'identity', 'If-Match': etag } }))

  assert.equal(response.status, 206)
  assert.equal(response.headers.get('content-range'), 'bytes 0-3/100')
  assert.equal(response.headers.get('content-length'), '4')
  assert.equal(response.headers.get('etag'), etag)
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), expectedBody)
  assert.equal(fixture.calls.length, 1)
  assert.equal(fixture.calls[0]?.file, '/usr/bin/curl')
  assert.equal(fixture.calls[0]?.args[0], '--disable', '忽略用户curlrc')
  assert.equal(fixture.calls[0]?.options.shell, false)
  assert.deepEqual(fixture.calls[0]?.args.slice(0, 2), ['--disable', '--silent'])
  assert.ok(fixture.calls[0]?.args.includes('--suppress-connect-headers'))
  assert.ok(fixture.calls[0]?.args.includes('--range'))
  const optionValue = (name: string): string | undefined => {
    const index = fixture.calls[0]?.args.indexOf(name) ?? -1
    return index >= 0 ? fixture.calls[0]?.args[index + 1] : undefined
  }
  assert.equal(optionValue('--range'), '0-3')
  assert.equal(optionValue('--max-filesize'), '4')
  assert.equal(optionValue('--max-time'), String(WALLPAPER_LIMITS.downloadMs / 1000))
  assert.equal(optionValue('--output'), '-')
  assert.ok(fixture.calls[0]?.args.includes(`If-Match: ${etag}`))
  assert.equal(fixture.calls[0]?.args.at(-1), url)
  for (const unsafe of ['-k', '--insecure', '--cacert', '--capath', '--proxy', '-x', '--location', '-L']) {
    assert.ok(!fixture.calls[0]?.args.includes(unsafe), `must not pass ${unsafe}`)
  }
})

test('单字节碎片不积累与Range长度成比例的Buffer数组', async () => {
  const body = Buffer.alloc(64 * 1024)
  for (let index = 0; index < body.length; index++) body[index] = index % 251
  const header = Buffer.from(`HTTP/1.1 206 Partial Content\r\nContent-Range: bytes 0-${body.length - 1}/100000\r\nContent-Length: ${body.length}\r\nETag: ${etag}\r\n\r\n`, 'latin1')
  const stdout = new EventEmitter() as unknown as Readable
  const stderr = new PassThrough()
  const child = new EventEmitter() as EventEmitter & WallpaperTransportChild
  const signals: NodeJS.Signals[] = []
  Object.assign(child, {
    stdout,
    stderr,
    kill: (signal: NodeJS.Signals) => { signals.push(signal); return true },
  })
  const spawnProcess = (): WallpaperTransportChild => {
    queueMicrotask(() => {
      child.emit('spawn')
      ;(stdout as unknown as EventEmitter).emit('data', header)
      for (let offset = 0; offset < body.length; offset++) {
        ;(stdout as unknown as EventEmitter).emit('data', body.subarray(offset, offset + 1))
      }
      child.emit('close', 0, null)
    })
    return child
  }
  const fetchRange = createAppleWallpaperRangeFetcher({ spawnProcess })
  const originalConcat = Buffer.concat
  let largestConcatInput = 0
  Buffer.concat = ((list: readonly Uint8Array[], totalLength?: number): Buffer => {
    largestConcatInput = Math.max(largestConcatInput, list.length)
    return originalConcat(list, totalLength)
  }) as typeof Buffer.concat

  try {
    const response = await fetchRange(url, request({
      headers: { Range: `bytes=0-${body.length - 1}`, 'Accept-Encoding': 'identity' },
    }))
    assert.equal(response.status, 206)
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), body)
    assert.ok(largestConcatInput <= 2, `concat must not receive a body-sized chunk list, got ${largestConcatInput}`)
    assert.deepEqual(signals, [])
  } finally {
    Buffer.concat = originalConcat
  }
})

test('正文Buffer分配失败映射固定码并等待真实child close', async () => {
  const stdout = new EventEmitter() as unknown as Readable
  const stderr = new EventEmitter() as unknown as Readable
  const child = new EventEmitter() as EventEmitter & WallpaperTransportChild
  const signals: NodeJS.Signals[] = []
  let onKilled!: (signal: NodeJS.Signals) => void
  const killed = new Promise<NodeJS.Signals>(resolve => { onKilled = resolve })
  Object.assign(child, {
    stdout,
    stderr,
    kill: (signal: NodeJS.Signals) => { signals.push(signal); onKilled(signal); return true },
  })
  const header = responseHeader()
  const fetchRange = createAppleWallpaperRangeFetcher({
    spawnProcess: () => {
      queueMicrotask(() => {
        child.emit('spawn')
        ;(stdout as unknown as EventEmitter).emit('data', header)
      })
      return child
    },
  })
  const originalAllocUnsafe = Buffer.allocUnsafe
  Buffer.allocUnsafe = (() => { throw new Error('private allocation detail') }) as typeof Buffer.allocUnsafe
  const pending = fetchRange(url, request())
  let settled = false
  const observed = pending.then(() => { settled = true }, () => { settled = true })
  const rejection = assert.rejects(pending, codeIs('download-failed'))

  try {
    assert.equal(await killed, 'SIGTERM')
    assert.deepEqual(signals, ['SIGTERM'])
    await Promise.resolve()
    assert.equal(settled, false, 'allocation failure must not settle before child close')
  } finally {
    Buffer.allocUnsafe = originalAllocUnsafe
    child.emit('close', 0, null)
  }
  await rejection
  await observed
  assert.equal(settled, true)
})

test('URL validator接受下一Aerial目录号且拒绝编码/字面路径穿越', () => {
  assert.equal(isAppleWallpaperVideoUrl(url), true)
  assert.equal(isAppleWallpaperVideoUrl('https://sylvan.apple.com/itunes-assets/Aerials117/v5/next/video.mov'), true)
  assert.equal(isAppleWallpaperVideoUrl('https://sylvan.apple.com/itunes-assets/Aerials117/%2e%2e/video.mov'), false)
  assert.equal(isAppleWallpaperVideoUrl('https://sylvan.apple.com/itunes-assets/Aerials117/v1/../video.mov'), false)
  assert.equal(isAppleWallpaperVideoUrl('https://user@sylvan.apple.com/itunes-assets/Aerials117/video.mov'), false)
  assert.equal(isAppleWallpaperVideoUrl('https://sylvan.apple.com:444/itunes-assets/Aerials117/video.mov'), false)
  assert.equal(isAppleWallpaperVideoUrl('https://sylvan.apple.com/itunes-assets/Aerials117/video.mov?download=1'), false)
  assert.equal(isAppleWallpaperVideoUrl(null), false)
})

test('拒绝非Apple URL、危险URL部分和非GET/重定向/超预算参数且不启动进程', async () => {
  let spawns = 0
  const fetchRange = createAppleWallpaperRangeFetcher({ spawnProcess: () => { spawns++; return new FakeChild() } })
  const invalid: Array<[string, RequestInit]> = [
    ['https://example.com/itunes-assets/Aerials116/video.mov', request()],
    ['http://sylvan.apple.com/itunes-assets/Aerials116/video.mov', request()],
    ['https://user@sylvan.apple.com/itunes-assets/Aerials116/video.mov', request()],
    ['https://sylvan.apple.com:443/itunes-assets/Aerials116/video.mov', request()],
    [`${url}?x=1`, request()],
    [`${url}#fragment`, request()],
    [url.replace('/Aerials116/', '/AerialsX/'), request()],
    [url, request({ method: 'POST' })],
    [url, request({ redirect: 'follow' })],
    [url, request({ body: 'not allowed' })],
    [url, request({ credentials: 'include' })],
    [url, request({ headers: { Range: `bytes=0-${WALLPAPER_LIMITS.maxVideoSampleBytes}`, 'Accept-Encoding': 'identity' } })],
    [url, request({ headers: { Range: 'bytes=4-3', 'Accept-Encoding': 'identity' } })],
    [url, request({ headers: { Range: 'bytes=00-3', 'Accept-Encoding': 'identity' } })],
    [url, request({ headers: { Range: range, 'Accept-Encoding': 'gzip' } })],
    [url, request({ headers: { Range: range, 'Accept-Encoding': 'identity', 'If-Match': 'W/"weak"' } })],
  ]
  for (const [source, init] of invalid) await assert.rejects(fetchRange(source, init), codeIs('invalid-request'))
  assert.equal(spawns, 0)
})

test('拒绝redirect与不安全、重复、错位Range响应头', async t => {
  const cases: Array<[string, Buffer, Buffer]> = [
    ['redirect', Buffer.from('HTTP/1.1 302 Found\r\nLocation: https://example.com/x\r\n\r\n'), Buffer.alloc(0)],
    ['duplicate etag', Buffer.from(`HTTP/1.1 206 Partial Content\r\nContent-Range: bytes 0-3/100\r\nContent-Length: 4\r\nETag: ${etag}\r\netag: "other"\r\n\r\n`), expectedBody],
    ['wrong range', responseHeader({ 'Content-Range': 'bytes 1-4/100' }), expectedBody],
    ['weak etag', responseHeader({ ETag: `W/${etag}` }), expectedBody],
    ['wrong content encoding', responseHeader({ 'Content-Encoding': 'gzip' }), expectedBody],
  ]
  for (const [name, header, body] of cases) await t.test(name, async () => {
    const fixture = scriptedChild({ header, body })
    await assert.rejects(createAppleWallpaperRangeFetcher({ spawnProcess: fixture.spawnProcess })(url, request()), codeIs('download-failed'))
    assert.equal(fixture.calls[0]?.args.includes('--location'), false)
  })
})

test('允许并忽略重复的非控制面CDN诊断头', async () => {
  const header = Buffer.from(`HTTP/1.1 206 Partial Content\r\nContent-Range: bytes 0-3/100\r\nContent-Length: 4\r\nETag: ${etag}\r\nX-Cache-Status: HIT\r\nx-cache-status: EDGE\r\n\r\n`)
  const fixture = scriptedChild({ header, body: expectedBody })
  const response = await createAppleWallpaperRangeFetcher({ spawnProcess: fixture.spawnProcess })(url, request())
  assert.equal(response.status, 206)
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), expectedBody)
})

test('拒绝超过16KiB响应头及超过本次Range预算的完整stdout', async t => {
  for (const [name, header, body] of [
    ['large header', Buffer.from(`HTTP/1.1 206 Partial Content\r\nX-Fill: ${'a'.repeat(17 * 1024)}\r\n`), expectedBody],
    ['oversize body', responseHeader(), Buffer.from([0, 1, 2, 3, 4])],
  ] as const) await t.test(name, async () => {
    const fixture = scriptedChild({ header, body })
    await assert.rejects(createAppleWallpaperRangeFetcher({ spawnProcess: fixture.spawnProcess })(url, request()), codeIs('byte-budget-exceeded'))
    assert.ok(fixture.child.signals.includes('SIGTERM'))
  })
})

test('仅curl结构化证书退出码映射为固定码，其他非零码不泄漏stderr', async t => {
  for (const code of [60, 51, 77]) await t.test(String(code), async () => {
    const fixture = scriptedChild({ exitCode: code, stderr: Buffer.from('/private/user/cert.pem') })
    await assert.rejects(createAppleWallpaperRangeFetcher({ spawnProcess: fixture.spawnProcess })(url, request()), codeIs('download-certificate-failed'))
  })
  const other = scriptedChild({ exitCode: 22, stderr: Buffer.from('server said secret') })
  await assert.rejects(createAppleWallpaperRangeFetcher({ spawnProcess: other.spawnProcess })(url, request()), error => {
    assert.ok(codeIs('download-failed')(error))
    assert.doesNotMatch(String(error), /secret|private|cert\.pem/)
    return true
  })
})

test('stderr超过1KiB立即终止并只等child close结算', async () => {
  const fixture = scriptedChild({ header: responseHeader(), body: expectedBody, stderr: Buffer.alloc(1025, 0x61) })
  await assert.rejects(createAppleWallpaperRangeFetcher({ spawnProcess: fixture.spawnProcess })(url, request()), codeIs('download-failed'))
  assert.ok(fixture.child.signals.includes('SIGTERM'))
})

test('取消时先SIGTERM；close前promise仍pending；2秒后SIGKILL并继续等待close', async () => {
  const child = new FakeChild()
  let settled = false
  const timers = new Map<number, { delay: number; callback: () => void }>()
  let nextTimer = 0
  const scheduler: WallpaperTransportScheduler = {
    set(callback, delay) { const id = ++nextTimer; timers.set(id, { delay, callback }); return id },
    clear(handle) { timers.delete(handle as number) },
  }
  const controller = new AbortController()
  const fetchRange = createAppleWallpaperRangeFetcher({ spawnProcess: () => {
    queueMicrotask(() => child.emit('spawn'))
    return child
  }, scheduler })
  const operation = fetchRange(url, request({ signal: controller.signal })).finally(() => { settled = true })
  await new Promise(resolve => setImmediate(resolve))
  controller.abort()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(child.signals, ['SIGTERM'])
  assert.equal(settled, false, 'abort不早于真实close结算')
  const killTimer = [...timers.values()].find(timer => timer.delay === 2000)
  assert.ok(killTimer, 'SIGTERM后必须排程2秒强杀')
  killTimer.callback()
  assert.deepEqual(child.signals, ['SIGTERM', 'SIGKILL'])
  assert.equal(settled, false, 'SIGKILL仍不等于child close')
  child.close(0, 'SIGKILL')
  await assert.rejects(operation, codeIs('cancelled'))
  assert.equal(settled, true)
  assert.equal(timers.size, 0, 'close后撤回全部计时器')
})

test('请求超时同样先SIGTERM再等待两秒SIGKILL；仍以真实close结算', async () => {
  const child = new FakeChild()
  const timers = new Map<number, { delay: number; callback: () => void }>()
  let nextTimer = 0
  const scheduler: WallpaperTransportScheduler = {
    set(callback, delay) { const id = ++nextTimer; timers.set(id, { delay, callback }); return id },
    clear(handle) { timers.delete(handle as number) },
  }
  const fetchRange = createAppleWallpaperRangeFetcher({ spawnProcess: () => {
    queueMicrotask(() => child.emit('spawn'))
    return child
  }, scheduler })
  let settled = false
  const operation = fetchRange(url, request()).finally(() => { settled = true })
  await new Promise(resolve => setImmediate(resolve))
  const requestTimer = [...timers.values()].find(timer => timer.delay === WALLPAPER_LIMITS.downloadMs)
  assert.ok(requestTimer)
  requestTimer.callback()
  assert.deepEqual(child.signals, ['SIGTERM'])
  assert.equal(settled, false)
  const forceTimer = [...timers.values()].find(timer => timer.delay === 2000)
  assert.ok(forceTimer)
  forceTimer.callback()
  assert.deepEqual(child.signals, ['SIGTERM', 'SIGKILL'])
  assert.equal(settled, false)
  child.close(0, 'SIGKILL')
  await assert.rejects(operation, codeIs('download-failed'))
  assert.equal(timers.size, 0)
})

test('close前有效stdout也不能提前返回Response；成功后可读完整body', async () => {
  const child = new FakeChild()
  const fetchRange = createAppleWallpaperRangeFetcher({ spawnProcess: () => {
    queueMicrotask(() => {
      child.emit('spawn')
      child.stdout.write(responseHeader())
      child.stdout.write(expectedBody)
      child.stdout.end()
      child.stderr.end()
    })
    return child
  } })
  let settled = false
  const operation = fetchRange(url, request()).finally(() => { settled = true })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(settled, false)
  child.emit('close', 0, null)
  const response = await operation
  assert.equal(response.status, 206)
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), expectedBody)
})
