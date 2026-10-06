/**
 * [INPUT]: 依赖模型、受控原生 Tabs、视口/预算/取消、背景与 Client IndexedDB 图库包装、DOM 模板及已接受保存配置
 * [OUTPUT]: 提供工作台编辑/合成/导出生命周期；图片首次访问/失败重试读本地库存，Tab复用就绪/在途库存，显式批获取不改变背景，关闭等待自有I/O结算后关仓
 * [POS]: capture-window 总协调器；图库选择 revision 与系统批获取分开拥有生命周期，选择/导出 signal 贯穿解码，媒体入库与偏好 ID 分离
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { captureBackgroundMode, createCaptureBackgroundMemory, type CaptureBackgroundMode } from "./background-modes.ts";
import type { CaptureBackgroundTabsMount, CaptureBackgroundTabsController } from "./background-tabs.tsx";
import {
  syncCaptureBackgroundControls,
  wireCaptureBackgroundActions,
} from "./background-controls.ts";
import { captureWindowCopy, type CaptureWindowCopy } from "./copy.ts";
import { wirePaddingSlider } from "./padding-slider.ts";
import { captureOutputSize, renderCaptureToCanvas } from "./compositor.ts";
import type { CaptureMaterialAppearance } from './material.ts';
import { createCaptureBackgroundImageStore } from "./backgrounds.ts";
import {
  syncCaptureColorPopover,
  type CaptureColorTarget,
  wireCaptureColorPopovers,
} from "./color-popover.ts";
import { createInspectorScroll } from "./inspector-scroll.ts";
import {
  applyCaptureCommand,
  CAPTURE_MAX_ZOOM,
  CAPTURE_MIN_ZOOM,
  type CaptureCandidate,
  createCaptureWindowState,
  type CaptureWindowCommand,
  type CaptureWindowState,
} from "./model.ts";
import { createCaptureEditorViewport, type CaptureEditorViewportController } from "./editor-viewport.ts";
import {
  applyCapturePreferences,
  type CapturePreferenceStorage,
  isCapturePreferenceCommand,
  loadCapturePreferences,
  saveCapturePreferences,
  shouldRestoreCurrentWallpaper,
} from "./preferences.ts";
import { ROOT_ENTRY_ID } from '../../shared/components.ts';
import {
  isGalleryWallpaperId,
  wallpaperGalleryDatabaseName,
  WallpaperGalleryError,
} from '../../shared/wallpaper-gallery.ts';
import { createWallpaperGalleryStore } from './wallpaper-gallery-store.ts';
import { createWallpaperGallery, type WallpaperGalleryStore } from './wallpaper-gallery.ts';
import { createSystemWallpaperSelectionAction, createWallpaperGalleryActions } from './wallpaper-gallery-actions.ts';
import { resolveSelectedCaptureRegions } from "./redactions.ts";
import { mountCaptureRegionLayer } from "./regions.ts";
import {
  createSystemWallpaperController,
  createSystemWallpaperEditorActions,
  type SystemWallpaperAdapter,
} from "./system-wallpapers.ts";
import {
  captureToolbarTemplate,
  captureWindowTemplate,
  rememberCaptureWindowRender,
  restoreCaptureWindowRender,
} from "./view.ts";
import { wireKeyboard } from "./editor-keyboard.ts";
import { encodeCapture, handCaptureToDownload } from './export.ts';
import { isCaptureExportSizeAllowed, captureExportFileName, resolveCaptureExportPreferences, type CaptureExportPreferences } from '../../shared/capture-export.ts';
export type CaptureWindowEditorOptions = {
  mountBackgroundTabs?: CaptureBackgroundTabsMount;
  exportPreferences?: CaptureExportPreferences;
  fileMetadata?: { title: string; capturedAt: Date };
  materialAppearance?: CaptureMaterialAppearance;
  sourceScaleFactor?: number;
  automaticRegions?: CaptureCandidate[];
  initialState?: CaptureWindowState;
  locale?: string;
  onClose?: () => void;
  onCopy?: (png: Blob) => Promise<void>;
  onNotify?: (message: string, tone?: 'success') => void;
  onRetake?: (
    revision: number,
    privacyEnabled: boolean,
  ) => CaptureWindowRetake | Promise<CaptureWindowRetake>;
  onSave?: (image: Blob, suggestedName: string, directory: string, behavior: CaptureExportPreferences['saveBehavior'], signal: AbortSignal, metadata: { format: CaptureExportPreferences['saveFormat']; width: number; height: number; title: string; capturedAt: string }) => Promise<"cancelled" | "saved">;
  preferenceStorage?: CapturePreferenceStorage | null;
  galleryStore?: WallpaperGalleryStore;
  source: HTMLCanvasElement;
  systemWallpapers?: SystemWallpaperAdapter;
};
export type CaptureWindowRetake = {
  fileMetadata?: { title: string; capturedAt: Date };
  materialAppearance?: CaptureMaterialAppearance;
  sourceScaleFactor?: number;
  automaticRegions: CaptureCandidate[];
  source: HTMLCanvasElement;
};
export type CaptureWindowEditorController = {
  destroy: () => void;
  getState: () => CaptureWindowState;
};
let backgroundTabsSequence = 0;

export function mountCaptureWindowEditor(
  host: HTMLElement,
  options: CaptureWindowEditorOptions,
): CaptureWindowEditorController {
  let source = options.source;
  let fileMetadata = options.fileMetadata ?? { title: host.ownerDocument.title, capturedAt: new Date() };
  // 外观属于本次取像元数据，不随编辑器/宿主后续主题切换重算、不持久化。
  let materialAppearance = options.materialAppearance ?? (host.ownerDocument.querySelector('[data-ds-dark-theme]') ? 'dark' : 'light');
  const preferenceStorage = options.preferenceStorage === undefined
    ? window.localStorage
    : options.preferenceStorage;
  const defaultState = createCaptureWindowState({
    height: source.height,
    scaleFactor: options.sourceScaleFactor ?? window.devicePixelRatio,
    width: source.width,
  });
  const initialPreferences = preferenceStorage ? loadCapturePreferences(preferenceStorage) : null;
  let pendingGalleryPreferenceId = !options.initialState && initialPreferences?.background.kind === 'wallpaper'
    && isGalleryWallpaperId(initialPreferences.background.systemId)
    ? initialPreferences.background.systemId
    : undefined;
  let state = options.initialState ?? (initialPreferences
    ? applyCapturePreferences(defaultState, initialPreferences)
    : defaultState);
  const backgroundImages = createCaptureBackgroundImageStore();
  const backgroundMemory = createCaptureBackgroundMemory(state.lastOpaqueBackground);
  backgroundMemory.remember(state.background);
  const backgroundTabsId = `pdsh-capture-background-${++backgroundTabsSequence}`;
  let backgroundTabs: CaptureBackgroundTabsController | undefined;
  let backgroundRevision = 0;
  let lastBackgroundColor = state.background.kind === "color" ? state.background.color : "#2B3440";
  let manualRegionSequence = 0;
  let destroyed = false;
  const isMacOS = navigator.platform.startsWith("Mac");
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const copy = captureWindowCopy(options.locale ?? document.documentElement.lang ?? navigator.language);
  const galleryStore = options.galleryStore ?? createWallpaperGalleryStore({ name: wallpaperGalleryDatabaseName(ROOT_ENTRY_ID) });
  const wallpaperGallery = createWallpaperGallery({
    document: host.ownerDocument,
    locale: () => options.locale ?? document.documentElement.lang ?? navigator.language,
    store: galleryStore,
    systemAdapter: options.systemWallpapers,
  });
  let automaticCandidates = options.automaticRegions ?? [];
  const root = document.createElement("div");
  root.className = "pdsh-capture-root";
  root.setAttribute("data-pdsh-capture", "true");
  root.setAttribute("data-pdsh-capture-hide", "");
  root.setAttribute("data-state", "editing");
  host.append(root);
  const inspectorScroll = createInspectorScroll(root);
  const systemWallpaperController = createSystemWallpaperController(wallpaperGallery.systemAdapter, () => {
    if (!destroyed && root.dataset.state === "editing") render();
  });
  const systemWallpaperActions = createSystemWallpaperEditorActions(systemWallpaperController, {
    apply: ({ dataUrl, id }) => {
      dispatch({ background: { dataUrl, kind: "wallpaper", systemId: id }, kind: "set-background" });
    },
    isAlive: () => !destroyed,
    onError: () => notify(copy.systemWallpapersError),
    onLoadError: error => notifyGalleryError(error, copy.systemWallpaperLoadError),
    onUnavailable: () => notify(copy.systemWallpapersUnavailable),
    resolve: ({ dataUrl, id }, signal) => backgroundImages.resolve({
      dataUrl,
      kind: "wallpaper",
      systemId: id,
    }, signal),
  });
  const galleryActions = createWallpaperGalleryActions({
    advanceBackgroundRevision: () => ++backgroundRevision,
    createAbortController: () => new window.AbortController(),
    gallery: wallpaperGallery,
    invalidateSystemSelection: () => systemWallpaperController.invalidateSelection(),
    isAlive: () => !destroyed,
    isEditing: () => root.dataset.state === "editing",
    notifyError: (error, action) => notifyGalleryError(error,
      action === 'import' ? copy.wallpaperUnreadable
        : action === 'select' ? copy.systemWallpaperLoadError
          : copy.galleryUnavailable),
    onChanged: () => {
      if (!destroyed && root.dataset.state === "editing") render();
    },
    onRemoved: id => {
      backgroundMemory.forgetWallpaper(id);
      const selected = state.background.kind === 'wallpaper' && state.background.systemId === id;
      const wasPendingPreference = pendingGalleryPreferenceId === id;
      if (!selected && !wasPendingPreference) return;
      pendingGalleryPreferenceId = undefined;
      dispatch({ kind: 'set-background', background: { id: 'sea', kind: 'preset' } });
    },
    onRestore: (id, selection, image) => {
      backgroundImages.remember(selection.dataUrl, image);
      pendingGalleryPreferenceId = undefined;
      const background = { dataUrl: selection.dataUrl, kind: 'wallpaper' as const, systemId: id };
      state = applyCaptureCommand(state, { kind: 'set-background', background });
      backgroundMemory.remember(background);
      refreshEditor({ kind: 'set-background', background });
    },
    onSelected: (id, selection, image) => {
      backgroundImages.remember(selection.dataUrl, image);
      pendingGalleryPreferenceId = undefined;
      dispatch({ kind: 'set-background', background: { dataUrl: selection.dataUrl, kind: 'wallpaper', systemId: id } });
    },
    readBackgroundRevision: () => backgroundRevision,
    resolve: (id, selection, signal) => backgroundImages.resolve({ dataUrl: selection.dataUrl, kind: 'wallpaper', systemId: id }, signal),
  });
  const selectSystemWallpaper = createSystemWallpaperSelectionAction(
    galleryActions,
    () => ++backgroundRevision,
    id => systemWallpaperActions.select(id),
  );
  const editorViewport = createCaptureEditorViewport({
    createManualRegionId: () => `manual-${++manualRegionSequence}`,
    dispatchRegion,
    readState: () => state,
    root,
    setZoom: setViewportZoom,
  });
  const resizeObserver = new ResizeObserver(() => {
    if (!root.querySelector<HTMLCanvasElement>(".pdsh-capture-canvas")) return;
    if (!editorViewport.isAtDefault()) {
      resetView();
    }
    editorViewport.fit();
  });
  resizeObserver.observe(root);
  const unwireColorPopovers = wireCaptureColorPopovers(root, {
    label: (target) => target === "background" ? copy.custom : copy.maskColor,
    onChange: changeColor,
    onOpen: (target) => {
      if (target === "background") {
        dispatch({
          background: { color: lastBackgroundColor, kind: "color" },
          kind: "set-background",
        });
      }
    },
    readColor: (target) => target === "background" ? lastBackgroundColor : state.solidColor,
  });
  function outputFits(candidate: CaptureWindowState): boolean {
    const size = captureOutputSize(candidate.source, candidate.padding);
    return isCaptureExportSizeAllowed(size.width, size.height);
  }
  function fitRestoredPadding(): void {
    if (outputFits(state)) return;
    state = { ...state, padding: defaultState.padding };
    notify(copy.exportTooLarge);
  }
  fitRestoredPadding();
  function applyEditorCommand(command: CaptureWindowCommand): boolean {
    if ((command.kind === "set-tool" && command.tool !== state.tool) ||
        (command.kind === "set-redaction-source" && command.source !== state.redactionSource)) {
      editorViewport.cancelGesture();
    }
    if (command.kind === "set-padding") {
      if (!outputFits(applyCaptureCommand(state, command))) {
        const input = root.querySelector<HTMLInputElement>("[data-input='padding']");
        if (input) { input.value = String(state.padding); input.setAttribute("aria-valuetext", `${state.padding}%`); }
        notify(copy.exportTooLarge);
        return false;
      }
      editorViewport.resetPan();
    }
    state = applyCaptureCommand(state, command);
    return true;
  }
  function dispatch(command: CaptureWindowCommand): void {
    if (command.kind === "set-zoom") {
      setViewportZoom(command.zoom);
      return;
    }
    if (command.kind === "set-background" || command.kind === "set-transparent-background") {
      backgroundRevision++;
      systemWallpaperController.invalidateSelection();
      galleryActions.cancelSelection();
      if (command.kind === 'set-background') pendingGalleryPreferenceId = undefined;
    }
    if (!applyEditorCommand(command)) return;
    backgroundMemory.remember(state.background);
    if (preferenceStorage && isCapturePreferenceCommand(command)) {
      const preferenceState = pendingGalleryPreferenceId
        ? { ...state, background: { dataUrl: '', kind: 'wallpaper' as const, systemId: pendingGalleryPreferenceId } }
        : state;
      saveCapturePreferences(preferenceStorage, preferenceState);
    }
    refreshEditor(command);
    if (command.kind === "set-background" || command.kind === "set-transparent-background") {
      hydrateBackground(state.background);
    }
  }
  function preview(command: CaptureWindowCommand): void {
    if (!applyEditorCommand(command)) return;
    refreshEditor(command);
  }
  function dispatchRegion(command: CaptureWindowCommand): void {
    if (destroyed || root.dataset.state !== "editing") return;
    if (
      (command.kind === "select-automatic-region" || command.kind === "remove-region") &&
      (state.tool !== "redact" || state.redactionSource !== "auto")
    ) return;
    state = applyCaptureCommand(state, command);
    renderCanvas();
    updateHistoryControls(root, state);
  }
  function setViewportZoom(zoom: number): void {
    state = applyCaptureCommand(state, { kind: "set-zoom", zoom });
    syncZoomControls(root, state);
  }
  const exportAbort = new window.AbortController();
  function close(): void {
    if (destroyed) return;
    destroyed = true;
    exportAbort.abort();
    backgroundRevision++;
    backgroundTabs?.destroy();
    editorViewport.destroy();
    const systemWallpaperSettlement = systemWallpaperController.destroy();
    const gallerySettlement = galleryActions.destroy();
    backgroundImages.dispose();
    void Promise.all([systemWallpaperSettlement, gallerySettlement]).then(() => wallpaperGallery.close(), () => wallpaperGallery.close());
    resizeObserver.disconnect();
    inspectorScroll.destroy();
    unwireColorPopovers();
    root.remove();
    if (previousFocus?.isConnected) previousFocus.focus();
    options.onClose?.();
  }
  function notify(message: string, tone?: 'success'): void {
    options.onNotify?.(message, tone);
  }
  function notifyGalleryError(error: unknown, fallback = copy.galleryUnavailable): void {
    if (error instanceof WallpaperGalleryError) {
      if (error.code === 'gallery-full') notify(copy.galleryFull);
      else if (error.code === 'invalid-asset') notify(copy.wallpaperUnreadable);
      else if (error.code !== 'disposed') notify(copy.galleryUnavailable);
      return;
    }
    if (!(error instanceof DOMException && error.name === 'AbortError')) notify(fallback);
  }
  function changeColor(target: CaptureColorTarget, color: string): void {
    if (target === "background") {
      lastBackgroundColor = color;
      dispatch({ background: { color, kind: "color" }, kind: "set-background" });
      return;
    }
    dispatch({ color, kind: "set-solid-color" });
  }
  function setPhase(phase: "composing" | "saving" | "editing" | "recapturing"): void {
    if (phase !== "editing") editorViewport.cancelGesture();
    root.setAttribute("data-state", phase);
    root.toggleAttribute("aria-busy", phase !== "editing");
    backgroundTabs?.update(captureBackgroundMode(state.background), phase !== "editing");
    if (phase === "editing") {
      render();
      return;
    }
    for (const control of root.querySelectorAll<HTMLInputElement | HTMLButtonElement>(
      "button, input",
    )) {
      control.disabled = true;
    }
  }
  function resetView(): void {
    editorViewport.reset();
  }
  function refreshEditor(command: CaptureWindowCommand): void {
    root.setAttribute("data-tool", state.tool);
    const stage = root.querySelector<HTMLElement>(".pdsh-capture-stage");
    if (stage) stage.dataset.tool = state.tool;
    const overlayOnly = command.kind === "set-tool" ||
      command.kind === "set-redaction-source" ||
      command.kind === "set-redaction-style";
    if (overlayOnly) refreshToolbar();
    syncEditorControls(root, state, copy, lastBackgroundColor);
    backgroundTabs?.update(captureBackgroundMode(state.background), root.dataset.state !== "editing");
    const canvas = root.querySelector<HTMLCanvasElement>(".pdsh-capture-canvas");
    if (overlayOnly && canvas) {
      mountCaptureRegionLayer(root.querySelector(".pdsh-capture-canvas-frame"), canvas, currentRenderState(), automaticCandidates, copy, dispatchRegion);
    } else {
      renderCanvas();
    }
    updateHistoryControls(root, state);
  }
  function refreshToolbar(): void {
    const toolbar = root.querySelector<HTMLElement>(".pdsh-capture-toolbar");
    if (!toolbar) return;
    const memory = rememberCaptureWindowRender(root);
    const template = document.createElement("template");
    template.innerHTML = captureToolbarTemplate(state, copy).trim();
    const replacement = template.content.firstElementChild;
    if (!(replacement instanceof HTMLElement)) return;
    toolbar.replaceWith(replacement);
    wireToolbarActions(root, dispatch, dispatchRegion, editorViewport);
    restoreCaptureWindowRender(root, memory);
  }
  function selectBackgroundMode(mode: CaptureBackgroundMode): void {
    if (destroyed || root.dataset.state !== "editing" || mode === captureBackgroundMode(state.background)) return;
    unwireColorPopovers.close();
    dispatch({ kind: "set-background", background: backgroundMemory.read(mode) });
    if (mode === "wallpapers") {
      // +--- 切换不是库存失效；首次访问或读取失败才需要重读。 ---+
      const { status } = galleryActions.getState();
      if (status === 'idle' || status === 'error') void galleryActions.loadInventory();
    }
  }
  function render(): void {
    if (destroyed) return;
    const galleryState = galleryActions.getState();
    const renderMemory = rememberCaptureWindowRender(root);
    backgroundTabs?.destroy();
    backgroundTabs = undefined;
    unwireColorPopovers.close();
    root.innerHTML = captureWindowTemplate(state, copy, {
      backgroundTabsId,
      lastBackgroundColor,
      systemWallpapers: systemWallpaperController.getState(),
      galleryAssets: galleryState.assets,
      galleryStatus: galleryState.status,
      galleryBusyId: galleryState.busyId,
    });
    const tabsContainer = root.querySelector<HTMLElement>("[data-background-tabs]");
    if (tabsContainer && options.mountBackgroundTabs) backgroundTabs = options.mountBackgroundTabs(tabsContainer, {
      id: backgroundTabsId, value: captureBackgroundMode(state.background), label: copy.background,
      labels: { none: copy.backgroundTabs.none, "plain-color": copy.backgroundTabs.color,
        gradients: copy.backgroundTabs.gradient, wallpapers: copy.backgroundTabs.image },
      disabled: root.dataset.state !== "editing", onChange: selectBackgroundMode,
    });
    root.setAttribute("data-tool", state.tool);
    root.querySelector<HTMLElement>(".pdsh-capture-backdrop")?.addEventListener("click", close);
    root.querySelector<HTMLElement>("[data-action='close']")?.addEventListener("click", close);
    renderCanvas();
    wireToolbarActions(root, dispatch, dispatchRegion, editorViewport);
    wireCaptureBackgroundActions(root, {
      dispatch,
      pickWallpaper: () => root.querySelector<HTMLInputElement>("[data-input='wallpaper']")?.click(),
      gallery: {
        select: id => { void galleryActions.select(id); },
        remove: id => { void galleryActions.remove(id); },
      },
      setBackgroundColor: (color) => {
        lastBackgroundColor = color;
        dispatch({ background: { color, kind: "color" }, kind: "set-background" });
      },
      systemWallpapers: {
        ...systemWallpaperActions,
        acquireAll: async () => {
          if (destroyed || root.dataset.state !== 'editing') return;
          await systemWallpaperActions.acquireAll();
          if (!destroyed) await galleryActions.loadInventory();
        },
        select: id => selectSystemWallpaper(id),
      },
    });
    wireInputs(root, dispatch, preview, file => galleryActions.import(file), setPrivacy);
    wireKeyboard(root, state, dispatchRegion, close, exportCopy);
    root.querySelector<HTMLElement>("[data-action='retake']")?.addEventListener("click", () => {
      void retake();
    });
    root.querySelector<HTMLElement>("[data-action='copy']")?.addEventListener("click", () => {
      void exportCopy();
    });
    root.querySelector<HTMLElement>("[data-action='save']")?.addEventListener("click", () => {
      void exportSave();
    });
    restoreCaptureWindowRender(root, renderMemory);
    inspectorScroll.refresh();
  }
  function renderCanvas(): HTMLCanvasElement {
    const rendered = renderCurrentCapture(backgroundImages.read(state.background));
    rendered.className = "pdsh-capture-canvas";
    rendered.setAttribute("data-capture-output", "true");
    const frame = root.querySelector<HTMLElement>(".pdsh-capture-canvas-frame");
    const current = frame?.querySelector<HTMLCanvasElement>(".pdsh-capture-canvas");
    const canvas = current ?? rendered;
    if (current) {
      current.width = rendered.width;
      current.height = rendered.height;
      current.getContext("2d")?.drawImage(rendered, 0, 0);
    } else {
      frame?.prepend(rendered);
    }
    mountCaptureRegionLayer(frame, canvas, currentRenderState(), automaticCandidates, copy, dispatchRegion);
    const paddingValue = root.querySelector<HTMLElement>("[data-value='padding']");
    if (paddingValue) paddingValue.textContent = `${state.padding}%`;
    const stage = root.querySelector<HTMLElement>(".pdsh-capture-stage");
    if (stage && frame) editorViewport.bind(stage, frame, canvas);
    return canvas;
  }
  async function retake(privacyEnabled = state.privacyEnabled): Promise<boolean> {
    setPhase("recapturing");
    const revision = state.sourceRevision + 1;
    try {
      const snapshot = await options.onRetake?.(revision, privacyEnabled);
      if (!snapshot) throw new Error("Screenshot not returned");
      if (destroyed) return false;
      source = snapshot.source;
      fileMetadata = snapshot.fileMetadata ?? fileMetadata;
      materialAppearance = snapshot.materialAppearance ?? materialAppearance;
      automaticCandidates = snapshot.automaticRegions;
      state = applyCaptureCommand(state, {
        kind: "retake",
        source: {
          height: source.height,
          scaleFactor: snapshot.sourceScaleFactor ?? state.source.scaleFactor,
          width: source.width,
        },
      });
      fitRestoredPadding();
      if (privacyEnabled !== state.privacyEnabled) dispatch({ enabled: privacyEnabled, kind: "set-privacy" });
      resetView();
      return true;
    } catch {
      if (!destroyed) notify(copy.retakeFailed);
      return false;
    } finally {
      if (!destroyed) setPhase("editing");
    }
  }
  async function setPrivacy(enabled: boolean): Promise<void> {
    if (enabled !== state.privacyEnabled) await retake(enabled);
  }
  async function exportCopy(): Promise<void> {
    if (destroyed || root.getAttribute("data-state") !== "editing") return;
    setPhase("composing");
    try {
      const canvas = renderCurrentCapture(await backgroundImages.resolve(state.background, exportAbort.signal));
      const blob = await encodeCapture(canvas);
      if (destroyed) return;
      if (options.onCopy) await options.onCopy(blob);
      else await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      if (destroyed) return;
      notify(copy.copied, 'success');
      close();
    } catch {
      if (destroyed) return;
      setPhase("editing");
      notify(copy.clipboardUnavailable);
    }
  }
  async function exportSave(): Promise<void> {
    if (destroyed || root.getAttribute("data-state") !== "editing") return;
    setPhase("composing");
    try {
      const canvas = renderCurrentCapture(await backgroundImages.resolve(state.background, exportAbort.signal));
      const preferences = resolveCaptureExportPreferences(options.exportPreferences);
      const blob = await encodeCapture(canvas, preferences.saveFormat);
      if (destroyed) return;
      const suggestedName = captureExportFileName(preferences, fileMetadata.capturedAt, { title: fileMetadata.title, width: canvas.width, height: canvas.height });
      if (options.onSave) {
        setPhase("saving");
        const result = await options.onSave(blob, suggestedName, preferences.saveDirectory, preferences.saveBehavior, exportAbort.signal, {format: preferences.saveFormat, width: canvas.width, height: canvas.height, title: fileMetadata.title, capturedAt: fileMetadata.capturedAt.toISOString()});
        if (destroyed) return;
        if (result === "cancelled") {
          setPhase("editing");
          return;
        }
        if (result !== "saved") throw new Error("Save receipt unavailable");
      } else {
        if (preferences.saveBehavior === 'direct') throw new Error('Direct save provider unavailable');
        handCaptureToDownload(root.ownerDocument, blob, suggestedName);
        setPhase('editing');
        notify(copy.saveStarted, 'success');
        return;
      }
      notify(copy.saved, 'success');
      close();
    } catch (error) {
      if (destroyed) return;
      setPhase("editing");
      notify(error instanceof Error && error.message === 'runtime-not-current' ? copy.runtimeOutdated
        : error instanceof Error && error.message === 'save-unconfirmed' ? copy.saveUnconfirmed : copy.saveFailed);
    }
  }
  function hydrateBackground(background: CaptureWindowState["background"]): void {
    backgroundImages.hydrate(background, () => {
      if (!destroyed) renderCanvas();
    }, () => {
      if (background.kind === "wallpaper") notify(copy.wallpaperUnreadable);
    });
  }
  function currentRenderState(): CaptureWindowState {
    return {
      ...state,
      regions: resolveSelectedCaptureRegions(state.regions, automaticCandidates),
    };
  }
  function renderCurrentCapture(backgroundImage: CanvasImageSource | null): HTMLCanvasElement {
    return renderCaptureToCanvas(source, currentRenderState(), { backgroundImage, isMacOS, materialAppearance });
  }
  render();
  if (captureBackgroundMode(state.background) === 'wallpapers') void galleryActions.loadInventory();
  void systemWallpaperActions.restoreCurrent(shouldRestoreCurrentWallpaper(preferenceStorage));
  if (pendingGalleryPreferenceId) void galleryActions.restore(pendingGalleryPreferenceId);
  hydrateBackground(state.background);
  return {
    destroy: close,
    getState: () => state,
  };
}
function wireToolbarActions(
  root: HTMLElement,
  dispatch: (command: CaptureWindowCommand) => void,
  dispatchRegion: (command: CaptureWindowCommand) => void,
  viewport: CaptureEditorViewportController,
): void {
  const actions: Record<string, CaptureWindowCommand> = {
    "source-auto": { kind: "set-redaction-source", source: "auto" },
    "source-draw": { kind: "set-redaction-source", source: "draw" },
    "tool-move": { kind: "set-tool", tool: "move" },
    "tool-redact": { kind: "set-tool", tool: "redact" },
  };
  for (const [action, command] of Object.entries(actions)) {
    root.querySelector<HTMLElement>(`[data-action='${action}']`)?.addEventListener("click", () => {
      dispatch(command);
    });
  }
  const regionActions: Record<string, CaptureWindowCommand> = {
    redo: { kind: "redo" },
    undo: { kind: "undo" },
  };
  for (const [action, command] of Object.entries(regionActions)) {
    root.querySelector<HTMLElement>(`[data-action='${action}']`)?.addEventListener("click", () => {
      dispatchRegion(command);
    });
  }
  for (const style of ["mosaic", "blur", "solid"] as const) {
    root.querySelector<HTMLElement>(`[data-action='style-${style}']`)?.addEventListener("click", () => {
      dispatch({ kind: "set-redaction-style", style });
    });
  }
  root.querySelector<HTMLElement>("[data-action='zoom-in']")?.addEventListener("click", () => {
    viewport.zoomByFactor(1.25);
  });
  root.querySelector<HTMLElement>("[data-action='zoom-out']")?.addEventListener("click", () => {
    viewport.zoomByFactor(1 / 1.25);
  });
  root.querySelector<HTMLElement>("[data-action='zoom-reset']")?.addEventListener("click", () => {
    viewport.reset();
  });
  root.querySelector<HTMLElement>("[data-action='zoom-fit']")?.addEventListener("click", () => {
    viewport.reset();
  });
}
function wireInputs(
  root: HTMLElement,
  dispatch: (command: CaptureWindowCommand) => void,
  preview: (command: CaptureWindowCommand) => void,
  loadWallpaper: (file: File) => Promise<void>,
  setPrivacy: (enabled: boolean) => Promise<void>,
): void {
  root.querySelector<HTMLInputElement>("[data-input='privacy']")?.addEventListener("change", (event) => {
    void setPrivacy((event.currentTarget as HTMLInputElement).checked);
  });
  root.querySelector<HTMLInputElement>("[data-input='shadow']")?.addEventListener("change", (event) => {
    dispatch({ kind: "set-shadow", shadow: (event.currentTarget as HTMLInputElement).checked });
  });
  const padding = root.querySelector<HTMLInputElement>("[data-input='padding']");
  if (padding) wirePaddingSlider(padding,
    value => preview({ kind: "set-padding", padding: value }),
    value => dispatch({ kind: "set-padding", padding: value }),
  );
  root.querySelector<HTMLInputElement>("[data-input='wallpaper']")?.addEventListener("change", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void loadWallpaper(file);
  });
}
function syncEditorControls(
  root: HTMLElement,
  state: CaptureWindowState,
  copy: CaptureWindowCopy,
  lastBackgroundColor: string,
): void {
  syncZoomControls(root, state);
  syncCaptureBackgroundControls(root, state, lastBackgroundColor);

  const padding = root.querySelector<HTMLInputElement>("[data-input='padding']");
  const paddingValue = root.querySelector<HTMLElement>("[data-value='padding']");
  if (padding) padding.value = String(state.padding);
  if (paddingValue) paddingValue.textContent = `${state.padding}%`;

  const shadow = root.querySelector<HTMLInputElement>("[data-input='shadow']");
  const privacy = root.querySelector<HTMLInputElement>("[data-input='privacy']");
  if (shadow) shadow.checked = state.shadow;
  if (privacy) privacy.checked = state.privacyEnabled;

  syncCaptureColorPopover(root, "solid", state.solidColor);
}

function syncZoomControls(root: HTMLElement, state: CaptureWindowState): void {
  const zoom = root.querySelector<HTMLElement>(".pdsh-capture-zoom-reset");
  if (zoom) zoom.textContent = `${Math.round(state.zoom * 100)}%`;
  const zoomOut = root.querySelector<HTMLButtonElement>("[data-action='zoom-out']");
  const zoomIn = root.querySelector<HTMLButtonElement>("[data-action='zoom-in']");
  if (zoomOut) zoomOut.disabled = state.zoom <= CAPTURE_MIN_ZOOM;
  if (zoomIn) zoomIn.disabled = state.zoom >= CAPTURE_MAX_ZOOM;
}

function updateHistoryControls(root: HTMLElement, state: CaptureWindowState): void {
  const undo = root.querySelector<HTMLButtonElement>("[data-action='undo']");
  const redo = root.querySelector<HTMLButtonElement>("[data-action='redo']");
  if (undo) undo.disabled = state.history.past.length === 0;
  if (redo) redo.disabled = state.history.future.length === 0;
}
