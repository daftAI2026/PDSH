/**
 * [INPUT]: 读取Apple本地Aerial entries.json、root-owned Wallpaper ExtensionKit manifest和官方固定视频URL校验器。
 * [OUTPUT]: 按landscape官方preferredOrder选择两组动态/景观代表；暴露只含Host源信息的目录，并仅stat本地媒体。
 * [POS]: Host素材发现边界；不联网、不读像素、不接收Renderer路径/URL，未知schema失败时保留既有缓存。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { createHash } from 'node:crypto'
import { constants as fsConstants } from 'node:fs'
import type { Stats } from 'node:fs'
import { lstat, open, readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
import { WALLPAPER_LIMITS, isSystemWallpaperName } from '../shared/system-wallpaper-protocol.ts'
import { NativeWallpaperFailure } from './system-wallpaper-native.ts'
import { isAppleWallpaperVideoUrl } from './system-wallpaper-transport.ts'

const EXTENSION_ROOT = '/System/Library/ExtensionKit/Extensions'
const MAX_MANIFEST_BYTES = 4 * 1024 * 1024, MAX_EXTENSION_MANIFEST_BYTES = 64 * 1024
const MAX_ASSETS = 512, MAX_CATEGORIES = 32, MAX_SUBCATEGORIES = 128, MAX_EXTENSION_BUNDLES = 512
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu
const IDENTIFIER = /^[A-Za-z0-9 -]{1,64}$/u
const THEME = /^[A-Z][A-Za-z0-9]*$/u
const KEY_PREFIXES = ['AerialSubcategoryDescription', 'AerialSubcategory'] as const
const LEGACY_VIDEO_IDS = new Map([
  ['4DFE24ED-71CC-42D4-9FE8-3B8959B6CC19', 'system-wallpaper-golden-gate'],
  ['4207734D-74FE-4F92-B5E1-6EC8DEE24A15', 'system-wallpaper-golden-gate-sunset'],
  ['4C108785-A7BA-422E-9C79-B0129F1D5550', 'system-wallpaper-tahoe-day'],
])
const LEGACY_IMAGE_IDS = new Map([['Tahoe', 'system-wallpaper-tahoe']])

export interface SystemWallpaperSource {
  id: string
  name: string
  available: boolean
  downloadable: boolean
  sourceType: 'image' | 'video'
  cacheUUID?: string
  imagePath?: string
  url?: string
}

interface JsonRecord { readonly [key: string]: unknown }
type WallpaperProvider = { identifier: string; imagePath: string; url?: string }
interface LandscapeGroup {
  readonly id: string
  readonly theme: string
  readonly order: number
  readonly representativeAssetID: string
}
type ParsedCatalog = { readonly assets: JsonRecord[]; readonly categories: Array<JsonRecord & { readonly subcategories: JsonRecord[] }> }

/** 只读Apple固定目录与本地文件元数据；任何IO失败都不联网，也不泄露路径。 */
export async function discoverSystemWallpaperSources(signal?: AbortSignal): Promise<SystemWallpaperSource[]> {
  throwIfAborted(signal)
  if (process.platform !== 'darwin' || typeof process.getuid !== 'function') unavailable()
  const uid = process.getuid()
  const cache = join(homedir(), 'Library', 'Application Support', 'com.apple.wallpaper', 'aerials')
  const manifestDir = join(cache, 'manifest')
  const videoDir = join(cache, 'videos')
  if (!await isDirectory(join(homedir(), 'Library'), uid)
    || !await isDirectory(join(homedir(), 'Library', 'Application Support'), uid)
    || !await isDirectory(join(homedir(), 'Library', 'Application Support', 'com.apple.wallpaper'), uid)
    || !await isDirectory(cache, uid) || !await isDirectory(manifestDir, uid)) unavailable()
  const bytes = await readJsonBytes(join(manifestDir, 'entries.json'), MAX_MANIFEST_BYTES, uid, false, signal)
  if (!bytes) unavailable()
  const providers = await readExtensionProviders(signal)
  const sources = selectSystemWallpaperSources(parseJson(bytes), providers)
  const hasVideoDir = await isDirectory(videoDir, uid)
  const result: SystemWallpaperSource[] = []
  for (const source of sources) {
    throwIfAborted(signal)
    const path = source.sourceType === 'video'
      ? (hasVideoDir && source.cacheUUID ? join(videoDir, `${source.cacheUUID}.mov`) : undefined)
      : source.imagePath
    const owner = source.sourceType === 'video' ? uid : 0
    const maximum = source.sourceType === 'video' ? WALLPAPER_LIMITS.maxVideoBytes : WALLPAPER_LIMITS.maxSourceImageBytes
    result.push({ ...source, available: path ? await isOwnedRegularFile(path, owner, maximum, signal) : false })
  }
  throwIfAborted(signal)
  return result
}

