/**
 * [INPUT]: 依赖官方实现版本封套与独立的纯壁纸注册握手。
 * [OUTPUT]: 确认后台版本和壁纸 Remote 注册；扩展握手失败不阻断基础截图。
 * [POS]: 更新完成反馈和显式 capture/save 共享的版本围栏；不写设置、不安装、不取像。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { CaptureClientError } from './window-capture-stream.ts'

export async function isWallpaperRemoteRegistered(remote: any): Promise<boolean> {
  if (typeof remote?.wallpaperRegistered !== 'function') return false
  try {
    const reply = await remote.wallpaperRegistered()
    return reply?.ok === true && reply.value === true
  } catch { return false }
}

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
