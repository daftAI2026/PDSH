/**
 * [INPUT]: 依赖共享图库DTO/语义名预算与注入的最小IndexedDB双；不连接Host、Remote或真实浏览器数据库。
 * [OUTPUT]: 验证系统名v1往返、旧无名记录兼容、用户项拒名、同事务预算、关闭再开持久及固定错误码。
 * [POS]: Client IndexedDB媒体仓的TDD合同；共享文档仍由上级地图维护。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  WALLPAPER_GALLERY_LIMITS,
  WallpaperGalleryError,
  wallpaperGalleryDatabaseName,
} from '../src/shared/wallpaper-gallery.ts'
import type { WallpaperGalleryAsset } from '../src/shared/wallpaper-gallery.ts'
import { SYSTEM_WALLPAPER_IDS } from '../src/shared/system-wallpaper-protocol.ts'
import { createWallpaperGalleryStore } from '../src/client/capture/wallpaper-gallery-store.ts'

type FakeAsset = WallpaperGalleryAsset & Record<string, unknown>
const FAKE_STORE_NAME = 'wallpaper-gallery-assets'

class FakeRequest<T = unknown> {
  result!: T
  error: DOMException | null = null
  onsuccess: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  succeed(result: T): void {
    this.result = result
    this.onsuccess?.(new Event('success'))
  }
}

class FakeOpenRequest extends FakeRequest<FakeDatabase> {
  onupgradeneeded: ((event: Event) => void) | null = null
  onblocked: ((event: Event) => void) | null = null
}

type FakeState = {
  version: number
  stores: Map<string, Map<string, FakeAsset>>
  tail: Promise<void>
}

class FakeIDBFactory {
  readonly states = new Map<string, FakeState>()
  readonly virtualBlobSizes = new Map<string, number>()
  readonly getAllCounts: Array<number | undefined> = []
  readonly heldStarts: Array<() => void> = []
  readonly openHandles = new Map<string, FakeDatabase>()
  holdTransactions = false
  openCalls = 0
  openError: Error | undefined
  private nextTransactionListener: (() => void) | undefined

  open(name: string, version = 1): IDBOpenDBRequest {
    if (this.openError) throw this.openError
    this.openCalls++
    let state = this.states.get(name)
    if (!state) {
      state = { version: 0, stores: new Map(), tail: Promise.resolve() }
      this.states.set(name, state)
    }
    const database = new FakeDatabase(state, this)
    this.openHandles.set(name, database)
    const request = new FakeOpenRequest()
    queueMicrotask(() => {
      request.result = database
      if (state!.version < version) {
        state!.version = version
        request.onupgradeneeded?.(new Event('upgradeneeded'))
      }
      request.onsuccess?.(new Event('success'))
    })
    return request as unknown as IDBOpenDBRequest
  }

  whenNextTransactionCreated(): Promise<void> {
    return new Promise(resolve => { this.nextTransactionListener = resolve })
  }

  notifyTransactionCreated(): void {
    const notify = this.nextTransactionListener
    this.nextTransactionListener = undefined
    notify?.()
  }

  releaseHeldTransactions(): void {
    for (const start of this.heldStarts.splice(0)) start()
  }

  seed(name: string, storeName: string, rows: Array<[string, FakeAsset]>): void {
    let state = this.states.get(name)
    if (!state) {
      state = { version: 1, stores: new Map(), tail: Promise.resolve() }
      this.states.set(name, state)
    }
    state.version = 1
    state.stores.set(storeName, new Map(rows))
  }
}

class FakeDatabase {
  readonly objectStoreNames: IDBObjectStoreNames
  onversionchange: ((event: Event) => void) | null = null
  private closed = false
  private readonly state: FakeState
  private readonly factory: FakeIDBFactory

  constructor(state: FakeState, factory: FakeIDBFactory) {
    this.state = state
    this.factory = factory
    this.objectStoreNames = {
      contains: (name: string) => state.stores.has(name),
      item: (index: number) => [...state.stores.keys()][index] ?? null,
      get length() { return state.stores.size },
      [Symbol.iterator]: function* () { yield* state.stores.keys() },
    } as IDBObjectStoreNames
  }

  createObjectStore(name: string): IDBObjectStore {
    this.state.stores.set(name, new Map())
    return {} as IDBObjectStore
  }

  transaction(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBTransaction {
    if (this.closed) throw new DOMException('closed')
    const data = this.state.stores.get(storeName)
    if (!data) throw new DOMException('missing store')
    const transaction = new FakeTransaction(mode, data, this.factory)
    let release!: () => void
    const previous = this.state.tail
    this.state.tail = new Promise<void>(resolve => { release = resolve })
    void previous.then(() => {
      const start = () => transaction.start(release)
      if (this.factory.holdTransactions) this.factory.heldStarts.push(start)
      else start()
    })
    this.factory.notifyTransactionCreated()
    return transaction as unknown as IDBTransaction
  }

  close(): void { this.closed = true }
  triggerVersionChange(): void {
    this.onversionchange?.(new Event('versionchange'))
    this.close()
  }
}

class FakeTransaction {
  oncomplete: ((event: Event) => void) | null = null
  onabort: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  private readonly jobs: Array<(store: Map<string, FakeAsset>) => void> = []
  private active = false
  private aborted = false
  private finished = false
  private scheduled = false
  private working: Map<string, FakeAsset> | undefined
  private releaseLock: (() => void) | undefined
  readonly mode: IDBTransactionMode
  private readonly source: Map<string, FakeAsset>
  private readonly factory: FakeIDBFactory

  constructor(mode: IDBTransactionMode, source: Map<string, FakeAsset>, factory: FakeIDBFactory) {
    this.mode = mode
    this.source = source
    this.factory = factory
  }

  objectStore(_storeName: string): FakeObjectStore { return new FakeObjectStore(this, this.factory) }

  start(release: () => void): void {
    this.active = true
    this.releaseLock = release
    this.working = new Map([...this.source].map(([id, asset]) => [id, copyFakeAsset(asset)]))
    this.schedule()
  }

  enqueue(job: (store: Map<string, FakeAsset>) => void): void {
    if (this.finished || this.aborted) return
    this.jobs.push(job)
    this.schedule()
  }

  abort(): void {
    if (this.finished) return
    this.aborted = true
    this.schedule()
  }

  private schedule(): void {
    if (!this.active || this.scheduled || this.finished) return
    this.scheduled = true
    queueMicrotask(() => this.pump())
  }

  private pump(): void {
    this.scheduled = false
    if (this.finished) return
    if (this.aborted) { this.finish(false); return }
    const job = this.jobs.shift()
    if (job) {
      try { job(this.working!) } catch { this.aborted = true }
      this.schedule()
      return
    }
    this.finish(true)
  }

  private finish(commit: boolean): void {
    if (this.finished) return
    this.finished = true
    if (commit && this.mode === 'readwrite') {
      this.source.clear()
      if (this.working) for (const [id, asset] of this.working) this.source.set(id, asset)
    }
    if (commit) this.oncomplete?.(new Event('complete'))
    else this.onabort?.(new Event('abort'))
    this.releaseLock?.()
  }

}

class FakeObjectStore {
  private readonly transaction: FakeTransaction
  private readonly factory: FakeIDBFactory
  constructor(transaction: FakeTransaction, factory: FakeIDBFactory) {
    this.transaction = transaction
    this.factory = factory
  }

  getAll(_query?: IDBKeyRange | IDBValidKey, count?: number): IDBRequest<FakeAsset[]> {
    const request = new FakeRequest<FakeAsset[]>()
    this.factory.getAllCounts.push(count)
    this.transaction.enqueue(store => request.succeed(
      [...store.values()].slice(0, count).map(copyFakeAsset),
    ))
    return request as unknown as IDBRequest<FakeAsset[]>
  }

  get(id: string): IDBRequest<FakeAsset | undefined> {
    const request = new FakeRequest<FakeAsset | undefined>()
    this.transaction.enqueue(store => request.succeed(store.has(id) ? copyFakeAsset(store.get(id)!) : undefined))
    return request as unknown as IDBRequest<FakeAsset | undefined>
  }

  put(asset: FakeAsset): IDBRequest<string> {
    const request = new FakeRequest<string>()
    this.transaction.enqueue(store => {
      const copy = copyFakeAsset(asset)
      const virtualSize = this.factory.virtualBlobSizes.get(asset.id)
      if (virtualSize !== undefined) Object.defineProperty(copy.blob, 'size', { value: virtualSize })
      store.set(asset.id, copy)
      request.succeed(asset.id)
    })
    return request as unknown as IDBRequest<string>
  }

  delete(id: string): IDBRequest<undefined> {
    const request = new FakeRequest<undefined>()
    this.transaction.enqueue(store => { store.delete(id); request.succeed(undefined) })
    return request as unknown as IDBRequest<undefined>
  }
}

function copyFakeAsset(asset: FakeAsset): FakeAsset {
  return { ...asset, blob: asset.blob } as FakeAsset
}

function validUserAsset(index: number, blob: Blob = new Blob(['image'], { type: 'image/png' })): WallpaperGalleryAsset {
  return {
    id: `user-wallpaper-${index.toString(16).padStart(64, '0')}`,
    blob,
    width: 2,
    height: 2,
    sourceType: 'image',
    thumbnail: 'data:image/jpeg;base64,AA==',
    createdAt: 1,
  }
}

function validSystemAsset(id: string): WallpaperGalleryAsset {
  return {
    id,
    blob: new Blob(['jpeg'], { type: 'image/jpeg' }),
    width: 2,
    height: 2,
    sourceType: 'video',
    thumbnail: 'data:image/jpeg;base64,AA==',
    createdAt: 0,
  }
}

test('IndexedDB gallery is root-scoped, persists across close, returns canonical assets, and does not delete on close', async () => {
  const indexedDB = new FakeIDBFactory()
  const name = wallpaperGalleryDatabaseName('pdsh-rc')
  assert.notEqual(name, wallpaperGalleryDatabaseName('pdsh'))
  const store = createWallpaperGalleryStore({ name, indexedDB: indexedDB as unknown as IDBFactory })
  await store.put(validSystemAsset('system-wallpaper-tahoe'))
  const loaded = await store.get('system-wallpaper-tahoe')
  assert.equal(loaded?.id, 'system-wallpaper-tahoe')
  assert.equal(loaded?.blob.type, 'image/jpeg')
  assert.deepEqual(Object.keys(loaded ?? {}).sort(), ['blob', 'createdAt', 'height', 'id', 'sourceType', 'thumbnail', 'width'])
  assert.equal((await store.list()).length, 1)
  store.close()
  store.close()
  await assert.rejects(store.list(), error => (error as WallpaperGalleryError).code === 'disposed')

  const reopened = createWallpaperGalleryStore({ name, indexedDB: indexedDB as unknown as IDBFactory })
  assert.equal((await reopened.get('system-wallpaper-tahoe'))?.id, 'system-wallpaper-tahoe')
  await reopened.remove('system-wallpaper-tahoe')
  assert.equal(await reopened.get('system-wallpaper-tahoe'), undefined)
  reopened.close()
})

test('semantic system names round-trip in v1 while legacy rows without names remain readable', async () => {
  const indexedDB = new FakeIDBFactory()
  const name = wallpaperGalleryDatabaseName('pdsh-rc')
  const dynamicId = `system-wallpaper-image-${'b'.repeat(64)}`
  const store = createWallpaperGalleryStore({ name, indexedDB: indexedDB as unknown as IDBFactory })
  await store.put({ ...validSystemAsset(dynamicId), systemName: 'Windows · img0' } as WallpaperGalleryAsset)
  await store.put(validSystemAsset(SYSTEM_WALLPAPER_IDS[0]))
  assert.equal((await store.get(dynamicId) as (WallpaperGalleryAsset & { systemName?: string }) | undefined)?.systemName,
    'Windows · img0')
  assert.equal((await store.get(SYSTEM_WALLPAPER_IDS[0]))?.systemName, undefined,
    'legacy v1 assets do not need an upgrade or a synthetic name field')
  assert.equal(indexedDB.states.get(name)?.version, 1, 'the additive metadata field does not change the database schema')
  store.close()

  const reopened = createWallpaperGalleryStore({ name, indexedDB: indexedDB as unknown as IDBFactory })
  assert.equal((await reopened.get(dynamicId) as (WallpaperGalleryAsset & { systemName?: string }) | undefined)?.systemName,
    'Windows · img0')
  assert.equal((await reopened.get(SYSTEM_WALLPAPER_IDS[0]))?.id, SYSTEM_WALLPAPER_IDS[0])
  await assert.rejects(reopened.put({ ...validUserAsset(1), systemName: 'Windows · img0' } as WallpaperGalleryAsset),
    error => (error as WallpaperGalleryError).code === 'invalid-asset')
  reopened.close()
})

test('versionchange discards the resolved opening handle and opens a fresh connection', async () => {
  const indexedDB = new FakeIDBFactory()
  const store = createWallpaperGalleryStore({ name: 'gallery-versionchange', indexedDB: indexedDB as unknown as IDBFactory })
  assert.deepEqual(await store.list(), [])
  assert.equal(indexedDB.openCalls, 1)
  indexedDB.openHandles.get('gallery-versionchange')!.triggerVersionChange()
  assert.deepEqual(await store.list(), [])
  assert.equal(indexedDB.openCalls, 2, 'a resolved promise must not resurrect the closed connection')
  store.close()
})

test('list and put bound getAll and reject over-count, over-user-count, or over-budget stored galleries', async () => {
  const excessCountDb = new FakeIDBFactory()
  const badRows = Array.from({ length: WALLPAPER_GALLERY_LIMITS.maxEntries + 1 }, (_, index) => [
    `corrupt-${index}`, { id: `corrupt-${index}` } as FakeAsset,
  ] as [string, FakeAsset])
  excessCountDb.seed('gallery-over-count', FAKE_STORE_NAME, badRows)
  const countStore = createWallpaperGalleryStore({ name: 'gallery-over-count', indexedDB: excessCountDb as unknown as IDBFactory })
  await assert.rejects(countStore.list(), error => (error as WallpaperGalleryError).code === 'gallery-full')
  await assert.rejects(countStore.put(validUserAsset(999)), error => (error as WallpaperGalleryError).code === 'gallery-full')
  assert.deepEqual(excessCountDb.getAllCounts, [WALLPAPER_GALLERY_LIMITS.maxEntries + 1, WALLPAPER_GALLERY_LIMITS.maxEntries + 1])
  countStore.close()

  const excessUsersDb = new FakeIDBFactory()
  const excessUsers = Array.from({ length: WALLPAPER_GALLERY_LIMITS.maxUserEntries + 1 }, (_, index) => {
    const asset = validUserAsset(index) as FakeAsset
    return [asset.id, asset] as [string, FakeAsset]
  })
  excessUsersDb.seed('gallery-over-users', FAKE_STORE_NAME, excessUsers)
  const userStore = createWallpaperGalleryStore({ name: 'gallery-over-users', indexedDB: excessUsersDb as unknown as IDBFactory })
  await assert.rejects(userStore.list(), error => (error as WallpaperGalleryError).code === 'gallery-full')
  assert.equal(excessUsersDb.getAllCounts[0], WALLPAPER_GALLERY_LIMITS.maxEntries + 1)
  userStore.close()

  const excessBytesDb = new FakeIDBFactory()
  const oversizedMedia = Array.from({ length: 8 }, (_, index) => {
    const asset = validUserAsset(index) as FakeAsset
    Object.defineProperty(asset.blob, 'size', { value: WALLPAPER_GALLERY_LIMITS.maxUserBytes })
    return [asset.id, asset] as [string, FakeAsset]
  })
  excessBytesDb.seed('gallery-over-bytes', FAKE_STORE_NAME, oversizedMedia)
  const byteStore = createWallpaperGalleryStore({ name: 'gallery-over-bytes', indexedDB: excessBytesDb as unknown as IDBFactory })
  await assert.rejects(byteStore.list(), error => (error as WallpaperGalleryError).code === 'gallery-full')
  byteStore.close()
})

test('close aborts an in-flight write and its promise rejects disposed without committing', async () => {
  const indexedDB = new FakeIDBFactory()
  indexedDB.holdTransactions = true
  const name = 'gallery-close-inflight'
  const store = createWallpaperGalleryStore({ name, indexedDB: indexedDB as unknown as IDBFactory })
  const transactionCreated = indexedDB.whenNextTransactionCreated()
  const pending = store.put(validUserAsset(42))
  await transactionCreated
  await new Promise(resolve => setImmediate(resolve))
  store.close()
  indexedDB.holdTransactions = false
  indexedDB.releaseHeldTransactions()
  await assert.rejects(pending, error => (error as WallpaperGalleryError).code === 'disposed')

  const reopened = createWallpaperGalleryStore({ name, indexedDB: indexedDB as unknown as IDBFactory })
  assert.equal(await reopened.get(validUserAsset(42).id), undefined, 'aborted write is not present after reopening')
  reopened.close()
})

test('gallery accepts only closed IDs and shared media contracts; it never stores File metadata or extra keys', async () => {
  const indexedDB = new FakeIDBFactory()
  const store = createWallpaperGalleryStore({ name: 'gallery-validation', indexedDB: indexedDB as unknown as IDBFactory })
  const FileConstructor = (await import('node:buffer')).File
  const file = new FileConstructor(['user image'], 'private-name.png', { type: 'image/png', lastModified: 99 })
  await store.put({ ...validUserAsset(1, file), id: `user-wallpaper-${'a'.repeat(64)}` })
  const saved = await store.get(`user-wallpaper-${'a'.repeat(64)}`)
  assert.equal(saved?.blob instanceof FileConstructor, false)
  assert.equal('name' in (saved?.blob ?? {}), false)
  assert.equal(saved?.blob.type, 'image/png')

  const badAssets = [
    { ...validUserAsset(2), id: 'user-wallpaper-../path' },
    { ...validUserAsset(3), id: `user-wallpaper-${'g'.repeat(64)}` },
    { ...validUserAsset(4), blob: new Blob(['x'], { type: 'image/gif' }) },
    { ...validUserAsset(5), width: Number.POSITIVE_INFINITY },
    { ...validUserAsset(6), thumbnail: 'file:///Users/person/private.png' },
    { ...validUserAsset(7), fileName: 'private.png' },
  ]
  for (const asset of badAssets) {
    await assert.rejects(store.put(asset as WallpaperGalleryAsset), error => (error as WallpaperGalleryError).code === 'invalid-asset')
  }
  assert.equal((await store.list()).length, 1)
  store.close()
})

test('one serialized readwrite transaction enforces media+thumbnail bytes and user count without eviction', async () => {
  const indexedDB = new FakeIDBFactory()
  const name = 'gallery-budget'
  const store = createWallpaperGalleryStore({ name, indexedDB: indexedDB as unknown as IDBFactory })
  const simulatedUserBlobBytes = 32 * 1024 * 1024
  for (let index = 0; index < 7; index++) {
    const asset = validUserAsset(index)
    indexedDB.virtualBlobSizes.set(asset.id, simulatedUserBlobBytes)
    await store.put(asset)
  }
  const simulatedSystemBlobBytes = Math.floor((WALLPAPER_GALLERY_LIMITS.maxBytes - 7 * simulatedUserBlobBytes - 100) / 4)
  for (const id of SYSTEM_WALLPAPER_IDS) {
    indexedDB.virtualBlobSizes.set(id, simulatedSystemBlobBytes)
    await store.put(validSystemAsset(id))
  }
  const totalOver = validUserAsset(8, new Blob(['x'], { type: 'image/png' }))
  await assert.rejects(store.put(totalOver), error => (error as WallpaperGalleryError).code === 'gallery-full')
  await assert.rejects(store.list(), error => (error as WallpaperGalleryError).code === 'gallery-full')
  assert.equal(indexedDB.states.get(name)?.stores.get(FAKE_STORE_NAME)?.size, 11,
    'thumbnail bytes count toward the cap; refusal does not evict prior entries')

  const countDb = new FakeIDBFactory()
  const countStore = createWallpaperGalleryStore({ name: 'gallery-count', indexedDB: countDb as unknown as IDBFactory })
  for (let index = 0; index < WALLPAPER_GALLERY_LIMITS.maxUserEntries - 1; index++) {
    await countStore.put(validUserAsset(index))
  }
  const first = validUserAsset(100)
  const second = validUserAsset(101)
  const outcomes = await Promise.allSettled([countStore.put(first), countStore.put(second)])
  assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1)
  const rejected = outcomes.find(outcome => outcome.status === 'rejected') as PromiseRejectedResult
  assert.equal((rejected.reason as WallpaperGalleryError).code, 'gallery-full')
  assert.equal((await countStore.list()).length, WALLPAPER_GALLERY_LIMITS.maxUserEntries)
  countStore.close()
  store.close()
})

test('storage failures are fixed and redacted; invalid IDs never reach IndexedDB', async () => {
  const unopened = new FakeIDBFactory()
  const idGuard = createWallpaperGalleryStore({ name: 'gallery-id-guard', indexedDB: unopened as unknown as IDBFactory })
  await assert.rejects(idGuard.get('../private'), error => (error as WallpaperGalleryError).code === 'invalid-asset')
  await assert.rejects(idGuard.remove('../private'), error => (error as WallpaperGalleryError).code === 'invalid-asset')
  assert.equal(unopened.states.size, 0, 'invalid IDs are rejected before opening a database')
  idGuard.close()

  const unavailable = new FakeIDBFactory()
  unavailable.openError = new Error('disk path /private/user/Library/Application Support')
  const store = createWallpaperGalleryStore({ name: 'gallery-unavailable', indexedDB: unavailable as unknown as IDBFactory })
  await assert.rejects(store.list(), error => {
    assert.equal((error as WallpaperGalleryError).code, 'storage-unavailable')
    assert.doesNotMatch(String(error), /private|Library|Application Support/)
    return true
  })
  store.close()
})