/** 纯选择器：只按Apple显式display order取两组，不推断OS版本或用位置充当缓存ID。 */
export function selectSystemWallpaperSources(
  manifest: unknown,
  providers: readonly { identifier: string; imagePath: string; url?: string }[],
): SystemWallpaperSource[] {
  const catalog = parseCatalog(manifest)
  if (!Array.isArray(providers) || providers.length > MAX_EXTENSION_BUNDLES) invalidCatalog()
  const providersByTheme = new Map<string, WallpaperProvider[]>()
  for (const value of providers) {
    if (!isRecord(value) || typeof value.identifier !== 'string' || !IDENTIFIER.test(value.identifier)
      || typeof value.imagePath !== 'string' || !isSafeImagePath(value.imagePath, value.identifier)
      || (value.url !== undefined && !isAppleWallpaperVideoUrl(value.url))) invalidCatalog()
    const matches = providersByTheme.get(value.identifier) ?? []
    matches.push(value as unknown as WallpaperProvider)
    providersByTheme.set(value.identifier, matches)
  }
  if ([...providersByTheme.values()].some(matches => matches.length > 1)) invalidCatalog()

  const landscapeCategories = catalog.categories.filter(item => item.localizedNameKey === 'AerialCategoryLandscapes')
  if (landscapeCategories.length !== 1) invalidCatalog()
  const landscape = landscapeCategories[0]!
  const groups: LandscapeGroup[] = []
  const themes = new Set<string>()
  const orders = new Set<number>()
  for (const item of landscape.subcategories) {
    const theme = parseThemeKey(item.localizedNameKey)
    const order = requireOrder(item.preferredOrder)
    if (themes.has(theme) || orders.has(order)) invalidCatalog()
    themes.add(theme); orders.add(order)
    groups.push({ id: requireString(item.id, 128), theme, order,
      representativeAssetID: requireUuid(item.representativeAssetID) })
  }
  groups.sort((a, b) => a.order - b.order)
  if (groups.length < 2) unavailable()

  const dynamicCategories = catalog.categories.filter(item => item.id === 'dynamic-aerials')
  if (dynamicCategories.length > 1) invalidCatalog()
  const dynamicCategory = dynamicCategories[0]
  const dynamicGroups = new Map<string, JsonRecord[]>()
  for (const item of dynamicCategory?.subcategories ?? []) {
    const theme = parseDynamicTheme(item.localizedNameKey)
    if (theme === undefined) continue
    const matches = dynamicGroups.get(theme) ?? []
    matches.push(item); dynamicGroups.set(theme, matches)
  }

  const assets = new Map(catalog.assets.map(asset => [requireUuid(asset.id), asset] as const))
  const result: SystemWallpaperSource[] = []
  for (const group of groups.slice(0, 2)) {
    const dynamicMatches = dynamicGroups.get(group.theme) ?? []
    const providerMatches = providersByTheme.get(group.theme) ?? []
    if (dynamicMatches.length > 1 || providerMatches.length > 1
      || (dynamicMatches.length && providerMatches.length)) invalidCatalog()
    if (dynamicMatches.length) {
      const dynamic = dynamicMatches[0]!
      const uuid = requireUuid(dynamic.representativeAssetID)
      const asset = requireMemberAsset(assets, uuid, requireString(dynamicCategory!.id, 128), requireString(dynamic.id, 128))
      result.push(videoSource(uuid, displayName(group.theme), videoUrl(asset)))
    } else if (providerMatches.length) {
      result.push(imageSource(providerMatches[0]!))
    } else unavailable()

    const landscapeAsset = requireMemberAsset(assets, group.representativeAssetID, requireString(landscape.id, 128), group.id)
    if (!isSystemWallpaperName(landscapeAsset.accessibilityLabel)) invalidCatalog()
    result.push(videoSource(group.representativeAssetID, landscapeAsset.accessibilityLabel, videoUrl(landscapeAsset)))
  }
  const ids = result.map(item => item.id)
  const urls = result.map(item => item.url).filter((item): item is string => item !== undefined)
  if (result.length !== WALLPAPER_LIMITS.maxCatalogEntries || new Set(ids).size !== ids.length
    || new Set(urls).size !== urls.length) invalidCatalog()
  return result
}

