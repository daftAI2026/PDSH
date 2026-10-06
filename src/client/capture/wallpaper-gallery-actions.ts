/**
 * [INPUT]: 依赖本地 wallpaper-gallery 的持久素材操作、编辑器 revision 围栏与可取消图像解析端口。
 * [OUTPUT]: 提供目录读取、缓存选择、恢复、导入与移除；销毁同步撤权并join自有媒体/仓储Promise后才允许关闭连接。
 * [POS]: capture-window 图库交互控制器；集中拥有目录/选择异步版本、resolver cancellation 和 busy 状态，不承担媒体校验或 DOM。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { isGalleryWallpaperId, isUserWallpaperId } from '../../shared/wallpaper-gallery.ts';
import type { WallpaperGallery, WallpaperGallerySelection } from './wallpaper-gallery.ts';

export type WallpaperGalleryActionStatus = 'error' | 'idle' | 'loading' | 'ready';
export type WallpaperGalleryActionState = {
  assets: Awaited<ReturnType<WallpaperGallery['list']>>;
  busyId: string | null;
  status: WallpaperGalleryActionStatus;
};
export type WallpaperGalleryActionFailure = 'import' | 'remove' | 'restore' | 'select';

export type WallpaperGalleryActionOptions = {
  advanceBackgroundRevision: () => number;
  createAbortController: () => AbortController;
  gallery: WallpaperGallery;
  invalidateSystemSelection: () => void;
  isAlive: () => boolean;
  isEditing: () => boolean;
  notifyError: (error: unknown, action: WallpaperGalleryActionFailure) => void;
  onChanged: () => void;
  onRemoved: (id: string) => void;
  onRestore: (id: string, selection: WallpaperGallerySelection, image: HTMLImageElement) => void;
  onSelected: (id: string, selection: WallpaperGallerySelection, image: HTMLImageElement) => void;
  readBackgroundRevision: () => number;
  resolve: (id: string, selection: WallpaperGallerySelection, signal?: AbortSignal) => Promise<HTMLImageElement | null>;
};

export type WallpaperGalleryActions = {
  cancelSelection: () => void;
  destroy: () => Promise<void>;
  getState: () => WallpaperGalleryActionState;
  import: (file: File) => Promise<void>;
  loadInventory: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  restore: (id: string) => Promise<void>;
  select: (id: string) => Promise<void>;
};

/** 新系统选择会取消任何晚到的图库解码，并让全背景 revision 统一前进。 */
export function createSystemWallpaperSelectionAction(
  galleryActions: Pick<WallpaperGalleryActions, 'cancelSelection'>,
  advanceBackgroundRevision: () => number,
  selectSystemWallpaper: (id: string) => Promise<void>,
): (id: string) => Promise<void> {
  return id => {
    galleryActions.cancelSelection();
    advanceBackgroundRevision();
    return selectSystemWallpaper(id);
  };
}

