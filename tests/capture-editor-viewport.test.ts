/**
 * [INPUT]: 依赖真实编辑器、jsdom 与可控 requestAnimationFrame；不读取用户截图或启动 Desktop。
 * [OUTPUT]: 验证缩放控制共用精确状态、视口变换与像素合成隔离、帧合并及指针取消/卸载清理。
 * [POS]: capture 编辑器视口交互合同；Canvas 绘制桩只证明控制流，不证明桌面视觉表现。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { mountCaptureWindowEditor, type CaptureWindowEditorOptions } from '../src/client/capture/editor.ts';
import { createCaptureWindowState, scaleCaptureZoom, wheelCaptureZoom } from '../src/client/capture/model.ts';

function fixture(editorOptions: Partial<CaptureWindowEditorOptions> = {}) {
  const dom = new JSDOM('<html lang="zh"><title>视口夹具</title><body><main></main></body></html>', {
    pretendToBeVisual: true,
    url: 'https://capture-viewport.invalid/',
  });
  const resizeObservers: Array<{ trigger: () => void }> = [];
  class FixtureResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      resizeObservers.push({ trigger: () => callback([], this as unknown as ResizeObserver) });
    }
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
    Image: dom.window.Image,
    ResizeObserver: FixtureResizeObserver,
  };
  const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { configurable: true, value, writable: true });
  }

  const frames = new Map<number, FrameRequestCallback>();
  let nextFrameId = 0;
  dom.window.requestAnimationFrame = (callback) => {
    const id = ++nextFrameId;
    frames.set(id, callback);
    return id;
  };
  dom.window.cancelAnimationFrame = (id) => { frames.delete(id); };
  const flushFrames = () => {
    for (let round = 0; frames.size && round < 8; round += 1) {
      const pending = [...frames.entries()];
      frames.clear();
      for (const [, callback] of pending) callback(0);
    }
  };

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
  const document = dom.window.document;
  const originalCreateElement = document.createElement.bind(document);
  let canvasAllocations = 0;
  document.createElement = ((name: string, options?: ElementCreationOptions) => {
    if (name.toLowerCase() === 'canvas') canvasAllocations += 1;
    return originalCreateElement(name, options);
  }) as typeof document.createElement;

  const source = document.createElement('canvas');
  source.width = 120;
  source.height = 80;
  const editor = mountCaptureWindowEditor(document.querySelector('main')!, {
    initialState: { ...createCaptureWindowState({ width: 120, height: 80 }), background: { color: '#fff', kind: 'color' } },
    preferenceStorage: null,
    source,
    onNotify: () => {},
    ...editorOptions,
  });
  flushFrames();

  const root = document.querySelector<HTMLElement>('[data-pdsh-capture]')!;
  const stage = root.querySelector<HTMLElement>('.pdsh-capture-stage')!;
  const frame = root.querySelector<HTMLElement>('.pdsh-capture-canvas-frame')!;
  const wheel = (deltaY: number, deltaMode = 0) => stage.dispatchEvent(new dom.window.WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    clientX: 40,
    clientY: 30,
    deltaMode,
    deltaY,
  }));
  const pointer = (type: string, pointerId: number, clientX: number, clientY: number, button = 0) => {
    const event = new dom.window.MouseEvent(type, { bubbles: true, button, clientX, clientY });
    Object.defineProperty(event, 'pointerId', { value: pointerId });
    stage.dispatchEvent(event);
  };

  return {
    canvasAllocations: () => canvasAllocations,
    close() {
      editor.destroy();
      dom.window.close();
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete (globalThis as Record<string, unknown>)[key];
      }
    },
    dom,
    editor,
    flushFrames,
    flushAsync: () => new Promise<void>((resolve) => setImmediate(resolve)),
    frame,
    frames,
    pointer,
    root,
    stage,
    triggerResize: () => resizeObservers.forEach((observer) => observer.trigger()),
    wheel,
  };
}

test('wheel 只更新视口状态与百分比，不重新分配全分辨率合成画布', () => {
  const h = fixture();
  try {
    const allocations = h.canvasAllocations();
    const expectedZoom = wheelCaptureZoom(h.editor.getState().zoom, 20);
    h.wheel(20);
    assert.equal(h.editor.getState().zoom, expectedZoom);
    assert.equal(h.root.querySelector('.pdsh-capture-zoom-reset')?.textContent, `${Math.round(expectedZoom * 100)}%`);
    assert.equal(h.canvasAllocations(), allocations, '视口缩放不能触发像素合成/Canvas 分配');
  } finally {
    h.close();
  }
});

test('放大按钮从精确模型 zoom 继续，而不是从圆整后的百分比文本重建', () => {
  const h = fixture();
  try {
    h.wheel(20);
    const afterWheel = h.editor.getState().zoom;
    h.root.querySelector<HTMLElement>("[data-action='zoom-in']")!.click();
    assert.equal(h.editor.getState().zoom, scaleCaptureZoom(afterWheel, 1.25));
  } finally {
    h.close();
  }
});

test('滚轮按 deltaMode 换算行/页单位，并对异常大的事件作有界缩放', () => {
  const h = fixture();
  try {
    h.stage.style.lineHeight = '20px';
    h.wheel(1, 1);
    assert.equal(h.editor.getState().zoom, wheelCaptureZoom(1, 20));
    Object.defineProperty(h.stage, 'clientHeight', { configurable: true, value: 200 });
    const beforePage = h.editor.getState().zoom;
    h.wheel(1, 2);
    assert.equal(h.editor.getState().zoom, wheelCaptureZoom(beforePage, 200));
    h.wheel(1_000_000, 0);
    assert.equal(h.editor.getState().zoom, 0.4);
    h.wheel(-1_000_000, 0);
    h.wheel(-1_000_000, 0);
    assert.equal(h.editor.getState().zoom, 6);
  } finally {
    h.close();
  }
});

test('高频拖动每帧最多排一个 transform，pointercancel 清理手势，卸载取消待执行帧', () => {
  const h = fixture();
  try {
    const captured = new Set<number>();
    h.stage.setPointerCapture = (id: number) => { captured.add(id); };
    h.stage.hasPointerCapture = (id: number) => captured.has(id);
    h.stage.releasePointerCapture = (id: number) => { captured.delete(id); };
    h.pointer('pointerdown', 7, 10, 10);
    h.pointer('pointermove', 7, 14, 13);
    h.pointer('pointermove', 7, 18, 16);
    assert.equal(h.frames.size, 1, '同一帧多次 move 只能排一次变换写入');
    assert.equal(h.frame.style.transform, 'translate(0px, 0px) scale(1)', '变换只在下一帧提交');
    h.pointer('pointercancel', 7, 18, 16);
    assert.equal(h.stage.hasAttribute('data-panning'), false);
    assert.equal(captured.size, 0);
    h.editor.destroy();
    assert.equal(h.frames.size, 0, 'dispose 必须取消尚未执行的 requestAnimationFrame');
  } finally {
    h.close();
  }
});

test('composing/saving 等忙碌阶段拒绝新的视口手势', () => {
  const h = fixture();
  try {
    const zoom = h.editor.getState().zoom;
    h.root.setAttribute('data-state', 'saving');
    h.wheel(40);
    h.pointer('pointerdown', 11, 10, 10);
    h.pointer('pointermove', 11, 30, 30);
    assert.equal(h.editor.getState().zoom, zoom);
    assert.equal(h.stage.hasAttribute('data-panning'), false);
    assert.equal(h.frames.size, 0);
  } finally {
    h.close();
  }
});

test('wheel、缩放按钮与 fit/reset 共用精确 zoom 和同一 transform 写入口', () => {
  const h = fixture();
  try {
    h.wheel(20);
    const wheelZoom = h.editor.getState().zoom;
    h.flushFrames();
    assert.equal(h.frame.style.transform.match(/scale\(([^)]+)\)$/)?.[1], String(wheelZoom));
    h.root.querySelector<HTMLElement>("[data-action='zoom-in']")!.click();
    const buttonZoom = scaleCaptureZoom(wheelZoom, 1.25);
    assert.equal(h.editor.getState().zoom, buttonZoom);
    h.flushFrames();
    assert.equal(h.frame.style.transform.match(/scale\(([^)]+)\)$/)?.[1], String(buttonZoom));
    h.root.querySelector<HTMLElement>("[data-action='zoom-fit']")!.click();
    h.flushFrames();
    assert.equal(h.editor.getState().zoom, 1);
    assert.equal(h.frame.style.transform, 'translate(0px, 0px) scale(1)');
  } finally {
    h.close();
  }
});

test('ResizeObserver 统一 fit 并重置非默认视口，不重新合成图像内容', () => {
  const h = fixture();
  try {
    h.root.querySelector<HTMLElement>("[data-action='zoom-in']")!.click();
    h.flushFrames();
    const allocations = h.canvasAllocations();
    Object.defineProperty(h.stage, 'clientWidth', { configurable: true, value: 400 });
    Object.defineProperty(h.stage, 'clientHeight', { configurable: true, value: 200 });
    h.triggerResize();
    assert.equal(h.editor.getState().zoom, 1);
    assert.equal(h.canvasAllocations(), allocations);
    h.flushFrames();
    assert.equal(h.frame.style.transform, 'translate(0px, 0px) scale(1)');
    const canvas = h.root.querySelector<HTMLCanvasElement>('.pdsh-capture-canvas')!;
    const fitScale = Math.min(
      h.stage.clientWidth / canvas.width,
      h.stage.clientHeight / canvas.height,
    );
    assert.equal(h.frame.style.width, `${Math.round(canvas.width * fitScale)}px`);
    assert.equal(h.frame.style.height, `${Math.round(canvas.height * fitScale)}px`);
  } finally {
    h.close();
  }
});

test('内容编辑和重拍仍重合成像素，不被视口快速路径跳过', async () => {
  const h = fixture({
    onRetake: async () => {
      const source = document.createElement('canvas');
      source.width = 160;
      source.height = 90;
      return { automaticRegions: [], source, sourceScaleFactor: 1 };
    },
  });
  try {
    const padding = h.root.querySelector<HTMLInputElement>("[data-input='padding']")!;
    const beforePadding = h.canvasAllocations();
    padding.value = '9';
    padding.dispatchEvent(new h.dom.window.Event('input', { bubbles: true }));
    assert.ok(h.canvasAllocations() > beforePadding, 'padding 改动必须重绘编辑像素');

    const beforeRetake = h.canvasAllocations();
    h.root.querySelector<HTMLElement>("[data-action='retake']")!.click();
    await h.flushAsync();
    assert.equal(h.editor.getState().source.width, 160);
    assert.ok(h.canvasAllocations() > beforeRetake, '新来源必须重建合成画布');
  } finally {
    h.close();
  }
});

test('拖动中的画布帧不启用会落后于指针的 CSS transform transition', () => {
  const css = readFileSync(new URL('../src/client/capture/capture-window.css', import.meta.url), 'utf8');
  const frameRule = css.match(/\.pdsh-capture-canvas-frame\s*\{([^}]*)\}/s)?.[1] ?? '';
  assert.doesNotMatch(frameRule, /transition\s*:\s*transform/i);
});
