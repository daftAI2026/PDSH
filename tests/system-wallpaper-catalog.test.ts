/**
 * [INPUT]: 依赖Apple Aerial分类fixture、root-owned静态扩展provider与固定视频URL验证器。
 * [OUTPUT]: 锁定按官方landscape次序选择两组动态/景观代表、稳定素材身份、路径/URL边界和未知版本拒绝；不读取系统缓存、不联网。
 * [POS]: Host壁纸catalog纯选择器合同；discover的真实固定路径IO单独由Host集成门验证。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const DYNAMIC_CATEGORY = 'dynamic-aerials'
const LANDSCAPE_CATEGORY = 'landscape-category'
const DYNAMIC_SUBCATEGORY = 'dynamic-golden-gate'
const GOLDEN_SUBCATEGORY = 'landscape-golden-gate'
const TAHOE_SUBCATEGORY = 'landscape-tahoe'
const SEQUOIA_SUBCATEGORY = 'landscape-sequoia'

const UUIDS = {
  dynamicGolden: '4DFE24ED-71CC-42D4-9FE8-3B8959B6CC19',
  goldenLandscape: '4207734D-74FE-4F92-B5E1-6EC8DEE24A15',
  tahoeLandscape: '4C108785-A7BA-422E-9C79-B0129F1D5550',
  sequoiaLandscape: 'F88CDF4A-9681-4D1F-88FE-34F1A3C6A62B',
}

const videoUrl = (name: string): string => `https://sylvan.apple.com/itunes-assets/Aerials126/v4/${name}.mov`

function subcategory(id: string, localizedNameKey: string, preferredOrder: number, representativeAssetID: string) {
  return {
    id,
    localizedDescriptionKey: localizedNameKey.replace('AerialSubcategory', 'AerialSubcategoryDescription'),
    localizedNameKey,
    preferredOrder,
    previewImage: `https://sylvan.apple.com/preview/${id}.png`,
    representativeAssetID,
  }
}

function asset(
  id: string,
  label: string,
  categoryId: string,
  subcategoryId: string,
  url: string,
  extra: Record<string, unknown> = {},
) {
  return {
    accessibilityLabel: label,
    categories: [categoryId],
    id,
    includeInShuffle: true,
    localizedNameKey: `${label.replaceAll(' ', '_')}_NAME`,
    pointsOfInterest: {},
    preferredOrder: 0,
    previewImage: `https://sylvan.apple.com/preview/${id}.png`,
    shotID: label.replaceAll(' ', '_'),
    showInTopLevel: true,
    subcategories: [subcategoryId],
    'url-4K-SDR-240FPS': url,
    ...extra,
  }
}

function catalogFixture(options: {
  readonly addNextTheme?: boolean
  readonly rootExtra?: Record<string, unknown>
  readonly dynamicUrl?: string
  readonly landscapeUrl?: string
  readonly duplicateLandscapeOrder?: boolean
} = {}) {
  const auroraDynamicSubcategory = 'dynamic-aurora'
  const auroraLandscapeSubcategory = 'landscape-aurora'
  const secondLandscapeTheme = options.addNextTheme ? 'GoldenGate' : 'Tahoe'
  const secondLandscapeId = options.addNextTheme ? GOLDEN_SUBCATEGORY : TAHOE_SUBCATEGORY
  const secondLandscapeAssetId = options.addNextTheme ? UUIDS.goldenLandscape : UUIDS.tahoeLandscape
  const firstLandscapeTheme = options.addNextTheme ? 'Aurora' : 'GoldenGate'
  const firstLandscapeId = options.addNextTheme ? auroraLandscapeSubcategory : GOLDEN_SUBCATEGORY
  const firstLandscapeAssetId = options.addNextTheme ? 'A0A0A0A0-1111-4111-8111-111111111111' : UUIDS.goldenLandscape
  const order1 = options.duplicateLandscapeOrder ? 0 : 1
  const landscapeSubcategories = [
    subcategory(firstLandscapeId, `AerialSubcategoryDescription${firstLandscapeTheme}`, 0, firstLandscapeAssetId),
    subcategory(secondLandscapeId, `AerialSubcategoryDescription${secondLandscapeTheme}`, order1, secondLandscapeAssetId),
    ...(options.addNextTheme ? [subcategory(TAHOE_SUBCATEGORY, 'AerialSubcategoryDescriptionTahoe', 2, UUIDS.tahoeLandscape)] : []),
    subcategory(SEQUOIA_SUBCATEGORY, 'AerialSubcategoryDescriptionSequoia', options.addNextTheme ? 3 : 2, UUIDS.sequoiaLandscape),
  ]
  const dynamicSubcategories = options.addNextTheme
    ? [
      subcategory(auroraDynamicSubcategory, 'AerialSubcategoryDescriptionAuroraGraphical', -501,
        'A1A1A1A1-1111-4111-8111-111111111111'),
      subcategory(DYNAMIC_SUBCATEGORY, 'AerialSubcategoryDescriptionGoldenGateGraphical', -500, UUIDS.dynamicGolden),
    ]
    : [subcategory(DYNAMIC_SUBCATEGORY, 'AerialSubcategoryDescriptionGoldenGateGraphical', -500, UUIDS.dynamicGolden)]
  const landscapeAssets = options.addNextTheme
    ? [
      asset(firstLandscapeAssetId, 'Aurora Evening', LANDSCAPE_CATEGORY, firstLandscapeId,
        videoUrl('aurora-landscape')),
      asset(UUIDS.goldenLandscape, 'Golden Gate Sunset', LANDSCAPE_CATEGORY, GOLDEN_SUBCATEGORY,
        options.landscapeUrl ?? videoUrl('golden-sunset')),
      asset(UUIDS.tahoeLandscape, 'Tahoe Day', LANDSCAPE_CATEGORY, TAHOE_SUBCATEGORY, videoUrl('tahoe-day')),
    ]
    : [
      asset(UUIDS.goldenLandscape, 'Golden Gate Sunset', LANDSCAPE_CATEGORY, GOLDEN_SUBCATEGORY,
        options.landscapeUrl ?? videoUrl('golden-sunset')),
      asset(UUIDS.tahoeLandscape, 'Tahoe Day', LANDSCAPE_CATEGORY, TAHOE_SUBCATEGORY, videoUrl('tahoe-day')),
    ]
  const dynamicAssets = options.addNextTheme
    ? [
      asset('A1A1A1A1-1111-4111-8111-111111111111', 'macOS', DYNAMIC_CATEGORY, auroraDynamicSubcategory,
        videoUrl('aurora-dynamic'), { localizedNameKey: 'DYNAMIC_LIGHT_KEY' }),
      asset(UUIDS.dynamicGolden, 'macOS', DYNAMIC_CATEGORY, DYNAMIC_SUBCATEGORY,
        options.dynamicUrl ?? videoUrl('golden-dynamic'), { localizedNameKey: 'DYNAMIC_LIGHT_KEY' }),
    ]
    : [asset(UUIDS.dynamicGolden, 'macOS', DYNAMIC_CATEGORY, DYNAMIC_SUBCATEGORY,
      options.dynamicUrl ?? videoUrl('golden-dynamic'), { localizedNameKey: 'DYNAMIC_LIGHT_KEY' })]

  return {
    assets: [...dynamicAssets, ...landscapeAssets,
      asset(UUIDS.sequoiaLandscape, 'Sequoia Morning', LANDSCAPE_CATEGORY, SEQUOIA_SUBCATEGORY, videoUrl('sequoia'))],
    categories: [
      {
        id: DYNAMIC_CATEGORY,
        localizedDescriptionKey: 'AerialCategoryDynamicDescription',
        localizedNameKey: 'AerialCategoryDynamic',
        preferredOrder: 0,
        representativeAssetID: UUIDS.dynamicGolden,
        subcategories: dynamicSubcategories,
      },
      {
        id: LANDSCAPE_CATEGORY,
        localizedDescriptionKey: 'AerialCategoryLandscapesDescription',
        localizedNameKey: 'AerialCategoryLandscapes',
        preferredOrder: 1,
        representativeAssetID: UUIDS.goldenLandscape,
        subcategories: landscapeSubcategories,
      },
    ],
    initialAssetCount: 4,
    localizationVersion: 'fixture-1',
    version: 1,
    ...options.rootExtra,
  }
}

async function loadCatalogModule() {
  try {
    return await import('../src/host/system-wallpaper-catalog.ts')
  } catch {
    assert.fail('system-wallpaper-catalog.ts must provide the Apple metadata parser')
  }
}

function errorCode(error: unknown): unknown {
  return (error as { code?: unknown })?.code
}

test('当前Apple清单按landscape代表顺序生成四项，并仅用legacy ID桥接已有缓存', async () => {
  const { selectSystemWallpaperSources } = await loadCatalogModule()
  const sources = selectSystemWallpaperSources(catalogFixture(), [
    { identifier: 'Tahoe', imagePath: '/System/Library/ExtensionKit/Extensions/NeptuneOneWallpaper.appex/Contents/Resources/TahoeLight.heic', url: videoUrl('tahoe-light-landscape') },
  ])

  assert.deepEqual(sources.map(source => [source.id, source.name, source.sourceType]), [
    ['system-wallpaper-golden-gate', 'Golden Gate', 'video'],
    ['system-wallpaper-golden-gate-sunset', 'Golden Gate Sunset', 'video'],
    ['system-wallpaper-tahoe', 'Tahoe', 'image'],
    ['system-wallpaper-tahoe-day', 'Tahoe Day', 'video'],
  ])
  assert.deepEqual(sources.map(source => source.available), [false, false, false, false])
  assert.deepEqual(sources.map(source => source.downloadable), [true, true, true, true])
  assert.equal(sources[0]?.cacheUUID, UUIDS.dynamicGolden)
  assert.equal(sources[1]?.cacheUUID, UUIDS.goldenLandscape)
  assert.equal(sources[2]?.imagePath, '/System/Library/ExtensionKit/Extensions/NeptuneOneWallpaper.appex/Contents/Resources/TahoeLight.heic')
  assert.equal(sources[2]?.url, videoUrl('tahoe-light-landscape'))
  assert.equal(sources[3]?.cacheUUID, UUIDS.tahoeLandscape)
})

test('Apple显示顺序插入新主题会选新前两组，不把它们改写成OS版本或复用缓存槽', async () => {
  const { selectSystemWallpaperSources } = await loadCatalogModule()
  const sources = selectSystemWallpaperSources(catalogFixture({
    addNextTheme: true,
    rootExtra: { macOSVersion: '999', osRelease: 'invented' },
  }), [
    { identifier: 'Tahoe', imagePath: '/System/Library/ExtensionKit/Extensions/NeptuneOneWallpaper.appex/Contents/Resources/TahoeLight.heic', url: videoUrl('tahoe-light-landscape') },
  ])

  assert.equal(sources.length, 4)
  assert.deepEqual(sources.map(source => source.name), [
    'Aurora', 'Aurora Evening', 'Golden Gate', 'Golden Gate Sunset',
  ])
  assert.equal(sources[0]?.id, 'system-wallpaper-video-a1a1a1a1-1111-4111-8111-111111111111')
  assert.equal(sources[1]?.id, 'system-wallpaper-video-a0a0a0a0-1111-4111-8111-111111111111')
  assert.equal(sources.some(source => source.id === 'system-wallpaper-tahoe'), false)
  assert.equal(sources.some(source => /999|invented|macos/i.test(source.name)), false)
})

test('景观order不唯一、重复代表或错误归属不能猜测替代素材', async () => {
  const { selectSystemWallpaperSources } = await loadCatalogModule()
  const providers = [{ identifier: 'Tahoe', imagePath: '/System/Library/ExtensionKit/Extensions/NeptuneOneWallpaper.appex/Contents/Resources/TahoeLight.heic', url: videoUrl('tahoe') }]
  await assert.rejects(async () => selectSystemWallpaperSources(catalogFixture({ duplicateLandscapeOrder: true }), providers),
    error => errorCode(error) === 'protocol-invalid')

  const wrongMembership = catalogFixture() as ReturnType<typeof catalogFixture> & { assets: Array<Record<string, unknown>> }
  wrongMembership.assets[0] = { ...wrongMembership.assets[0], subcategories: ['wrong-group'] }
  await assert.rejects(async () => selectSystemWallpaperSources(wrongMembership, providers),
    error => errorCode(error) === 'protocol-invalid')
})

test('拒绝不支持的schema、错误URL、重复主题和静态provider歧义', async () => {
  const { selectSystemWallpaperSources } = await loadCatalogModule()
  const provider = { identifier: 'Tahoe', imagePath: '/System/Library/ExtensionKit/Extensions/NeptuneOneWallpaper.appex/Contents/Resources/TahoeLight.heic', url: videoUrl('tahoe') }
  await assert.rejects(async () => selectSystemWallpaperSources({ ...catalogFixture(), version: 2 }, [provider]),
    error => errorCode(error) === 'protocol-invalid')
  await assert.rejects(async () => selectSystemWallpaperSources(catalogFixture({
    landscapeUrl: 'https://example.com/a.mov',
  }), [provider]), error => errorCode(error) === 'protocol-invalid')
  await assert.rejects(async () => selectSystemWallpaperSources(catalogFixture(), [
    provider, { ...provider, imagePath: '/System/Library/ExtensionKit/Extensions/OtherWallpaper.appex/Contents/Resources/TahoeLight.heic' },
  ]), error => errorCode(error) === 'protocol-invalid')
  await assert.rejects(async () => selectSystemWallpaperSources(catalogFixture(), [
    { ...provider, imagePath: '/tmp/TahoeLight.heic' },
  ]), error => errorCode(error) === 'protocol-invalid')

  const duplicateTheme = catalogFixture() as ReturnType<typeof catalogFixture> & { categories: Array<Record<string, unknown>> }
  const landscapes = duplicateTheme.categories.find(category => category.id === LANDSCAPE_CATEGORY) as {
    subcategories: Array<Record<string, unknown>>
  }
  landscapes.subcategories[1] = {
    ...landscapes.subcategories[1], localizedNameKey: 'AerialSubcategoryDescriptionGoldenGate',
  }
  await assert.rejects(async () => selectSystemWallpaperSources(duplicateTheme, [provider]),
    error => errorCode(error) === 'protocol-invalid')
})

test('有效格式但没有可匹配的最新两组素材时返回固定unavailable', async () => {
  const { selectSystemWallpaperSources } = await loadCatalogModule()
  await assert.rejects(async () => selectSystemWallpaperSources(catalogFixture(), []),
    error => errorCode(error) === 'unavailable')
})
