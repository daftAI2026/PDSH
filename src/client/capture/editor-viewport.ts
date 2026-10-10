/**
 * [INPUT]: 依赖编辑器当前 CaptureWindowState、舞台/画布 DOM 与模型命令入口；缩放单位按 WheelEvent.deltaMode 归一。
 * [OUTPUT]: 提供视口控制器；接受手势阻止默认选择与拖拽，松开提交交集。已松键失捕获等待同指针松开，其余失捕获、失焦及模式切换取消。先清空手势再提交，按帧写 transform。
 * [POS]: capture 编辑器的高频交互边界；zoom 仍由模型持有，pan 仅由该控制器持有，二者不从 DOM 文本回读。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { capturePhysicalPadding } from './compositor.ts';
import { anchoredPanForZoom, captureContainScale, viewportRectToSource } from './geometry.ts';
import {
  CAPTURE_MAX_ZOOM,
  CAPTURE_MIN_ZOOM,
  capturePointerIntent,
  scaleCaptureZoom,
  type CaptureWindowCommand,
  type CaptureWindowState,
  wheelCaptureZoom,
} from './model.ts';

const MAX_WHEEL_DELTA_PIXELS = 1000;
const DEFAULT_WHEEL_LINE_HEIGHT = 16;
const WHEEL_DELTA_LINE = 1;
const WHEEL_DELTA_PAGE = 2;

type PointerGesture = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startPanX: number;
  startPanY: number;
  captureReleased: boolean;
};

export type CaptureEditorViewportController = {
  bind: (stage: HTMLElement, frame: HTMLElement, canvas: HTMLCanvasElement) => void;
  cancelGesture: () => void;
  destroy: () => void;
  fit: () => void;
  isAtDefault: () => boolean;
  pan: () => { x: number; y: number };
  reset: () => void;
  resetPan: () => void;
  zoomByFactor: (factor: number) => void;
};

export type CaptureEditorViewportOptions = {
  createManualRegionId: () => string;
  dispatchRegion: (command: CaptureWindowCommand) => void;
  readState: () => CaptureWindowState;
  root: HTMLElement;
  setZoom: (zoom: number) => void;
};

/** 创建一个生命周期受编辑器拥有的视口控制器；bind 可随工作台重绘安全换绑。 */
export function createCaptureEditorViewport(
  options: CaptureEditorViewportOptions,
): CaptureEditorViewportController {
  const view = options.root.ownerDocument.defaultView;
  let stage: HTMLElement | null = null;
  let frame: HTMLElement | null = null;
  let canvas: HTMLCanvasElement | null = null;
  let panX = 0;
  let panY = 0;
  let gesture: PointerGesture | null = null;
  let draft: HTMLElement | null = null;
  let animationFrame: number | null = null;
  let disposed = false;
  let unbind = () => {};

  function readPan(): { x: number; y: number } {
    return { x: panX, y: panY };
  }

  function applyTransform(): void {
    animationFrame = null;
    if (disposed || !frame) return;
    frame.style.transform = `translate(${panX}px, ${panY}px) scale(${options.readState().zoom})`;
  }

  function cancelTransform(): void {
    if (animationFrame === null) return;
    view?.cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }

  function scheduleTransform(): void {
    if (disposed || !frame || animationFrame !== null) return;
    if (!view?.requestAnimationFrame) {
      applyTransform();
      return;
    }
    animationFrame = view.requestAnimationFrame(applyTransform);
  }

  function isInteractive(): boolean {
    return !disposed && options.root.dataset.state === 'editing';
  }

  function writePan(x: number, y: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    panX = x;
    panY = y;
    scheduleTransform();
  }

  function setZoom(zoom: number): void {
    if (disposed) return;
    options.setZoom(scaleCaptureZoom(zoom, 1));
    scheduleTransform();
  }

  function detachGesture(commit: boolean, event?: PointerEvent): void {
    const activeStage = stage;
    const activeCanvas = canvas;
    const activeGesture = gesture;
    if (!activeGesture || (event && event.pointerId !== activeGesture.pointerId)) return;
    const activeDraft = draft;
    // +--- 先进入空闲态，再归还捕获和调用外部提交，阻止终态重入。 ---+
    gesture = null;
    draft = null;
    activeDraft?.remove();
    activeStage?.removeAttribute('data-panning');
    try {
      if (activeStage?.hasPointerCapture(activeGesture.pointerId)) {
        activeStage.releasePointerCapture(activeGesture.pointerId);
      }
    } catch {
      // 浏览器已撤销指针时不恢复旧手势；本地终态已完成。
    }
    if (activeDraft && commit && event && activeCanvas && isInteractive()) {
      // 先同步最新 transform，确保快速连续的拖动/绘框读取同一视觉几何。
      cancelTransform();
      applyTransform();
      const state = options.readState();
      const canvasRect = activeCanvas.getBoundingClientRect();
      const scale = canvasRect.width / activeCanvas.width;
      const rect = viewportRectToSource(
        {
          height: event.clientY - activeGesture.startClientY,
          width: event.clientX - activeGesture.startClientX,
          x: activeGesture.startClientX,
          y: activeGesture.startClientY,
        },
        {
          scale,
          x: canvasRect.left + capturePhysicalPadding(state.source, state.padding) * scale,
          y: canvasRect.top + capturePhysicalPadding(state.source, state.padding) * scale,
        },
        state.source,
      );
      options.dispatchRegion({ id: options.createManualRegionId(), kind: 'add-region', rect });
    }
  }

  function bind(nextStage: HTMLElement, nextFrame: HTMLElement, nextCanvas: HTMLCanvasElement): void {
    if (disposed) return;
    if (stage !== nextStage) {
      unbind();
      detachGesture(false);
      cancelTransform();
      stage = nextStage;
      frame = nextFrame;
      canvas = nextCanvas;
      bindStage(nextStage);
    } else {
      frame = nextFrame;
      canvas = nextCanvas;
    }
    fit();
  }

  function bindStage(target: HTMLElement): void {
    const removers: Array<() => void> = [];
    const listen = <K extends keyof HTMLElementEventMap>(
      type: K,
      listener: (event: HTMLElementEventMap[K]) => void,
      listenerOptions?: AddEventListenerOptions,
    ) => {
      const typedListener = listener as EventListener;
      target.addEventListener(type, typedListener, listenerOptions);
      removers.push(() => target.removeEventListener(type, typedListener, listenerOptions));
    };

    listen('wheel', (event) => {
      event.preventDefault();
      if (!isInteractive()) return;
      const state = options.readState();
      const delta = normalizeWheelDelta(event, target, view);
      if (delta === 0) return;
      const nextZoom = wheelCaptureZoom(state.zoom, delta);
      const rect = target.getBoundingClientRect();
      const nextPan = anchoredPanForZoom(
        readPan(),
        { x: event.clientX, y: event.clientY },
        { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
        state.zoom,
        nextZoom,
      );
      writePan(nextPan.x, nextPan.y);
      setZoom(nextZoom);
    }, { passive: false });

    listen('pointerdown', (event) => {
      if (!isInteractive()) return;
      if (gesture) return;
      const state = options.readState();
      const targetElement = event.target instanceof Element ? event.target : null;
      const intent = capturePointerIntent(
        state,
        event.button,
        Boolean(targetElement?.closest('[data-region]')),
      );
      if (intent === 'ignore' || intent === 'region') return;
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        return;
      }
      // +--- 手势已由舞台拥有；禁止默认选择或原生拖拽夺走捕获。 ---+
      event.preventDefault();
      const pan = readPan();
      gesture = {
        pointerId: event.pointerId,
        captureReleased: false,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      };
      if (intent === 'draw') {
        draft = target.ownerDocument.createElement('div');
        draft.className = 'pdsh-capture-draft-region';
        options.root.append(draft);
        updateDraft(draft, event.clientX, event.clientY, event.clientX, event.clientY);
      } else {
        target.setAttribute('data-panning', 'true');
      }
    });

    listen('pointermove', (event) => {
      if (!gesture || gesture.pointerId !== event.pointerId || gesture.captureReleased) return;
      if (!isInteractive()) {
        detachGesture(false);
        return;
      }
      if (draft) {
        updateDraft(draft, gesture.startClientX, gesture.startClientY, event.clientX, event.clientY);
        return;
      }
      writePan(
        gesture.startPanX + event.clientX - gesture.startClientX,
        gesture.startPanY + event.clientY - gesture.startClientY,
      );
    });

    listen('pointerup', (event) => detachGesture(isInteractive(), event));
    listen('pointercancel', (event) => detachGesture(false, event));
    listen('lostpointercapture', (event) => {
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      // +--- 已松键的失捕获不是取消；等待真实松开，不据此提交。 ---+
      if (draft && event.buttons === 0) gesture.captureReleased = true;
      else detachGesture(false, event);
    });
    const cancelStale = () => {
      if (gesture?.captureReleased) detachGesture(false);
    };
    const finishReleased = (event: PointerEvent) => {
      if (gesture?.captureReleased) detachGesture(isInteractive(), event);
    };
    const cancelReleased = (event: PointerEvent) => detachGesture(false, event);
    target.ownerDocument.addEventListener('pointerdown', cancelStale, true);
    target.ownerDocument.addEventListener('pointerup', finishReleased, true);
    target.ownerDocument.addEventListener('pointercancel', cancelReleased, true);
    removers.push(() => {
      target.ownerDocument.removeEventListener('pointerdown', cancelStale, true);
      target.ownerDocument.removeEventListener('pointerup', finishReleased, true);
      target.ownerDocument.removeEventListener('pointercancel', cancelReleased, true);
    });
    const cancelOnBlur = () => detachGesture(false);
    view?.addEventListener('blur', cancelOnBlur);
    removers.push(() => view?.removeEventListener('blur', cancelOnBlur));
    unbind = () => {
      for (const remove of removers) remove();
      removers.length = 0;
    };
  }

  function fit(): void {
    if (!stage || !frame || !canvas || disposed) return;
    const fitScale = captureContainScale(
      { height: canvas.height, width: canvas.width },
      { height: stage.clientHeight, width: stage.clientWidth },
    );
    frame.style.width = `${Math.round(canvas.width * fitScale)}px`;
    frame.style.height = `${Math.round(canvas.height * fitScale)}px`;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    scheduleTransform();
  }

  return {
    bind,
    cancelGesture: () => detachGesture(false),
    destroy() {
      if (disposed) return;
      disposed = true;
      detachGesture(false);
      unbind();
      cancelTransform();
      stage = null;
      frame = null;
      canvas = null;
    },
    fit,
    isAtDefault: () => options.readState().zoom === 1 && panX === 0 && panY === 0,
    pan: readPan,
    reset() {
      writePan(0, 0);
      setZoom(1);
    },
    resetPan() {
      writePan(0, 0);
    },
    zoomByFactor(factor) {
      setZoom(scaleCaptureZoom(options.readState().zoom, factor));
    },
  };
}

