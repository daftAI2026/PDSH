/**
 * [INPUT]: 依赖 Client 系统壁纸 Remote adapter、封闭共享 DTO 与系统壁纸选择控制器。
 * [OUTPUT]: 验证动态ID活动目录顺序/资格、显式媒体加载、固定Host失败码保真且未知码不泄露、JPEG预算/终态/解码取消、销毁settlement，以及单批入口取代未缓存占位。
 * [POS]: 系统壁纸 Client 专项合同；不连接网络、不触及本机桌面素材或真实 DSH。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSystemWallpaperRemoteAdapter, SystemWallpaperClientError } from '../src/client/capture/system-wallpaper-remote.ts';
import { SYSTEM_WALLPAPER_IDS, WALLPAPER_LIMITS, WALLPAPER_STATUSES } from '../src/shared/system-wallpaper-protocol.ts';
import { createSystemWallpaperController } from '../src/client/capture/system-wallpapers.ts';
import { captureWindowCopy } from '../src/client/capture/copy.ts';
import { captureWindowTemplate } from '../src/client/capture/view.ts';
import { createCaptureWindowState } from '../src/client/capture/model.ts';

const futureVideoId = 'system-wallpaper-video-123e4567-e89b-12d3-a456-426614174000';
const futureStillId = `system-wallpaper-image-${'a'.repeat(64)}`;

function handleOf(frames, { failAfterFrames = false } = {}) {
  let disposed = 0;
  const handle = {
    async dispose() { disposed++; },
    send() {},
    end() {},
    async *[Symbol.asyncIterator]() {
      for (const frame of frames) yield frame;
      if (failAfterFrames) throw new Error('private transport detail');
    },
  };
  return { handle, get disposed() { return disposed; } };
}

function catalogFrames(entries) {
  return [
    { type: 'catalog', entries },
    { type: 'terminal', status: 'listed' },
  ];
}

function jpegFrames(id, bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), metadata = {}) {
  const chunkCount = Math.ceil(bytes.length / WALLPAPER_LIMITS.chunkBytes);
  const frames = [
    { type: 'phase', phase: 'decoding' },
    { type: 'image', id, sourceType: id.endsWith('sunset') || id.endsWith('tahoe-day') ? 'video' : 'image', width: 640, height: 480, jpegBytes: bytes.length, chunkCount, ...metadata },
  ];
  for (let index = 0; index < chunkCount; index++) {
    frames.push({ type: 'chunk', index, base64: Buffer.from(bytes.subarray(index * WALLPAPER_LIMITS.chunkBytes, (index + 1) * WALLPAPER_LIMITS.chunkBytes)).toString('base64') });
  }
  frames.push({ type: 'terminal', status: 'loaded' });
  return frames;
}

function catalogEntry(id, overrides = {}) {
  return { id, name: '../../untrusted host label', available: true, downloadable: false, ...overrides };
}

test('目录拒绝保留每个Host白名单失败码，未知终态只能成为协议错误', async () => {
  for (const status of WALLPAPER_STATUSES.filter(code => code !== 'listed' && code !== 'loaded')) {
    const failed = handleOf([{ type: 'terminal', status }]);
    const adapter = createSystemWallpaperRemoteAdapter({ wallpaper: () => failed.handle });
    await assert.rejects(adapter.list(), error => error instanceof SystemWallpaperClientError && error.code === status);
    assert.equal(failed.disposed, 1);
  }
  const unknown = handleOf([{ type: 'terminal', status: 'private-file-path-credentials' }]);
  const adapter = createSystemWallpaperRemoteAdapter({ wallpaper: () => unknown.handle });
  await assert.rejects(adapter.list(), { code: 'protocol-invalid', message: 'protocol-invalid' });
});

test('listing accepts available or downloadable IDs in Host order, keeps legacy copy, bounds semantic names, and never loads pixels', async () => {
  const list = handleOf(catalogFrames([
    catalogEntry(futureStillId, { name: 'Next macOS Static', available: true, downloadable: false }),
    catalogEntry(SYSTEM_WALLPAPER_IDS[0], { name: 'Host must not rename Golden Gate' }),
    catalogEntry(futureVideoId, { name: 'Next macOS Video', available: false, downloadable: true }),
    catalogEntry(SYSTEM_WALLPAPER_IDS[2], { available: false, downloadable: false }),
  ]));
  let loads = 0;
  const adapter = createSystemWallpaperRemoteAdapter({
    wallpaper(request) {
      assert.deepEqual(request, { kind: 'list' });
      return list.handle;
    },
  }, { locale: () => 'en' });

  const entries = await adapter.list();
  assert.equal(loads, 0);
  assert.equal(list.disposed, 1);
  assert.deepEqual(entries.map(({ id, name, available, downloadable }) => ({ id, name, available, downloadable })), [
    { id: futureStillId, name: 'Next macOS Static', available: true, downloadable: false },
    { id: SYSTEM_WALLPAPER_IDS[0], name: 'macOS 27 · Golden Gate', available: true, downloadable: false },
    { id: futureVideoId, name: 'Next macOS Video', available: false, downloadable: true },
  ]);
  assert.deepEqual(entries.map(entry => entry.id), [futureStillId, SYSTEM_WALLPAPER_IDS[0], futureVideoId],
    'the Client preserves the current Host catalog order rather than imposing a historical order');
});

test('downloadable-only rows become loadable only after the current explicit catalog response', async () => {
  let mediaRequests = 0;
  const listed = handleOf(catalogFrames([catalogEntry(futureVideoId, { available: false, downloadable: true })]));
  const loaded = handleOf(jpegFrames(futureVideoId, undefined, { sourceType: 'video' }));
  let listRequests = 0;
  const adapter = createSystemWallpaperRemoteAdapter({ wallpaper(request) {
    if (request.kind === 'load') { mediaRequests++; return loaded.handle; }
    listRequests++;
    return listed.handle;
  } }, { decode: async (_url, expected) => expected });
  assert.deepEqual((await adapter.list()).map(entry => entry.id), [futureVideoId]);
  const image = await adapter.load(futureVideoId, new AbortController().signal);
  assert.match(image, /^data:image\/jpeg;base64,/);
  assert.equal(mediaRequests, 1);
  assert.equal(listRequests, 1);
});

test('only an explicitly selected catalog ID opens one bounded JPEG stream and local image decode', async () => {
  const list = handleOf(catalogFrames([catalogEntry(SYSTEM_WALLPAPER_IDS[0])]));
  const loaded = handleOf(jpegFrames(SYSTEM_WALLPAPER_IDS[0]));
  const calls = [];
  let decoded = 0;
  let revoked = 0;
  const adapter = createSystemWallpaperRemoteAdapter({
    wallpaper(request, signal) {
      calls.push({ request, signal });
      return request.kind === 'list' ? list.handle : loaded.handle;
    },
  }, {
    locale: () => 'zh-CN',
    createObjectURL(blob) { assert.equal(blob.type, 'image/jpeg'); return 'blob:wallpaper'; },
    revokeObjectURL(url) { assert.equal(url, 'blob:wallpaper'); revoked++; },
    decode: async (url, expected, signal) => {
      decoded++;
      assert.equal(url, 'blob:wallpaper');
      assert.deepEqual(expected, { width: 640, height: 480 });
      assert.ok(signal instanceof AbortSignal);
      return { width: 640, height: 480 };
    },
  });

  await adapter.list();
  assert.equal(calls.length, 1, 'catalog must not load any JPEG');
  const dataUrl = await adapter.load(SYSTEM_WALLPAPER_IDS[0], new AbortController().signal);
  assert.deepEqual(calls.map(call => call.request), [
    { kind: 'list' },
    { kind: 'load', id: SYSTEM_WALLPAPER_IDS[0] },
  ]);
  assert.match(dataUrl, /^data:image\/jpeg;base64,/);
  assert.equal(decoded, 1, 'metadata alone is not image acceptance');
  assert.equal(adapter.getSourceType(SYSTEM_WALLPAPER_IDS[0]), 'image');
  assert.equal(revoked, 1, 'temporary Blob URL is released after decode');
  assert.equal(loaded.disposed, 1, 'stream is disposed after natural completion');
});

test('unknown, duplicate, malformed, or merely host-named catalog entries fail closed', async () => {
  for (const entries of [
    [catalogEntry('system-wallpaper-arbitrary-file')],
    [catalogEntry(SYSTEM_WALLPAPER_IDS[0]), catalogEntry(SYSTEM_WALLPAPER_IDS[0])],
    [{ ...catalogEntry(SYSTEM_WALLPAPER_IDS[0]), downloadable: 'yes' }],
    [catalogEntry(futureStillId, { name: 'x'.repeat(97) })],
    [catalogEntry(futureStillId, { name: 'bad\nname' })],
    [catalogEntry(futureStillId, { name: 'bad\u0085name' })],
    Array.from({ length: WALLPAPER_LIMITS.maxCatalogEntries + 1 }, (_, index) =>
      catalogEntry(`system-wallpaper-image-${String(index).padStart(64, '0')}`)),
  ]) {
    const source = handleOf(catalogFrames(entries));
    const adapter = createSystemWallpaperRemoteAdapter({ wallpaper: () => source.handle });
    await assert.rejects(adapter.list(), error => error instanceof SystemWallpaperClientError && error.code === 'protocol-invalid');
    assert.equal(source.disposed, 1);
  }
});

test('load requires a previously listed, available or downloadable closed ID', async () => {
  let opens = 0;
  const adapter = createSystemWallpaperRemoteAdapter({ wallpaper: () => { opens++; throw new Error('must-not-open'); } });
  await assert.rejects(adapter.load(SYSTEM_WALLPAPER_IDS[0]), error => error.code === 'unavailable');
  await assert.rejects(adapter.load(futureStillId), error => error.code === 'unavailable');
  await assert.rejects(adapter.load('system-wallpaper-other'), error => error.code === 'protocol-invalid');
  assert.equal(opens, 0);
});

test('a refreshed catalog is the complete authorization set; stale IDs cannot issue later load requests', async () => {
  const oldList = handleOf(catalogFrames([catalogEntry(futureVideoId)]));
  const newList = handleOf(catalogFrames([catalogEntry(futureStillId)]));
  let lists = 0;
  let mediaRequests = 0;
  const adapter = createSystemWallpaperRemoteAdapter({ wallpaper(request) {
    if (request.kind === 'load') { mediaRequests++; throw new Error('must not request stale material'); }
    return (++lists === 1 ? oldList : newList).handle;
  } });
  await adapter.list();
  await adapter.list();
  await assert.rejects(adapter.load(futureVideoId), error => error.code === 'unavailable');
  assert.equal(mediaRequests, 0, 'an ID omitted by the latest roster is no longer remotely authorized');
  assert.equal(oldList.disposed, 1);
  assert.equal(newList.disposed, 1);
});

test('an unavailable non-downloadable catalog row cannot trigger a remote load', async () => {
  const list = handleOf(catalogFrames([catalogEntry(SYSTEM_WALLPAPER_IDS[0], { available: false, downloadable: false })]));
  let opens = 0;
  const adapter = createSystemWallpaperRemoteAdapter({ wallpaper: request => {
    opens++;
    assert.deepEqual(request, { kind: 'list' });
    return list.handle;
  } });
  assert.deepEqual(await adapter.list(), []);
  await assert.rejects(adapter.load(SYSTEM_WALLPAPER_IDS[0]), error => error.code === 'unavailable');
  assert.equal(opens, 1);
});

test('catalog and load terminal require natural stream end; carrier errors stay sanitized', async () => {
  for (const [frames, options] of [
    [catalogFrames([catalogEntry(SYSTEM_WALLPAPER_IDS[0])]), { failAfterFrames: true }],
    [[{ type: 'catalog', entries: [catalogEntry(SYSTEM_WALLPAPER_IDS[0])] }], {}],
  ]) {
    const source = handleOf(frames, options);
    const adapter = createSystemWallpaperRemoteAdapter({ wallpaper: () => source.handle });
    await assert.rejects(adapter.list(), error => {
      assert.equal(error.code, options.failAfterFrames ? 'stream-failed' : 'protocol-invalid');
      assert.doesNotMatch(error.message, /private transport detail/);
      return true;
    });
    assert.equal(source.disposed, 1);
  }

  const listed = handleOf(catalogFrames([catalogEntry(SYSTEM_WALLPAPER_IDS[0])]));
  const brokenLoad = handleOf(jpegFrames(SYSTEM_WALLPAPER_IDS[0]), { failAfterFrames: true });
  let calls = 0;
  const adapter = createSystemWallpaperRemoteAdapter({ wallpaper: () => (++calls === 1 ? listed.handle : brokenLoad.handle) });
  await adapter.list();
  await assert.rejects(adapter.load(SYSTEM_WALLPAPER_IDS[0]), error => error.code === 'stream-failed');
  assert.equal(brokenLoad.disposed, 1);
});

test('bad JPEG frame ordering, byte budgets, terminal status, or actual dimensions reject before selection', async () => {
  const valid = jpegFrames(SYSTEM_WALLPAPER_IDS[0]);
  const cases = [
    valid.map((frame, index) => index === 2 ? { ...frame, index: 4 } : frame),
    jpegFrames(SYSTEM_WALLPAPER_IDS[0], new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { width: 2601 }),
    jpegFrames(SYSTEM_WALLPAPER_IDS[0], new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { id: SYSTEM_WALLPAPER_IDS[1] }),
    jpegFrames(SYSTEM_WALLPAPER_IDS[0], new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { sourceType: 'unknown' }),
    jpegFrames(SYSTEM_WALLPAPER_IDS[0], new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), { jpegBytes: WALLPAPER_LIMITS.maxBytes + 1 }),
    [...valid.slice(0, -1), { type: 'terminal', status: 'download-failed' }],
  ];
  for (const frames of cases) {
    const list = handleOf(catalogFrames([catalogEntry(SYSTEM_WALLPAPER_IDS[0])]));
    const load = handleOf(frames);
    let calls = 0;
    let urls = 0;
    const adapter = createSystemWallpaperRemoteAdapter({ wallpaper: () => (++calls === 1 ? list.handle : load.handle) }, {
      createObjectURL() { urls++; return 'blob:must-not-escape'; },
      decode: async () => ({ width: 640, height: 480 }),
      revokeObjectURL() {},
    });
    await adapter.list();
    await assert.rejects(adapter.load(SYSTEM_WALLPAPER_IDS[0]));
    assert.equal(urls, 0, 'invalid streams never reach browser decode');
  }
});

test('abort during image decode releases the temporary URL and cannot accept a late result', async () => {
  const list = handleOf(catalogFrames([catalogEntry(SYSTEM_WALLPAPER_IDS[0])]));
  const load = handleOf(jpegFrames(SYSTEM_WALLPAPER_IDS[0]));
  const controller = new AbortController();
  let finishDecode;
  let started;
  const decodeStarted = new Promise(resolve => { started = resolve; });
  const pendingDecode = new Promise(resolve => { finishDecode = resolve; });
  let revoked = 0;
  const adapter = createSystemWallpaperRemoteAdapter({ wallpaper: request => request.kind === 'list' ? list.handle : load.handle }, {
    createObjectURL: () => 'blob:pending',
    revokeObjectURL: () => { revoked++; },
    decode: () => { started(); return pendingDecode; },
  });
  await adapter.list();
  let accepted = false;
  const operation = adapter.load(SYSTEM_WALLPAPER_IDS[0], controller.signal).then(() => { accepted = true; }, error => error);
  try {
    await decodeStarted;
    controller.abort();
    const outcome = await operation;
    assert.equal(outcome.code, 'cancelled');
    assert.equal(accepted, false);
    assert.equal(revoked, 1);
    assert.equal(load.disposed, 1);
    finishDecode({ width: 640, height: 480 });
    await Promise.resolve();
    assert.equal(accepted, false);
  } finally {
    finishDecode({ width: 640, height: 480 });
    await operation;
  }
});

test('selection change and disposal abort the owned Remote load and reject late data', async () => {
  const entries = SYSTEM_WALLPAPER_IDS.slice(0, 2).map(id => ({ ...catalogEntry(id), thumbnail: '' }));
  let firstSignal;
  let resolveFirst;
  const firstLoad = new Promise(resolve => { resolveFirst = resolve; });
  const adapter = {
    async list() { return entries; },
    load(id, signal) {
      if (id === entries[0].id) { firstSignal = signal; return firstLoad; }
      return Promise.resolve('data:image/jpeg;base64,AA==');
    },
  };
  const wallpaper = createSystemWallpaperController(adapter);
  await wallpaper.ensureLoaded();
  const stale = wallpaper.select(entries[0].id);
  const current = await wallpaper.select(entries[1].id);
  assert.equal(firstSignal.aborted, true, 'new selection cancels its predecessor');
  assert.equal(current.id, entries[1].id);
  resolveFirst('data:image/jpeg;base64,AA==');
  assert.equal(await stale, null, 'late bytes cannot replace the active choice');
  const disposal = wallpaper.select(entries[0].id);
  wallpaper.destroy();
  assert.equal(await disposal, null);
});

test('destroy waits for an owned in-flight selection load to settle after abort', async () => {
  const entry = { id: SYSTEM_WALLPAPER_IDS[0], name: 'Golden Gate', available: true, downloadable: true };
  let loadSignal;
  let markLoadStarted;
  let resolveLoad;
  const loadStarted = new Promise(resolve => { markLoadStarted = resolve; });
  const pendingLoad = new Promise(resolve => { resolveLoad = resolve; });
  const wallpaper = createSystemWallpaperController({
    async list() { return [entry]; },
    load(_id, signal) {
      loadSignal = signal;
      markLoadStarted();
      // +--- 此桩故意等显式结算；验证控制器持有的 Promise，不声称能同步终止浏览器解码。 ---+
      return pendingLoad;
    },
  });
  await wallpaper.ensureLoaded();

  let selectionSettled = false;
  let destroySettled = false;
  const selection = wallpaper.select(entry.id).then(value => {
    selectionSettled = true;
    return value;
  });
  await loadStarted;
  const destruction = wallpaper.destroy().then(() => { destroySettled = true; });

  try {
    assert.equal(loadSignal.aborted, true, 'destroy aborts the active selection synchronously');
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(selectionSettled, false, 'adapter load remains in flight until its owner settles');
    assert.equal(destroySettled, false, 'destroy must not finish before the owned load settles');
  } finally {
    resolveLoad('data:image/jpeg;base64,AA==');
  }

  assert.equal(await selection, null, 'settled late data cannot become a selection after destroy');
  await destruction;
  assert.equal(destroySettled, true);
});

test('leaving the wallpaper panel cancels its load and restores a retryable idle tile', async () => {
  let loadSignal;
  let resolveLoad;
  const pendingLoad = new Promise(resolve => { resolveLoad = resolve; });
  const entry = { id: SYSTEM_WALLPAPER_IDS[0], name: 'Golden Gate', available: true, downloadable: true };
  const controller = createSystemWallpaperController({
    async list() { return [entry]; },
    load(_id, signal) { loadSignal = signal; return pendingLoad; },
  });
  await controller.ensureLoaded();
  const pending = controller.select(entry.id);
  assert.equal(controller.getState().entries[0].loadStatus, 'loading');
  controller.invalidateSelection();
  assert.equal(loadSignal.aborted, true);
  assert.equal(controller.getState().entries[0].loadStatus, 'idle');
  resolveLoad('data:image/jpeg;base64,/9j/2Q==');
  assert.equal(await pending, null);
  controller.destroy();
});

test('the catalog stays behind one explicit batch action; absent provider exposes no fake action', () => {
  const state = createCaptureWindowState({ height: 600, width: 800, scaleFactor: 1 });
  const entry = {
    id: SYSTEM_WALLPAPER_IDS[0], name: captureWindowCopy('en').systemWallpaperNames[SYSTEM_WALLPAPER_IDS[0]],
    available: false, downloadable: true, loadStatus: 'idle', thumbnail: '',
  };
  const markup = captureWindowTemplate(state, captureWindowCopy('en'), {
    systemWallpapers: { status: 'ready', entries: [entry] },
  });
  assert.doesNotMatch(markup, /data-system-wallpaper=/);
  assert.match(markup, /data-action="acquire-system-wallpapers"/);

  const unsupported = captureWindowTemplate(state, captureWindowCopy('en'), {
    systemWallpapers: { status: 'unavailable', entries: [] },
  });
  assert.doesNotMatch(unsupported, /data-system-wallpaper=/);
  assert.doesNotMatch(unsupported, /data-action="acquire-system-wallpapers"/);
});
