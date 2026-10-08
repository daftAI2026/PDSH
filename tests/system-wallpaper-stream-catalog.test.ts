/**
 * [INPUT]: 依赖shared活动材料ID/名称/五项上限、Host stream与固定失败类型。
 * [OUTPUT]: 验证macOS与Windows x64 stream门、动态目录及畸形目录边界；不启动helper、不联网、不读取素材。
 * [POS]: system-wallpaper-stream的平台与活动目录合同；不要求legacy缓存ID进入当前roster。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { WALLPAPER_LIMITS, isSystemWallpaperName } from '../src/shared/system-wallpaper-protocol.ts'
import { NativeWallpaperFailure } from '../src/host/system-wallpaper-native.ts'
import { createSystemWallpaperStream } from '../src/host/system-wallpaper-stream.ts'
import type { WallpaperCatalogEntry } from '../src/shared/system-wallpaper-protocol.ts'

const dynamicEntries: WallpaperCatalogEntry[] = [
  entry('system-wallpaper-video-a1a1a1a1-1111-4111-8111-111111111111', 'Aurora'),
  entry('system-wallpaper-video-a0a0a0a0-1111-4111-8111-111111111111', 'Aurora Evening'),
  entry(`system-wallpaper-image-${'a'.repeat(64)}`, 'Golden Gate'),
  entry('system-wallpaper-video-b2b2b2b2-2222-4222-8222-222222222222', 'Golden Gate Sunset'),
]

function entry(id: string, name: string): WallpaperCatalogEntry {
  assert.equal(isSystemWallpaperName(name), true)
  return { id, name, available: false, downloadable: true }
}

async function collectCatalog(entries: WallpaperCatalogEntry[]) {
  return collectStream({ list: async () => entries })
}

async function collectStream(options: {
  list: () => Promise<WallpaperCatalogEntry[]>
  platform?: string
  arch?: string
}) {
  const stream = createSystemWallpaperStream({
    request: { kind: 'list' },
    signal: new AbortController().signal,
    lifetimeSignal: new AbortController().signal,
    platform: options.platform ?? 'darwin', arch: options.arch, enabled: () => true, disposed: () => false,
    reserve: () => ({ track: () => {}, release: () => {} }),
    list: options.list,
    load: async () => { throw new Error('list must not load pixels') },
  })
  const frames = []
  for await (const frame of stream) frames.push(frame)
  return frames
}

test('four source entries remain valid below the shared five-item ceiling', async () => {
  assert.equal(dynamicEntries.length, 4)
  assert.ok(dynamicEntries.length < WALLPAPER_LIMITS.maxCatalogEntries)
  const frames = await collectCatalog(dynamicEntries)
  assert.deepEqual(frames, [
    { type: 'catalog', entries: dynamicEntries },
    { type: 'terminal', status: 'listed' },
  ])
})

test('empty and partial valid rosters list successfully; unknown discovery remains unavailable', async () => {
  assert.deepEqual(await collectCatalog([]), [
    { type: 'catalog', entries: [] }, { type: 'terminal', status: 'listed' },
  ])
  assert.deepEqual(await collectCatalog(dynamicEntries.slice(0, 2)), [
    { type: 'catalog', entries: dynamicEntries.slice(0, 2) }, { type: 'terminal', status: 'listed' },
  ])
  const unknown = await collectStream({
    list: async () => { throw new NativeWallpaperFailure('unavailable') },
  })
  assert.deepEqual(unknown, [{ type: 'terminal', status: 'unavailable' }])
})

test('Windows x64 uses the same bounded stream while Windows ARM64 and Linux remain unsupported', async () => {
  const entries = [
    ['a', 'Windows · img0'],
    ['b', 'Windows · img19'],
    ['c', 'Windows · ThemeA20'],
    ['d', 'Windows · ThemeB24'],
    ['e', 'Windows · ThemeC28'],
  ].map(([hash, name]) => ({
    id: `system-wallpaper-image-${hash!.repeat(64)}`,
    name: name!,
    available: true,
    downloadable: false,
  }))
  assert.equal(entries.length, WALLPAPER_LIMITS.maxCatalogEntries)
  assert.deepEqual(await collectStream({ platform: 'win32', arch: 'x64', list: async () => entries }), [
    { type: 'catalog', entries }, { type: 'terminal', status: 'listed' },
  ])

  let operations = 0
  for (const [platform, arch] of [['win32', 'arm64'], ['linux', 'x64']] as const) {
    assert.deepEqual(await collectStream({ platform, arch, list: async () => { operations++; return [] } }), [
      { type: 'terminal', status: 'unsupported-platform' },
    ])
  }
  assert.equal(operations, 0, 'unsupported targets do not reserve or invoke the helper operation')
})

test('duplicate, malformed ID, C1 name and more than five entries fail closed', async () => {
  const badCatalogs: Array<[string, WallpaperCatalogEntry[]]> = [
    ['duplicate ID', [dynamicEntries[0]!, { ...dynamicEntries[1]!, id: dynamicEntries[0]!.id }]],
    ['malformed ID', [{ ...dynamicEntries[0]!, id: 'system-wallpaper-video-not-a-uuid' }]],
    ['C1 control name', [{ ...dynamicEntries[0]!, name: 'Aurora\u0085Evening' }]],
    ['more than the active roster budget', [
      ...dynamicEntries,
      entry('system-wallpaper-video-c3c3c3c3-3333-4333-8333-333333333333', 'Extra'),
      entry('system-wallpaper-video-d4d4d4d4-4444-4444-8444-444444444444', 'Extra two'),
    ]],
  ]
  for (const [label, entries] of badCatalogs) {
    await assert.rejects(collectCatalog(entries), { code: 'protocol-invalid' }, label)
  }
})