function parseCatalog(input: unknown): ParsedCatalog {
  if (!isRecord(input) || input.version !== 1 || !Array.isArray(input.assets) || !Array.isArray(input.categories)
    || input.assets.length > MAX_ASSETS || input.categories.length > MAX_CATEGORIES
    || !Number.isSafeInteger(input.initialAssetCount) || (input.initialAssetCount as number) < 0
    || (input.initialAssetCount as number) > MAX_ASSETS || typeof input.localizationVersion !== 'string'
    || input.localizationVersion.length < 1 || input.localizationVersion.length > 128) invalidCatalog()
  const assetIds = new Set<string>()
  const assets: JsonRecord[] = []
  for (const entry of input.assets) {
    if (!isRecord(entry)) invalidCatalog()
    const id = requireUuid(entry.id)
    if (assetIds.has(id)) invalidCatalog()
    assetIds.add(id); validateIdList(entry.categories); validateIdList(entry.subcategories)
    assets.push(entry)
  }
  const categoryIds = new Set<string>()
  const subcategoryIds = new Set<string>()
  let childCount = 0
  const categories: ParsedCatalog['categories'] = []
  for (const entry of input.categories) {
    if (!isRecord(entry) || !Array.isArray(entry.subcategories)) invalidCatalog()
    const id = requireString(entry.id, 128)
    requireString(entry.localizedNameKey, 128); requireOrder(entry.preferredOrder)
    if (categoryIds.has(id)) invalidCatalog()
    categoryIds.add(id); childCount += entry.subcategories.length
    if (childCount > MAX_SUBCATEGORIES) invalidCatalog()
    const subcategories: JsonRecord[] = []
    const childOrders = new Set<number>()
    for (const child of entry.subcategories) {
      if (!isRecord(child)) invalidCatalog()
      const childId = requireString(child.id, 128)
      requireString(child.localizedNameKey, 128)
      const order = requireOrder(child.preferredOrder)
      requireUuid(child.representativeAssetID)
      if (subcategoryIds.has(childId) || childOrders.has(order)) invalidCatalog()
      subcategoryIds.add(childId); childOrders.add(order); subcategories.push(child)
    }
    categories.push({ ...entry, id, subcategories })
  }
  return { assets, categories }
}

function requireMemberAsset(
  assets: ReadonlyMap<string, JsonRecord>, id: string, category: string, subcategory: string,
): JsonRecord {
  const asset = assets.get(id)
  if (!asset || !hasId(asset.categories, category) || !hasId(asset.subcategories, subcategory)) invalidCatalog()
  return asset
}

