/**
 * [INPUT]: 依赖两种 Remote 封套与可控取消信号。
 * [OUTPUT]: 验证基础版本、壁纸与几何独立握手；取消阻止后续查询。
 * [POS]: 能力就绪合同；不访问 Host、像素或设置。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isCaptureRuntimeCurrent,
  isWallpaperCapabilityReady,
  isCaptureGeometryCapabilityReady,
  requireCaptureRuntimeCurrent,
  requireWallpaperCapabilityCurrent,
} from '../src/client/capture/runtime-readiness.ts'

const VERSION = '0.5.1'
const currentCapture = { implementationVersion: async () => ({ ok: true, value: VERSION }) }

test('几何能力独立握手，不以壁纸或基础版本冒充注册', async () => {
  const capability = { ...currentCapture, captureGeometryRegistered: async () => ({ ok: true, value: true }), captureGeometry: async () => ({ ok: true, value: null }) }
  assert.equal(await isCaptureGeometryCapabilityReady(capability, VERSION), true)
  for (const remote of [currentCapture, { ...capability, captureGeometry: undefined },
    { ...capability, implementationVersion: async () => ({ ok: true, value: 'old' }) },
    { ...capability, captureGeometryRegistered: async () => ({ ok: true, value: false }) },
    { ...capability, captureGeometryRegistered: async () => ({ ok: false }) },
    { ...capability, captureGeometryRegistered: async () => { throw Error('private') } }]) {
    assert.equal(await isCaptureGeometryCapabilityReady(remote, VERSION), false)
    assert.equal(await isCaptureRuntimeCurrent(remote, VERSION), remote.implementationVersion === currentCapture.implementationVersion)
  }
})

test('几何等待版本时取消，不得继续注册握手', async () => {
  const controller = new AbortController(); let release, reads = 0;
  const pending = isCaptureGeometryCapabilityReady({
    implementationVersion: () => new Promise(resolve => { release = resolve; }),
    captureGeometryRegistered: async () => { reads++; return { ok: true, value: true }; },
    captureGeometry: async () => ({ ok: true, value: null }),
  }, VERSION, controller.signal);
  controller.abort(); release({ ok: true, value: VERSION });
  assert.equal(await pending, false); assert.equal(reads, 0);
})

test('基础截图版本不授予 capability 壁纸扩展', async () => {
  const base = {
    ...currentCapture,
    wallpaper() { assert.fail('不得探测媒体流') },
    wallpaperRegistered() { assert.fail('基础壳注册不证明 capability') },
  }
  assert.equal(await isCaptureRuntimeCurrent(base, VERSION), true)
  assert.equal(await isWallpaperCapabilityReady(base, VERSION), false)
})

test('仅 capability 的实际版本与纯注册握手都匹配时才就绪', async () => {
  const cases = [
    [{ wallpaperRegistered: async () => ({ ok: true, value: true }) }, false],
    [{ implementationVersion: async () => ({ ok: true, value: '0.5.0' }), wallpaperRegistered: async () => ({ ok: true, value: true }) }, false],
    [{ implementationVersion: async () => ({ ok: false }), wallpaperRegistered: async () => ({ ok: true, value: true }) }, false],
    [{ implementationVersion: async () => { throw Error('unknown') }, wallpaperRegistered: async () => ({ ok: true, value: true }) }, false],
    [{ implementationVersion: currentCapture.implementationVersion, wallpaperRegistered: async () => ({ ok: false }) }, false],
    [{ implementationVersion: currentCapture.implementationVersion, wallpaperRegistered: async () => ({ ok: true, value: false }) }, false],
    [{ implementationVersion: currentCapture.implementationVersion, wallpaperRegistered: async () => ({ ok: true, value: 'true' }) }, false],
    [{ implementationVersion: currentCapture.implementationVersion, wallpaperRegistered: async () => { throw Error('unknown') } }, false],
    [{ implementationVersion: currentCapture.implementationVersion, wallpaperRegistered: async () => ({ ok: true, value: true }) }, true],
  ] as const
  for (const [remote, expected] of cases) {
    assert.equal(await isWallpaperCapabilityReady(remote, VERSION), expected)
  }
})

test('每次壁纸操作复核 capability 版本，不依赖基础截图版本', async () => {
  await requireWallpaperCapabilityCurrent({ implementationVersion: currentCapture.implementationVersion }, VERSION)
  await assert.rejects(requireWallpaperCapabilityCurrent({}, VERSION), /runtime-not-current/)
  await assert.rejects(requireWallpaperCapabilityCurrent({
    implementationVersion: async () => ({ ok: true, value: '0.5.0' }),
  }, VERSION), /runtime-not-current/)
  await assert.rejects(requireWallpaperCapabilityCurrent({
    implementationVersion: async () => ({ ok: false, error: {} }),
  }, VERSION), /stream-failed/)
  await assert.rejects(requireWallpaperCapabilityCurrent({
    implementationVersion: async () => { throw Error('private carrier') },
  }, VERSION), /stream-failed/)
})

test('取消发生在 capability Remote 等待期间，不得继续壁纸操作', async () => {
  const controller = new AbortController()
  let release!: (value: any) => void
  const pending = requireWallpaperCapabilityCurrent({
    implementationVersion: () => new Promise(resolve => { release = resolve }),
  }, VERSION, controller.signal)
  controller.abort()
  release({ ok: true, value: VERSION })
  await assert.rejects(pending, /cancelled/)
  let reads = 0
  await assert.rejects(requireWallpaperCapabilityCurrent({ implementationVersion: () => { reads++ } }, VERSION, controller.signal), /cancelled/)
  assert.equal(reads, 0)
})

test('基础截图版本仍独立拒绝旧实现与未知连接', async () => {
  assert.equal(await isCaptureRuntimeCurrent({}, VERSION), false)
  const current = { implementationVersion: currentCapture.implementationVersion }
  assert.equal(await isCaptureRuntimeCurrent(current, VERSION), true)
  await requireCaptureRuntimeCurrent(current, VERSION)
  await assert.rejects(requireCaptureRuntimeCurrent({
    implementationVersion: async () => ({ ok: true, value: '0.5.0' }),
  }, VERSION), /runtime-not-current/)
  await assert.rejects(requireCaptureRuntimeCurrent({ implementationVersion: async () => ({ ok: false }) }, VERSION), /stream-failed/)
})