function normalizeWheelDelta(
  event: WheelEvent,
  stage: HTMLElement,
  view: Window | null,
): number {
  if (!Number.isFinite(event.deltaY)) return 0;
  let delta = event.deltaY;
  if (event.deltaMode === WHEEL_DELTA_LINE) {
    const style = view?.getComputedStyle(stage);
    const lineHeight = parsePixels(style?.lineHeight) ?? parsePixels(style?.fontSize) ?? DEFAULT_WHEEL_LINE_HEIGHT;
    delta *= lineHeight;
  } else if (event.deltaMode === WHEEL_DELTA_PAGE) {
    delta *= Math.max(1, stage.clientHeight || stage.getBoundingClientRect().height);
  }
  return Math.max(-MAX_WHEEL_DELTA_PIXELS, Math.min(MAX_WHEEL_DELTA_PIXELS, delta));
}

function parsePixels(value: string | undefined): number | null {
  if (!value) return null;
  const pixels = Number.parseFloat(value);
  return Number.isFinite(pixels) && pixels > 0 ? pixels : null;
}

function updateDraft(draft: HTMLElement, startX: number, startY: number, endX: number, endY: number): void {
  draft.style.left = `${Math.min(startX, endX)}px`;
  draft.style.top = `${Math.min(startY, endY)}px`;
  draft.style.width = `${Math.abs(endX - startX)}px`;
  draft.style.height = `${Math.abs(endY - startY)}px`;
}