function videoSource(uuid: string, name: string, url: string | undefined): SystemWallpaperSource {
  if (!isSystemWallpaperName(name)) invalidCatalog()
  const canonical = uuid.toUpperCase()
  return {
    id: LEGACY_VIDEO_IDS.get(canonical) ?? `system-wallpaper-video-${canonical.toLowerCase()}`,
    name, available: false, downloadable: url !== undefined, sourceType: 'video', cacheUUID: canonical,
    ...(url ? { url } : {}),
  }
}

function imageSource(provider: WallpaperProvider): SystemWallpaperSource {
  const name = displayName(provider.identifier)
  if (!isSystemWallpaperName(name)) invalidCatalog()
  const identity = provider.url ?? provider.imagePath
  return {
    id: LEGACY_IMAGE_IDS.get(provider.identifier)
      ?? `system-wallpaper-image-${createHash('sha256').update(provider.identifier).update('\0').update(identity).digest('hex')}`,
    name, available: false, downloadable: provider.url !== undefined, sourceType: 'image',
    imagePath: provider.imagePath, ...(provider.url ? { url: provider.url } : {}),
  }
}

function parseThemeKey(value: unknown): string {
  if (typeof value !== 'string' || value.length > 128) invalidCatalog()
  for (const prefix of KEY_PREFIXES) {
    if (!value.startsWith(prefix)) continue
    const theme = value.slice(prefix.length)
    if (!THEME.test(theme)) invalidCatalog()
    return theme
  }
  return invalidCatalog()
}

function parseDynamicTheme(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 128) invalidCatalog()
  const prefix = KEY_PREFIXES.find(item => value.startsWith(item))
  if (!prefix) return undefined
  const tail = value.slice(prefix.length)
  if (!tail.endsWith('Graphical')) return undefined
  const theme = tail.slice(0, -'Graphical'.length)
  if (!THEME.test(theme)) invalidCatalog()
  return theme
}

function displayName(theme: string): string { return theme.replace(/([a-z0-9])([A-Z])/gu, '$1 $2') }

function videoUrl(asset: JsonRecord): string | undefined {
  const value = asset['url-4K-SDR-240FPS']
  if (value === undefined) return undefined
  if (!isAppleWallpaperVideoUrl(value)) invalidCatalog()
  return value
}

function validateIdList(value: unknown): void {
  if (!Array.isArray(value) || value.length > MAX_CATEGORIES) invalidCatalog()
  const ids = new Set<string>()
  for (const item of value) {
    const id = requireString(item, 128)
    if (ids.has(id)) invalidCatalog()
    ids.add(id)
  }
}

function hasId(value: unknown, expected: string): boolean {
  return Array.isArray(value) && value.includes(expected)
}

function requireUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) invalidCatalog()
  return value.toUpperCase()
}

function requireOrder(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < -100_000 || (value as number) > 100_000) invalidCatalog()
  return value as number
}

function requireString(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value || value.length > max || /\p{Cc}/u.test(value)) invalidCatalog()
  return value
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSafeImagePath(path: string, identifier: string): boolean {
  const expected = /^\/System\/Library\/ExtensionKit\/Extensions\/[A-Za-z0-9.-]+Wallpaper\.appex\/Contents\/Resources\/([A-Za-z0-9 -]{1,64})Light\.heic$/u
  const match = path.match(expected)
  return isAbsolute(path) && path.length <= 1_024 && !path.includes('\0') && match?.[1] === identifier
}

