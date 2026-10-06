/**
 * [INPUT]: 依赖 shared WallpaperGalleryAsset 的闭集ID/Blob/缩略图合同与浏览器 IndexedDB；不读Host、Settings或用户文件名。
 * [OUTPUT]: 提供稳定/RC隔离的异步本地媒体仓；有界重读并在同一读写事务检验容量/项数再原子写入。
 * [POS]: capture 的持久背景素材仓；只保留静态派生Blob与最小显示元数据，关闭会中止在途事务但不清除图库。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  WALLPAPER_GALLERY_LIMITS,
  WallpaperGalleryError,
  isGalleryWallpaperId,
  isUserWallpaperId,
  isWallpaperGalleryAsset,
} from '../../shared/wallpaper-gallery.ts'
import type { WallpaperGalleryAsset } from '../../shared/wallpaper-gallery.ts'

const DATABASE_VERSION = 1
const ASSET_STORE = 'wallpaper-gallery-assets'

export interface WallpaperGalleryStoreOptions {
  readonly name: string
  readonly indexedDB?: IDBFactory
}

export interface WallpaperGalleryStore {
  list(): Promise<WallpaperGalleryAsset[]>
  get(id: string): Promise<WallpaperGalleryAsset | undefined>
  put(asset: WallpaperGalleryAsset): Promise<void>
  remove(id: string): Promise<void>
  close(): void
}

/** IndexedDB只存媒体，不存设置；调用方以根配置身份生成稳定/RC隔离名称。 */
export function createWallpaperGalleryStore(options: WallpaperGalleryStoreOptions): WallpaperGalleryStore {
  let closed = false
  let database: IDBDatabase | undefined
  let opening: Promise<IDBDatabase> | undefined
  const activeTransactions = new Set<() => void>()

  function openDatabase(): Promise<IDBDatabase> {
    if (closed) return Promise.reject(new WallpaperGalleryError('disposed'))
    if (database) return Promise.resolve(database)
    if (opening) return opening

    const factory = options.indexedDB ?? globalThis.indexedDB
    if (!factory || typeof options.name !== 'string' || options.name.length === 0) {
      return Promise.reject(new WallpaperGalleryError('storage-unavailable'))
    }

    const pending = new Promise<IDBDatabase>((resolve, reject) => {
      let request: IDBOpenDBRequest
      let blocked = false
      let completed = false
      const rejectOnce = (failure: WallpaperGalleryError): void => {
        if (completed) return
        completed = true
        reject(failure)
      }
      try { request = factory.open(options.name, DATABASE_VERSION) }
      catch { rejectOnce(new WallpaperGalleryError('storage-unavailable')); return }

      request.onupgradeneeded = () => {
        try {
          const opened = request.result
          if (!opened.objectStoreNames.contains(ASSET_STORE)) {
            opened.createObjectStore(ASSET_STORE, { keyPath: 'id' })
          }
        } catch {
          try { request.transaction?.abort() } catch { /* 只暴露固定storage错误。 */ }
        }
      }
      request.onblocked = () => {
        blocked = true
        rejectOnce(new WallpaperGalleryError('storage-unavailable'))
      }
      request.onerror = () => rejectOnce(new WallpaperGalleryError('storage-unavailable'))
      request.onsuccess = () => {
        const opened = request.result
        if (closed || blocked || completed) {
          try { opened.close() } catch { /* 关闭失败不泄漏原始存储错误。 */ }
          if (closed) rejectOnce(new WallpaperGalleryError('disposed'))
          return
        }
        completed = true
        database = opened
        opened.onversionchange = () => {
          if (database === opened) database = undefined
          try { opened.close() } catch { /* 连接关闭不改写业务结果。 */ }
        }
        resolve(opened)
      }
    })
    opening = pending
    void pending.then(
      () => { if (opening === pending) opening = undefined },
      () => { if (opening === pending) opening = undefined },
    )
    return pending
  }

  function transaction<T>(
    mode: IDBTransactionMode,
    run: (
      store: IDBObjectStore,
      tx: IDBTransaction,
      fail: (error: WallpaperGalleryError) => void,
      setResult: (value: T) => void,
    ) => void,
  ): Promise<T> {
    if (closed) return Promise.reject(new WallpaperGalleryError('disposed'))
    return openDatabase().then(db => new Promise<T>((resolve, reject) => {
      if (closed) { reject(new WallpaperGalleryError('disposed')); return }
      let tx: IDBTransaction
      try { tx = db.transaction(ASSET_STORE, mode) }
      catch { reject(new WallpaperGalleryError(closed ? 'disposed' : 'storage-unavailable')); return }

      let failure: WallpaperGalleryError | undefined
      let result: T
      const fail = (error: WallpaperGalleryError): void => {
        failure ??= error
        try { tx.abort() } catch { /* 事务可能已经进入中止阶段。 */ }
      }
      const abortForDispose = (): void => {
        failure = new WallpaperGalleryError('disposed')
        try { tx.abort() } catch { /* 数据库关闭时不伪造在途事务成功。 */ }
      }
      activeTransactions.add(abortForDispose)
      tx.oncomplete = () => {
        activeTransactions.delete(abortForDispose)
        if (failure) reject(failure)
        else resolve(result)
      }
      tx.onabort = () => {
        activeTransactions.delete(abortForDispose)
        reject(failure ?? new WallpaperGalleryError('storage-unavailable'))
      }
      tx.onerror = () => { failure ??= new WallpaperGalleryError('storage-unavailable') }
      try {
        run(tx.objectStore(ASSET_STORE), tx, fail, value => { result = value })
      } catch {
        fail(new WallpaperGalleryError('storage-unavailable'))
      }
    }))
  }

  function list(): Promise<WallpaperGalleryAsset[]> {
    return transaction<WallpaperGalleryAsset[]>('readonly', (store, _tx, fail, setResult) => {
      const request = store.getAll(undefined, WALLPAPER_GALLERY_LIMITS.maxEntries + 1)
      request.onsuccess = () => {
        try {
          if (!Array.isArray(request.result)) throw new WallpaperGalleryError('invalid-asset')
          if (request.result.length > WALLPAPER_GALLERY_LIMITS.maxEntries) {
            throw new WallpaperGalleryError('gallery-full')
          }
          const assets = request.result.map(normalizeStoredAsset)
          assertGalleryWithinLimits(assets)
          assets.sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
          setResult(assets)
        } catch (error) { fail(error instanceof WallpaperGalleryError ? error : new WallpaperGalleryError('invalid-asset')) }
      }
      request.onerror = () => fail(new WallpaperGalleryError('storage-unavailable'))
    })
  }

  function get(id: string): Promise<WallpaperGalleryAsset | undefined> {
    if (closed) return Promise.reject(new WallpaperGalleryError('disposed'))
    if (!isGalleryWallpaperId(id)) return Promise.reject(new WallpaperGalleryError('invalid-asset'))
    return transaction<WallpaperGalleryAsset | undefined>('readonly', (store, _tx, fail, setResult) => {
      const request = store.get(id)
      request.onsuccess = () => {
        try { setResult(request.result === undefined ? undefined : normalizeStoredAsset(request.result)) }
        catch (error) { fail(error instanceof WallpaperGalleryError ? error : new WallpaperGalleryError('invalid-asset')) }
      }
      request.onerror = () => fail(new WallpaperGalleryError('storage-unavailable'))
    })
  }

  function put(input: WallpaperGalleryAsset): Promise<void> {
    if (closed) return Promise.reject(new WallpaperGalleryError('disposed'))
    let asset: WallpaperGalleryAsset
    try { asset = normalizeInputAsset(input) }
    catch (error) {
      return Promise.reject(error instanceof WallpaperGalleryError ? error : new WallpaperGalleryError('invalid-asset'))
    }
    return transaction<void>('readwrite', (store, _tx, fail, setResult) => {
      const request = store.getAll(undefined, WALLPAPER_GALLERY_LIMITS.maxEntries + 1)
      request.onsuccess = () => {
        try {
          if (!Array.isArray(request.result)) throw new WallpaperGalleryError('invalid-asset')
          if (request.result.length > WALLPAPER_GALLERY_LIMITS.maxEntries) {
            throw new WallpaperGalleryError('gallery-full')
          }
          const existing = request.result.map(normalizeStoredAsset)
          assertGalleryWithinLimits(existing)
          const retained = existing.filter(item => item.id !== asset.id)
          assertGalleryWithinLimits([...retained, asset])
          const putRequest = store.put(asset)
          putRequest.onsuccess = () => setResult(undefined)
          putRequest.onerror = () => fail(new WallpaperGalleryError('storage-unavailable'))
        } catch (error) {
          fail(error instanceof WallpaperGalleryError ? error : new WallpaperGalleryError('invalid-asset'))
        }
      }
      request.onerror = () => fail(new WallpaperGalleryError('storage-unavailable'))
    })
  }

  function remove(id: string): Promise<void> {
    if (closed) return Promise.reject(new WallpaperGalleryError('disposed'))
    if (!isGalleryWallpaperId(id)) return Promise.reject(new WallpaperGalleryError('invalid-asset'))
    return transaction<void>('readwrite', (store, _tx, fail, setResult) => {
      const request = store.delete(id)
      request.onsuccess = () => setResult(undefined)
      request.onerror = () => fail(new WallpaperGalleryError('storage-unavailable'))
    })
  }

  return {
    list,
    get,
    put,
    remove,
    close() {
      if (closed) return
      closed = true
      const current = database
      database = undefined
      for (const abort of [...activeTransactions]) abort()
      try { current?.close() } catch { /* 关闭为终态，但不删除已持久化的用户素材。 */ }
    },
  }
}

