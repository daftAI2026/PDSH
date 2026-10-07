/**
 * [INPUT]: 依赖基础 Capture 与独立 capability 的 Remote 封套。
 * [OUTPUT]: 分别核对版本、注册握手与取消。
 * [POS]: 基础围栏保护截图/保存；扩展围栏保护壁纸请求。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { CaptureClientError } from './window-capture-stream.ts'

async function isWallpaperRemoteRegistered(remote: any): Promise<boolean> {
  if (typeof remote?.wallpaperRegistered !== 'function') return false
  try {
    const reply = await remote.wallpaperRegistered()
    return reply?.ok === true && reply.value === true
  } catch { return false }
}

/** 基础截图壳的壁纸方法不授予独立 capability。 */
export async function isWallpaperCapabilityReady(remote: any, version: string): Promise<boolean> {
  if (await runtimeStatus(remote, version) !== 'current') return false
  return isWallpaperRemoteRegistered(remote)
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

async function requireRuntimeCurrent(remote: any, version: string, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw new CaptureClientError('cancelled')
  const status = await runtimeStatus(remote, version)
  if (signal?.aborted) throw new CaptureClientError('cancelled')
  if (status !== 'current') throw new CaptureClientError(status === 'outdated' ? 'runtime-not-current' : 'stream-failed')
}

export function requireCaptureRuntimeCurrent(remote: any, version: string, signal?: AbortSignal): Promise<void> {
  return requireRuntimeCurrent(remote, version, signal)
}

/** 每个壁纸动作都重新读取 capability 实际版本。 */
export function requireWallpaperCapabilityCurrent(remote: any, version: string, signal?: AbortSignal): Promise<void> {
  return requireRuntimeCurrent(remote, version, signal)
}