async function readExtensionProviders(signal?: AbortSignal): Promise<WallpaperProvider[]> {
  throwIfAborted(signal)
  if (!await isDirectory(EXTENSION_ROOT, 0)) return []
  let entries
  try { entries = await readdir(EXTENSION_ROOT, { withFileTypes: true }) }
  catch { return [] }
  const bundles = entries.filter(item => item.isDirectory() && item.name.endsWith('Wallpaper.appex')
    && /^[A-Za-z0-9.-]+\.appex$/u.test(item.name))
  if (bundles.length > MAX_EXTENSION_BUNDLES) invalidCatalog()
  const providers: WallpaperProvider[] = []
  for (const item of bundles) {
    throwIfAborted(signal)
    const bundle = join(EXTENSION_ROOT, item.name)
    const contents = join(bundle, 'Contents')
    const resources = join(contents, 'Resources')
    if (!await isDirectory(bundle, 0) || !await isDirectory(contents, 0) || !await isDirectory(resources, 0)) continue
    const bytes = await readJsonBytes(join(resources, 'manifest.json'), MAX_EXTENSION_MANIFEST_BYTES, 0, true, signal)
    if (!bytes) continue
    const manifest = parseJson(bytes)
    if (!isRecord(manifest) || manifest.version !== 1 || typeof manifest.identifier !== 'string'
      || !IDENTIFIER.test(manifest.identifier)) invalidCatalog()
    const lightUrl = manifest.lightLandscapeRemoteURL
    if (lightUrl !== undefined && !isAppleWallpaperVideoUrl(lightUrl)) invalidCatalog()
    const url = typeof lightUrl === 'string' ? lightUrl : undefined
    const imagePath = join(resources, `${manifest.identifier}Light.heic`)
    if (!isSafeImagePath(imagePath, manifest.identifier)) invalidCatalog()
    providers.push({ identifier: manifest.identifier, imagePath, ...(url ? { url } : {}) })
  }
  return providers
}

async function readJsonBytes(
  path: string, maximum: number, owner: number, missingAllowed: boolean, signal?: AbortSignal,
): Promise<Buffer | undefined> {
  throwIfAborted(signal)
  let handle
  try { handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK) }
  catch (error) {
    if (isMissing(error)) {
      if (missingAllowed) return undefined
      unavailable()
    }
    unavailable()
  }
  try {
    const before = await handle.stat()
    if (!before.isFile() || before.uid !== owner || before.size <= 0 || before.size > maximum) invalidCatalog()
    const chunks: Buffer[] = []
    let offset = 0
    while (offset < before.size) {
      throwIfAborted(signal)
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, before.size - offset))
      const read = await handle.read(chunk, 0, chunk.length, offset)
      if (read.bytesRead <= 0) invalidCatalog()
      chunks.push(chunk.subarray(0, read.bytesRead)); offset += read.bytesRead
    }
    if (!sameFile(before, await handle.stat()) || offset !== before.size) invalidCatalog()
    return Buffer.concat(chunks, offset)
  } catch (error) {
    if (error instanceof NativeWallpaperFailure) throw error
    unavailable()
  } finally { await handle.close().catch(() => undefined) }
}

function parseJson(bytes: Buffer): unknown {
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown }
  catch { return invalidCatalog() }
}

async function isOwnedRegularFile(path: string, owner: number, maximum: number, signal?: AbortSignal): Promise<boolean> {
  throwIfAborted(signal)
  let handle
  try { handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK) }
  catch { return false }
  try {
    const info = await handle.stat()
    return info.isFile() && info.uid === owner && info.size > 0 && info.size <= maximum
  } catch { return false }
  finally { await handle.close().catch(() => undefined) }
}

async function isDirectory(path: string, owner: number): Promise<boolean> {
  try {
    const info = await lstat(path)
    return info.isDirectory() && !info.isSymbolicLink() && info.uid === owner
  } catch { return false }
}

function sameFile(before: Stats, after: Stats): boolean {
  return before.dev === after.dev && before.ino === after.ino && before.uid === after.uid
    && before.size === after.size && before.mtimeMs === after.mtimeMs && before.ctimeMs === after.ctimeMs
}

function isMissing(error: unknown): boolean {
  const code = (error as { code?: unknown })?.code
  return code === 'ENOENT' || code === 'ENOTDIR'
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new NativeWallpaperFailure('cancelled')
}

function invalidCatalog(): never { throw new NativeWallpaperFailure('protocol-invalid') }
function unavailable(): never { throw new NativeWallpaperFailure('unavailable') }
