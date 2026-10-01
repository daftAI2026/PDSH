/**
 * [INPUT]: 依赖状态机、分配前输出预算、请求级取消、键盘适配、背景资源、冻结外观、DOM 模板与已接受的保存方式/目录/格式/命名偏好
 * [OUTPUT]: 提供截图编辑器挂载、生命周期控制及唯一状态向渲染与导出边界的编排
 * [POS]: capture-window 的交互总协调器，系统壁纸异步细节下沉至 system-wallpapers.ts
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import {
  syncCaptureBackgroundControls,
  wireCaptureBackgroundActions,
} from "./background-controls.ts";
import { captureWindowCopy, type CaptureWindowCopy } from "./copy.ts";
import { wirePaddingSlider } from "./padding-slider.ts";
import { capturePhysicalPadding, captureOutputSize, renderCaptureToCanvas } from "./compositor.ts";
import type { CaptureMaterialAppearance } from './material.ts';
import { createCaptureBackgroundImageStore } from "./backgrounds.ts";
import {
  syncCaptureColorPopover,
  type CaptureColorTarget,
  wireCaptureColorPopovers,
} from "./color-popover.ts";
import { createInspectorScroll } from "./inspector-scroll.ts";
import {
  anchoredPanForZoom,
  captureContainScale,
  viewportRectToSource,
} from "./geometry.ts";
import {
  applyCaptureCommand,
  CAPTURE_MAX_ZOOM,
  CAPTURE_MIN_ZOOM,
  type CaptureCandidate,
  capturePointerIntent,
  createCaptureWindowState,
  scaleCaptureZoom,
  type CaptureWindowCommand,
  type CaptureWindowState,
  wheelCaptureZoom,
} from "./model.ts";
import {
  applyCapturePreferences,
  type CapturePreferenceStorage,
  isCapturePreferenceCommand,
  loadCapturePreferences,
  saveCapturePreferences,
  shouldRestoreCurrentWallpaper,
} from "./preferences.ts";
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
import {
  isCaptureWallpaperFile,
  loadCaptureImage,
  readCaptureWallpaperFile,
} from "./wallpaper.ts";
import { wireKeyboard } from "./editor-keyboard.ts";
import { encodeCapture, handCaptureToDownload } from './export.ts';
import { isCaptureExportSizeAllowed, captureExportFileName, resolveCaptureExportPreferences, type CaptureExportPreferences } from '../../shared/capture-export.ts';
export type CaptureWindowEditorOptions = {
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
  onSave?: (image: Blob, suggestedName: string, directory: string, behavior: CaptureExportPreferences['saveBehavior'], signal: AbortSignal) => Promise<"cancelled" | "saved">;
  preferenceStorage?: CapturePreferenceStorage | null;
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
type PointerGesture = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
};
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
  let state = options.initialState ?? (
    preferenceStorage
      ? applyCapturePreferences(defaultState, loadCapturePreferences(preferenceStorage))
      : defaultState
  );
  const backgroundImages = createCaptureBackgroundImageStore();
  let lastWallpaperDataUrl = state.background.kind === "wallpaper" && !state.background.systemId
    ? state.background.dataUrl
    : null;
  let lastBackgroundColor = state.background.kind === "color" ? state.background.color : "#2B3440";
  let panX = 0;
  let panY = 0;
  let manualRegionSequence = 0;
  let destroyed = false;
  const isMacOS = navigator.platform.startsWith("Mac");
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const copy = captureWindowCopy(options.locale ?? document.documentElement.lang ?? navigator.language);
  let automaticCandidates = options.automaticRegions ?? [];
  const root = document.createElement("div");
  root.className = "pdsh-capture-root";
  root.setAttribute("data-pdsh-capture", "true");
  root.setAttribute("data-pdsh-capture-hide", "");
  root.setAttribute("data-state", "editing");
  host.append(root);
  const inspectorScroll = createInspectorScroll(root);
  const systemWallpaperController = createSystemWallpaperController(options.systemWallpapers, () => {
    if (!destroyed && root.dataset.state === "editing") render();
  });
  const systemWallpaperActions = createSystemWallpaperEditorActions(systemWallpaperController, {
    apply: ({ dataUrl, id }) => dispatch({
      background: { dataUrl, kind: "wallpaper", systemId: id },
      kind: "set-background",
    }),
    isAlive: () => !destroyed,
    onError: () => notify(copy.currentWallpaperError),
    onUnavailable: () => notify(copy.currentWallpaperUnavailable),
    resolve: ({ dataUrl, id }) => backgroundImages.resolve({
      dataUrl,
      kind: "wallpaper",
      systemId: id,
    }),
  });
  const resizeObserver = new ResizeObserver(() => {
    const canvas = root.querySelector<HTMLCanvasElement>(".pdsh-capture-canvas");
    const frame = root.querySelector<HTMLElement>(".pdsh-capture-canvas-frame");
    if (!canvas) return;
    if (state.zoom !== 1 || panX !== 0 || panY !== 0) {
      resetView();
      return;
    }
    window.requestAnimationFrame(() => fitCanvas(root, canvas, frame, state.zoom, panX, panY));
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
    if (command.kind === "set-padding") {
      if (!outputFits(applyCaptureCommand(state, command))) {
        const input = root.querySelector<HTMLInputElement>("[data-input='padding']");
        if (input) { input.value = String(state.padding); input.setAttribute("aria-valuetext", `${state.padding}%`); }
        notify(copy.exportTooLarge);
        return false;
      }
      panX = 0;
      panY = 0;
    }
    state = applyCaptureCommand(state, command);
    return true;
  }
  function dispatch(command: CaptureWindowCommand): void {
    if (command.kind === "set-background" || command.kind === "set-transparent-background") {
      systemWallpaperController.invalidateSelection();
    }
    if (!applyEditorCommand(command)) return;
    if (preferenceStorage && isCapturePreferenceCommand(command)) {
      saveCapturePreferences(preferenceStorage, state);
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
    state = applyCaptureCommand(state, command);
    renderCanvas();
    updateHistoryControls(root, state);
  }
  const exportAbort = new window.AbortController();
  function close(): void {
    if (destroyed) return;
    destroyed = true;
    exportAbort.abort();
    systemWallpaperController.destroy();
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
  function changeColor(target: CaptureColorTarget, color: string): void {
    if (target === "background") {
      lastBackgroundColor = color;
      dispatch({ background: { color, kind: "color" }, kind: "set-background" });
      return;
    }
    dispatch({ color, kind: "set-solid-color" });
  }
  function setPhase(phase: "composing" | "saving" | "editing" | "recapturing"): void {
    root.setAttribute("data-state", phase);
    root.toggleAttribute("aria-busy", phase !== "editing");
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
    panX = 0;
    panY = 0;
    dispatch({ kind: "set-zoom", zoom: 1 });
  }
  function refreshEditor(command: CaptureWindowCommand): void {
    root.setAttribute("data-tool", state.tool);
    const stage = root.querySelector<HTMLElement>(".pdsh-capture-stage");
    if (stage) stage.dataset.tool = state.tool;
    if (
      command.kind === "set-tool" ||
      command.kind === "set-redaction-source" ||
      command.kind === "set-redaction-style"
    ) {
      refreshToolbar();
    }
    syncEditorControls(root, state, copy, lastBackgroundColor, lastWallpaperDataUrl);
    renderCanvas();
    updateHistoryControls(root, state);
  }
  function refreshToolbar(): void {
    const toolbar = root.querySelector<HTMLElement>(".pdsh-capture-toolbar");
    if (!toolbar) return;
    const template = document.createElement("template");
    template.innerHTML = captureToolbarTemplate(state, copy).trim();
    const replacement = template.content.firstElementChild;
    if (!(replacement instanceof HTMLElement)) return;
    toolbar.replaceWith(replacement);
    wireToolbarActions(root, dispatch, dispatchRegion, resetView);
  }
  function render(): void {
    if (destroyed) return;
    const renderMemory = rememberCaptureWindowRender(root);
    root.innerHTML = captureWindowTemplate(state, copy, {
      lastBackgroundColor,
      systemWallpapers: systemWallpaperController.getState(),
      wallpaperDataUrl: lastWallpaperDataUrl,
    });
    root.setAttribute("data-tool", state.tool);
    root.querySelector<HTMLElement>(".pdsh-capture-backdrop")?.addEventListener("click", close);
    root.querySelector<HTMLElement>("[data-action='close']")?.addEventListener("click", close);
    const rendered = renderCanvas();
    const frame = root.querySelector<HTMLElement>(".pdsh-capture-canvas-frame");
    wireToolbarActions(root, dispatch, dispatchRegion, resetView);
    wireCaptureBackgroundActions(root, {
      dispatch,
      pickWallpaper: () => root.querySelector<HTMLInputElement>("[data-input='wallpaper']")?.click(),
      readWallpaperDataUrl: () => lastWallpaperDataUrl,
      setBackgroundColor: (color) => {
        lastBackgroundColor = color;
        dispatch({ background: { color, kind: "color" }, kind: "set-background" });
      },
      systemWallpapers: systemWallpaperActions,
    });
    wireStage(
      root,
      rendered,
      frame,
      () => state,
      dispatchRegion,
      () => `manual-${++manualRegionSequence}`,
      () => ({ panX, panY }),
      (x, y) => {
        panX = x;
        panY = y;
      },
    );
    wireInputs(root, dispatch, preview, loadWallpaper, setPrivacy);
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
    window.requestAnimationFrame(() => fitCanvas(root, rendered, frame, state.zoom, panX, panY));
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
    window.requestAnimationFrame(() => fitCanvas(root, canvas, frame, state.zoom, panX, panY));
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
  async function loadWallpaper(file: File): Promise<void> {
    if (!isCaptureWallpaperFile(file)) {
      notify(copy.wallpaperTooLarge);
      return;
    }
    try {
      const dataUrl = await readCaptureWallpaperFile(file);
      const wallpaperImage = await loadCaptureImage(dataUrl);
      backgroundImages.remember(dataUrl, wallpaperImage);
      lastWallpaperDataUrl = dataUrl;
      dispatch({ kind: "set-background", background: { dataUrl, kind: "wallpaper" } });
    } catch {
      notify(copy.wallpaperUnreadable);
    }
  }
  async function exportCopy(): Promise<void> {
    if (destroyed || root.getAttribute("data-state") !== "editing") return;
    setPhase("composing");
    try {
      const canvas = renderCurrentCapture(await backgroundImages.resolve(state.background));
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
      const canvas = renderCurrentCapture(await backgroundImages.resolve(state.background));
      const preferences = resolveCaptureExportPreferences(options.exportPreferences);
      const blob = await encodeCapture(canvas, preferences.saveFormat);
      if (destroyed) return;
      const suggestedName = captureExportFileName(preferences, fileMetadata.capturedAt, { title: fileMetadata.title, width: canvas.width, height: canvas.height });
      if (options.onSave) {
        setPhase("saving");
        const result = await options.onSave(blob, suggestedName, preferences.saveDirectory, preferences.saveBehavior, exportAbort.signal);
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
    } catch {
      if (destroyed) return;
      setPhase("editing");
      notify(copy.saveFailed);
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
  void systemWallpaperActions.restoreCurrent(shouldRestoreCurrentWallpaper(preferenceStorage));
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
  resetView: () => void,
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
    dispatch({ kind: "set-zoom", zoom: scaleCaptureZoom(currentZoom(root), 1.25) });
  });
  root.querySelector<HTMLElement>("[data-action='zoom-out']")?.addEventListener("click", () => {
    dispatch({ kind: "set-zoom", zoom: scaleCaptureZoom(currentZoom(root), 1 / 1.25) });
  });
  root.querySelector<HTMLElement>("[data-action='zoom-reset']")?.addEventListener("click", () => {
    resetView();
  });
  root.querySelector<HTMLElement>("[data-action='zoom-fit']")?.addEventListener("click", () => {
    resetView();
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
  root.querySelector<HTMLInputElement>("[data-input='none']")?.addEventListener("change", (event) => {
    dispatch({
      enabled: (event.currentTarget as HTMLInputElement).checked,
      kind: "set-transparent-background",
    });
  });
  const padding = root.querySelector<HTMLInputElement>("[data-input='padding']");
  if (padding) wirePaddingSlider(padding,
    value => preview({ kind: "set-padding", padding: value }),
    value => dispatch({ kind: "set-padding", padding: value }),
  );
  root.querySelector<HTMLInputElement>("[data-input='wallpaper']")?.addEventListener("change", (event) => {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (file) void loadWallpaper(file);
  });
}
function syncEditorControls(
  root: HTMLElement,
  state: CaptureWindowState,
  copy: CaptureWindowCopy,
  lastBackgroundColor: string,
  wallpaperDataUrl: string | null,
): void {
  const zoom = root.querySelector<HTMLElement>(".pdsh-capture-zoom-reset");
  if (zoom) zoom.textContent = `${Math.round(state.zoom * 100)}%`;
  const zoomOut = root.querySelector<HTMLButtonElement>("[data-action='zoom-out']");
  const zoomIn = root.querySelector<HTMLButtonElement>("[data-action='zoom-in']");
  if (zoomOut) zoomOut.disabled = state.zoom <= CAPTURE_MIN_ZOOM;
  if (zoomIn) zoomIn.disabled = state.zoom >= CAPTURE_MAX_ZOOM;
  syncCaptureBackgroundControls(root, state, lastBackgroundColor, wallpaperDataUrl, {
    showLess: copy.backgroundShowLess,
    showMore: copy.backgroundShowMore,
  });

  const padding = root.querySelector<HTMLInputElement>("[data-input='padding']");
  const paddingValue = root.querySelector<HTMLElement>("[data-value='padding']");
  if (padding) padding.value = String(state.padding);
  if (paddingValue) paddingValue.textContent = `${state.padding}%`;

  const shadow = root.querySelector<HTMLInputElement>("[data-input='shadow']");
  const none = root.querySelector<HTMLInputElement>("[data-input='none']");
  const privacy = root.querySelector<HTMLInputElement>("[data-input='privacy']");
  if (shadow) shadow.checked = state.shadow;
  if (none) none.checked = state.background.kind === "transparent";
  if (privacy) privacy.checked = state.privacyEnabled;

  syncCaptureColorPopover(root, "solid", state.solidColor);
}

function wireStage(
  root: HTMLElement,
  canvas: HTMLCanvasElement,
  frame: HTMLElement | null,
  readState: () => CaptureWindowState,
  dispatch: (command: CaptureWindowCommand) => void,
  createManualRegionId: () => string,
  readPan: () => { panX: number; panY: number },
  writePan: (x: number, y: number) => void,
): void {
  const stage = root.querySelector<HTMLElement>(".pdsh-capture-stage");
  if (!stage || !frame) return;
  const gestureStage = stage;
  let gesture: PointerGesture | null = null;
  let draft: HTMLElement | null = null;

  stage.addEventListener("wheel", (event) => {
    event.preventDefault();
    const state = readState();
    const nextZoom = wheelCaptureZoom(state.zoom, event.deltaY);
    const stageRect = stage.getBoundingClientRect();
    const currentPan = readPan();
    const pan = anchoredPanForZoom(
      { x: currentPan.panX, y: currentPan.panY },
      { x: event.clientX, y: event.clientY },
      { x: stageRect.left + stageRect.width / 2, y: stageRect.top + stageRect.height / 2 },
      state.zoom,
      nextZoom,
    );
    writePan(pan.x, pan.y);
    dispatch({ kind: "set-zoom", zoom: nextZoom });
  }, { passive: false });

  stage.addEventListener("pointerdown", (event) => {
    const state = readState();
    const target = event.target instanceof Element ? event.target : null;
    const intent = capturePointerIntent(
      state.tool,
      event.button,
      Boolean(target?.closest("[data-region]")),
    );
    if (intent === "ignore" || intent === "region") return;
    const pan = readPan();
    gesture = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: pan.panX,
      startPanY: pan.panY,
    };
    stage.setPointerCapture(event.pointerId);
    if (intent === "draw") {
      draft = document.createElement("div");
      draft.className = "pdsh-capture-draft-region";
      root.append(draft);
      updateDraft(draft, event.clientX, event.clientY, event.clientX, event.clientY);
    } else {
      stage.setAttribute("data-panning", "true");
    }
  });

  stage.addEventListener("pointermove", (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (draft) {
      updateDraft(
        draft,
        gesture.startClientX,
        gesture.startClientY,
        event.clientX,
        event.clientY,
      );
      return;
    }
    const x = gesture.startPanX + event.clientX - gesture.startClientX;
    const y = gesture.startPanY + event.clientY - gesture.startClientY;
    writePan(x, y);
    const state = readState();
    frame.style.transform = `translate(${x}px, ${y}px) scale(${state.zoom})`;
  });

  function finishGesture(event: PointerEvent, commit: boolean): void {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    if (draft) {
      if (commit) {
        const state = readState();
        const canvasRect = canvas.getBoundingClientRect();
        const scale = canvasRect.width / canvas.width;
        const rect = viewportRectToSource(
          {
            height: event.clientY - gesture.startClientY,
            width: event.clientX - gesture.startClientX,
            x: gesture.startClientX,
            y: gesture.startClientY,
          },
          {
            scale,
            x:
              canvasRect.left +
              capturePhysicalPadding(state.source, state.padding) * scale,
            y:
              canvasRect.top +
              capturePhysicalPadding(state.source, state.padding) * scale,
          },
          state.source,
        );
        dispatch({ id: createManualRegionId(), kind: "add-region", rect });
      }
      draft.remove();
      draft = null;
    }
    gestureStage.removeAttribute("data-panning");
    if (gestureStage.hasPointerCapture(event.pointerId)) {
      gestureStage.releasePointerCapture(event.pointerId);
    }
    gesture = null;
  }

  stage.addEventListener("pointerup", (event) => {
    finishGesture(event, true);
  });
  stage.addEventListener("pointercancel", (event) => {
    finishGesture(event, false);
  });
}

function updateHistoryControls(root: HTMLElement, state: CaptureWindowState): void {
  const undo = root.querySelector<HTMLButtonElement>("[data-action='undo']");
  const redo = root.querySelector<HTMLButtonElement>("[data-action='redo']");
  if (undo) undo.disabled = state.history.past.length === 0;
  if (redo) redo.disabled = state.history.future.length === 0;
}

function fitCanvas(
  root: HTMLElement,
  canvas: HTMLCanvasElement,
  frame: HTMLElement | null,
  zoom: number,
  panX: number,
  panY: number,
): void {
  const stage = root.querySelector<HTMLElement>(".pdsh-capture-stage");
  if (!stage || !frame) return;
  const fit = captureContainScale(
    { height: canvas.height, width: canvas.width },
    { height: stage.clientHeight, width: stage.clientWidth },
  );
  frame.style.width = `${Math.round(canvas.width * fit)}px`;
  frame.style.height = `${Math.round(canvas.height * fit)}px`;
  frame.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
}

function updateDraft(
  draft: HTMLElement,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): void {
  draft.style.left = `${Math.min(startX, endX)}px`;
  draft.style.top = `${Math.min(startY, endY)}px`;
  draft.style.width = `${Math.abs(endX - startX)}px`;
  draft.style.height = `${Math.abs(endY - startY)}px`;
}

function currentZoom(root: HTMLElement): number {
  const value = root.querySelector<HTMLElement>(".pdsh-capture-zoom-reset")?.textContent;
  return Number.parseInt(value ?? "100", 10) / 100;
}
