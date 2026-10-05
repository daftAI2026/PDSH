/**
 * [INPUT]: 依赖官方 Remote 的只读 implementationVersion 封套与当前 Client 版本。
 * [OUTPUT]: 确认真正运行的后台版本；区分已知旧后台与连接未知，不以磁盘清单或旧后台截图成功代替确认。
 * [POS]: 更新完成反馈和显式 capture/save 共享的版本围栏；不写设置、不安装、不取像。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { CaptureClientError } from './window-capture-stream.ts'

async function runtimeStatus(remote: any, version: string): Promise<'current' | 'outdated' | 'unavailable'> {
  if (typeof remote?.implementationVersion !== 'function') return 'outdated'
  try {
    const reply = await remote.implementationVersion()
    if (reply?.ok !== true || typeof reply.value !== 'string') return 'unavailable'
    return reply.value === version ? 'current' : 'outdated'
  } catch { return 'unavailable' }
}

export async function isCaptureRuntimeCurrent(remote: any, version: string): Promise<boolean> {
  return await runtimeStatus(remote, version) === 'current'
}

export async function requireCaptureRuntimeCurrent(remote: any, version: string, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new CaptureClientError('cancelled')
  const status = await runtimeStatus(remote, version)
  if (signal?.aborted) throw new CaptureClientError('cancelled')
  if (status !== 'current') throw new CaptureClientError(status === 'outdated' ? 'runtime-not-current' : 'stream-failed')
}
