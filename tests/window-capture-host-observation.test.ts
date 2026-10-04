/**
 * [INPUT]: 依赖 WindowCaptureService、Node fake child 与只记录 formatter 参数的内存 logger。
 * [OUTPUT]: 验证 Host 在每次显式调用核对设置时只观测固定服务状态、阶段及白名单失败码；不启动原生 helper 或访问用户目录。
 * [POS]: Remote capture 可诊断性的边界合同；证明 native owner 状态在 shared terminal 折叠前可见。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import { createRequire, syncBuiltinESMExports } from 'node:module'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import test from 'node:test'
import { Context, type Fiber } from '@deepseek-ai/cordis'
import { WindowCaptureService } from '../index.js'

type LogRecord = readonly [string, ...unknown[]]

class FakeChild extends EventEmitter {
  readonly stdout = new PassThrough()
  readonly stderr = new PassThrough()
  readonly kills: NodeJS.Signals[] = []
  closed = false
  private readonly status: string

  constructor(status: string) {
    super()
    this.status = status
  }

  kill(signal: NodeJS.Signals): boolean {
    this.kills.push(signal)
    this.finish(null, signal)
    return true
  }

  finish(code: number | null, signal: NodeJS.Signals | null = null): void {
    if (this.closed) return
    this.closed = true
    this.stderr.write(`phase=authorization-required\n{"status":"${this.status}"}\n`)
    setImmediate(() => {
      this.stdout.end()
      this.stderr.end()
      this.emit('close', code, signal)
    })
  }
}

async function collect<T>(stream: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = []
  for await (const value of stream) values.push(value)
  return values
}

test('Host capture logs mounted/enabled, invocation, phase, native status and safe terminal code', async () => {
  const childProcess = createRequire(import.meta.url)('node:child_process') as {
    spawn: (...args: unknown[]) => unknown
  }
  const originalSpawn = childProcess.spawn
  const records: LogRecord[] = []
  const logger = {
    info: (message: string, ...args: unknown[]) => records.push([message, ...args]),
  }
  const accepted = { captureEnabled: false }
  const settings = { describe: () => [{ ns: 'pdsh', value: accepted }] }
  const children: FakeChild[] = []
  const root = new Context()
  let service!: WindowCaptureService
  let ownerFiber!: Fiber

  try {
    childProcess.spawn = (() => {
      const child = new FakeChild('host-parent-mismatch')
      children.push(child)
      child.finish(1)
      return child
    }) as typeof childProcess.spawn
    syncBuiltinESMExports()

    ownerFiber = root.plugin({ apply(owner: Context) {
      const serviceContext = owner.extend({ settings, logger })
      service = new WindowCaptureService(serviceContext)
    } })
    await ownerFiber

    assert.equal(children.length, 0, 'mount and settings inspection must not start the helper')
    accepted.captureEnabled = true
    service.refreshCaptureEnabled()

    const frames = await collect(service.capture(new AbortController().signal))
    assert.equal(children.length, 1, 'only pulling the explicit capture stream reaches the fake spawn seam')
    assert.deepEqual(frames[0], { type: 'phase', phase: 'authorization-required' })
    assert.deepEqual(frames.at(-1), { type: 'terminal', status: 'helper-failed' })

    accepted.captureEnabled = false
    service.refreshCaptureEnabled()
    const disabledFrames = await collect(service.capture(new AbortController().signal))
    assert.deepEqual(disabledFrames, [{ type: 'terminal', status: 'disposed' }])
    assert.equal(children.length, 1, 'disabled capture is rejected before any helper spawn')

    assert.deepEqual(records, [
      ['PDSH capture event=service-mounted enabled=%s', false],
      ['PDSH capture event=enabled enabled=%s', true],
      ['PDSH capture event=enabled enabled=%s', true],
      ['PDSH capture event=invocation'],
      ['PDSH capture event=phase phase=%s', 'authorization-required'],
      ['PDSH capture event=native-result code=%s', 'host-parent-mismatch'],
      ['PDSH capture event=terminal code=%s', 'helper-failed'],
      ['PDSH capture event=enabled enabled=%s', false],
      ['PDSH capture event=enabled enabled=%s', false],
      ['PDSH capture event=invocation'],
      ['PDSH capture event=terminal code=%s', 'disposed'],
    ])
    assert.ok(records.every(([message]) => message.startsWith('PDSH capture event=')))
    assert.ok(!JSON.stringify(records).includes('window-capture'))
    assert.ok(!JSON.stringify(records).includes('pngBytes'))
    assert.ok(!JSON.stringify(records).includes('path'))
    assert.ok(frames.every(frame => typeof frame === 'object'))
  } finally {
    if (ownerFiber) await ownerFiber.dispose()
    childProcess.spawn = originalSpawn
    syncBuiltinESMExports()
  }
})
