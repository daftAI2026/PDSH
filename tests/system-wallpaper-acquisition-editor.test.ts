/**
 * [INPUT]: 依赖生产 CaptureWindowEditor、Gallery store port、jsdom、可控图像解码与 Canvas/ResizeObserver。
 * [OUTPUT]: 验证图库取消/重入、背景往返、选中ARIA/DOM和加号状态。
 * [POS]: Editor→Tabs→Gallery 生产交互合同。加号不是素材。不运行 Host 或 Desktop。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createCaptureWindowState, type CaptureWindowState } from '../src/client/capture/model.ts';
import type { CaptureBackgroundMode } from '../src/client/capture/background-modes.ts';
import { mountCaptureWindowEditor } from '../src/client/capture/editor.ts';
import { CAPTURE_PREFERENCES_KEY } from '../src/client/capture/preferences.ts';
import type { SystemWallpaperAdapter, SystemWallpaperEntry } from '../src/client/capture/system-wallpapers.ts';
import type { WallpaperGalleryStore } from '../src/client/capture/wallpaper-gallery.ts';
import { SYSTEM_WALLPAPER_IDS } from '../src/shared/system-wallpaper-protocol.ts';
import { syncCaptureBackgroundControls } from '../src/client/capture/background-controls.ts';

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

const turn = () => new Promise<void>(resolve => setImmediate(resolve));
async function until(condition: () => boolean, message: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (condition()) return;
    await turn();
  }
  assert.fail(message);
}

function installEditorDom() {
  const dom = new JSDOM('<html lang="zh"><title>壁纸批获取夹具</title><body><main></main></body></html>', {
    pretendToBeVisual: true,
    url: 'https://wallpaper-acquisition.invalid/',
  });
  class FixtureResizeObserver {
    constructor(_callback: ResizeObserverCallback) {}
    observe() {}
    disconnect() {}
  }
  const globals = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    HTMLCanvasElement: dom.window.HTMLCanvasElement,
    HTMLImageElement: dom.window.HTMLImageElement,
    ImageBitmap: class FixtureImageBitmap {},
    Image: dom.window.Image,
    ResizeObserver: FixtureResizeObserver,
  };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, value, writable: true });
  }

  const context = new Proxy({ canvas: null as HTMLCanvasElement | null }, {
    get(target, key) {
      if (key in target) return target[key as keyof typeof target];
      if (String(key).startsWith('create')) return () => ({ addColorStop() {} });
      return () => {};
    },
    set(target, key, value) {
      (target as Record<PropertyKey, unknown>)[key] = value;
      return true;
    },
  });
  dom.window.HTMLCanvasElement.prototype.getContext = function () {
    context.canvas = this;
    return context as unknown as CanvasRenderingContext2D;
  };

  return {
    dom,
    restoreGlobals() {
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete (globalThis as Record<string, unknown>)[key];
      }
    },
  };
}

function installGalleryImageDecoder(dom: JSDOM): () => void {
  const previousImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const previousCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const previousRevokeObjectURL = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  class FixtureImage extends EventTarget {
    naturalHeight = 1;
    naturalWidth = 1;
    private source = '';

    get src(): string { return this.source; }
    set src(value: string) {
      this.source = value;
      queueMicrotask(() => this.dispatchEvent(new Event('load')));
    }
    removeAttribute(name: string): void {
      if (name === 'src') this.source = '';
    }
  }
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: FixtureImage });
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:gallery-editor-fixture' });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
  return () => {
    if (previousImage) Object.defineProperty(globalThis, 'Image', previousImage);
    else delete (globalThis as Record<string, unknown>).Image;
    if (previousCreateObjectURL) Object.defineProperty(URL, 'createObjectURL', previousCreateObjectURL);
    else delete (URL as unknown as Record<string, unknown>).createObjectURL;
    if (previousRevokeObjectURL) Object.defineProperty(URL, 'revokeObjectURL', previousRevokeObjectURL);
    else delete (URL as unknown as Record<string, unknown>).revokeObjectURL;
  };
}

function assertGallerySelection(root: HTMLElement, selectedId: string | null): void {
  const userTiles = [...root.querySelectorAll<HTMLElement>('[data-gallery-user-image]')];
  const systemTiles = [...root.querySelectorAll<HTMLElement>('[data-gallery-wallpaper]')];
  assert.equal(userTiles.length, 1, 'fixture inventory exposes exactly one personal image');
  assert.equal(systemTiles.length, 1, 'fixture inventory exposes exactly one cached system image');
  const selectedTiles = [...userTiles, ...systemTiles].filter(tile => tile.dataset.selected === 'true');
  assert.equal(selectedTiles.length, selectedId ? 1 : 0, 'only the current Gallery background may paint a selection ring');
  for (const [tile, id] of [[userTiles[0], userTiles[0].dataset.galleryUserImage],
    [systemTiles[0], systemTiles[0].dataset.galleryWallpaper]] as const) {
    const selected = selectedId === id;
    assert.equal(tile.dataset.selected, String(selected), `tile ${id} data-selected follows the accepted background`);
    assert.equal(tile.getAttribute('aria-pressed'), String(selected), `tile ${id} aria-pressed follows the accepted background`);
  }
}

function assertBackgroundPanels(root: HTMLElement, activeMode: CaptureBackgroundMode, tabsId: string): void {
  const panels = [...root.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
  assert.equal(panels.length, 4, 'all mode panels remain mounted');
  for (const panel of panels) {
    const mode = panel.dataset.backgroundSection as CaptureBackgroundMode;
    const active = mode === activeMode;
    assert.equal(panel.id, `${tabsId}-${mode}-panel`);
    assert.equal(panel.getAttribute('aria-labelledby'), `${tabsId}-${mode}`);
    assert.equal(panel.hidden, !active);
    assert.equal(panel.hasAttribute('inert'), !active);
    assert.equal(panel.tabIndex, active && mode !== 'none' ? 0 : -1);
    assert.equal(panel.dataset.active, String(active));
  }
}

test('editor destroy aborts then joins explicit batch before closing Gallery, exactly once', { timeout: 5_000 }, async () => {
  const { dom, restoreGlobals } = installEditorDom();
  const started = deferred();
  const settleLoad = deferred();
  const storeClosed = deferred();
  const loadCalls: string[] = [];
  const notices: string[] = [];
  let activeSignal: AbortSignal | undefined;
  let closeCount = 0;
  let remoteListCount = 0;
  let galleryListCount = 0;

  const galleryStore: WallpaperGalleryStore = {
    async list() { galleryListCount++; return []; },
    async get() { return undefined; },
    async put() { assert.fail('local abort must prevent a late media write'); },
    async remove() { assert.fail('acquisition must not remove Gallery assets'); },
    close() {
      closeCount++;
      storeClosed.resolve();
    },
  };
  const systemWallpapers: SystemWallpaperAdapter = {
    async restore() { return []; },
    async list() {
      remoteListCount++;
      return SYSTEM_WALLPAPER_IDS.map((id): SystemWallpaperEntry => ({
        id,
        name: id,
        available: true,
        downloadable: true,
        sourceType: 'image',
      }));
    },
    async load(id, signal) {
      loadCalls.push(id);
      activeSignal = signal;
      started.resolve();
      // 模拟 Remote 已收到取消，但其实际 stream 仍需等待自身结算。
      await settleLoad.promise;
      return 'data:image/jpeg;base64,/9j/2Q==';
    },
  };

  let editor: ReturnType<typeof mountCaptureWindowEditor> | undefined;
  try {
    const document = dom.window.document;
    const source = document.createElement('canvas');
    source.width = 120;
    source.height = 80;
    const initialState = {
      ...createCaptureWindowState({ width: 120, height: 80, scaleFactor: 1 }),
      background: { id: 'sea', kind: 'preset' as const },
    };
    editor = mountCaptureWindowEditor(document.querySelector('main')!, {
      initialState,
      preferenceStorage: null,
      source,
      galleryStore,
      systemWallpapers,
      onNotify: message => notices.push(message),
    });
    const root = document.querySelector<HTMLElement>('[data-pdsh-capture]')!;
    const getButton = () => root.querySelector<HTMLButtonElement>("[data-action='acquire-system-wallpapers']");

    await new Promise<void>(resolve => setImmediate(resolve));
    assert.ok(galleryListCount > 0, 'mount restores only saved local metadata');
    assert.equal(remoteListCount, 0, 'mount does not request the Host catalog');
    assert.deepEqual(loadCalls, [], 'mount does not request wallpaper media');
    getButton()!.click();
    await started.promise;

    assert.deepEqual(loadCalls, [SYSTEM_WALLPAPER_IDS[0]], 'the explicit batch starts with the first closed ID');
    editor.destroy();
    assert.equal(activeSignal?.aborted, true, 'destroy aborts the active batch before returning');
    assert.equal(root.isConnected, false, 'the workbench DOM is removed immediately');
    assert.equal(closeCount, 0, 'Gallery remains open while the actual adapter operation is unsettled');
    assert.deepEqual(notices, [], 'ordinary close cancellation is silent');

    editor.destroy();
    assert.equal(closeCount, 0, 'repeated destroy cannot bypass the outstanding settlement');
    settleLoad.resolve();
    await storeClosed.promise;
    await new Promise<void>(resolve => setImmediate(resolve));

    assert.deepEqual(loadCalls, [SYSTEM_WALLPAPER_IDS[0]], 'settling cancellation never starts a later ID');
    assert.equal(closeCount, 1, 'Gallery closes once after batch settlement');
    assert.deepEqual(notices, [], 'settlement after close does not emit an ordinary failure notice');
    editor.destroy();
    assert.equal(closeCount, 1, 'destroy after close remains idempotent');
  } finally {
    settleLoad.resolve();
    editor?.destroy();
    await storeClosed.promise;
    dom.window.close();
    restoreGlobals();
  }
});

test('editor destroy keeps Gallery open until cached-tile store.get settles, without late Host media or notice', { timeout: 5_000 }, async () => {
  const { dom, restoreGlobals } = installEditorDom();
  const getStarted = deferred();
  const settleGet = deferred<ReturnType<typeof cachedSystemAsset> | undefined>();
  const storeClosed = deferred();
  const asset = cachedSystemAsset();
  const getCalls: string[] = [];
  const notices: string[] = [];
  let closeCount = 0;
  let listCount = 0;
  let remoteLists = 0;
  let remoteLoads = 0;

  const galleryStore: WallpaperGalleryStore = {
    async list() { listCount++; return [asset]; },
    get(id) { getCalls.push(id); getStarted.resolve(); return settleGet.promise; },
    async put() { assert.fail('cached selection must not write Gallery media'); },
    async remove() { assert.fail('selection must not remove Gallery media'); },
    close() { closeCount++; storeClosed.resolve(); },
  };
  const systemWallpapers: SystemWallpaperAdapter = {
    async list() { remoteLists++; return []; },
    async load() { remoteLoads++; throw new Error('close must not start Host media retrieval'); },
  };

  let editor: ReturnType<typeof mountCaptureWindowEditor> | undefined;
  try {
    const document = dom.window.document;
    const source = document.createElement('canvas');
    source.width = 120;
    source.height = 80;
    editor = mountCaptureWindowEditor(document.querySelector('main')!, {
      initialState: { ...createCaptureWindowState({ width: 120, height: 80, scaleFactor: 1 }),
        background: { id: 'sea', kind: 'preset' as const } },
      preferenceStorage: null,
      source,
      galleryStore,
      systemWallpapers,
      onNotify: message => notices.push(message),
    });
    const root = document.querySelector<HTMLElement>('[data-pdsh-capture]')!;
    let cachedTile: HTMLButtonElement | null = null;
    for (let turn = 0; turn < 20 && !cachedTile; turn++) {
      cachedTile = root.querySelector<HTMLButtonElement>(`[data-system-wallpaper="${SYSTEM_WALLPAPER_IDS[0]}"][data-gallery-wallpaper]`);
      if (!cachedTile) await new Promise<void>(resolve => setImmediate(resolve));
    }
    assert.ok(listCount > 0, 'mount restores cached system metadata from local list()');
    assert.ok(cachedTile, 'the saved system material is rendered as a cached selectable tile');
    cachedTile.click();
    await getStarted.promise;
    assert.deepEqual(getCalls, [SYSTEM_WALLPAPER_IDS[0]], 'the tile follows the Gallery action owner through local store.get()');

    editor.destroy();
    assert.equal(root.isConnected, false, 'editor DOM is removed immediately');
    assert.deepEqual(notices, [], 'ordinary close cancellation is silent');
    await new Promise<void>(resolve => setImmediate(resolve));
    const closeCountWhileGetPending = closeCount;

    settleGet.resolve(undefined);
    await storeClosed.promise;
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.deepEqual({ closeCountWhileGetPending, closeCountAfterSettle: closeCount, remoteLists, remoteLoads, notices },
      { closeCountWhileGetPending: 0, closeCountAfterSettle: 1, remoteLists: 0, remoteLoads: 0, notices: [] },
      'the Gallery remains open for local get(), then closes once without a late Host request or notice');
  } finally {
    settleGet.resolve(undefined);
    editor?.destroy();
    await new Promise<void>(resolve => setImmediate(resolve));
    if (closeCount > 0) await storeClosed.promise;
    dom.window.close();
    restoreGlobals();
  }
});

test('从 none/color/gradient 返回图片时不应闪现我的图片 loading 并重建缓存 DOM', { timeout: 5_000 }, async () => {
  const modes = ['none', 'plain-color', 'gradients'] as const;
  const observations: Array<Record<string, unknown>> = [];

  for (const sourceMode of modes) {
    const { dom, restoreGlobals } = installEditorDom();
    const persisted = [cachedSystemAsset(), cachedUserAsset()];
    const delayedList = deferred<typeof persisted>();
    let listCalls = 0;
    let tabMounts = 0;
    let changeMode: ((mode: CaptureBackgroundMode) => void) | undefined;
    const requestedModes: CaptureBackgroundMode[] = [];
    let editor: ReturnType<typeof mountCaptureWindowEditor> | undefined;
    const turn = () => new Promise<void>(resolve => setImmediate(resolve));
    const until = async (condition: () => boolean, message: string) => {
      for (let attempt = 0; attempt < 30; attempt++) {
        if (condition()) return;
        await turn();
      }
      assert.fail(message);
    };

    try {
      const source = dom.window.document.createElement('canvas');
      source.width = 120;
      source.height = 80;
      editor = mountCaptureWindowEditor(dom.window.document.querySelector('main')!, {
        initialState: {
          ...createCaptureWindowState({ width: 120, height: 80, scaleFactor: 1 }),
          background: { id: 'sea', kind: 'preset' as const },
        },
        preferenceStorage: null,
        source,
        galleryStore: {
          async list() {
            const call = listCalls++;
            if (call === 0) return persisted;
            return call === 1 ? delayedList.promise : persisted;
          },
          async get() { return undefined; },
          async put() { assert.fail('只读图库重验不得写素材'); },
          async remove() { assert.fail('切换 Tab 不得删除素材'); },
          close() {},
        },
        mountBackgroundTabs: (_container, props) => {
          tabMounts++;
          changeMode = mode => { requestedModes.push(mode); props.onChange(mode); };
          return { update() {}, destroy() {} };
        },
      });

      const root = dom.window.document.querySelector<HTMLElement>('[data-pdsh-capture]')!;
      const systemSelector = `[data-system-wallpaper="${SYSTEM_WALLPAPER_IDS[0]}"][data-gallery-wallpaper]`;
      const userSelector = `[data-gallery-user-image="${persisted[1].id}"]`;

      await until(() => listCalls === 1 && Boolean(root.querySelector(systemSelector)) &&
        Boolean(root.querySelector(userSelector)) && !root.querySelector('[data-gallery-status]'),
      'mount must restore existing system/user metadata before measuring a tab revisit');

      const currentChangeMode = () => {
        assert.equal(typeof changeMode, 'function', 'production editor must mount a real Tabs onChange callback');
        return changeMode!;
      };
      currentChangeMode()(sourceMode);
      assert.equal(root.querySelector('[data-background-section="wallpapers"]')?.hasAttribute('hidden'), true,
        `${sourceMode} transition hides the image panel through production editor state`);
      const expectedKind = sourceMode === 'none' ? 'transparent' : sourceMode === 'plain-color' ? 'color' : 'preset';
      assert.equal(editor.getState().background.kind, expectedKind,
        `${sourceMode} onChange must update the production editor background state`);

      const previousDialog = root.querySelector('.pdsh-capture-dialog');
      const previousTabs = root.querySelector('[data-background-tabs]');
      const previousSystemTile = root.querySelector(systemSelector);
      const previousUserTile = root.querySelector(userSelector);
      const mountsBeforeReturn = tabMounts;
      currentChangeMode()('wallpapers');
      await turn();
      assert.deepEqual(requestedModes, [sourceMode, 'wallpapers'], 'the production Tabs callbacks must reach both modes');

      const loading = root.querySelector('[data-gallery-status]');
      observations.push({
        sourceMode,
        rootDescendantsRetained: previousDialog?.isConnected === true && previousTabs?.isConnected === true,
        cachedSystemNodeRetained: previousSystemTile?.isConnected === true,
        cachedUserNodeRetained: previousUserTile?.isConnected === true,
        loadingNodeCount: root.querySelectorAll('[data-gallery-status]').length,
        loadingNodeOwner: loading?.closest('.pdsh-capture-gallery')?.getAttribute('aria-label') ?? null,
        loadingNodeText: loading?.textContent ?? null,
        cachedSystemTilesDuringWait: root.querySelectorAll(systemSelector).length,
        cachedUserTilesDuringWait: root.querySelectorAll(userSelector).length,
        tabMountDelta: tabMounts - mountsBeforeReturn,
        listCallCount: listCalls,
      });

      delayedList.resolve(persisted);
      await until(() => !root.querySelector('[data-gallery-status]') && Boolean(root.querySelector(systemSelector)) &&
        Boolean(root.querySelector(userSelector)), 'settled local list must restore both cached items');
    } finally {
      delayedList.resolve(persisted);
      editor?.destroy();
      await turn();
      dom.window.close();
      restoreGlobals();
    }
  }

  assert.deepEqual(observations, modes.map(sourceMode => ({
    sourceMode,
    rootDescendantsRetained: true,
    cachedSystemNodeRetained: true,
    cachedUserNodeRetained: true,
    loadingNodeCount: 0,
    loadingNodeOwner: null,
    loadingNodeText: null,
    cachedSystemTilesDuringWait: 1,
    cachedUserTilesDuringWait: 1,
    tabMountDelta: 0,
    listCallCount: 1,
  })), 'a warmed persistent Gallery should not flash a loading row or discard/recreate cached DOM when returning to Images');
});

test('首次非图片背景保留惰性读取，图片重入不重复在途读取，失败后仍可重试', { timeout: 5_000 }, async () => {
  for (const failFirstRead of [false, true]) {
    const { dom, restoreGlobals } = installEditorDom();
    const pending = deferred<ReturnType<typeof cachedUserAsset>[]>();
    let listCalls = 0;
    let changeMode: ((mode: CaptureBackgroundMode) => void) | undefined;
    let editor: ReturnType<typeof mountCaptureWindowEditor> | undefined;
    const turn = () => new Promise<void>(resolve => setImmediate(resolve));
    try {
      const source = dom.window.document.createElement('canvas');
      source.width = 120; source.height = 80;
      editor = mountCaptureWindowEditor(dom.window.document.querySelector('main')!, {
        initialState: { ...createCaptureWindowState({ width: 120, height: 80 }),
          background: { kind: 'color', color: '#ffffff' } },
        preferenceStorage: null, source,
        galleryStore: {
          async list() {
            listCalls++;
            if (failFirstRead && listCalls === 1) throw new Error('owned fixture storage failure');
            return pending.promise;
          },
          async get() { assert.fail('Tab navigation must not read full media'); },
          async put() { assert.fail('Tab navigation must not write media'); },
          async remove() { assert.fail('Tab navigation must not remove media'); },
          close() {},
        },
        mountBackgroundTabs: (_container, props) => {
          changeMode = props.onChange;
          return { update() {}, destroy() {} };
        },
      });
      const root = dom.window.document.querySelector<HTMLElement>('[data-pdsh-capture]')!;
      await turn();
      assert.equal(listCalls, 0, 'a non-image initial background keeps the existing lazy Gallery boundary');
      changeMode!('wallpapers');
      await turn();
      assert.equal(listCalls, 1, 'the first image visit must read local inventory');
      if (failFirstRead) {
        assert.equal(root.querySelector('[data-gallery-status]')?.getAttribute('role'), 'alert',
          'an actual first-read error remains visible rather than being hidden');
        changeMode!('plain-color'); changeMode!('wallpapers');
        await turn();
        assert.equal(listCalls, 2, 'a failed inventory may retry on a later image visit');
      }
      assert.equal(root.querySelector('[aria-label="我的图片"]')?.getAttribute('aria-busy'), 'true',
        'a genuine pending first/retry read retains non-visual busy semantics');
      assert.equal(root.querySelector('[data-gallery-status]'), null,
        'even a genuine first/retry read must not insert the removed loading message');
      const readsWhilePending = listCalls;
      changeMode!('none'); changeMode!('wallpapers');
      await turn();
      assert.equal(listCalls, readsWhilePending, 're-entering while inventory is pending must not start another read');
      pending.resolve([cachedUserAsset()]);
      for (let attempt = 0; attempt < 5; attempt++) await turn();
      assert.ok(root.querySelector('[data-gallery-user-image]'), 'the original pending read must still populate the Gallery');
      assert.equal(root.querySelector('[aria-label="我的图片"]')?.getAttribute('aria-busy'), 'false',
        'busy clears when the original inventory settles');
      const oldDialog = root.querySelector('.pdsh-capture-dialog');
      changeMode!('gradients'); changeMode!('wallpapers');
      await turn();
      assert.equal(listCalls, readsWhilePending, 'the now-ready inventory is reused');
      assert.equal(oldDialog?.isConnected, true, 'ready navigation must retain the workbench subtree');
    } finally {
      pending.resolve([cachedUserAsset()]);
      editor?.destroy();
      await turn();
      dom.window.close(); restoreGlobals();
    }
  }
});

test('空系统库存的首次恢复只发生在挂载，返回图片不再恢复或请求Host', { timeout: 5_000 }, async () => {
  const { dom, restoreGlobals } = installEditorDom();
  let listCalls = 0, remoteCalls = 0;
  let changeMode: ((mode: CaptureBackgroundMode) => void) | undefined;
  let editor: ReturnType<typeof mountCaptureWindowEditor> | undefined;
  const turn = () => new Promise<void>(resolve => setImmediate(resolve));
  try {
    const source = dom.window.document.createElement('canvas'); source.width = 120; source.height = 80;
    editor = mountCaptureWindowEditor(dom.window.document.querySelector('main')!, {
      preferenceStorage: null, source,
      galleryStore: {
        async list() { listCalls++; return []; },
        async get() { assert.fail('inventory restore must not read media'); },
        async put() { assert.fail('inventory restore must not write media'); },
        async remove() { assert.fail('inventory restore must not remove media'); },
        close() {},
      },
      systemWallpapers: {
        async list() { remoteCalls++; return []; },
        async load() { remoteCalls++; throw new Error('explicit acquisition only'); },
      },
      mountBackgroundTabs: (_container, props) => {
        changeMode = props.onChange;
        return { update() {}, destroy() {} };
      },
    });
    for (let attempt = 0; attempt < 5; attempt++) await turn();
    const root = dom.window.document.querySelector<HTMLElement>('[data-pdsh-capture]')!;
    assert.equal(listCalls, 2, 'initial Gallery and system-cache restoration still each read their local inventory');
    const oldDialog = root.querySelector('.pdsh-capture-dialog');
    for (const mode of ['none', 'plain-color', 'gradients'] as const) {
      changeMode!(mode); changeMode!('wallpapers');
      await turn();
    }
    assert.equal(listCalls, 2, 'an empty restored system cache must not be mistaken for unrestored on Tab entry');
    assert.equal(oldDialog?.isConnected, true, 'empty Gallery navigation also keeps the existing DOM');
    assert.equal(remoteCalls, 0, 'navigation cannot request Host catalog or media');
  } finally {
    editor?.destroy(); await turn();
    dom.window.close(); restoreGlobals();
  }
});

function cachedSystemAsset() {
  return {
    id: SYSTEM_WALLPAPER_IDS[0],
    blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x03, 0x01, 0x11, 0x00, 0xff, 0xd9])], { type: 'image/jpeg' }),
    width: 1,
    height: 1,
    sourceType: 'image' as const,
    thumbnail: 'data:image/jpeg;base64,YQ==',
    createdAt: 1,
  };
}

function cachedUserAsset() {
  return {
    id: `user-wallpaper-${'9'.repeat(64)}`,
    blob: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }),
    width: 1,
    height: 1,
    sourceType: 'image' as const,
    thumbnail: 'data:image/jpeg;base64,YQ==',
    createdAt: 2,
  };
}

test('背景恢复后的增量同步立即更新个人和系统选中环，不靠点击或重建 DOM', () => {
  const { dom, restoreGlobals } = installEditorDom();
  try {
    const userId = cachedUserAsset().id;
    const systemId = SYSTEM_WALLPAPER_IDS[0];
    const root = dom.window.document.querySelector<HTMLElement>('main')!;
    root.innerHTML = `<button data-gallery-user-image="${userId}" data-selected="false" aria-pressed="false"></button>
      <button data-system-wallpaper="${systemId}" data-gallery-wallpaper="${systemId}" data-selected="false" aria-pressed="false"></button>
      <button data-background-wallpaper data-gallery-add-image></button>
      <button data-background="sea" aria-pressed="true"></button>`;
    const userTile = root.querySelector<HTMLElement>('[data-gallery-user-image]')!;
    const systemTile = root.querySelector<HTMLElement>('[data-gallery-wallpaper]')!;
    const addImage = root.querySelector<HTMLButtonElement>('[data-gallery-add-image]')!;
    const state = createCaptureWindowState({ width: 120, height: 80, scaleFactor: 1 });
    userTile.focus();
    for (const id of [userId, systemId, userId]) {
      syncCaptureBackgroundControls(root, {
        ...state, background: { kind: 'wallpaper', systemId: id, dataUrl: 'data:image/jpeg;base64,YQ==' },
      }, '#ffffff');
      for (const [tile, tileId] of [[userTile, userId], [systemTile, systemId]] as const) {
        assert.equal(tile.dataset.selected, String(id === tileId), '选中环必须与已恢复的唯一背景模型一致');
        assert.equal(tile.getAttribute('aria-pressed'), String(id === tileId));
        assert.equal(tile.isConnected, true, '同步不能重建缩略图');
      }
      assert.equal(dom.window.document.activeElement, userTile, '同步不能借焦点伪造选中状态');
      assert.equal(addImage.hasAttribute('data-selected'), false, '同步不把背景状态投影到加号动作');
    }
    syncCaptureBackgroundControls(root, {
      ...state, background: { kind: 'wallpaper', dataUrl: 'data:image/jpeg;base64,YQ==' },
    }, '#ffffff');
    assert.equal(addImage.hasAttribute('data-selected'), false, '无素材ID的壁纸状态也不能选中加号');
    assert.equal(addImage.hasAttribute('aria-pressed'), false, '动作按钮不声明背景选择状态');
    syncCaptureBackgroundControls(root, { ...state, background: { kind: 'preset', id: 'sea' } }, '#ffffff');
    assert.equal(userTile.dataset.selected, 'false');
    assert.equal(systemTile.dataset.selected, 'false');
    assert.equal(addImage.hasAttribute('data-selected'), false);
  } finally {
    dom.window.close(); restoreGlobals();
  }
});
test('真实 Editor 选择个人图后从 none/color/gradient 返回均恢复唯一选中环且不重读/重建', { timeout: 5_000 }, async () => {
  const { dom, restoreGlobals } = installEditorDom();
  const restoreImageDecoder = installGalleryImageDecoder(dom);
  const systemAsset = cachedSystemAsset();
  const userAsset = { ...cachedUserAsset(), blob: cachedSystemAsset().blob };
  const assets = [systemAsset, userAsset];
  const userId = userAsset.id;
  const systemId = systemAsset.id;
  const storeGets: string[] = [];
  let storeLists = 0;
  let remoteLists = 0;
  let remoteLoads = 0;
  let tabMounts = 0;
  let onChange: ((mode: CaptureBackgroundMode) => void) | undefined;
  let tabsId = '';
  let currentMode: CaptureBackgroundMode = 'wallpapers';
  let editor: ReturnType<typeof mountCaptureWindowEditor> | undefined;
  try {
    const source = dom.window.document.createElement('canvas');
    source.width = 120; source.height = 80;
    editor = mountCaptureWindowEditor(dom.window.document.querySelector('main')!, {
      initialState: { ...createCaptureWindowState({ width: 120, height: 80, scaleFactor: 1 }),
        background: { id: 'sea', kind: 'preset' as const } },
      preferenceStorage: null,
      source,
      galleryStore: {
        async list() { storeLists++; return assets; },
        async get(id) { storeGets.push(id); return assets.find(asset => asset.id === id); },
        async put() { assert.fail('selection and Tab navigation must not write a Gallery asset'); },
        async remove() { assert.fail('selection and Tab navigation must not remove a Gallery asset'); },
        close() {},
      },
      systemWallpapers: {
        async list() { remoteLists++; return []; },
        async load() { remoteLoads++; throw new Error('Tab navigation cannot acquire system media'); },
      },
      mountBackgroundTabs: (_container, props) => {
        tabMounts++;
        onChange = props.onChange;
        tabsId = props.id;
        currentMode = props.value;
        return { update(value) { currentMode = value; }, destroy() {} };
      },
    });
    const root = dom.window.document.querySelector<HTMLElement>('[data-pdsh-capture]')!;
    const userSelector = `[data-gallery-user-image="${userId}"]`;
    const systemSelector = `[data-gallery-wallpaper="${systemId}"]`;
    await until(() => storeLists >= 2 && Boolean(root.querySelector(userSelector)) &&
      Boolean(root.querySelector(systemSelector)) && Boolean(root.querySelector('[data-action="acquire-system-wallpapers"]')),
    'the production Editor must finish local metadata and cached-system restoration before selection');
    await turn();
    const storeListsBeforeSelection = storeLists;

    root.querySelector<HTMLButtonElement>(userSelector)!.click();
    await until(() => {
      const background = editor!.getState().background;
      return background.kind === 'wallpaper' && background.systemId === userId &&
        root.querySelector(userSelector)?.getAttribute('aria-busy') === 'false';
    },
    'the real personal tile click must finish local load and decode before changing accepted background');
    const acceptedBackground = editor.getState().background;
    assert.equal(acceptedBackground.kind, 'wallpaper');
    if (acceptedBackground.kind === 'wallpaper') assert.equal(acceptedBackground.systemId, userId);
    assertGallerySelection(root, userId);
    assertBackgroundPanels(root, 'wallpapers', tabsId);
    assert.equal(currentMode, 'wallpapers');
    assert.deepEqual(storeGets, [userId], 'selection reads only the chosen asset once');
    assert.equal(storeLists, storeListsBeforeSelection, 'selection does not rebuild its inventory');

    const selectedUserTile = root.querySelector(userSelector);
    const selectedSystemTile = root.querySelector(systemSelector);
    const dialog = root.querySelector('.pdsh-capture-dialog');
    const tabsContainer = root.querySelector('[data-background-tabs]');
    const mountsBeforeNavigation = tabMounts;
    const otherModes: readonly [CaptureBackgroundMode, (state: CaptureWindowState) => void][] = [
      ['none', state => assert.equal(state.background.kind, 'transparent')],
      ['plain-color', state => assert.deepEqual(state.background, { kind: 'color', color: '#2B3440' })],
      ['gradients', state => assert.deepEqual(state.background, { kind: 'preset', id: 'rose' })],
    ];
    for (const [mode, assertModeBackground] of otherModes) {
      assert.equal(typeof onChange, 'function');
      onChange!(mode);
      assertModeBackground(editor.getState());
      assert.equal(currentMode, mode);
      assertGallerySelection(root, null);
      assertBackgroundPanels(root, mode, tabsId);
      assert.equal(selectedUserTile?.isConnected, true, `${mode} navigation retains the personal tile node`);
      assert.equal(selectedSystemTile?.isConnected, true, `${mode} navigation retains the system tile node`);

      onChange!('wallpapers');
      const restoredBackground: CaptureWindowState['background'] = editor.getState().background;
      assert.equal(restoredBackground.kind, 'wallpaper', `${mode} → wallpapers restores a Gallery background`);
      if (restoredBackground.kind === 'wallpaper') assert.equal(restoredBackground.systemId, userId,
        `${mode} → wallpapers restores the remembered personal material`);
      assert.equal(currentMode, 'wallpapers');
      assertGallerySelection(root, userId);
      assertBackgroundPanels(root, 'wallpapers', tabsId);
      assert.equal(root.querySelector(userSelector), selectedUserTile, 'Tab restoration must not replace the personal tile');
      assert.equal(root.querySelector(systemSelector), selectedSystemTile, 'Tab restoration must not replace the system tile');
      assert.equal(root.querySelector('.pdsh-capture-dialog'), dialog, 'Tab restoration must not rebuild the workbench');
      assert.equal(root.querySelector('[data-background-tabs]'), tabsContainer, 'Tab restoration keeps one native Tabs mount');
    }

    assert.equal(tabMounts, mountsBeforeNavigation, 'mode changes update the existing controlled Tabs instance');
    assert.equal(storeLists, storeListsBeforeSelection, 'warm mode changes never reread the store inventory');
    assert.deepEqual(storeGets, [userId], 'warm mode changes never reload image bytes');
    assert.equal(remoteLists, 0, 'navigation never requests the Host catalog or Get action');
    assert.equal(remoteLoads, 0, 'navigation never retrieves system media');
  } finally {
    editor?.destroy();
    await turn();
    restoreImageDecoder();
    dom.window.close();
    restoreGlobals();
  }
});
test('首次打开异步恢复个人图片偏好时，库存晚到仍按已接受ID绘制唯一选中环', { timeout: 5_000 }, async () => {
  const { dom, restoreGlobals } = installEditorDom();
  const restoreImageDecoder = installGalleryImageDecoder(dom);
  const systemAsset = cachedSystemAsset();
  const userAsset = { ...cachedUserAsset(), blob: cachedSystemAsset().blob };
  const assets = [systemAsset, userAsset];
  const userId = userAsset.id;
  const inventory = deferred<typeof assets>();
  let storeLists = 0;
  const storeGets: string[] = [];
  let onChange: ((mode: CaptureBackgroundMode) => void) | undefined;
  let tabsId = '';
  let currentMode: CaptureBackgroundMode = 'wallpapers';
  let editor: ReturnType<typeof mountCaptureWindowEditor> | undefined;
  try {
    const source = dom.window.document.createElement('canvas');
    source.width = 120; source.height = 80;
    const preferenceStorage = {
      getItem(key: string) {
        return key === CAPTURE_PREFERENCES_KEY ? JSON.stringify({
          background: { kind: 'wallpaper', systemId: userId },
          padding: 8, paddingUnit: 'percent', privacyEnabled: true, shadow: true,
        }) : null;
      },
      setItem() { assert.fail('opening and restoring a saved image must not rewrite preferences'); },
    };
    editor = mountCaptureWindowEditor(dom.window.document.querySelector('main')!, {
      preferenceStorage,
      source,
      galleryStore: {
        async list() { storeLists++; return inventory.promise; },
        async get(id) { storeGets.push(id); return assets.find(asset => asset.id === id); },
        async put() { assert.fail('preference restoration must not rewrite a saved Gallery asset'); },
        async remove() { assert.fail('preference restoration must not remove a saved Gallery asset'); },
        close() {},
      },
      mountBackgroundTabs: (_container, props) => {
        onChange = props.onChange;
        tabsId = props.id;
        currentMode = props.value;
        return { update(value) { currentMode = value; }, destroy() {} };
      },
    });

    const root = dom.window.document.querySelector<HTMLElement>('[data-pdsh-capture]')!;
    await until(() => {
      const background = editor!.getState().background;
      return storeLists === 1 && background.kind === 'wallpaper' && background.systemId === userId;
    },
    'the saved opaque ID must restore through local Gallery media while inventory is still pending');
    assert.equal(root.querySelector('[data-gallery-user-image]'), null, 'pending inventory has not fabricated a tile');
    assert.equal(currentMode, 'wallpapers', 'restored model controls the native Tabs value before inventory settles');
    assertBackgroundPanels(root, 'wallpapers', tabsId);

    inventory.resolve(assets);
    await until(() => Boolean(root.querySelector(`[data-gallery-user-image="${userId}"]`)) &&
      Boolean(root.querySelector(`[data-gallery-wallpaper="${systemAsset.id}"]`)),
    'the settled local inventory must paint the restored personal and system assets');
    assertGallerySelection(root, userId);
    assertBackgroundPanels(root, 'wallpapers', tabsId);
    assert.equal(storeLists, 1, 'one initial local inventory is sufficient for restore and first paint');
    assert.deepEqual(storeGets, [userId], 'preference restoration materializes only its selected local asset');
    assert.equal(typeof onChange, 'function', 'the restored mode remains connected to the mounted Tabs callback');
  } finally {
    inventory.resolve(assets);
    editor?.destroy();
    await turn();
    restoreImageDecoder();
    dom.window.close();
    restoreGlobals();
  }
});
