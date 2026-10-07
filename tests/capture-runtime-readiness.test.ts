/**
 * [INPUT]: 依赖真实 Client 版本围栏和可控官方 Remote 封套。
 * [OUTPUT]: 拒绝旧后台/失败/取消；壁纸须有真实握手，失败不阻断基础版本检查。
 * [POS]: 更新与截图调用前的回归门；内存 Remote 不访问 Host、像素或设置。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { isCaptureRuntimeCurrent, isWallpaperRemoteRegistered, requireCaptureRuntimeCurrent } from '../src/client/capture/runtime-readiness.ts'

test('本地壁纸方法存在不能证明 Host 注册；扩展失败不影响基础版本', async () => {
  const base = { implementationVersion: async () => ({ ok: true, value: '0.5.1' }), wallpaper() { throw Error('must not probe stream') } }
  assert.equal(await isWallpaperRemoteRegistered(base), false)
  for (const result of [{ ok: false }, { ok: true, value: false }, { ok: true, value: 'true' }]) {
    const remote = { ...base, wallpaperRegistered: async () => result }
    assert.equal(await isWallpaperRemoteRegistered(remote), false)
    await requireCaptureRuntimeCurrent(remote, '0.5.1')
  }
  assert.equal(await isWallpaperRemoteRegistered({ ...base, wallpaperRegistered: async () => { throw Error('unknown') } }), false)
  assert.equal(await isWallpaperRemoteRegistered({ ...base, wallpaperRegistered: async () => ({ ok: true, value: true }) }), true)
})

test('升级验收只认 Remote 返回的新实现，磁盘/旧后台/失败不能冒充成功', async () => {
  assert.equal(await isCaptureRuntimeCurrent({}, '0.3.3'), false)
  assert.equal(await isCaptureRuntimeCurrent({ implementationVersion: async () => ({ok: true, value: '0.3.2'}) }, '0.3.3'), false)
  assert.equal(await isCaptureRuntimeCurrent({ implementationVersion: async () => ({ok: false, error: {}}) }, '0.3.3'), false)
  assert.equal(await isCaptureRuntimeCurrent({ implementationVersion: async () => { throw new Error('unavailable') } }, '0.3.3'), false)
  const current = { implementationVersion: async () => ({ok: true, value: '0.3.3'}) }
  assert.equal(await isCaptureRuntimeCurrent(current, '0.3.3'), true)
  await requireCaptureRuntimeCurrent(current, '0.3.3')
  await assert.rejects(requireCaptureRuntimeCurrent(current, '0.3.4'), /runtime-not-current/)
})

test('取消发生在 Remote 等待期间，不得继续打开 capture/save', async () => {
  const controller = new AbortController()
  let release!: (value: any) => void
  const pending = requireCaptureRuntimeCurrent({ implementationVersion: () => new Promise(resolve => { release = resolve }) }, '0.3.3', controller.signal)
  controller.abort()
  release({ok: true, value: '0.3.3'})
  await assert.rejects(pending, /cancelled/)
  let reads = 0
  await assert.rejects(requireCaptureRuntimeCurrent({ implementationVersion: () => {reads++;} }, '0.3.3', controller.signal), /cancelled/)
  assert.equal(reads, 0)
})


test('旧后台与连接未知分开提示，不因 transport 失败臆断需要重启', async () => {
  await assert.rejects(requireCaptureRuntimeCurrent({}, '0.3.5'), /runtime-not-current/)
  await assert.rejects(requireCaptureRuntimeCurrent({ implementationVersion: async () => ({ok:false}) }, '0.3.5'), /stream-failed/)
  await assert.rejects(requireCaptureRuntimeCurrent({ implementationVersion: async () => {throw Error('raw secret')} }, '0.3.5'), /stream-failed/)
})