export function createWallpaperGalleryActions(options: WallpaperGalleryActionOptions): WallpaperGalleryActions {
  let assets: WallpaperGalleryActionState['assets'] = [];
  let status: WallpaperGalleryActionStatus = 'idle';
  let busyId: string | null = null;
  let listRevision = 0;
  let disposed = false;
  let selectionAbort: AbortController | undefined;
  let restoreAbort: AbortController | undefined;
  let destroySettlement: Promise<void> | undefined;
  const operations = new Set<Promise<unknown>>();

  function own<T>(operation: Promise<T>): Promise<T> {
    operations.add(operation);
    void operation.then(() => operations.delete(operation), () => operations.delete(operation));
    return operation;
  }

  function alive(): boolean {
    return !disposed && options.isAlive();
  }

  function publish(): void {
    if (alive()) options.onChanged();
  }

  function getState(): WallpaperGalleryActionState {
    return { assets, busyId, status };
  }

  function cancelSelection(): void {
    selectionAbort?.abort();
    selectionAbort = undefined;
    restoreAbort?.abort();
    restoreAbort = undefined;
    const hadBusyItem = busyId !== null;
    busyId = null;
    if (hadBusyItem) publish();
  }

  function startSelection(id: string): { abort: AbortController; revision: number } {
    cancelSelection();
    const revision = options.advanceBackgroundRevision();
    options.invalidateSystemSelection();
    const abort = options.createAbortController();
    selectionAbort = abort;
    busyId = id;
    publish();
    return { abort, revision };
  }

  function isCurrent(revision: number, abort: AbortController): boolean {
    return alive() && !abort.signal.aborted && options.readBackgroundRevision() === revision;
  }

  async function loadInventory(): Promise<void> {
    if (!alive()) return;
    const revision = ++listRevision;
    status = 'loading';
    publish();
    try {
      const next = await options.gallery.list();
      if (!alive() || revision !== listRevision) return;
      assets = next;
      status = 'ready';
    } catch {
      if (!alive() || revision !== listRevision) return;
      status = 'error';
    }
    publish();
  }

  async function select(id: string): Promise<void> {
    if (!alive() || !isGalleryWallpaperId(id)) return;
    const { abort, revision } = startSelection(id);
    try {
      const selection = await options.gallery.load(id, abort.signal);
      if (!isCurrent(revision, abort) || !options.isEditing()) return;
      const image = await options.resolve(id, selection, abort.signal);
      if (!image || !isCurrent(revision, abort) || !options.isEditing()) return;
      options.onSelected(id, selection, image);
    } catch (error) {
      if (isCurrent(revision, abort)) options.notifyError(error, 'select');
    } finally {
      if (selectionAbort === abort) {
        selectionAbort = undefined;
        busyId = null;
        publish();
      }
    }
  }

  async function importFile(file: File): Promise<void> {
    if (!alive()) return;
    const { abort, revision } = startSelection('importing');
    try {
      const asset = await options.gallery.import(file, abort.signal);
      if (!isCurrent(revision, abort) || !options.isEditing()) return;
      const selection = await options.gallery.load(asset.id, abort.signal);
      if (!isCurrent(revision, abort) || !options.isEditing()) return;
      const image = await options.resolve(asset.id, selection, abort.signal);
      if (!image || !isCurrent(revision, abort) || !options.isEditing()) return;
      void own(loadInventory());
      options.onSelected(asset.id, selection, image);
    } catch (error) {
      if (isCurrent(revision, abort) && options.isEditing()) options.notifyError(error, 'import');
    } finally {
      if (selectionAbort === abort) {
        selectionAbort = undefined;
        busyId = null;
        publish();
      }
    }
  }

  async function restore(id: string): Promise<void> {
    if (!alive() || !isGalleryWallpaperId(id)) return;
    restoreAbort?.abort();
    const abort = options.createAbortController();
    restoreAbort = abort;
    const revision = options.readBackgroundRevision();
    try {
      const selection = await options.gallery.restore(id, abort.signal);
      if (!selection || !alive() || abort.signal.aborted || revision !== options.readBackgroundRevision() || !options.isEditing()) return;
      const image = await options.resolve(id, selection, abort.signal);
      if (!image || !alive() || abort.signal.aborted || revision !== options.readBackgroundRevision() || !options.isEditing()) return;
      options.onRestore(id, selection, image);
    } catch (error) {
      if (alive() && !abort.signal.aborted && revision === options.readBackgroundRevision()) options.notifyError(error, 'restore');
    } finally {
      if (restoreAbort === abort) restoreAbort = undefined;
    }
  }

  async function remove(id: string): Promise<void> {
    if (!alive() || !isUserWallpaperId(id)) return;
    cancelSelection();
    options.advanceBackgroundRevision();
    options.invalidateSystemSelection();
    busyId = id;
    publish();
    try {
      await options.gallery.remove(id);
      await loadInventory();
      if (alive()) options.onRemoved(id);
    } catch (error) {
      if (alive()) options.notifyError(error, 'remove');
    } finally {
      busyId = null;
      publish();
    }
  }

  function destroy(): Promise<void> {
    if (destroySettlement) return destroySettlement;
    disposed = true;
    listRevision++;
    selectionAbort?.abort();
    selectionAbort = undefined;
    restoreAbort?.abort();
    restoreAbort = undefined;
    assets = [];
    busyId = null;
    status = 'idle';
    destroySettlement = Promise.allSettled([...operations]).then(() => undefined);
    return destroySettlement;
  }

  return {
    cancelSelection,
    destroy,
    getState,
    import: file => own(importFile(file)),
    loadInventory: () => own(loadInventory()),
    remove: id => own(remove(id)),
    restore: id => own(restore(id)),
    select: id => own(select(id)),
  };
}
