/**
 * [INPUT]: 依赖 Host 的惰性 stream/lifetime 接缝与 shared owned-window wire DTO。
 * [OUTPUT]: 固定显式触发、单航班、有界 chunk、取消和真实收敛的 Host 捕获合同。
 * [POS]: Host stream 红测；不启动原生 helper、不申请 macOS 权限、不触碰 Client 继承测试。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createCaptureFrameStream, createCaptureServiceLifetime } from '../src/host/window-capture-stream.ts'
import { CAPTURE_LIMITS, type CaptureFrame } from '../src/shared/window-capture-protocol.ts'

function nativePng(width = 2, height = 2): Buffer {
  const bytes = Buffer.alloc(33)
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(bytes)
  bytes.writeUInt32BE(13, 8)
  bytes.write('IHDR', 12, 'ascii')
  bytes.writeUInt32BE(width, 16)
  bytes.writeUInt32BE(height, 20)
  return bytes
}

test('constructing a stream does not start capture; pulled stream describes an owned window only', async () => {
  const lifetime = createCaptureServiceLifetime()
  const png = nativePng()
  let calls = 0
  const frames: CaptureFrame[] = []
  const stream = createCaptureFrameStream({
    signal: new AbortController().signal,
    lifetimeSignal: lifetime.signal,
    reserve: lifetime.reserve,
    capture: async ({ onPhase }) => {
      calls++
      onPhase('authorization-required')
      onPhase('capture-ready')
      return { png, width: 2, height: 2, scope: 'owned-window', pointPixelScale: 2 }
    },
  })

  assert.equal(calls, 0)
  for await (const frame of stream) frames.push(frame)
  assert.equal(calls, 1)
  assert.deepEqual(frames.slice(0, 2), [
    { type: 'phase', phase: 'authorization-required' },
    { type: 'phase', phase: 'capture-ready' },
  ])
  assert.deepEqual(frames[2], {
    type: 'image', scope: 'owned-window', width: 2, height: 2,
    pointPixelScale: 2, pngBytes: png.length, chunkCount: 1,
  })
  assert.deepEqual(frames.at(-1), { type: 'terminal', status: 'captured' })
  assert.ok(frames.filter(frame => frame.type === 'chunk').every(frame => Buffer.from(frame.base64, 'base64').length <= CAPTURE_LIMITS.pngChunkBytes))
  assert.ok(!JSON.stringify(frames).includes('current-page'))
  assert.ok(!JSON.stringify(frames).includes('url'))
  await lifetime.dispose()
})

test('disposing service aborts capture but waits for helper settlement before releasing its flight', async () => {
  const lifetime = createCaptureServiceLifetime()
  let finish!: () => void
  let signal!: AbortSignal
  const stream = createCaptureFrameStream({
    signal: new AbortController().signal,
    lifetimeSignal: lifetime.signal,
    reserve: lifetime.reserve,
    capture: async ({ signal: operationSignal, onPhase }) => {
      signal = operationSignal
      onPhase('authorization-required')
      await new Promise<void>(resolve => { finish = resolve })
      return { png: nativePng(), width: 2, height: 2, scope: 'owned-window', pointPixelScale: 1 }
    },
  })
  const iterator = stream[Symbol.asyncIterator]()
  assert.deepEqual(await iterator.next(), { done: false, value: { type: 'phase', phase: 'authorization-required' } })
  const teardown = lifetime.dispose()
  await Promise.resolve()
  assert.equal(signal.aborted, true)
  let settled = false
  void teardown.then(() => { settled = true })
  await Promise.resolve()
  assert.equal(settled, false)
  finish()
  await teardown
  assert.deepEqual(await iterator.next(), { done: false, value: { type: 'terminal', status: 'cancelled' } })
  assert.equal((await iterator.next()).done, true)
})

test('abort while next waits does not starve the helper settlement timer', async () => {
  const lifetime = createCaptureServiceLifetime()
  const controller = new AbortController()
  let helperSettled = false
  let helperSignal!: AbortSignal
  const stream = createCaptureFrameStream({
    signal: controller.signal,
    lifetimeSignal: lifetime.signal,
    reserve: lifetime.reserve,
    capture: async ({ signal, onPhase }) => {
      helperSignal = signal
      onPhase('authorization-required')
      await new Promise<void>(resolve => setTimeout(resolve, 15))
      helperSettled = true
      return { png: nativePng(), width: 2, height: 2, scope: 'owned-window', pointPixelScale: 1 }
    },
  })
  const iterator = stream[Symbol.asyncIterator]()

  assert.equal((await iterator.next()).value?.type, 'phase')
  const waitingNext = iterator.next()
  controller.abort()

  assert.deepEqual(await waitingNext, {
    done: false,
    value: { type: 'terminal', status: 'cancelled' },
  })
  assert.equal(helperSignal.aborted, true)
  assert.equal(helperSettled, false)

  // Returning the terminal frame is prompt; releasing the singleflight slot is not.
  const teardown = lifetime.dispose()
  await teardown
  assert.equal(helperSettled, true)
  assert.deepEqual(await iterator.next(), { done: true, value: undefined })
})
