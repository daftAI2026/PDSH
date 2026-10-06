/**
 * [INPUT]: 依赖 Host 注入的 SystemWallpaperAdapter、shared 动态/legacy ID 语法与固定 Remote 取消码；仅显式按钮启动批获取。
 * [OUTPUT]: 提供 Gallery 恢复、当前目录目标的串行显式获取、持久完成数与固定失败码状态；保留旧缓存、不自动应用背景；销毁 join 自有目录/媒体 Promise。
 * [POS]: capture-window 的系统壁纸目录/获取/选择 owner；完整 JPEG 按项交由 Gallery 持久化，终态发布持久项；全部图库选中环由 background-controls 投影。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { isSystemWallpaperId, type SystemWallpaperId } from '../../shared/system-wallpaper-protocol.ts';
import { WALLPAPER_GALLERY_LIMITS, WallpaperGalleryError } from '../../shared/wallpaper-gallery.ts';
import { SystemWallpaperClientError, isSystemWallpaperClientErrorCode, type SystemWallpaperClientErrorCode } from './system-wallpaper-remote.ts';

export type SystemWallpaperEntry = {
  id: string;
  name: string;
  thumbnail?: string;
  available?: boolean;
  downloadable?: boolean;
  sourceType?: "image" | "video";
  loadStatus?: "idle" | "loading" | "ready" | "error";
};

/** 旧 current 适配器的兼容 ID；新版本目录不伪装成当前桌面取像。 */
export const SYSTEM_WALLPAPER_CURRENT_ID = "system-wallpaper-current";

export type SystemWallpaperAdapter = {
  list: (signal?: AbortSignal, options?: { requireSource?: boolean }) => Promise<SystemWallpaperEntry[]>;
  restore?: (signal?: AbortSignal) => Promise<SystemWallpaperEntry[]>;
  load: (id: string, signal?: AbortSignal) => Promise<string>;
  getSourceType?: (id: string) => SystemWallpaperEntry["sourceType"];
};

export type SystemWallpaperStatus = "error" | "idle" | "loading" | "ready" | "unavailable";
export type SystemWallpaperAcquisitionStatus = 'error' | 'idle' | 'loading' | 'ready';
export type SystemWallpaperAcquisition = {
  status: SystemWallpaperAcquisitionStatus;
  completed: number;
  total: number;
  failureCode?: SystemWallpaperClientErrorCode;
};

export type SystemWallpaperAcquisitionErrorCode = 'incomplete' | 'durable-restore-required';
export class SystemWallpaperAcquisitionError extends Error {
  readonly code: SystemWallpaperAcquisitionErrorCode;

  constructor(code: SystemWallpaperAcquisitionErrorCode) {
    super(code);
    this.name = 'SystemWallpaperAcquisitionError';
    this.code = code;
  }
}

export type SystemWallpaperState = {
  entries: readonly SystemWallpaperEntry[];
  status: SystemWallpaperStatus;
  acquisition?: SystemWallpaperAcquisition;
};

export type SystemWallpaperSelection = {
  dataUrl: string;
  id: string;
};

export type SystemWallpaperController = {
  destroy: () => Promise<void>;
  acquireAll: () => Promise<void>;
  restore: () => Promise<void>;
  ensureLoaded: () => Promise<readonly SystemWallpaperEntry[]>;
  getState: () => SystemWallpaperState;
  getSelectionRevision: () => number;
  getSelectionSignal: (selection: SystemWallpaperSelection) => AbortSignal | undefined;
  invalidateSelection: () => void;
  isSelectionCurrent: (selection: SystemWallpaperSelection | string, revision?: number) => boolean;
  select: (id: string) => Promise<SystemWallpaperSelection | null>;
};

const SYSTEM_WALLPAPER_IMAGE_CACHE_LIMIT = 2;

