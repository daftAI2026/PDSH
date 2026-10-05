/**
 * [INPUT]: 依赖官方 Remote 的只读 implementationVersion 封套与当前 Client 版本。
 * [OUTPUT]: 确认真正运行的后台版本；不以磁盘清单或旧后台截图成功代替确认。
 * [POS]: 更新完成反馈和显式 capture/save 共享的版本围栏；不写设置、不安装、不取像。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { CaptureClientError } from './window-capture-stream.ts'

export async function isCaptureRuntimeCurrent(remote: any, version: string): Promise<boolean> {
  if (typeof remote?.implementationVersion !== 'function') return false
  try {
    const reply = await remote.implementationVersion()
    return reply?.ok === true && reply.value === version
  } catch { return false }
}

export async function requireCaptureRuntimeCurrent(remote: any, version: string, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new CaptureClientError('cancelled')
  const current = await isCaptureRuntimeCurrent(remote, version)
  if (signal?.aborted) throw new CaptureClientError('cancelled')
  if (!current) throw new CaptureClientError('stream-failed')
}
