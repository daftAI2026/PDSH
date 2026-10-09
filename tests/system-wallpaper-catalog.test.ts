/**
 * [INPUT]: 依赖Apple Aerial分类fixture、root-owned静态扩展provider与固定视频URL验证器。
 * [OUTPUT]: 锁定原四项、按目录顺序截前五、已选关联校验与歧义拒绝；不读系统缓存、不联网。
 * [POS]: Host壁纸catalog纯选择器合同；discover的真实固定路径IO单独由Host集成门验证。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import test from 'node:test'

const DYNAMIC_CATEGORY = 'dynamic-aerials'
const LANDSCAPE_CATEGORY = 'landscape-category'
const DYNAMIC_SUBCATEGORY = 'dynamic-golden-gate'
const SEQUOIA_DYNAMIC_SUBCATEGORY = 'dynamic-sequoia'
const GOLDEN_SUBCATEGORY = 'landscape-golden-gate'
const TAHOE_SUBCATEGORY = 'landscape-tahoe'
const SEQUOIA_SUBCATEGORY = 'landscape-sequoia'

const UUIDS = {
  dynamicGolden: '4DFE24ED-71CC-42D4-9FE8-3B8959B6CC19',
  dynamicSequoia: '5E5E5E5E-1111-4111-8111-111111111111',
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
  readonly thirdDynamic?: boolean
  readonly rootExtra?: Record<string, unknown>
  readonly dynamicUrl?: string
  readonly landscapeUrl?: string
  readonly thirdLandscapeUrl?: string
  readonly omitThirdLandscape?: boolean
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
    ...(options.omitThirdLandscape ? [] : [subcategory(
      SEQUOIA_SUBCATEGORY, 'AerialSubcategoryDescriptionSequoia', options.addNextTheme ? 3 : 2, UUIDS.sequoiaLandscape,
    )]),
  ]
  const dynamicSubcategories = options.addNextTheme
    ? [
      subcategory(auroraDynamicSubcategory, 'AerialSubcategoryDescriptionAuroraGraphical', -501,
        'A1A1A1A1-1111-4111-8111-111111111111'),
      subcategory(DYNAMIC_SUBCATEGORY, 'AerialSubcategoryDescriptionGoldenGateGraphical', -500, UUIDS.dynamicGolden),
      ...(options.thirdDynamic ? [subcategory(
        SEQUOIA_DYNAMIC_SUBCATEGORY, 'AerialSubcategoryDescriptionSequoiaGraphical', -499, UUIDS.dynamicSequoia,
      )] : []),
    ]
    : [
      subcategory(DYNAMIC_SUBCATEGORY, 'AerialSubcategoryDescriptionGoldenGateGraphical', -500, UUIDS.dynamicGolden),
      ...(options.thirdDynamic ? [subcategory(
        SEQUOIA_DYNAMIC_SUBCATEGORY, 'AerialSubcategoryDescriptionSequoiaGraphical', -499, UUIDS.dynamicSequoia,
      )] : []),
    ]
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
      ...(options.thirdDynamic ? [asset(UUIDS.dynamicSequoia, 'macOS', DYNAMIC_CATEGORY,
        SEQUOIA_DYNAMIC_SUBCATEGORY, videoUrl('sequoia-dynamic'), { localizedNameKey: 'DYNAMIC_LIGHT_KEY' })] : []),
    ]
    : [
      asset(UUIDS.dynamicGolden, 'macOS', DYNAMIC_CATEGORY, DYNAMIC_SUBCATEGORY,
        options.dynamicUrl ?? videoUrl('golden-dynamic'), { localizedNameKey: 'DYNAMIC_LIGHT_KEY' }),
      ...(options.thirdDynamic ? [asset(UUIDS.dynamicSequoia, 'macOS', DYNAMIC_CATEGORY,
        SEQUOIA_DYNAMIC_SUBCATEGORY, videoUrl('sequoia-dynamic'), { localizedNameKey: 'DYNAMIC_LIGHT_KEY' })] : []),
    ]

  return {
    assets: [...dynamicAssets, ...landscapeAssets,
      ...(!options.omitThirdLandscape ? [asset(UUIDS.sequoiaLandscape, 'Sequoia Morning', LANDSCAPE_CATEGORY,
        SEQUOIA_SUBCATEGORY, options.thirdLandscapeUrl ?? videoUrl('sequoia'))] : [])],
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

test('保留原四项及legacy ID；第三组无preferred候选时取其Landscape代表', async () => {
  const { selectSystemWallpaperSources } = await loadCatalogModule()
  const sources = selectSystemWallpaperSources(catalogFixture(), [
    { identifier: 'Tahoe', imagePath: '/System/Library/ExtensionKit/Extensions/NeptuneOneWallpaper.appex/Contents/Resources/TahoeLight.heic', url: videoUrl('tahoe-light-landscape') },
  ])

  assert.deepEqual(sources.map(source => [source.id, source.name, source.sourceType]), [
    ['system-wallpaper-golden-gate', 'Golden Gate', 'video'],
    ['system-wallpaper-golden-gate-sunset', 'Golden Gate Sunset', 'video'],
    ['system-wallpaper-tahoe', 'Tahoe', 'image'],
    ['system-wallpaper-tahoe-day', 'Tahoe Day', 'video'],
    [`system-wallpaper-video-${UUIDS.sequoiaLandscape.toLowerCase()}`, 'Sequoia Morning', 'video'],
  ])
  assert.deepEqual(sources.map(source => source.available), [false, false, false, false, false])
  assert.deepEqual(sources.map(source => source.downloadable), [true, true, true, true, true])
  assert.equal(sources[0]?.cacheUUID, UUIDS.dynamicGolden)
  assert.equal(sources[1]?.cacheUUID, UUIDS.goldenLandscape)
  assert.equal(sources[2]?.imagePath, '/System/Library/ExtensionKit/Extensions/NeptuneOneWallpaper.appex/Contents/Resources/TahoeLight.heic')
  assert.equal(sources[2]?.url, videoUrl('tahoe-light-landscape'))
  assert.equal(sources[3]?.cacheUUID, UUIDS.tahoeLandscape)
  assert.equal(sources[4]?.cacheUUID, UUIDS.sequoiaLandscape)
  assert.equal(sources[4]?.url, videoUrl('sequoia'))
})

test('Apple显示顺序插入新主题后统一截前五，不把顺序改写成OS版本', async () => {
  const { selectSystemWallpaperSources } = await loadCatalogModule()
  const sources = selectSystemWallpaperSources(catalogFixture({
    addNextTheme: true,
    rootExtra: { macOSVersion: '999', osRelease: 'invented' },
  }), [
    { identifier: 'Tahoe', imagePath: '/System/Library/ExtensionKit/Extensions/NeptuneOneWallpaper.appex/Contents/Resources/TahoeLight.heic', url: videoUrl('tahoe-light-landscape') },
  ])

  assert.equal(sources.length, 5)
  assert.deepEqual(sources.map(source => source.name), [
    'Aurora', 'Aurora Evening', 'Golden Gate', 'Golden Gate Sunset', 'Tahoe',
  ])
  assert.equal(sources[0]?.id, 'system-wallpaper-video-a1a1a1a1-1111-4111-8111-111111111111')
  assert.equal(sources[1]?.id, 'system-wallpaper-video-a0a0a0a0-1111-4111-8111-111111111111')
  assert.equal(sources[4]?.id, 'system-wallpaper-tahoe')
  assert.equal(sources[4]?.sourceType, 'image')
  assert.equal(sources.some(source => source.id === 'system-wallpaper-tahoe-day'), false)
  assert.equal(sources.some(source => /999|invented|macos/i.test(source.name)), false)
})

test('第三组唯一dynamic先于景观代表进入前五，截断后不验未选代表URL', async () => {
  const { selectSystemWallpaperSources } = await loadCatalogModule()
  const fixture = catalogFixture({ thirdDynamic: true, thirdLandscapeUrl: 'https://example.com/unselected.mov' })
  const landscapeAsset = fixture.assets.find(item => item.id === UUIDS.sequoiaLandscape)!
  landscapeAsset.subcategories = ['unselected-membership']
  const sources = selectSystemWallpaperSources(fixture, [
    { identifier: 'Tahoe', imagePath: '/System/Library/ExtensionKit/Extensions/NeptuneOneWallpaper.appex/Contents/Resources/TahoeLight.heic', url: videoUrl('tahoe-light-landscape') },
  ])

  assert.deepEqual(sources.map(source => source.name), [
    'Golden Gate', 'Golden Gate Sunset', 'Tahoe', 'Tahoe Day', 'Sequoia',
  ])
  assert.equal(sources[4]?.id, `system-wallpaper-video-${UUIDS.dynamicSequoia.toLowerCase()}`)
  assert.equal(sources[4]?.sourceType, 'video')
  assert.equal(sources.some(source => source.id === `system-wallpaper-video-${UUIDS.sequoiaLandscape.toLowerCase()}`), false)
})

test('进入前五的后续dynamic仍须唯一且绑定其代表资产', async () => {
  const { selectSystemWallpaperSources } = await loadCatalogModule()
  const provider = [{ identifier: 'Tahoe', imagePath: '/System/Library/ExtensionKit/Extensions/NeptuneOneWallpaper.appex/Contents/Resources/TahoeLight.heic', url: videoUrl('tahoe-light-landscape') }]
  const wrongMembership = catalogFixture({ thirdDynamic: true }) as ReturnType<typeof catalogFixture> & {
    assets: Array<Record<string, unknown>>
  }
  const dynamicAsset = wrongMembership.assets.find(item => item.id === UUIDS.dynamicSequoia)!
  dynamicAsset.subcategories = ['unselected-membership']
  await assert.rejects(async () => selectSystemWallpaperSources(wrongMembership, provider),
    error => errorCode(error) === 'protocol-invalid')

  const ambiguous = catalogFixture({ thirdDynamic: true }) as ReturnType<typeof catalogFixture> & {
    categories: Array<Record<string, unknown>>
  }
  const dynamicCategory = ambiguous.categories.find(item => item.id === DYNAMIC_CATEGORY) as {
    subcategories: Array<Record<string, unknown>>
  }
  const sequoiaDynamic = dynamicCategory.subcategories.find(item => item.id === SEQUOIA_DYNAMIC_SUBCATEGORY)!
  dynamicCategory.subcategories.push({
    ...sequoiaDynamic, id: 'dynamic-sequoia-copy', preferredOrder: -498,
  })
  await assert.rejects(async () => selectSystemWallpaperSources(ambiguous, provider),
    error => errorCode(error) === 'protocol-invalid')
})

test('前两组缺少原有dynamic或provider时仍拒绝不完整基线', async () => {
  const { selectSystemWallpaperSources } = await loadCatalogModule()
  const tahoeOnly = [{ identifier: 'Tahoe', imagePath: '/System/Library/ExtensionKit/Extensions/NeptuneOneWallpaper.appex/Contents/Resources/TahoeLight.heic', url: videoUrl('tahoe-light-landscape') }]
  const withoutGoldenDynamic = catalogFixture() as ReturnType<typeof catalogFixture> & {
    categories: Array<Record<string, unknown>>
  }
  const dynamic = withoutGoldenDynamic.categories.find(item => item.id === DYNAMIC_CATEGORY) as {
    subcategories: unknown[]
  }
  dynamic.subcategories = []
  await assert.rejects(async () => selectSystemWallpaperSources(withoutGoldenDynamic, tahoeOnly),
    error => errorCode(error) === 'unavailable')
  await assert.rejects(async () => selectSystemWallpaperSources(catalogFixture(), []),
    error => errorCode(error) === 'unavailable')
})

test('缺少第三Landscape组时只返回原四项，不伪造第五项', async () => {
  const { selectSystemWallpaperSources } = await loadCatalogModule()
  const sources = selectSystemWallpaperSources(catalogFixture({ omitThirdLandscape: true }), [
    { identifier: 'Tahoe', imagePath: '/System/Library/ExtensionKit/Extensions/NeptuneOneWallpaper.appex/Contents/Resources/TahoeLight.heic', url: videoUrl('tahoe-light-landscape') },
  ])

  assert.equal(sources.length, 4)
  assert.deepEqual(sources.map(source => source.id), [
    'system-wallpaper-golden-gate', 'system-wallpaper-golden-gate-sunset',
    'system-wallpaper-tahoe', 'system-wallpaper-tahoe-day',
  ])
})

test('第三Landscape代表必须有唯一成员关系、Apple URL和素材身份', async () => {
  const { selectSystemWallpaperSources } = await loadCatalogModule()
  const provider = [{ identifier: 'Tahoe', imagePath: '/System/Library/ExtensionKit/Extensions/NeptuneOneWallpaper.appex/Contents/Resources/TahoeLight.heic', url: videoUrl('tahoe-light-landscape') }]

  const duplicateOrder = catalogFixture() as ReturnType<typeof catalogFixture> & {
    categories: Array<Record<string, unknown>>
  }
  const orderLandscapes = duplicateOrder.categories.find(item => item.id === LANDSCAPE_CATEGORY) as {
    subcategories: Array<Record<string, unknown>>
  }
  orderLandscapes.subcategories[2] = { ...orderLandscapes.subcategories[2], preferredOrder: 1 }
  await assert.rejects(async () => selectSystemWallpaperSources(duplicateOrder, provider),
    error => errorCode(error) === 'protocol-invalid')

  const wrongMembership = catalogFixture() as ReturnType<typeof catalogFixture> & { assets: Array<Record<string, unknown>> }
  const sequoia = wrongMembership.assets.find(item => item.id === UUIDS.sequoiaLandscape)!
  sequoia.subcategories = ['not-sequoia']
  await assert.rejects(async () => selectSystemWallpaperSources(wrongMembership, provider),
    error => errorCode(error) === 'protocol-invalid')

  await assert.rejects(async () => selectSystemWallpaperSources(catalogFixture({
    thirdLandscapeUrl: 'https://example.com/sequoia.mov',
  }), provider), error => errorCode(error) === 'protocol-invalid')

  await assert.rejects(async () => selectSystemWallpaperSources(catalogFixture({
    thirdLandscapeUrl: videoUrl('golden-sunset'),
  }), provider), error => errorCode(error) === 'protocol-invalid')

  const duplicateIdentity = catalogFixture() as ReturnType<typeof catalogFixture> & {
    assets: Array<Record<string, unknown>>
    categories: Array<Record<string, unknown>>
  }
  const landscapes = duplicateIdentity.categories.find(item => item.id === LANDSCAPE_CATEGORY) as {
    subcategories: Array<Record<string, unknown>>
  }
  landscapes.subcategories[2] = {
    ...landscapes.subcategories[2], representativeAssetID: UUIDS.goldenLandscape,
  }
  const golden = duplicateIdentity.assets.find(item => item.id === UUIDS.goldenLandscape)!
  golden.subcategories = [GOLDEN_SUBCATEGORY, SEQUOIA_SUBCATEGORY]
  await assert.rejects(async () => selectSystemWallpaperSources(duplicateIdentity, provider),
    error => errorCode(error) === 'protocol-invalid')
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
  await assert.rejects(async () => selectSystemWallpaperSources(catalogFixture({ addNextTheme: true }), [
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