function normalizeInputAsset(value: unknown): WallpaperGalleryAsset {
  let valid = false
  try { valid = isWallpaperGalleryAsset(value) } catch { valid = false }
  if (!valid) throw new WallpaperGalleryError('invalid-asset')
  const asset = value as WallpaperGalleryAsset
  try {
    return Object.freeze({
      id: asset.id,
      blob: new Blob([asset.blob], { type: asset.blob.type }),
      width: asset.width,
      height: asset.height,
      sourceType: asset.sourceType,
      thumbnail: asset.thumbnail,
      createdAt: asset.createdAt,
    })
  } catch { throw new WallpaperGalleryError('storage-unavailable') }
}

function normalizeStoredAsset(value: unknown): WallpaperGalleryAsset {
  let valid = false
  try { valid = isWallpaperGalleryAsset(value) } catch { valid = false }
  if (!valid) throw new WallpaperGalleryError('invalid-asset')
  const asset = value as WallpaperGalleryAsset
  try {
    return Object.freeze({
      id: asset.id,
      blob: removeFileMetadata(asset.blob),
      width: asset.width,
      height: asset.height,
      sourceType: asset.sourceType,
      thumbnail: asset.thumbnail,
      createdAt: asset.createdAt,
    })
  } catch { throw new WallpaperGalleryError('storage-unavailable') }
}

function removeFileMetadata(blob: Blob): Blob {
  try {
    if (!('name' in blob) && !('lastModified' in blob)) return blob
    return new Blob([blob], { type: blob.type })
  } catch { throw new WallpaperGalleryError('storage-unavailable') }
}

function storedBytes(asset: WallpaperGalleryAsset): number {
  // Base64缩略图仅含ASCII；按UTF-16双字节保守计入媒体仓预算。
  return asset.blob.size + asset.thumbnail.length * 2
}

function assertGalleryWithinLimits(assets: readonly WallpaperGalleryAsset[]): void {
  const userCount = assets.reduce((count, asset) => count + (isUserWallpaperId(asset.id) ? 1 : 0), 0)
  const bytes = assets.reduce((sum, asset) => sum + storedBytes(asset), 0)
  if (assets.length > WALLPAPER_GALLERY_LIMITS.maxEntries
    || userCount > WALLPAPER_GALLERY_LIMITS.maxUserEntries
    || bytes > WALLPAPER_GALLERY_LIMITS.maxBytes) {
    throw new WallpaperGalleryError('gallery-full')
  }
}