export function createSystemWallpaperController(
  adapter: SystemWallpaperAdapter | undefined,
  onChange?: (state: SystemWallpaperState) => void,
): SystemWallpaperController {
  let state: SystemWallpaperState = {
    entries: [],
    status: adapter ? "idle" : "unavailable",
    ...(adapter ? { acquisition: idleAcquisition() } : {}),
  };
  let listPromise: Promise<readonly SystemWallpaperEntry[]> | null = null;
  let listAbort: AbortController | undefined;
  let acquisitionPromise: Promise<void> | undefined;
  let acquisitionAbort: AbortController | undefined;
  let destroySettlement: Promise<void> | undefined;
  let selectionRevision = 0;
  let pendingSelectionId: string | null = null;
  let activeSelection: { abort: AbortController; id: string; revision: number } | undefined;
  const selectionOwners = new WeakMap<SystemWallpaperSelection, { revision: number; signal: AbortSignal }>();
  const originalLoads = new Map<string, string>();
  const operations = new Set<Promise<unknown>>();
  let destroyed = false;

  function own<T>(operation: Promise<T>): Promise<T> {
    operations.add(operation);
    void operation.then(() => operations.delete(operation), () => operations.delete(operation));
    return operation;
  }

  function idleAcquisition(): SystemWallpaperAcquisition {
    return { status: 'idle', completed: 0, total: 0 };
  }

  function publish(next: SystemWallpaperState): void {
    if (destroyed) return;
    state = next;
    onChange?.(state);
  }

  function abortActiveSelection(): void {
    const active = activeSelection;
    activeSelection = undefined;
    active?.abort.abort();
    const entry = active && state.entries.find(item => item.id === active.id);
    if (!destroyed && entry?.loadStatus === "loading") {
      updateEntry(active.id, entry.thumbnail ? "ready" : "idle");
    }
  }

  function ensureLoaded(): Promise<readonly SystemWallpaperEntry[]> {
    if (destroyed) return Promise.resolve([]);
    if (!adapter) return Promise.resolve([]);
    if (state.status === "ready") return Promise.resolve(state.entries);
    if (state.status === "loading" && listPromise) return listPromise;
    const abort = new AbortController();
    listAbort = abort;
    publish({ ...state, entries: [], status: "loading" });
    const pending = Promise.resolve().then(() => adapter.list(abort.signal)).then((entries) => {
      if (!destroyed && !abort.signal.aborted) {
        publish({ ...state, entries: entries.map(entry => ({ ...entry, loadStatus: entry.loadStatus ?? "idle" })), status: "ready" });
      }
      return entries;
    }, (error: unknown) => {
      if (!destroyed && !abort.signal.aborted) publish({ ...state, entries: [], status: "error" });
      throw error;
    }).finally(() => {
      if (listAbort === abort) listAbort = undefined;
      if (listPromise === pending) listPromise = null;
    });
    listPromise = pending;
    return pending;
  }

  function updateEntry(id: string, loadStatus: SystemWallpaperEntry["loadStatus"], thumbnail?: string, sourceType?: SystemWallpaperEntry["sourceType"]): void {
    publish({ ...state, entries: state.entries.map((entry) => entry.id === id
      ? { ...entry, loadStatus, ...(thumbnail !== undefined ? { thumbnail } : {}), ...(sourceType ? { sourceType } : {}) } : entry) });
  }

  function setAcquisition(acquisition: SystemWallpaperAcquisition): void {
    if (!state.acquisition) return;
    if (state.acquisition.status === 'loading' && acquisition.status === 'loading') {
      // +--- 每项进度只更新可读状态；Gallery/DOM 仅在开始、终态与最终缩略图提交时通知观察者。 ---+
      state = { ...state, acquisition };
      return;
    }
    publish({ ...state, acquisition });
  }

  function isCurrentAcquisition(abort: AbortController): boolean {
    return !destroyed && acquisitionAbort === abort && !abort.signal.aborted;
  }

  function isSystemId(id: string): id is SystemWallpaperId {
    return isSystemWallpaperId(id);
  }

  function validRestoredEntries(entries: readonly SystemWallpaperEntry[]): SystemWallpaperEntry[] {
    return entries.filter(entry => isSystemId(entry.id) && isSmallGalleryThumbnail(entry.thumbnail) &&
      (entry.sourceType === 'image' || entry.sourceType === 'video'))
      .map(entry => ({ ...entry, available: true, downloadable: false, loadStatus: 'ready' as const }));
  }

  function isSmallGalleryThumbnail(value: unknown): value is string {
    return typeof value === 'string' && value.length <= WALLPAPER_GALLERY_LIMITS.maxThumbnailChars &&
      /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/u.test(value);
  }

  function mergeEntries(incoming: readonly SystemWallpaperEntry[]): SystemWallpaperEntry[] {
    const merged = new Map<SystemWallpaperId, SystemWallpaperEntry>();
    for (const entry of [...state.entries, ...incoming]) {
      if (!isSystemId(entry.id)) continue;
      const previous = merged.get(entry.id);
      const hasThumbnail = typeof entry.thumbnail === 'string' && entry.thumbnail.length > 0;
      merged.set(entry.id, {
        ...previous,
        ...entry,
        ...(hasThumbnail || !previous?.thumbnail ? {} : { thumbnail: previous.thumbnail, loadStatus: previous.loadStatus }),
        ...(!hasThumbnail && !previous?.thumbnail && entry.loadStatus === 'ready' ? { loadStatus: 'idle' as const } : {}),
        ...(entry.sourceType ? { sourceType: entry.sourceType } : previous?.sourceType ? { sourceType: previous.sourceType } : {}),
      });
    }
    return [...merged.values()];
  }

  function publishEntries(incoming: readonly SystemWallpaperEntry[], status = state.status): void {
    const entries = mergeEntries(incoming);
    const nextStatus = entries.length && status === 'idle' ? 'ready' : status;
    publish({ ...state, entries, status: nextStatus });
  }

  function rememberImage(id: string, dataUrl: string): void {
    originalLoads.delete(id);
    originalLoads.set(id, dataUrl);
    while (originalLoads.size > SYSTEM_WALLPAPER_IMAGE_CACHE_LIMIT) {
      const oldest = originalLoads.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      originalLoads.delete(oldest);
      const entry = state.entries.find(item => item.id === oldest);
      if (entry?.thumbnail) updateEntry(oldest, "idle", "");
    }
  }

  async function select(id: string): Promise<SystemWallpaperSelection | null> {
    if (!adapter || destroyed) return null;
    const revision = ++selectionRevision;
    pendingSelectionId = id;
    abortActiveSelection();
    const entry = state.entries.find((item) => item.id === id);
    if (state.status !== "ready" || !entry || entry.available === false) return null;

    const abort = new AbortController();
    activeSelection = { abort, id, revision };
    const cached = originalLoads.get(id);
    if (cached !== undefined) {
      originalLoads.delete(id);
      originalLoads.set(id, cached);
      const selection = { dataUrl: cached, id };
      selectionOwners.set(selection, { revision, signal: abort.signal });
      updateEntry(id, "ready", cached, entry.sourceType ?? adapter.getSourceType?.(id));
      return selection;
    }

    let prepared = false;
    updateEntry(id, "loading");
    try {
      // +--- 状态发布会同步调用观察者；发布后重看缓存与owner再调用adapter。 ---+
      const cachedAfterPublish = originalLoads.get(id);
      let dataUrl: string;
      if (cachedAfterPublish) {
        originalLoads.delete(id);
        originalLoads.set(id, cachedAfterPublish);
        dataUrl = await Promise.resolve(cachedAfterPublish);
      } else {
        if (!adapter || destroyed || !state.entries.some((item) => item.id === id)) {
          throw new Error("unknown system wallpaper");
        }
        dataUrl = await adapter.load(id, abort.signal);
      }
      if (!isCurrent(id, revision) || abort.signal.aborted) return null;
      rememberImage(id, dataUrl);
      updateEntry(id, "ready", dataUrl, adapter.getSourceType?.(id));
      const selection = { dataUrl, id };
      selectionOwners.set(selection, { revision, signal: abort.signal });
      prepared = true;
      return selection;
    } catch (error) {
      if (isCurrent(id, revision) && !abort.signal.aborted) updateEntry(id, "error");
      throw error;
    } finally {
      // +--- 返回 JPEG 不结束选择生命周期；后置解码仍由该 signal 取消。 ---+
      if (!prepared && activeSelection?.abort === abort) activeSelection = undefined;
    }
  }

  function acquireAll(): Promise<void> {
    if (!adapter || destroyed) return Promise.resolve();
    if (acquisitionPromise) return acquisitionPromise;
    if (!adapter.restore) {
      setAcquisition({ status: 'error', completed: 0, total: 0 });
      return Promise.reject(new SystemWallpaperAcquisitionError('durable-restore-required'));
    }

    const abort = new AbortController();
    acquisitionAbort = abort;
    let completed = 0;
    let total = 0;
    let firstFailure: Error | undefined;
    let targetIds: SystemWallpaperId[] = [];
    let currentCatalog: SystemWallpaperEntry[] | undefined;

    const pending = Promise.resolve().then(async () => {
      let operationError: unknown;
      let failed = false;
      try {
        const cached = validRestoredEntries(await adapter.restore!(abort.signal));
        if (!isCurrentAcquisition(abort)) return;
        const cachedIds = new Set(cached.map(entry => entry.id));
        const cachedChanged = cached.some(entry => {
          const visible = state.entries.find(current => current.id === entry.id);
          return !visible || visible.thumbnail !== entry.thumbnail || visible.name !== entry.name ||
            visible.sourceType !== entry.sourceType || visible.loadStatus !== 'ready';
        });
        if (cachedChanged) publishEntries(cached);
        // +--- 每次显式获取都读活动目录；历史缓存不定义新版本的目标集合。 ---+
        const catalog = await adapter.list(abort.signal, { requireSource: true });
        if (!isCurrentAcquisition(abort)) return;
        const targets = new Set<SystemWallpaperId>();
        for (const entry of catalog) {
          if (isSystemId(entry.id) && (entry.available === true || entry.downloadable === true)) targets.add(entry.id);
        }
        targetIds = [...targets];
        currentCatalog = catalog.filter(entry => targets.has(entry.id as SystemWallpaperId));
        total = targetIds.length;
        completed = targetIds.filter(id => cachedIds.has(id)).length;
        setAcquisition({ status: 'loading', completed, total });

        for (const id of targetIds) {
          if (!isCurrentAcquisition(abort)) return;
          if (cachedIds.has(id)) continue;
          try {
            // +--- 完整 JPEG 只经 Gallery 单项持久化；读回小缩略图确认 put 已提交。 ---+
            await adapter.load(id, abort.signal);
            if (!isCurrentAcquisition(abort)) return;
            const restored = validRestoredEntries(await adapter.restore!(abort.signal));
            if (!isCurrentAcquisition(abort)) return;
            if (!restored.some(asset => asset.id === id)) throw new Error('The Gallery did not restore the acquired wallpaper');
            for (const asset of restored) cachedIds.add(asset.id);
            completed = targetIds.filter(target => cachedIds.has(target)).length;
            setAcquisition({ status: 'loading', completed, total });
          } catch (error) {
            if (!isCurrentAcquisition(abort)) return;
            // +--- Host 取消可能先于 Client 撤权；它终止整批，不是可跳过的单项读取失败。 ---+
            if (isCancellation(error)) throw error;
            // +--- 媒体/仓储失败只保留经核验的公开错误类型。 ---+
            const safeFailure = safeAcquisitionFailure(error);
            if (isFatalGalleryFailure(error)) firstFailure = safeFailure;
            else firstFailure ??= safeFailure;
            if (isFatalGalleryFailure(error)) break;
          }
        }

        if (firstFailure || completed < total) {
          throw firstFailure ?? new SystemWallpaperAcquisitionError('incomplete');
        }
      } catch (error) {
        if (!isCurrentAcquisition(abort)) return;
        failed = true;
        operationError = firstFailure ?? error;
      }

      // +--- 结束、部分失败或Host取消都只做一次最终恢复，发现已提交但load曾失败的项目也不丢缩略图。 ---+
      if (!isCurrentAcquisition(abort)) return;
      try {
        const restored = validRestoredEntries(await adapter.restore!());
        if (!isCurrentAcquisition(abort)) return;
        const persistedIds = new Set(restored.map(entry => entry.id));
        completed = targetIds.filter(id => persistedIds.has(id)).length;
        if (currentCatalog === undefined) {
          // +--- 目录源失败时只保留可验证的本机缓存，不猜测当前桌面版本。 ---+
          publishEntries(restored);
        } else {
          const persisted = new Map(restored.map(entry => [entry.id, entry]));
          const currentEntries = currentCatalog.flatMap(source => {
            const asset = persisted.get(source.id);
            return asset ? [{ ...asset, name: source.name, available: true,
              downloadable: false, loadStatus: 'ready' as const }] : [];
          });
          // +--- 成功取得的活动roster裁掉展示中的旧缓存，但不删除其持久条目或既有偏好。 ---+
          publish({ ...state, entries: currentEntries, status: 'ready' });
        }
      } catch {
        // +--- 最终刷新失败不得清空此前已显示/已验证的本地资产。 ---+
      }
      if (!isCurrentAcquisition(abort)) return;
      if (!failed && completed < total) {
        failed = true;
        operationError = new SystemWallpaperAcquisitionError('incomplete');
      }

      if (!failed) {
        setAcquisition({ status: 'ready', completed, total });
      } else if (isCancellation(operationError)) {
        setAcquisition({ status: 'idle', completed, total });
        throw operationError instanceof SystemWallpaperClientError ? operationError : new DOMException('Aborted', 'AbortError');
      } else {
        const failure = safeAcquisitionFailure(operationError);
        const failureCode = failure instanceof SystemWallpaperClientError && isSystemWallpaperClientErrorCode(failure.code)
          ? failure.code : undefined;
        setAcquisition({ status: 'error', completed, total,
          ...(failureCode ? { failureCode } : {}) });
        throw failure;
      }
    }).finally(() => {
        if (acquisitionAbort === abort) acquisitionAbort = undefined;
        if (acquisitionPromise === pending) acquisitionPromise = undefined;
    });
    acquisitionPromise = pending;
    setAcquisition({ status: 'loading', completed, total });
    return pending;
  }

  function isCurrent(id: string, revision: number): boolean {
    return !destroyed && selectionRevision === revision && pendingSelectionId === id;
  }

  async function restore(): Promise<void> {
    if (!adapter?.restore || destroyed || state.status !== "idle") return;
    const abort = new AbortController();
    listAbort = abort;
    publish({ ...state, entries: [], status: "loading" });
    try {
      const entries = await adapter.restore(abort.signal);
      if (!destroyed && !abort.signal.aborted) {
        publish({ ...state, entries: entries.map(entry => ({ ...entry, loadStatus: entry.loadStatus ?? "idle" })), status: entries.length ? "ready" : "idle" });
      }
    } catch {
      if (!destroyed && !abort.signal.aborted) publish({ ...state, entries: [], status: "error" });
    } finally {
      if (listAbort === abort) listAbort = undefined;
    }
  }

  return {
    destroy: () => {
      if (destroySettlement) return destroySettlement;
      destroyed = true;
      selectionRevision += 1;
      pendingSelectionId = null;
      listAbort?.abort();
      listAbort = undefined;
      listPromise = null;
      abortActiveSelection();
      acquisitionAbort?.abort();
      originalLoads.clear();
      state = { entries: [], status: 'unavailable', ...(adapter ? { acquisition: idleAcquisition() } : {}) };
      destroySettlement = Promise.allSettled([...operations]).then(() => undefined);
      return destroySettlement;
    },
    restore: () => own(restore()),
    ensureLoaded: () => own(ensureLoaded()),
    getState: () => state,
    getSelectionRevision: () => selectionRevision,
    getSelectionSignal: selection => selectionOwners.get(selection)?.signal,
    invalidateSelection: () => {
      selectionRevision += 1;
      pendingSelectionId = null;
      abortActiveSelection();
    },
    isSelectionCurrent: (selection, revision) => {
      if (destroyed) return false;
      if (typeof selection === "string") {
        return pendingSelectionId === selection &&
          (revision === undefined || selectionRevision === revision);
      }
      return selectionOwners.get(selection)?.revision === selectionRevision &&
        pendingSelectionId === selection.id;
    },
    acquireAll: () => own(acquireAll()),
    select: id => own(select(id)),
  };
}

