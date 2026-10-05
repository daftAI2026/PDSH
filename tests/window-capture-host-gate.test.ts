/**
 * [INPUT]: 依赖真实 Cordis Loader-owner event、正式 WindowCaptureService、Host capture/save stream 与 Node 子进程边界。
 * [OUTPUT]: 验证 accepted captureEnabled 撤回同时 abort 两路并等待真实 fake-child settle；Settings 迟到就绪可恢复显式调用，但不复活已卸载服务。
 * [POS]: Host 生命周期集成合同；只替换 child_process.spawn 为可控假子进程，不运行 helper、不触发 TCC、不写图像。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import type { Fiber } from '@deepseek-ai/cordis'
import type { WindowCaptureService } from '../src/host/window-capture-service.ts'
import type { WindowSaveInputFrame, WindowSaveRequest } from '../src/shared/window-save-protocol.ts'
import { observeCaptureEnabled } from '../src/host/capture.ts'

type FakeChild = EventEmitter & {
  stdout: PassThrough
  stderr: PassThrough
  closed: boolean
  kills: NodeJS.Signals[]
  kill(signal: NodeJS.Signals): boolean
}

class WaitingUplink implements AsyncIterable<WindowSaveInputFrame> {
  readonly started: Promise<void>
  readonly closedPromise: Promise<void>
  closed = false
  private start!: () => void
  private resolveClosed!: () => void
  private resolveNext?: (result: IteratorResult<WindowSaveInputFrame>) => void

  constructor() {
    this.started = new Promise(resolve => { this.start = resolve })
    this.closedPromise = new Promise(resolve => { this.resolveClosed = resolve })
  }

  [Symbol.asyncIterator](): AsyncIterator<WindowSaveInputFrame> {
    return {
      next: () => {
        this.start()
        return new Promise(resolve => { this.resolveNext = resolve })
      },
      return: async () => {
        this.closed = true
        this.resolveClosed()
        this.resolveNext?.({ done: true, value: undefined })
        return { done: true, value: undefined }
      },
    }
  }
}

function makeFakeChild(settleDelayMs: number): FakeChild {
  const child = new EventEmitter() as FakeChild
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  child.closed = false
  child.kills = []
  child.kill = signal => {
    child.kills.push(signal)
    if (!child.closed) {
      setTimeout(() => {
        child.closed = true
        child.stdout.end()
        child.stderr.end()
        child.emit('close', null, signal)
      }, settleDelayMs)
    }
    return true
  }
  return child
}

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = []
  for await (const value of stream) values.push(value)
  return values
}

function emitLoaderVolatileUpdate(fiber: Fiber, paths: readonly (readonly string[])[]): void {
  // Loader Entry._commitVolatile emits with this owner filter, not a generic root event.
  const eventContext = Object.create(fiber.ctx) as Context
  const ownerFiber = fiber.ctx.fiber
  ;(eventContext as any)[Context.filter] = (owner: Context) => owner.fiber === ownerFiber
  ;(fiber.ctx.emit as any)(eventContext, 'loader/volatile-update', paths)
}

function deferredCount(items: readonly unknown[]) {
  const waiters = new Set<() => void>()
  return {
    wait(count: number): Promise<void> {
      if (items.length >= count) return Promise.resolve()
      return new Promise((resolve, reject) => {
        const wake = () => {
          if (items.length < count) return
          clearTimeout(timer)
          waiters.delete(wake)
          resolve()
        }
        const timer = setTimeout(() => {
          waiters.delete(wake)
          reject(new Error(`timed out waiting for fake helper ${count}`))
        }, 2_000)
        waiters.add(wake)
      })
    },
    wake(): void { for (const wake of [...waiters]) wake() },
  }
}

test('Settings becoming ready after service mount is revalidated on explicit capture without a volatile toggle', async () => {
  const childProcess = createRequire(import.meta.url)('node:child_process') as { spawn: (...args: any[]) => unknown }
  const originalSpawn = childProcess.spawn
  let nativeCalls = 0
  childProcess.spawn = () => { nativeCalls++; throw new Error('cancelled readiness probe must not spawn') }
  syncBuiltinESMExports()
  const root = new Context()
  let accepted: Record<string, unknown> | undefined
  let service!: WindowCaptureService
  const { WindowCaptureService: RuntimeWindowCaptureService } = await import('../index.js')
  const owner = root.plugin({ apply(ctx: Context) {
    ctx.provide('settings', { describe: () => accepted ? [{ ns: 'pdsh', value: accepted }] : [] })
    service = new RuntimeWindowCaptureService(ctx) as WindowCaptureService
  } })
  await owner
  const aborter = new AbortController()
  aborter.abort()
  // +--- 已取消请求只探测生命周期，不运行 helper、不请求录屏授权 ---+
  const terminal = () => collect(service.capture(aborter.signal))
  try {
    assert.deepEqual(await terminal(), [{ type: 'terminal', status: 'disposed' }], 'missing Settings stays closed')
    accepted = { captureEnabled: true }
    assert.deepEqual(await terminal(), [{ type: 'terminal', status: 'cancelled' }], 'ready Settings must not remain latched off')
    accepted.captureEnabled = false
    assert.deepEqual(await terminal(), [{ type: 'terminal', status: 'disposed' }], 'fresh accepted revocation wins without an event')
    accepted.captureEnabled = true
    assert.deepEqual(await terminal(), [{ type: 'terminal', status: 'cancelled' }])
    await owner.dispose()
    assert.deepEqual(await terminal(), [{ type: 'terminal', status: 'disposed' }], 'accepted true cannot revive a disposed service')
    assert.equal(nativeCalls, 0, 'mount/ready/revoke/dispose 均不执行原生 helper')
  } finally {
    await owner.dispose()
    childProcess.spawn = originalSpawn
    syncBuiltinESMExports()
  }
})

test('First save after late Settings readiness does not inherit the aborted mount generation', async () => {
  const root = new Context()
  let ready = false
  let uplinkReads = 0
  let service!: WindowCaptureService
  const { WindowCaptureService: RuntimeWindowCaptureService } = await import('../index.js')
  const owner = root.plugin({ apply(ctx: Context) {
    ctx.provide('settings', { describe: () => ready ? [{ ns: 'pdsh', value: {
      captureEnabled: true, saveDirectory: tmpdir(), saveFormat: 'png', fileNamePattern: 'PDSH-{date}-{time}',
    } }] : [] })
    service = new RuntimeWindowCaptureService(ctx.extend({ invocation: { uplink: () => {
      uplinkReads++
      return { async *[Symbol.asyncIterator]() {} }
    } } })) as WindowCaptureService
  } })
  await owner
  try {
    ready = true
    // +--- 无效请求应进入正常校验而非旧 generation 的 cancelled；不读像素、不写文件 ---+
    const frames = await collect(service.save({} as WindowSaveRequest, new AbortController().signal))
    assert.equal(frames.at(-1)?.type, 'terminal')
    assert.equal((frames.at(-1) as { code: string }).code, 'invalid-request')
    assert.equal(uplinkReads, 1, 'Remote 构造取得 carrier，但后端校验不迭代像素')
  } finally { await owner.dispose() }
})

test('Loader owner volatile update aborts the active Host capture and save, then re-enable waits for another click', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pdsh-window-host-gate-'))
  const childProcess = createRequire(import.meta.url)('node:child_process') as { spawn: (...args: any[]) => unknown }
  const originalSpawn = childProcess.spawn
  const children: FakeChild[] = []
  const spawns = deferredCount(children)
  const pendingUplink = new WaitingUplink()
  const accepted = {
    captureEnabled: true,
    saveDirectory: directory,
    saveFormat: 'png',
    fileNamePattern: 'PDSH-{date}-{time}',
  }
  const settings = {
    describe: () => [{ ns: 'pdsh', value: { ...accepted } }],
  }
  const root = new Context()
  let service!: WindowCaptureService
  let refreshCount = 0
  let ownerFiber!: Fiber
  let otherFiber!: Fiber
  let captureAborter: AbortController | undefined
  let saveAborter: AbortController | undefined
  let explicitRetryAborter: AbortController | undefined
  let captureTask: Promise<unknown[]> | undefined
  let saveTask: Promise<unknown[]> | undefined
  let retryTask: Promise<unknown[]> | undefined
  let ownerInstalled = false

  try {
    childProcess.spawn = ((..._args: any[]) => {
      const child = makeFakeChild(35)
      children.push(child)
      spawns.wake()
      return child
    }) as typeof childProcess.spawn
    // The service's default spawner uses node:child_process's ESM named export.
    syncBuiltinESMExports()

    const { WindowCaptureService: RuntimeWindowCaptureService } = await import('../index.js')
    ownerFiber = root.plugin({ apply(owner: Context) {
      owner.provide('settings', settings)
      const serviceContext = owner.extend({ invocation: { uplink: () => pendingUplink } })
      service = new RuntimeWindowCaptureService(serviceContext) as WindowCaptureService
      const refresh = service.refreshCaptureEnabled.bind(service)
      service.refreshCaptureEnabled = () => { refreshCount++; refresh() }
      observeCaptureEnabled(owner)
    } })
    await ownerFiber
    ownerInstalled = true
    assert.equal(children.length, 0, 'Host service construction must not spawn the helper')

    otherFiber = root.plugin({ apply() {} })
    await otherFiber

    captureAborter = new AbortController()
    captureTask = collect(service.capture(captureAborter.signal))
    await spawns.wait(1)
    assert.equal(children.length, 1)
    assert.deepEqual(children[0]!.kills, [])

    saveAborter = new AbortController()
    const request: WindowSaveRequest = {
      requestId: '11111111-1111-4111-8111-111111111111',
      format: 'png', width: 2, height: 1, title: 'test', capturedAt: '2026-10-03T04:05:06.000Z',
    }
    saveTask = collect(service.save(request, saveAborter.signal))
    await pendingUplink.started
    const activeLifetimeSignal = (await (service as any).runtime.current()).lifetime.signal as AbortSignal

    // A sibling Loader row and an unrelated volatile path cannot revoke this service.
    emitLoaderVolatileUpdate(otherFiber, [['captureEnabled']])
    emitLoaderVolatileUpdate(ownerFiber, [['maskIdentity']])
    assert.equal(refreshCount, 0, '业务实现逐调用核对；外壳只接收 owner 事件，旁系事件不刷新')
    assert.deepEqual(children[0]!.kills, [])
    assert.equal(pendingUplink.closed, false)

    accepted.captureEnabled = false
    emitLoaderVolatileUpdate(ownerFiber, [['captureEnabled']])
    assert.equal(refreshCount, 1)
    assert.equal(activeLifetimeSignal.aborted, true, 'the service generation is synchronously revoked')
    assert.deepEqual(children[0]!.kills, ['SIGTERM'])
    await pendingUplink.closedPromise
    assert.equal(pendingUplink.closed, true, 'the save backend closes its active uplink after the synchronous abort')

    let captureSettled = false
    void captureTask.then(() => { captureSettled = true })
    await new Promise(resolve => setTimeout(resolve, 0))
    assert.equal(captureSettled, false, 'capture stream must await the fake helper close, not merely SIGTERM')
    const [captureFrames, saveFrames] = await Promise.all([captureTask, saveTask])
    assert.deepEqual(captureFrames.at(-1), { type: 'terminal', status: 'cancelled' })
    assert.deepEqual(saveFrames.at(-1), {
      type: 'terminal', requestId: request.requestId, code: 'cancelled',
    })
    assert.equal(children[0]!.closed, true)
    assert.deepEqual(await readdir(directory), [], 'a cancelled uplink must never reach the Host writer')

    accepted.captureEnabled = true
    emitLoaderVolatileUpdate(ownerFiber, [['captureEnabled']])
    assert.equal(refreshCount, 2)
    assert.equal(children.length, 1, 're-enabling only creates a new generation; it does not restart capture')

    explicitRetryAborter = new AbortController()
    retryTask = collect(service.capture(explicitRetryAborter.signal))
    await spawns.wait(2)
    assert.equal(children.length, 2, 'only the explicit second capture request starts another helper')
    explicitRetryAborter.abort()
    const retryFrames = await retryTask
    assert.deepEqual(retryFrames.at(-1), { type: 'terminal', status: 'cancelled' })
    assert.equal(children[1]!.closed, true)
  } finally {
    captureAborter?.abort()
    saveAborter?.abort()
    explicitRetryAborter?.abort()
    if (ownerInstalled) await ownerFiber.dispose()
    if (otherFiber) await otherFiber.dispose()
    await Promise.allSettled([captureTask, saveTask, retryTask].filter(Boolean) as Promise<unknown[]>[])
    childProcess.spawn = originalSpawn
    syncBuiltinESMExports()
    await rm(directory, { recursive: true, force: true })
  }
})
