/**
 * [INPUT]: 依赖 Node 事件流与 Buffer，为壁纸 Host 合同提供可控子进程、JPEG 字节和 iterable 收集器。
 * [OUTPUT]: 提供 FakeChild、minimalJpeg 与 collect 测试夹具，不代表原生解码或系统媒体验收。
 * [POS]: 壁纸 Host 测试的共享夹具层，供 helper、stream 与 CaptureRuntime 合同复用。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'

export class FakeChild extends EventEmitter {
  readonly stdout = new PassThrough()
  readonly stderr = new PassThrough()
  readonly kills: NodeJS.Signals[] = []
  closed = false

  kill(signal: NodeJS.Signals): boolean {
    this.kills.push(signal)
    return true
  }
}

export function minimalJpeg(width = 2, height = 1): Buffer {
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, ...Buffer.from('JFIF\0'), 1, 1, 0, 0, 1, 0, 1, 0, 0])
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x0b, 8, 0, height, 0, width, 1, 1, 0x11, 0])
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 63, 0])
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, sos, Buffer.from([0x00, 0xff, 0xd9])])
}

export async function collect<T>(source: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = []
  for await (const value of source) values.push(value)
  return values
}
