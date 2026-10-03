/**
 * [INPUT]: 依赖真实 Cordis Loader-owner event、正式 WindowCaptureService、Host capture/save stream 与 Node 子进程边界。
 * [OUTPUT]: 验证 accepted captureEnabled 撤回同时 abort 两路并等待真实 fake-child settle；重新启用不自动取像。
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
    const activeLifetimeSignal = (service as any).lifetime.signal as AbortSignal

    // A sibling Loader row and an unrelated volatile path cannot revoke this service.
    emitLoaderVolatileUpdate(otherFiber, [['captureEnabled']])
    emitLoaderVolatileUpdate(ownerFiber, [['maskIdentity']])
    assert.equal(refreshCount, 0)
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