export type SystemWallpaperEditorActions = {
  acquireAll: () => Promise<void>;
  loadCatalog: () => Promise<void>;
  /** 兼容旧 current-adapter 调用方；仅载目录，不再抓取“当前桌面”。 */
  loadCurrent: () => Promise<void>;
  restoreCurrent: (apply?: boolean) => Promise<void>;
  select: (id: string) => Promise<void>;
};

export type SystemWallpaperSelectionPipeline = {
  apply: (selection: SystemWallpaperSelection) => void;
  isAlive: () => boolean;
  onError: () => void;
  onLoadError?: (error?: unknown) => void;
  onUnavailable?: () => void;
  resolve: (selection: SystemWallpaperSelection, signal?: AbortSignal) => Promise<HTMLImageElement | null>;
};

export function createSystemWallpaperEditorActions(
  controller: SystemWallpaperController,
  pipeline: SystemWallpaperSelectionPipeline,
): SystemWallpaperEditorActions {
  let acquisitionPromise: Promise<void> | undefined;

  function acquireAll(): Promise<void> {
    if (!pipeline.isAlive() || !controller.getState().acquisition) return Promise.resolve();
    if (acquisitionPromise) return acquisitionPromise;
    const pending = controller.acquireAll().catch((error: unknown) => {
      if (pipeline.isAlive() && !isCancellation(error)) (pipeline.onLoadError ?? pipeline.onError)(error);
    }).finally(() => {
      if (acquisitionPromise === pending) acquisitionPromise = undefined;
    });
    acquisitionPromise = pending;
    return pending;
  }

  async function select(id: string): Promise<void> {
    const pending = controller.select(id);
    const revision = controller.getSelectionRevision();
    await pending.then(async (selection) => {
      if (!selection || !pipeline.isAlive() || !controller.isSelectionCurrent(id, revision)) return;
      try {
        const image = await pipeline.resolve(selection, controller.getSelectionSignal(selection));
        if (!image) {
          if (pipeline.isAlive() && controller.isSelectionCurrent(selection)) (pipeline.onLoadError ?? pipeline.onError)();
          return;
        }
        if (!pipeline.isAlive() || !controller.isSelectionCurrent(selection)) return;
        pipeline.apply(selection);
      } catch (error) {
        if (pipeline.isAlive() && controller.isSelectionCurrent(selection)) (pipeline.onLoadError ?? pipeline.onError)(error);
      }
    }, (error) => {
      if (pipeline.isAlive() && controller.isSelectionCurrent(id, revision)) (pipeline.onLoadError ?? pipeline.onError)(error);
    });
  }

  async function loadCatalog(): Promise<void> {
    const revision = controller.getSelectionRevision();
    try {
      const entries = await controller.ensureLoaded();
      if (!pipeline.isAlive() || controller.getSelectionRevision() !== revision) return;
      if (!entries.some(entry => entry.available !== false || entry.downloadable === true)) pipeline.onUnavailable?.();
    } catch {
      if (pipeline.isAlive() && controller.getSelectionRevision() === revision) pipeline.onError();
    }
  }

  return {
    acquireAll,
    loadCatalog,
    loadCurrent: loadCatalog,
    restoreCurrent: async (apply = true) => {
      const revision = controller.getSelectionRevision();
      await controller.restore();
      if (!apply || !pipeline.isAlive() || revision !== controller.getSelectionRevision()) return;
      if (controller.getState().entries.some((entry) => entry.id === SYSTEM_WALLPAPER_CURRENT_ID)) {
        await select(SYSTEM_WALLPAPER_CURRENT_ID);
      }
    },
    select,
  };
}

export function wireSystemWallpaperActions(root: HTMLElement, actions: SystemWallpaperEditorActions): void {
  root.querySelectorAll<HTMLElement>("[data-system-wallpaper]").forEach((tile) => {
    if (tile.dataset.galleryWallpaper) return;
    tile.addEventListener("click", () => {
      const id = tile.dataset.systemWallpaper;
      if (id && tile.dataset.loadStatus !== "loading") void actions.select(id);
    });
  });
  root.querySelector<HTMLButtonElement>("[data-action='acquire-system-wallpapers']")?.addEventListener("click", () => {
    void actions.acquireAll();
  });
}

function isCancellation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' &&
    ('name' in error && error.name === 'AbortError' || 'code' in error && error.code === 'cancelled'));
}

function safeAcquisitionFailure(error: unknown): Error {
  return error instanceof WallpaperGalleryError || error instanceof SystemWallpaperClientError || error instanceof SystemWallpaperAcquisitionError
    ? error
    : new Error('System wallpaper acquisition failed');
}

function isFatalGalleryFailure(error: unknown): boolean {
  return error instanceof WallpaperGalleryError &&
    (error.code === 'gallery-full' || error.code === 'storage-unavailable' || error.code === 'disposed');
}
