/**
 * [INPUT]: 依赖 Client 壁纸图库包装、共享资产契约与 fake store/adapter。
 * [OUTPUT]: 验证动态活动目录与旧缓存分账、系统/用户持久媒体边界、目录失败码保真、纯本地选择与销毁结算。
 * [POS]: 壁纸图库 Client 专项回归；以可控 Image/Store 验证取消和持久语义，不连接网络、实际 IndexedDB、Host 或系统素材。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { webcrypto } from 'node:crypto';
import { createWallpaperGallery, type WallpaperGallery, type WallpaperGallerySelection } from '../src/client/capture/wallpaper-gallery.ts';
import { createSystemWallpaperSelectionAction, createWallpaperGalleryActions } from '../src/client/capture/wallpaper-gallery-actions.ts';
import { WallpaperGalleryError } from '../src/shared/wallpaper-gallery.ts';
import { captureWindowCopy } from '../src/client/capture/copy.ts';
import { captureWindowTemplate } from '../src/client/capture/view.ts';
import { createCaptureWindowState } from '../src/client/capture/model.ts';
import { applyCapturePreferences, loadCapturePreferences, saveCapturePreferences } from '../src/client/capture/preferences.ts';
import { SystemWallpaperClientError } from '../src/client/capture/system-wallpaper-remote.ts';
import { createSystemWallpaperController } from '../src/client/capture/system-wallpapers.ts';

const systemId = 'system-wallpaper-golden-gate';
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/WQAAAABJRU5ErkJggg==', 'base64');
const tinyJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x03, 0x01, 0x11, 0x00, 0xff, 0xd9]);
const thumb = 'data:image/jpeg;base64,YQ==';

function fakeStore(seed = []) {
  const records = new Map(seed.map(asset => [asset.id, asset]));
  const calls = { get: [], list: 0, put: [], remove: [], close: 0 };
  let failPut;
  return {
    calls,
    records,
    setPutFailure(error) { failPut = error; },
    store: {
      async list() { calls.list++; return [...records.values()]; },
      async get(id) { calls.get.push(id); return records.get(id); },
      async put(asset) { calls.put.push(asset); if (failPut) throw failPut; records.set(asset.id, asset); },
      async remove(id) { calls.remove.push(id); records.delete(id); },
      close() { calls.close++; },
    },
  };
}

function systemAsset() {
  return { id: systemId, blob: new Blob([tinyJpeg], { type: 'image/jpeg' }),
    width: 1, height: 1, sourceType: 'image', thumbnail: thumb, createdAt: 1 };
}

function setup({ store = fakeStore(), systemAdapter, decodeBlob, createThumbnail } = {}) {
  return {
    fake: store,
    gallery: createWallpaperGallery({
      store: store.store,
      systemAdapter,
      crypto: webcrypto,
      decodeBlob: decodeBlob ?? (async () => ({ width: 1, height: 1 })),
      createThumbnail: createThumbnail ?? (async () => thumb),
      now: () => 42,
    }),
  };
}

test('显式获取的目录错误必须上抛，已有缓存仍可纯本地恢复和选择', async () => {
  const error = new SystemWallpaperClientError('helper-failed');
  let loads = 0;
  const { gallery, fake } = setup({ store: fakeStore([systemAsset()]), systemAdapter: {
    async list() { throw error; },
    async load() { loads++; assert.fail('目录失败不能继续请求媒体'); },
  } });
  try {
    await assert.rejects(gallery.systemAdapter.list(undefined, { requireSource: true }), caught => caught === error,
      '不能将失败目录伪装成只含缓存的成功目录');
    assert.equal((await gallery.systemAdapter.restore()).length, 1);
    assert.equal((await gallery.load(systemId)).asset.id, systemId);
    assert.equal(loads, 0);
    assert.equal(fake.calls.put.length, 0);
    assert.equal(fake.calls.remove.length, 0);
  } finally { gallery.close(); }
});

test('真实Gallery批获取必须保留目录失败码，不把两张缓存误报为成功目录', async () => {
  const error = new SystemWallpaperClientError('helper-failed');
  const cached = [systemAsset(), { ...systemAsset(), id: 'system-wallpaper-tahoe' }];
  let lists = 0;
  let loads = 0;
  const { gallery, fake } = setup({ store: fakeStore(cached), systemAdapter: {
    async list() { lists++; throw error; },
    async load() { loads++; assert.fail('目录失败不能继续请求媒体'); },
  } });
  const controller = createSystemWallpaperController(gallery.systemAdapter);
  try {
    await assert.rejects(controller.acquireAll(), caught => caught === error);
    assert.deepEqual(controller.getState().acquisition,
      { status: 'error', completed: 0, total: 0, failureCode: 'helper-failed' });
    assert.deepEqual(controller.getState().entries.map(entry => entry.id), cached.map(asset => asset.id));
    assert.equal(lists, 1);
    assert.equal(loads, 0);
    assert.equal(fake.calls.put.length, 0);
    assert.equal(fake.calls.remove.length, 0);
    assert.equal((await gallery.systemAdapter.list()).length, 2, '普通离线目录仍可显示缓存');
  } finally { await controller.destroy(); gallery.close(); }
});

test('未来材料进入当前目录，旧系统/用户资产留仓而不扩张当前四项目标', async () => {
  const futureId = 'system-wallpaper-video-11111111-2222-4333-8444-555555555555';
  const old = systemAsset();
  const { gallery, fake } = setup({ store: fakeStore([old]), systemAdapter: {
    async list() { return [{ id: futureId, name: 'Future Day', available: false, downloadable: true }]; },
    async load(id) { assert.equal(id, futureId); return `data:image/jpeg;base64,${Buffer.from(tinyJpeg).toString('base64')}`; },
    getSourceType() { return 'video'; },
  } });
  try {
    const roster = await gallery.systemAdapter.list(undefined, { requireSource: true });
    assert.deepEqual(roster.map(entry => entry.id), [futureId]);
    await gallery.systemAdapter.load(futureId);
    const restored = await gallery.systemAdapter.restore();
    assert.deepEqual(restored.map(entry => entry.id), [systemId, futureId]);
    assert.equal((await gallery.load(futureId)).asset.id, futureId);
    assert.equal(fake.records.has(systemId), true);
    assert.equal(fake.calls.remove.length, 0, '新版目录不得驱逐旧资产');
  } finally { gallery.close(); }
});

test('cached system JPEG wins before the remote load and listing never requests pixels', async () => {
  const fake = fakeStore([systemAsset()]);
  let remoteLists = 0;
  let remoteLoads = 0;
  const { gallery } = setup({ store: fake, systemAdapter: {
    async list() { remoteLists++; return [{ id: systemId, name: 'Golden Gate', available: false, downloadable: false }]; },
    async load() { remoteLoads++; throw new Error('must use gallery cache'); },
  } });

  const assets = await gallery.list();
  assert.equal(assets.length, 1);
  assert.equal(remoteLists, 0, 'local gallery listing does not touch the system provider');
  const entries = await gallery.systemAdapter.list();
  assert.equal(entries[0].available, true, 'a saved item remains selectable while its source is unavailable');
  assert.equal(entries[0].downloadable, false);
  assert.equal(entries[0].thumbnail, thumb);
  const loaded = await gallery.systemAdapter.load(systemId);
  assert.match(loaded, /^data:image\/jpeg;base64,/);
  assert.equal(remoteLoads, 0);
  assert.equal(remoteLists, 1);
  gallery.close();
  assert.equal(fake.calls.remove.length, 0, 'closing a gallery releases the connection, not saved media');
  assert.equal(fake.calls.close, 1);
});

test('selecting a missing cached system material never reacquires it outside the explicit batch', async () => {
  let remoteLoads = 0;
  const { gallery } = setup({ systemAdapter: {
    async list() { return []; },
    async load() { remoteLoads++; return `data:image/jpeg;base64,${Buffer.from(tinyJpeg).toString('base64')}`; },
  } });
  try {
    await assert.rejects(gallery.load(systemId), { code: 'storage-unavailable' });
    assert.equal(remoteLoads, 0, 'selection is local-only, even if metadata was present before its asset disappeared');
  } finally { gallery.close(); }
});

test('explicit system load is saved before it is returned, then restoration is local-only', async () => {
  const fake = fakeStore();
  let remoteLoads = 0;
  let puts = 0;
  const originalPut = fake.store.put;
  fake.store.put = async asset => { puts++; await originalPut(asset); };
  const { gallery } = setup({ store: fake, systemAdapter: {
    async list() { return [{ id: systemId, name: 'Golden Gate', available: true, downloadable: false }]; },
    async load() { remoteLoads++; return `data:image/jpeg;base64,${Buffer.from(tinyJpeg).toString('base64')}`; },
    getSourceType() { return 'image'; },
  } });

  await gallery.systemAdapter.list();
  await gallery.systemAdapter.load(systemId);
  const selected = await gallery.load(systemId);
  assert.equal(selected.asset.id, systemId);
  assert.equal(puts, 1);
  assert.equal(remoteLoads, 1);
  assert.equal(fake.records.get(systemId).sourceType, 'image');
  const restored = await gallery.restore(systemId);
  assert.equal(restored.asset.id, systemId);
  assert.equal(remoteLoads, 1, 'restore only reads IndexedDB and never re-enters the helper');
});

test('user import verifies static image magic, hashes bytes, preserves PNG bytes and stores no filename', async () => {
  const { gallery, fake } = setup();
  const file = new File([tinyPng], 'private-home.png', { type: 'image/png' });
  const asset = await gallery.import(file);
  const expected = Buffer.from(await webcrypto.subtle.digest('SHA-256', tinyPng)).toString('hex');
  assert.equal(asset.id, `user-wallpaper-${expected}`);
  assert.equal(asset.blob.type, 'image/png');
  assert.deepEqual(Buffer.from(await asset.blob.arrayBuffer()), tinyPng);
  assert.deepEqual(Object.keys(asset).sort(), ['blob', 'createdAt', 'height', 'id', 'sourceType', 'thumbnail', 'width']);
  assert.equal(asset.sourceType, 'image');
  assert.equal(fake.calls.put.length, 1);
});

test('SVG, MIME mismatch, APNG and animated WebP are rejected before storage', async () => {
  const { gallery, fake } = setup();
  const bad = [
    new File(['<svg/>'], 'vector.svg', { type: 'image/svg+xml' }),
    new File([tinyPng], 'mismatch.jpg', { type: 'image/jpeg' }),
    new File([Buffer.concat([tinyPng.subarray(0, 33), Buffer.from([0, 0, 0, 8]), Buffer.from('acTL'), Buffer.alloc(12), tinyPng.subarray(33)])], 'animated.png', { type: 'image/png' }),
    new File([Buffer.from('RIFF\x16\0\0\0WEBPVP8X\x0a\0\0\0\x02\0\0\0\0\0')], 'animated.webp', { type: 'image/webp' }),
  ];
  for (const file of bad) await assert.rejects(gallery.import(file), error => error instanceof WallpaperGalleryError && error.code === 'invalid-asset');
  assert.equal(fake.calls.put.length, 0);
});

test('gallery quota failure does not claim a saved selection; remove is limited to user IDs', async () => {
  const fake = fakeStore();
  fake.setPutFailure(new WallpaperGalleryError('gallery-full'));
  const { gallery } = setup({ store: fake });
  await assert.rejects(gallery.import(new File([tinyPng], 'not-retained.png', { type: 'image/png' })),
    error => error instanceof WallpaperGalleryError && error.code === 'gallery-full');
  await assert.rejects(gallery.remove(systemId), error => error instanceof WallpaperGalleryError && error.code === 'invalid-asset');
  const userId = `user-wallpaper-${'a'.repeat(64)}`;
  fake.records.set(userId, { ...systemAsset(), id: userId, sourceType: 'image', blob: new Blob([tinyPng], { type: 'image/png' }) });
  await gallery.remove(userId);
  assert.deepEqual(fake.calls.remove, [userId]);
});

test('preferences persist only opaque gallery IDs and accept a cached system or user ID on restore', () => {
  const userId = `user-wallpaper-${'b'.repeat(64)}`;
  let serialized = '';
  const storage = { getItem: () => serialized || null, setItem: (_key, value) => { serialized = value; } };
  const state = { ...createCaptureWindowState({ width: 1280, height: 720 }),
    background: { dataUrl: 'data:image/png;base64,private-pixels', kind: 'wallpaper', systemId: userId } };
  saveCapturePreferences(storage, state);
  assert.equal(serialized.includes('private-pixels'), false);
  assert.deepEqual(loadCapturePreferences(storage).background, { kind: 'wallpaper', systemId: userId });
  const restored = applyCapturePreferences(createCaptureWindowState({ width: 1280, height: 720 }), loadCapturePreferences(storage), 'data:image/png;base64,cached');
  assert.deepEqual(restored.background, { dataUrl: 'data:image/png;base64,cached', kind: 'wallpaper', systemId: userId });
  serialized = JSON.stringify({ background: { kind: 'wallpaper', systemId }, padding: 8, paddingUnit: 'percent', privacyEnabled: true, shadow: true });
  assert.deepEqual(loadCapturePreferences(storage).background, { kind: 'wallpaper', systemId });
});

test('saved My images and offline cached system tiles remain discoverable without a system provider or filenames', () => {
  const userId = `user-wallpaper-${'c'.repeat(64)}`;
  const userAsset = { ...systemAsset(), id: userId, sourceType: 'image', blob: new Blob([tinyPng], { type: 'image/png' }) };
  const state = createCaptureWindowState({ width: 1280, height: 720 });
  const html = captureWindowTemplate(state, captureWindowCopy('en'), {
    systemWallpapers: { entries: [], status: 'unavailable' },
    galleryAssets: [systemAsset(), userAsset],
    galleryStatus: 'ready',
  });
  assert.match(html, /My images/);
  assert.match(html, new RegExp(`data-gallery-wallpaper="${systemId}"`));
  assert.match(html, new RegExp(`data-gallery-user-image="${userId}"`));
  assert.match(html, new RegExp(`data-gallery-remove="${userId}"`));
  assert.match(html, /data-background-wallpaper[^>]*aria-label="Add image"/);
  assert.doesNotMatch(html, /data-action="(?:add-gallery-image|change-wallpaper)"|data-wallpaper-preview/);
  assert.doesNotMatch(html, /private-home\.png/);
  assert.doesNotMatch(html, /data-action="retry-system-wallpapers"/);
});

test('cached system catalog remains visible when its provider fails, without loading pixels', async () => {
  const fake = fakeStore([systemAsset()]);
  let loads = 0;
  const { gallery } = setup({ store: fake, systemAdapter: {
    async list() { throw new Error('private remote outage'); },
    async load() { loads++; throw new Error('must not load'); },
  } });
  const entries = await gallery.systemAdapter.list();
  assert.deepEqual(entries.map(entry => entry.id), [systemId]);
  assert.equal(entries[0].available, true);
  assert.equal(entries[0].thumbnail, thumb);
  assert.equal(loads, 0);
});

test('closing during cached Blob materialization rejects the late result', async () => {
  let reads = 0;
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  class DelayedBlob extends Blob {
    async arrayBuffer() {
      reads++;
      if (reads === 2) return blocked;
      return super.arrayBuffer();
    }
  }
  const asset = { ...systemAsset(), blob: new DelayedBlob([tinyJpeg], { type: 'image/jpeg' }) };
  const { gallery } = setup({ store: fakeStore([asset]) });
  const pending = gallery.load(systemId);
  for (let turn = 0; turn < 20 && reads < 2; turn++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(reads, 2);
  gallery.close();
  release(tinyJpeg.buffer.slice(tinyJpeg.byteOffset, tinyJpeg.byteOffset + tinyJpeg.byteLength));
  await assert.rejects(pending, error => error instanceof WallpaperGalleryError && error.code === 'disposed');
});

test('encoded dimensions are checked against budgets before browser decode allocation', async () => {
  let decodes = 0;
  const oversized = Buffer.from(tinyPng);
  oversized.writeUInt32BE(6000, 16);
  oversized.writeUInt32BE(6000, 20);
  const { gallery, fake } = setup({ decodeBlob: async () => { decodes++; return { width: 6000, height: 6000 }; } });
  await assert.rejects(gallery.import(new File([oversized], 'large.png', { type: 'image/png' })),
    error => error instanceof WallpaperGalleryError && error.code === 'invalid-asset');
  assert.equal(decodes, 0);
  assert.equal(fake.calls.put.length, 0);
});

test('EXIF-oriented user JPEG may swap encoded dimensions during decode and cached readback', async () => {
  const orientedJpeg = Buffer.from(tinyJpeg);
  orientedJpeg[10] = 2;
  const { gallery } = setup({ decodeBlob: async () => ({ width: 1, height: 2 }) });
  const asset = await gallery.import(new File([orientedJpeg], 'rotated.jpg', { type: 'image/jpeg' }));
  assert.deepEqual([asset.width, asset.height], [1, 2], 'stored size follows the browser-decoded EXIF orientation');
  const selected = await gallery.load(asset.id);
  assert.deepEqual([selected.asset.width, selected.asset.height], [1, 2], 'cached selection validates against the oriented dimensions');
});

test('starting a system selection cancels a late gallery decode before resolving or applying it', async () => {
  const userId = `user-wallpaper-${'e'.repeat(64)}`;
  let observedSignal: AbortSignal | undefined;
  let revision = 0;
  let applied = 0;
  let resolveCalls = 0;
  let selectedSystemId: string | undefined;
  const asset = { id: userId, blob: new Blob([tinyPng], { type: 'image/png' }), width: 1, height: 1,
    sourceType: 'image' as const, thumbnail: thumb, createdAt: 1 };
  let finishLoad!: (selection: WallpaperGallerySelection) => void;
  const loading = new Promise<WallpaperGallerySelection>(resolve => { finishLoad = resolve; });
  const gallery: WallpaperGallery = {
    async list() { return []; },
    async get() { return undefined; },
    async put() {},
    async remove() {},
    close() {},
    systemAdapter: undefined,
    load: (_id, signal) => { observedSignal = signal; return loading; },
    async import() { throw new Error('unused'); },
    async restore() { return null; },
  };
  const actions = createWallpaperGalleryActions({
    advanceBackgroundRevision: () => ++revision,
    createAbortController: () => new AbortController(),
    gallery,
    invalidateSystemSelection() {},
    isAlive: () => true,
    isEditing: () => true,
    notifyError: () => assert.fail('unexpected gallery error'),
    onChanged() {},
    onRemoved() {},
    onRestore() {},
    onSelected() { applied++; },
    readBackgroundRevision: () => revision,
    resolve: async () => { resolveCalls++; return {} as HTMLImageElement; },
  });
  const gallerySelection = actions.select(userId);
  const systemSelection = createSystemWallpaperSelectionAction(actions, () => ++revision, async id => {
    selectedSystemId = id;
  });
  await systemSelection(systemId);
  assert.equal(observedSignal?.aborted, true, 'the older gallery work is canceled before system load starts');
  finishLoad({ asset, dataUrl: 'data:image/png;base64,YQ==' });
  await gallerySelection;
  assert.equal(selectedSystemId, systemId);
  assert.equal(resolveCalls, 0, 'a canceled Gallery await must not start Image decoding');
  assert.equal(applied, 0, 'late gallery completion cannot overwrite the newer system choice');
});

test('Gallery Blob decode passes cancellation to Image and promptly revokes its temporary URL', async () => {
  const fake = fakeStore();
  const originalImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  let src = '';
  let removedSrc = false;
  let revoked: string[] = [];
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: class {
    naturalWidth = 1;
    naturalHeight = 1;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
      const handlers = listeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
      handlers.add(listener);
      listeners.set(type, handlers);
    }
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject) { listeners.get(type)?.delete(listener); }
    set src(value: string) { src = value; removedSrc = false; }
    get src() { return src; }
    removeAttribute(name: string) { if (name === 'src') { src = ''; removedSrc = true; } }
  } });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:gallery-cancel' });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: (url: string) => revoked.push(url) });
  const gallery = createWallpaperGallery({
    store: fake.store,
    systemAdapter: {
      async list() { return []; },
      async load() { return `data:image/jpeg;base64,${Buffer.from(tinyJpeg).toString('base64')}`; },
    },
    crypto: webcrypto,
    createThumbnail: async () => thumb,
  });
  try {
    const abort = new AbortController();
    const pending = gallery.systemAdapter.load(systemId, abort.signal);
    for (let turn = 0; turn < 20 && src !== 'blob:gallery-cancel'; turn++) await new Promise(resolve => setImmediate(resolve));
    assert.equal(src, 'blob:gallery-cancel', 'decode started through an owned temporary URL');
    abort.abort();
    await assert.rejects(pending, error => error.name === 'AbortError');
    assert.equal(removedSrc, true, 'abort clears the Image source to stop its pending fetch/decode');
    assert.deepEqual(revoked, ['blob:gallery-cancel'], 'the temporary Blob URL is revoked before the operation settles');
    assert.equal(fake.calls.put.length, 0, 'an aborted system image is never persisted');
    assert.equal(listeners.get('load')?.size ?? 0, 0);
    assert.equal(listeners.get('error')?.size ?? 0, 0);
  } finally {
    gallery.close();
    if (originalImage) Object.defineProperty(globalThis, 'Image', originalImage);
    else delete (globalThis as Record<string, unknown>).Image;
    if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate);
    else delete (URL as unknown as Record<string, unknown>).createObjectURL;
    if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke);
    else delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
  }
});

test('Gallery select, import and restore pass their owned signal to the resolver and suppress canceled results', async t => {
  const userId = `user-wallpaper-${'f'.repeat(64)}`;
  const asset = { id: userId, blob: new Blob([tinyPng], { type: 'image/png' }), width: 1, height: 1,
    sourceType: 'image' as const, thumbnail: thumb, createdAt: 1 };
  const selection = { asset, dataUrl: 'data:image/png;base64,YQ==' };
  const image = {} as HTMLImageElement;
  for (const operation of ['select', 'import', 'restore'] as const) {
    await t.test(operation, async () => {
      let resolverSignal: AbortSignal | undefined;
      let finishResolver!: (value: HTMLImageElement) => void;
      let applied = 0;
      let revision = 0;
      const gallery: WallpaperGallery = {
        async list() { return []; },
        async get() { return undefined; },
        async put() {},
        async remove() {},
        close() {},
        systemAdapter: undefined,
        async load() { return selection; },
        async import() { return asset; },
        async restore() { return selection; },
      };
      const actions = createWallpaperGalleryActions({
        advanceBackgroundRevision: () => ++revision,
        createAbortController: () => new AbortController(),
        gallery,
        invalidateSystemSelection() {},
        isAlive: () => true,
        isEditing: () => true,
        notifyError: error => assert.fail(`unexpected action failure: ${String(error)}`),
        onChanged() {},
        onRemoved() {},
        onRestore() { applied++; },
        onSelected() { applied++; },
        readBackgroundRevision: () => revision,
        resolve: (_id, _selection, signal) => {
          resolverSignal = signal;
          return new Promise(resolve => { finishResolver = resolve; });
        },
      });
      const pending = operation === 'select' ? actions.select(userId)
        : operation === 'import' ? actions.import(new File([tinyPng], 'image.png', { type: 'image/png' }))
          : actions.restore(userId);
      for (let turn = 0; turn < 20 && !resolverSignal; turn++) await new Promise(resolve => setImmediate(resolve));
      assert.ok(resolverSignal, 'resolver receives the selection-owned cancellation signal');
      assert.equal(resolverSignal.aborted, false);
      actions.cancelSelection();
      assert.equal(resolverSignal.aborted, true, 'switch/cancel reaches in-flight browser Image decoding');
      finishResolver(image);
      await pending;
      assert.equal(applied, 0, 'late decoded pixels cannot be applied after cancellation');
      actions.destroy();
    });
  }
});

test('destroy aborts in-flight decode and clears the gallery controller’s owned asset and status references', async () => {
  const userId = `user-wallpaper-${'d'.repeat(64)}`;
  const asset = { id: userId, blob: new Blob([tinyPng], { type: 'image/png' }), width: 1, height: 1,
    sourceType: 'image' as const, thumbnail: thumb, createdAt: 1 };
  const selection = { asset, dataUrl: 'data:image/png;base64,YQ==' };
  let revision = 0;
  let resolverSignal: AbortSignal | undefined;
  const gallery: WallpaperGallery = {
    async list() { return [asset]; },
    async get() { return undefined; },
    async put() {},
    async remove() {},
    close() {},
    systemAdapter: undefined,
    async load() { return selection; },
    async import() { return asset; },
    async restore() { return selection; },
  };
  const actions = createWallpaperGalleryActions({
    advanceBackgroundRevision: () => ++revision,
    createAbortController: () => new AbortController(),
    gallery,
    invalidateSystemSelection() {},
    isAlive: () => true,
    isEditing: () => true,
    notifyError: error => assert.fail(`unexpected action failure: ${String(error)}`),
    onChanged() {},
    onRemoved() {},
    onRestore() {},
    onSelected() { assert.fail('destroyed image must not apply'); },
    readBackgroundRevision: () => revision,
    resolve: (_id, _selection, signal) => new Promise((_resolve, reject) => {
      resolverSignal = signal;
      signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted', 'AbortError')), { once: true });
    }),
  });
  await actions.loadInventory();
  assert.deepEqual(actions.getState(), { assets: [asset], busyId: null, status: 'ready' });
  const pending = actions.select(userId);
  for (let turn = 0; turn < 20 && !resolverSignal; turn++) await new Promise(resolve => setImmediate(resolve));
  assert.ok(resolverSignal);
  assert.equal(actions.getState().busyId, userId);
  actions.destroy();
  await pending;
  assert.equal(resolverSignal.aborted, true);
  assert.deepEqual(actions.getState(), { assets: [], busyId: null, status: 'idle' });
});

test('destroy joins its owned Gallery.load before late results can resolve, apply, or notify', async () => {
  let markLoadStarted!: () => void;
  const loadStarted = new Promise<void>(resolve => { markLoadStarted = resolve; });
  let finishLoad!: (selection: WallpaperGallerySelection) => void;
  let observedSignal: AbortSignal | undefined;
  let revision = 0;
  let resolveCalls = 0;
  let applied = 0;
  let notices = 0;
  const asset = systemAsset();
  const pendingLoad = new Promise<WallpaperGallerySelection>(resolve => { finishLoad = resolve; });
  const gallery: WallpaperGallery = {
    async list() { return []; },
    async get() { return undefined; },
    async put() {},
    async remove() {},
    close() {},
    systemAdapter: undefined,
    load: (_id, signal) => {
      observedSignal = signal;
      markLoadStarted();
      // +--- 仅把 Gallery.load 的拥有权延迟到显式结算，不模拟可同步终止的浏览器解码。 ---+
      return pendingLoad;
    },
    async import() { throw new Error('unused'); },
    async restore() { return null; },
  };
  const actions = createWallpaperGalleryActions({
    advanceBackgroundRevision: () => ++revision,
    createAbortController: () => new AbortController(),
    gallery,
    invalidateSystemSelection() {},
    isAlive: () => true,
    isEditing: () => true,
    notifyError() { notices++; },
    onChanged() {},
    onRemoved() {},
    onRestore() {},
    onSelected() { applied++; },
    readBackgroundRevision: () => revision,
    resolve: async () => { resolveCalls++; return {} as HTMLImageElement; },
  });

  const selection = actions.select(systemId);
  await loadStarted;
  let destroySettled = false;
  const destruction = Promise.resolve(actions.destroy()).then(() => { destroySettled = true; });
  try {
    assert.equal(observedSignal?.aborted, true, 'destroy aborts the Gallery.load signal synchronously');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(destroySettled, false, 'destroy must join its still-pending Gallery.load');
  } finally {
    finishLoad({ asset, dataUrl: `data:image/jpeg;base64,${Buffer.from(tinyJpeg).toString('base64')}` });
  }

  await selection;
  await destruction;
  assert.equal(resolveCalls, 0, 'late Gallery data does not start a new decode after destroy');
  assert.equal(applied, 0, 'late Gallery data is never selected after destroy');
  assert.equal(notices, 0, 'ordinary destroy cancellation is silent');
});
