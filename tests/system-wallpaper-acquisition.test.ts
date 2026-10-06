/**
 * [INPUT]: 依赖 system-wallpapers controller、Gallery 缓存 wrapper、动态当前目录与可控 adapter/AbortSignal。
 * [OUTPUT]: 验证显式批次按当前available/downloadable目标串行持久化、旧缓存保留不计新进度，以及重试/固定错误码/取消和真实销毁结算。
 * [POS]: 批量系统壁纸 Client 专项合同；不读本机素材、执行真实 Host/Remote、真实 IndexedDB 或 Desktop。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSystemWallpaperController, createSystemWallpaperEditorActions, SystemWallpaperAcquisitionError, wireSystemWallpaperActions, type SystemWallpaperAdapter, type SystemWallpaperEntry } from '../src/client/capture/system-wallpapers.ts';
import { createWallpaperGallery } from '../src/client/capture/wallpaper-gallery.ts';
import { isSystemWallpaperId, SYSTEM_WALLPAPER_IDS } from '../src/shared/system-wallpaper-protocol.ts';
import { captureWindowCopy } from '../src/client/capture/copy.ts';
import { WallpaperGalleryError } from '../src/shared/wallpaper-gallery.ts';
import { SystemWallpaperClientError } from '../src/client/capture/system-wallpaper-remote.ts';

const thumb = 'data:image/jpeg;base64,dA==';
const largeJpegDataUrl = `data:image/jpeg;base64,${'x'.repeat(2 * 1024 * 1024)}`;
const futureVideoId = 'system-wallpaper-video-123e4567-e89b-12d3-a456-426614174000';
const futureStillId = `system-wallpaper-image-${'a'.repeat(64)}`;
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test('controller exposes no per-item prepare path outside the explicit batch API', async () => {
  const controller = createSystemWallpaperController(undefined);
  assert.equal('prepare' in controller, false,
    'an individual preload would bypass explicit four-item acquisition and Gallery persistence');
  await controller.destroy();
});

function catalog(): SystemWallpaperEntry[] {
  return SYSTEM_WALLPAPER_IDS.map(id => ({ id, name: id, available: true, downloadable: false }));
}

function cachedEntry(id: string): SystemWallpaperEntry {
  return { id, name: id, available: true, downloadable: false, sourceType: 'image', thumbnail: thumb, loadStatus: 'ready' };
}

function durableAdapter(options: {
  failOnce?: string;
  beforeLoad?: (id: string, signal?: AbortSignal) => Promise<void> | void;
} = {}) {
  const calls: string[] = [];
  const cache = new Map<string, SystemWallpaperEntry>();
  let failed = false;
  let activeLoads = 0;
  let maxActiveLoads = 0;
  const adapter: SystemWallpaperAdapter = {
    async list(signal) {
      calls.push('list');
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return catalog();
    },
    async restore(signal) {
      calls.push('restore');
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      return SYSTEM_WALLPAPER_IDS.flatMap(id => cache.has(id) ? [cache.get(id)!] : []);
    },
    async load(id, signal) {
      calls.push(`load:${id}`);
      activeLoads++;
      maxActiveLoads = Math.max(maxActiveLoads, activeLoads);
      try {
        await options.beforeLoad?.(id, signal);
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        if (id === options.failOnce && !failed) {
          failed = true;
          throw new Error('private media failure');
        }
        cache.set(id, cachedEntry(id));
        return largeJpegDataUrl;
      } finally {
        activeLoads--;
      }
    },
  };
  return { adapter, cache, calls, maxActiveLoads: () => maxActiveLoads };
}

test('有两项缓存时仍暴露原始目录失败码，而非仅笼统未完成', async () => {
  const fake = durableAdapter();
  fake.cache.set(SYSTEM_WALLPAPER_IDS[0], cachedEntry(SYSTEM_WALLPAPER_IDS[0]));
  fake.cache.set(SYSTEM_WALLPAPER_IDS[2], cachedEntry(SYSTEM_WALLPAPER_IDS[2]));
  fake.adapter.list = async () => { throw new SystemWallpaperClientError('helper-failed'); };
  const controller = createSystemWallpaperController(fake.adapter);
  try {
    await assert.rejects(controller.acquireAll(), { code: 'helper-failed' });
    assert.equal(controller.getState().acquisition?.failureCode, 'helper-failed');
    assert.equal(controller.getState().acquisition?.completed, 0,
      'cached legacy IDs cannot be claimed as completed until a fresh catalog identifies current targets');
    assert.equal(controller.getState().entries.length, 2, '诊断失败不能清掉已存资产');
    assert.equal(fake.calls.some(call => call.startsWith('load:')), false);
  } finally { await controller.destroy(); }
});

test('mount is inert; each explicit batch refreshes the catalog, loads current IDs serially, and retains only small restored entries', async () => {
  const fake = durableAdapter();
  const controller = createSystemWallpaperController(fake.adapter);
  assert.deepEqual(fake.calls, [], 'construction and mount do not enumerate or fetch media');
  assert.deepEqual(controller.getState().acquisition, { status: 'idle', completed: 0, total: 0 });

  await controller.acquireAll();
  assert.deepEqual(fake.calls, [
    'restore', 'list',
    `load:${SYSTEM_WALLPAPER_IDS[0]}`, 'restore',
    `load:${SYSTEM_WALLPAPER_IDS[1]}`, 'restore',
    `load:${SYSTEM_WALLPAPER_IDS[2]}`, 'restore',
    `load:${SYSTEM_WALLPAPER_IDS[3]}`, 'restore', 'restore',
  ]);
  assert.equal(fake.maxActiveLoads(), 1, 'acquisition never overlaps JPEG streams');
  assert.deepEqual(controller.getState().acquisition, { status: 'ready', completed: 4, total: 4 });
  assert.equal(controller.getState().entries.length, 4);
  assert.ok(controller.getState().entries.every(entry => entry.thumbnail === thumb));
  assert.equal(JSON.stringify(controller.getState()).includes(largeJpegDataUrl), false,
    'the controller never keeps the per-load full JPEG data URL as a batch asset or thumbnail');
  const beforeCachedRetry = fake.calls.length;
  await controller.acquireAll();
  assert.deepEqual(fake.calls.slice(beforeCachedRetry), ['restore', 'list', 'restore'],
    'an explicit retry re-reads the real roster but cached IDs do not reopen media streams');
  await controller.destroy();
});

test('serial progress remains readable but does not notify the whole editor for every downloaded item', async () => {
  const cache = new Map<string, SystemWallpaperEntry>();
  const notifications: Array<{ status: string; completed: number; total: number; ids: string[] }> = [];
  const reads: Array<{ completed: number; total: number }> = [];
  let controller!: ReturnType<typeof createSystemWallpaperController>;
  const adapter: SystemWallpaperAdapter = {
    async restore() { return [...cache.values()]; },
    async list() { return catalog(); },
    async load(id) {
      const progress = controller.getState().acquisition!;
      reads.push({ completed: progress.completed, total: progress.total });
      cache.set(id, cachedEntry(id));
      return largeJpegDataUrl;
    },
  };
  controller = createSystemWallpaperController(adapter, state => notifications.push({
    status: state.acquisition!.status,
    completed: state.acquisition!.completed,
    total: state.acquisition!.total,
    ids: state.entries.map(entry => entry.id),
  }));

  await controller.acquireAll();
  assert.deepEqual(reads, [
    { completed: 0, total: 4 }, { completed: 1, total: 4 },
    { completed: 2, total: 4 }, { completed: 3, total: 4 },
  ], 'getState exposes exact serial progress even while notifications are coalesced');
  assert.deepEqual(notifications, [
    { status: 'loading', completed: 0, total: 0, ids: [] },
    { status: 'loading', completed: 4, total: 4, ids: [...SYSTEM_WALLPAPER_IDS] },
    { status: 'ready', completed: 4, total: 4, ids: [...SYSTEM_WALLPAPER_IDS] },
  ], 'the editor sees initial busy, one durable thumbnail update, then ready—not four intermediate rerenders');
  await controller.destroy();
});

test('a failed item preserves successful Gallery entries and a retry skips already cached IDs', async () => {
  const fake = durableAdapter({ failOnce: SYSTEM_WALLPAPER_IDS[1] });
  const controller = createSystemWallpaperController(fake.adapter);
  await assert.rejects(controller.acquireAll(), /acquisition failed/);
  assert.deepEqual(controller.getState().acquisition, { status: 'error', completed: 3, total: 4 });
  assert.deepEqual(controller.getState().entries.map(entry => entry.id), [SYSTEM_WALLPAPER_IDS[0], SYSTEM_WALLPAPER_IDS[2], SYSTEM_WALLPAPER_IDS[3]],
    'only durable Gallery assets are published; failed media has no placeholder tile');
  assert.ok(controller.getState().entries.every(entry => entry.thumbnail === thumb));

  await controller.acquireAll();
  assert.deepEqual(fake.calls.filter(call => call.startsWith('load:')), [
    `load:${SYSTEM_WALLPAPER_IDS[0]}`,
    `load:${SYSTEM_WALLPAPER_IDS[1]}`,
    `load:${SYSTEM_WALLPAPER_IDS[2]}`,
    `load:${SYSTEM_WALLPAPER_IDS[3]}`,
    `load:${SYSTEM_WALLPAPER_IDS[1]}`,
  ]);
  assert.deepEqual(controller.getState().acquisition, { status: 'ready', completed: 4, total: 4 });
  await controller.destroy();
});

test('remote cancellation ends the entire batch even before the local owner signal is revoked', async () => {
  for (const cancelAt of [0, 1]) {
    let signalAtCancellation: AbortSignal | undefined;
    const fake = durableAdapter({ beforeLoad: (id, signal) => {
      if (id !== SYSTEM_WALLPAPER_IDS[cancelAt]) return;
      signalAtCancellation = signal;
      throw new SystemWallpaperClientError('cancelled');
    } });
    const controller = createSystemWallpaperController(fake.adapter);
    try {
      await assert.rejects(controller.acquireAll(), error => error instanceof SystemWallpaperClientError && error.code === 'cancelled');
      assert.equal(signalAtCancellation?.aborted, false, 'Host 撤权的终态可先于 Client 配置订阅撤销本地 signal');
      assert.deepEqual(fake.calls.filter(call => call.startsWith('load:')),
        SYSTEM_WALLPAPER_IDS.slice(0, cancelAt + 1).map(id => `load:${id}`), '取消不得继续请求后续素材');
      assert.deepEqual(controller.getState().entries.map(entry => entry.id), SYSTEM_WALLPAPER_IDS.slice(0, cancelAt),
        '取消保留本批已成功持久保存的素材');
      assert.deepEqual(controller.getState().acquisition, { status: 'idle', completed: cancelAt, total: 4 },
        '普通取消既不冒称四项完成，也不显示单项下载错误');
    } finally { await controller.destroy(); }
  }
});

test('an adapter AbortError stops the batch without surfacing a download error notice', async () => {
  const fake = durableAdapter({ beforeLoad: () => { throw new DOMException('private adapter message', 'AbortError'); } });
  const controller = createSystemWallpaperController(fake.adapter);
  let notices = 0;
  const actions = createSystemWallpaperEditorActions(controller, {
    apply: () => assert.fail('获取与取消不得改变背景'),
    isAlive: () => true,
    onError: () => { notices++; },
    onLoadError: () => { notices++; },
    resolve: async () => assert.fail('取消不得启动背景解码'),
  });
  try {
    await actions.acquireAll();
    assert.deepEqual(fake.calls.filter(call => call.startsWith('load:')), [`load:${SYSTEM_WALLPAPER_IDS[0]}`]);
    assert.deepEqual(controller.getState().acquisition, { status: 'idle', completed: 0, total: 4 });
    assert.equal(notices, 0, '普通取消不变成错误提示');
  } finally { await controller.destroy(); }
});

test('duplicate batch requests share the same in-flight work', async () => {
  let release!: () => void;
  let loadStarted!: () => void;
  const started = new Promise<void>(resolve => { loadStarted = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const fake = durableAdapter({ beforeLoad: async (_id, signal) => {
    loadStarted();
    await Promise.race([gate, new Promise<void>(resolve => signal?.addEventListener('abort', () => resolve(), { once: true }))]);
  } });
  const controller = createSystemWallpaperController(fake.adapter);
  const first = controller.acquireAll();
  const second = controller.acquireAll();
  assert.equal(second, first);
  await started;
  release();
  await first;
  assert.equal(fake.calls.filter(call => call === 'list').length, 1);
  assert.equal(fake.calls.filter(call => call.startsWith('load:')).length, 4);
  await controller.destroy();
});

test('destroy aborts acquisition but settles only after the active load settles and never starts a later ID', async () => {
  let activeSignal: AbortSignal | undefined;
  let releaseLoad!: () => void;
  let started!: () => void;
  const loadStarted = new Promise<void>(resolve => { started = resolve; });
  const gate = new Promise<void>(resolve => { releaseLoad = resolve; });
  const fake = durableAdapter({ beforeLoad: async (_id, signal) => {
    activeSignal = signal;
    started();
    await gate;
  } });
  const published: unknown[] = [];
  const controller = createSystemWallpaperController(fake.adapter, state => published.push(state));
  const batch = controller.acquireAll();
  await loadStarted;
  const countAtDestroy = published.length;
  const settling = controller.destroy();
  const repeatedDestroy = controller.destroy();
  assert.equal(repeatedDestroy, settling, 'repeat disposal joins the same settlement');
  assert.equal(activeSignal?.aborted, true);
  let settled = false;
  void settling.then(() => { settled = true; });
  await tick();
  assert.equal(settled, false, 'abort request is not confused with completion of the active adapter call');

  releaseLoad();
  await Promise.all([batch, settling]);
  assert.equal(fake.calls.filter(call => call.startsWith('load:')).length, 1);
  assert.equal(published.length, countAtDestroy, 'a disposed batch publishes no late progress');
  assert.deepEqual(controller.getState().entries, []);
});

test('adapter without durable restore fails closed without listing or loading media', async () => {
  const calls: string[] = [];
  const adapter: SystemWallpaperAdapter = {
    async list() { calls.push('list'); return catalog(); },
    async load(id) { calls.push(`load:${id}`); return largeJpegDataUrl; },
  };
  const controller = createSystemWallpaperController(adapter);
  await assert.rejects(controller.acquireAll(), error => error instanceof SystemWallpaperAcquisitionError && error.code === 'durable-restore-required');
  assert.deepEqual(calls, []);
  assert.deepEqual(controller.getState().acquisition, { status: 'error', completed: 0, total: 0 });
  await controller.destroy();
});

test('活动目录只有两项可获取素材时按当前目录完成，不为缺失素材报未完成', async () => {
  const skippedIds = new Set([SYSTEM_WALLPAPER_IDS[1], SYSTEM_WALLPAPER_IDS[3]]);
  const calls: string[] = [];
  const cache = new Map<string, SystemWallpaperEntry>();
  const adapter: SystemWallpaperAdapter = {
    async restore() { calls.push('restore'); return [...cache.values()]; },
    async list() {
      calls.push('list');
      return catalog().filter(entry => entry.id !== SYSTEM_WALLPAPER_IDS[1]).map(entry => entry.id === SYSTEM_WALLPAPER_IDS[3]
        ? { ...entry, available: false, downloadable: false }
        : entry);
    },
    async load(id) {
      calls.push(`load:${id}`);
      cache.set(id, cachedEntry(id));
      return largeJpegDataUrl;
    },
  };
  const controller = createSystemWallpaperController(adapter);
  await controller.acquireAll();
  assert.deepEqual(calls, [
    'restore', 'list',
    `load:${SYSTEM_WALLPAPER_IDS[0]}`, 'restore',
    `load:${SYSTEM_WALLPAPER_IDS[2]}`, 'restore', 'restore',
  ], 'the missing and explicitly unavailable IDs never reach the media adapter');
  assert.deepEqual(controller.getState().acquisition, { status: 'ready', completed: 2, total: 2 });
  assert.deepEqual(controller.getState().entries.map(entry => entry.id), [SYSTEM_WALLPAPER_IDS[0], SYSTEM_WALLPAPER_IDS[2]]);
  assert.ok(controller.getState().entries.every(entry => entry.thumbnail === thumb));
  await controller.destroy();
});

test('显式获取会串行读取当前目录中仅可下载的素材', async () => {
  const fake = durableAdapter();
  fake.adapter.list = async () => catalog().map((entry, index) => ({
    ...entry, available: index === 0 || index === 2, downloadable: index === 1 || index === 3,
  }));
  const controller = createSystemWallpaperController(fake.adapter);
  try {
    await controller.acquireAll();
    assert.deepEqual(fake.calls.filter(call => call.startsWith('load:')),
      [`load:${SYSTEM_WALLPAPER_IDS[0]}`, `load:${SYSTEM_WALLPAPER_IDS[1]}`, `load:${SYSTEM_WALLPAPER_IDS[2]}`, `load:${SYSTEM_WALLPAPER_IDS[3]}`]);
    assert.deepEqual(controller.getState().acquisition, { status: 'ready', completed: 4, total: 4 });
    assert.ok(controller.getState().entries.every(entry => entry.available === true && entry.downloadable === false),
      'persisted downloadable rows become local Gallery entries before selection');
  } finally { await controller.destroy(); }
});

test('当前目录为空时是零目标成功；旧目录缓存保留但不算新目录进度', async () => {
  for (const keepCached of [false, true]) {
    const fake = durableAdapter();
    if (keepCached) fake.cache.set(SYSTEM_WALLPAPER_IDS[0], cachedEntry(SYSTEM_WALLPAPER_IDS[0]));
    fake.adapter.list = async () => [];
    const controller = createSystemWallpaperController(fake.adapter);
    try {
      await controller.acquireAll();
      assert.equal(fake.calls.some(call => call.startsWith('load:')), false);
      assert.deepEqual(controller.getState().acquisition,
        { status: 'ready', completed: 0, total: 0 });
      assert.equal(controller.getState().entries.length, 0, 'a known empty roster has no active tiles');
      assert.equal(fake.cache.has(SYSTEM_WALLPAPER_IDS[0]), keepCached,
        'filtering the active roster never removes an older persisted image');
    } finally { await controller.destroy(); }
  }
});

test('future catalog replaces acquisition targets without deleting legacy cache or publishing each saved thumbnail', async () => {
  assert.equal(isSystemWallpaperId(futureVideoId), true);
  assert.equal(isSystemWallpaperId(futureStillId), true);
  const cache = new Map<string, SystemWallpaperEntry>(SYSTEM_WALLPAPER_IDS.map(id => [id, cachedEntry(id)]));
  const legacyIds = [...cache.keys()];
  const calls: string[] = [];
  let controller!: ReturnType<typeof createSystemWallpaperController>;
  let entriesBeforeFirstLoad: readonly SystemWallpaperEntry[] | undefined;
  const adapter: SystemWallpaperAdapter = {
    async restore() {
      calls.push('restore');
      return [...cache.values()];
    },
    async list() {
      calls.push('list');
      return [
        { id: futureVideoId, name: 'Next macOS Video', available: false, downloadable: true, sourceType: 'video' },
        { id: futureStillId, name: 'Next macOS Still', available: true, downloadable: false, sourceType: 'image' },
      ];
    },
    async load(id) {
      calls.push(`load:${id}`);
      if (!entriesBeforeFirstLoad) entriesBeforeFirstLoad = controller.getState().entries;
      else assert.strictEqual(controller.getState().entries, entriesBeforeFirstLoad,
        'intermediate saves do not publish/re-render the thumbnail list');
      assert.deepEqual(controller.getState().entries.map(entry => entry.id), legacyIds,
        'old cached items remain visible while the new roster is acquired');
      cache.set(id, { ...cachedEntry(id), name: 'System images',
        sourceType: id === futureVideoId ? 'video' : 'image' });
      return largeJpegDataUrl;
    },
  };
  controller = createSystemWallpaperController(adapter);
  try {
    await controller.acquireAll();
    assert.deepEqual(calls, ['restore', 'list', `load:${futureVideoId}`, 'restore', `load:${futureStillId}`, 'restore', 'restore']);
    assert.deepEqual(controller.getState().acquisition, { status: 'ready', completed: 2, total: 2 },
      'progress measures only the current catalog, not the four retained legacy items');
    assert.deepEqual(controller.getState().entries.map(entry => entry.id), [futureVideoId, futureStillId],
      'only persisted items in the refreshed active roster remain visible');
    assert.deepEqual(controller.getState().entries.map(entry => entry.name), ['Next macOS Video', 'Next macOS Still'],
      'a fresh Host roster restores current semantic names over generic local-cache labels');
    assert.deepEqual([...cache.keys()].filter(id => legacyIds.includes(id)), legacyIds,
      'filtering visible entries does not delete old persisted assets');
    assert.ok(controller.getState().entries.every(entry => entry.thumbnail === thumb), 'final publication contains persisted thumbnails only');
    assert.equal(JSON.stringify(controller.getState()).includes(largeJpegDataUrl), false);
  } finally { await controller.destroy(); }
});

test('fatal durable Gallery errors retain their fixed code and stop all later wallpaper loads', async () => {
  for (const code of ['gallery-full', 'storage-unavailable', 'disposed'] as const) {
    const calls: string[] = [];
    const adapter: SystemWallpaperAdapter = {
      async restore() { calls.push('restore'); return []; },
      async list() { calls.push('list'); return catalog(); },
      async load(id) { calls.push(`load:${id}`); throw new WallpaperGalleryError(code); },
    };
    const controller = createSystemWallpaperController(adapter);
    await assert.rejects(controller.acquireAll(), error => error instanceof WallpaperGalleryError && error.code === code);
    assert.deepEqual(calls, ['restore', 'list', `load:${SYSTEM_WALLPAPER_IDS[0]}`, 'restore'], `${code} stops the batch after the first failed write and refreshes persisted thumbnails`);
    assert.deepEqual(controller.getState().acquisition, { status: 'error', completed: 0, total: 4 });
    await controller.destroy();
  }
});

test('typed Gallery capacity failure reaches the existing mapped load notice exactly once', async () => {
  let errors = 0;
  const codes: string[] = [];
  const controller = createSystemWallpaperController({
    async restore() { return []; },
    async list() { return catalog(); },
    async load() { throw new WallpaperGalleryError('gallery-full'); },
  });
  const actions = createSystemWallpaperEditorActions(controller, {
    apply() {},
    isAlive: () => true,
    onError: () => { errors++; },
    onLoadError: error => { codes.push((error as WallpaperGalleryError).code); },
    resolve: async () => null,
  });
  await actions.acquireAll();
  assert.deepEqual(codes, ['gallery-full']);
  assert.equal(errors, 0, 'typed acquisition failures use the existing load-error copy mapping');
  await controller.destroy();
});

test('editor acquisition wrapper reports one error for coalesced requests and keeps cancellation silent', async () => {
  let errors = 0;
  const failedAdapter: SystemWallpaperAdapter = {
    async restore() { return []; },
    async list() { throw new Error('private catalog failure'); },
    async load() { throw new Error('must not load after catalog failure'); },
  };
  const failedController = createSystemWallpaperController(failedAdapter);
  const actions = createSystemWallpaperEditorActions(failedController, {
    apply() {},
    isAlive: () => true,
    onError: () => { errors++; },
    resolve: async () => ({} as HTMLImageElement),
  });
  const first = actions.acquireAll();
  const duplicate = actions.acquireAll();
  assert.equal(first, duplicate);
  await first;
  assert.equal(errors, 1);
  assert.equal(failedController.getState().acquisition?.status, 'error');
  await failedController.destroy();

  let releaseLoad!: () => void;
  let started!: () => void;
  const loadStarted = new Promise<void>(resolve => { started = resolve; });
  const gate = new Promise<void>(resolve => { releaseLoad = resolve; });
  const pending = durableAdapter({ beforeLoad: async () => { started(); await gate; } });
  const controller = createSystemWallpaperController(pending.adapter);
  const cancelable = createSystemWallpaperEditorActions(controller, {
    apply() {}, isAlive: () => true, onError: () => { errors++; }, resolve: async () => null,
  });
  const operation = cancelable.acquireAll();
  await loadStarted;
  const shutdown = controller.destroy();
  releaseLoad();
  await Promise.all([operation, shutdown]);
  assert.equal(errors, 1, 'normal cancellation on close never becomes an error notice');
});

test('system acquisition button invokes the batch once and no longer wires per-item or retry catalog actions', async () => {
  let clicks = 0;
  const selectors: string[] = [];
  let clickHandler: (() => void) | undefined;
  const button = { addEventListener(type: string, listener: () => void) { if (type === 'click') clickHandler = listener; } };
  const root = {
    querySelectorAll() { return []; },
    querySelector(selector: string) { selectors.push(selector); return selector === "[data-action='acquire-system-wallpapers']" ? button : null; },
  } as unknown as HTMLElement;
  wireSystemWallpaperActions(root, {
    acquireAll: async () => { clicks++; },
    loadCatalog: async () => {},
    loadCurrent: async () => {},
    restoreCurrent: async () => {},
    select: async () => {},
  });
  assert.deepEqual(selectors, ["[data-action='acquire-system-wallpapers']"]);
  assert.ok(clickHandler);
  clickHandler();
  await tick();
  assert.equal(clicks, 1);
});

test('Gallery restore reads only local system metadata and thumbnails without listing or loading remote media', async () => {
  const systemId = SYSTEM_WALLPAPER_IDS[0];
  const asset = {
    id: systemId,
    blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
    width: 1,
    height: 1,
    sourceType: 'video' as const,
    thumbnail: thumb,
    createdAt: 1,
  };
  let lists = 0;
  let loads = 0;
  const gallery = createWallpaperGallery({
    store: {
      close() {},
      async get() { throw new Error('restore uses one metadata list'); },
      async list() { return [asset]; },
      async put() {},
      async remove() {},
    },
    systemAdapter: {
      async list() { lists++; return catalog(); },
      async load() { loads++; return largeJpegDataUrl; },
    },
  });
  try {
    const entries = await gallery.systemAdapter!.restore!();
    assert.deepEqual(entries, [{
      id: systemId,
      name: captureWindowCopy('en').systemWallpaperNames[systemId],
      available: true,
      downloadable: false,
      sourceType: 'video',
      thumbnail: thumb,
      loadStatus: 'ready',
    }]);
    assert.equal(lists, 0, 'metadata restore is local, not a Remote catalog request');
    assert.equal(loads, 0, 'metadata restore does not decode/download wallpaper media');
  } finally { gallery.close(); }
});
