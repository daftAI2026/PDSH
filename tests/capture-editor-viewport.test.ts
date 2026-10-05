/**
 * [INPUT]: 依赖真实编辑器、jsdom 与可控 requestAnimationFrame；不读取用户截图或启动 Desktop。
 * [OUTPUT]: 验证缩放与工具状态唯一、检测/手绘意图分离、手绘隐藏候选但保留遮罩、模式切换不合成像素、切模式取消旧手势、候选点击忙碌围栏、选中按钮焦点，以及帧合并和卸载清理。
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

// +--- 工具状态与真实指针动作必须同义 ---+
function prepareRegionPointer(h: ReturnType<typeof fixture>) {
  const captured = new Set<number>();
  h.stage.setPointerCapture = id => { captured.add(id); };
  h.stage.hasPointerCapture = id => captured.has(id);
  h.stage.releasePointerCapture = id => { captured.delete(id); };
  h.dom.window.HTMLCanvasElement.prototype.getBoundingClientRect = function () {
    return { x: 0, y: 0, left: 0, top: 0, right: this.width, bottom: this.height,
      width: this.width, height: this.height, toJSON() {} };
  };
  const choose = (action: string) => h.root.querySelector<HTMLElement>(`[data-action='${action}']`)!.click();
  const draw = (id: number) => {
    h.pointer('pointerdown', id, 20, 20);
    h.pointer('pointermove', id, 60, 50);
    h.pointer('pointerup', id, 60, 50);
  };
  return { captured, choose, draw };
}

test('检测模式拖空白不画框，手绘模式才创建区域；中键仍能平移', () => {
  const h = fixture();
  try {
    const p = prepareRegionPointer(h);
    p.choose('tool-redact');
    assert.equal(h.editor.getState().redactionSource, 'auto');
    h.pointer('pointerdown', 20, 20, 20);
    assert.equal(h.root.querySelector('.pdsh-capture-draft-region'), null, '自动模式不能启动手绘');
    h.pointer('pointerup', 20, 60, 50);
    assert.equal(h.editor.getState().regions.length, 0);
    h.pointer('pointerdown', 21, 20, 20, 1);
    assert.equal(h.stage.hasAttribute('data-panning'), true);
    h.pointer('pointerup', 21, 60, 50, 1);
    p.choose('source-draw');
    p.draw(22);
    assert.equal(h.editor.getState().regions.length, 1, '手绘正例必须真的提交矩形');
  } finally { h.close(); }
});

test('切工具或区域来源立即取消旧手绘，迟到 pointerup 不提交到新模式', () => {
  for (const action of ['tool-move', 'source-auto']) {
    const h = fixture();
    try {
      const p = prepareRegionPointer(h);
      p.choose('tool-redact'); p.choose('source-draw');
      h.pointer('pointerdown', 30, 20, 20);
      assert.ok(h.root.querySelector('.pdsh-capture-draft-region'));
      p.choose(action);
      assert.equal(h.root.querySelector('.pdsh-capture-draft-region'), null, action);
      assert.equal(p.captured.size, 0, '取消须归还所属 pointer capture');
      h.pointer('pointerup', 30, 60, 50);
      assert.equal(h.editor.getState().regions.length, 0);
      p.choose('tool-redact'); p.choose('source-draw'); p.draw(31);
      assert.equal(h.editor.getState().regions.length, 1);
    } finally { h.close(); }
  }
});

test('工具栏替换保留所选按钮焦点，各互斥组始终只有一个选中值', () => {
  const h = fixture();
  try {
    const select = (action: string) => {
      const button = h.root.querySelector<HTMLElement>(`[data-action='${action}']`)!;
      button.focus(); button.click();
      assert.equal((h.dom.window.document.activeElement as HTMLElement).dataset.action, action);
      assert.equal(h.root.querySelector(`[data-action='${action}']`)?.getAttribute('aria-pressed'), 'true');
    };
    select('tool-redact'); select('source-draw'); select('style-solid');
    for (const group of [['tool-move', 'tool-redact'], ['source-auto', 'source-draw'], ['style-mosaic', 'style-blur', 'style-solid']]) {
      assert.equal(group.filter(action => h.root.querySelector(`[data-action='${action}']`)?.getAttribute('aria-pressed') === 'true').length, 1);
    }
    select('tool-move'); select('tool-redact');
    assert.equal(h.editor.getState().redactionSource, 'draw');
    assert.equal(h.editor.getState().redactionStyle, 'solid');
  } finally { h.close(); }
});

test('检测来源按点击候选添加打码，再点击已选区域移除，不要求拖动', () => {
  const candidate = { id: 'detected-fixture', x: 10, y: 10, width: 40, height: 20 };
  const h = fixture({ automaticRegions: [candidate] });
  try {
    const p = prepareRegionPointer(h);
    p.choose('tool-redact'); p.choose('style-blur');
    assert.equal(h.editor.getState().redactionSource, 'auto');
    const suggested = h.root.querySelector<HTMLElement>('.pdsh-capture-region-candidate')!;
    assert.equal(suggested.dataset.interactive, 'true');
    suggested.click();
    assert.equal(h.editor.getState().regions.length, 1);
    const [selected] = h.editor.getState().regions;
    assert.equal(selected.id, candidate.id);
    assert.equal(selected.source, 'automatic');
    assert.equal(selected.style, 'blur');
    assert.deepEqual(selected.rect, { x: 10, y: 10, width: 40, height: 20 });
    assert.equal(h.root.querySelectorAll('.pdsh-capture-region-candidate').length, 0);
    h.root.querySelector<HTMLElement>('.pdsh-capture-region-confirmed')!.click();
    assert.equal(h.editor.getState().regions.length, 0);
    assert.equal(h.root.querySelectorAll('.pdsh-capture-region-candidate').length, 1);
    const staleCandidate = h.root.querySelector<HTMLElement>('.pdsh-capture-region-candidate')!;
    p.choose('source-draw');
    assert.equal(h.root.querySelector('.pdsh-capture-region-candidate'), null);
    staleCandidate.click();
    assert.equal(h.editor.getState().regions.length, 0, '手绘模式不接受旧候选点击');
    p.choose('source-auto');
    h.root.querySelector<HTMLElement>('.pdsh-capture-region-candidate')!.click();
    p.choose('undo');
    assert.equal(h.editor.getState().regions.length, 0);
    p.choose('redo');
    assert.equal(h.editor.getState().regions.length, 1);
    assert.equal(h.editor.getState().redactionSource, 'auto');
  } finally { h.close(); }
});

test('手绘隐藏未选候选，切回检测立即恢复，已选遮罩与样式不清空', () => {
  const h = fixture({ automaticRegions: [
    { id: 'chosen', x: 10, y: 10, width: 40, height: 20 },
    { id: 'guide', x: 60, y: 10, width: 40, height: 20 },
  ] });
  try {
    const p = prepareRegionPointer(h);
    p.choose('tool-redact'); p.choose('style-blur');
    h.root.querySelector<HTMLElement>('.pdsh-capture-region-candidate')!.click();
    const selected = h.editor.getState().regions;
    const staleConfirmed = h.root.querySelector<HTMLElement>('.pdsh-capture-region-confirmed')!;
    p.choose('source-draw');
    staleConfirmed.click();
    assert.equal(h.root.querySelectorAll('.pdsh-capture-region-candidate').length, 0, '手绘仅隐藏未选候选');
    assert.equal(h.root.querySelectorAll('.pdsh-capture-region-confirmed').length, 1);
    for (const region of h.root.querySelectorAll<HTMLElement>('.pdsh-capture-region')) {
      assert.equal(region.dataset.interactive, 'false', '候选和已选区域均交还指针');
      region.click();
    }
    assert.equal(h.editor.getState().regions, selected, '来源变化或参考框点击不改已选像素遮罩');
    assert.equal(selected[0].style, 'blur');
    p.draw(44);
    assert.equal(h.editor.getState().regions.length, 2, '能画过已有检测区域，不触发删除');
    p.choose('source-auto');
    assert.equal(h.root.querySelectorAll('.pdsh-capture-region-candidate').length, 1, '同一候选恢复，无需重拍或重新检测');
    for (const region of h.root.querySelectorAll<HTMLElement>('.pdsh-capture-region')) assert.equal(region.dataset.interactive, 'true');
    assert.equal(h.editor.getState().regions.length, 2);
    p.choose('tool-move');
    assert.equal(h.root.querySelectorAll('.pdsh-capture-region').length, 0, '移动模式收起交互框，不删除遮罩');
    assert.equal(h.editor.getState().regions.length, 2);
  } finally { h.close(); }
});

test('真实重拍等待期间拒绝候选添加/已选移除，恢复 editing 后接受点击', async () => {
  for (const selected of [false, true]) {
    let failRetake!: (error: Error) => void;
    const pending = new Promise<never>((_, reject) => { failRetake = reject; });
    const h = fixture({
      automaticRegions: [{ id: 'busy-candidate', x: 10, y: 10, width: 40, height: 20 }],
      onRetake: () => pending,
    });
    try {
      const p = prepareRegionPointer(h);
      p.choose('tool-redact');
      if (selected) h.root.querySelector<HTMLElement>('.pdsh-capture-region-candidate')!.click();
      const selector = selected ? '.pdsh-capture-region-confirmed' : '.pdsh-capture-region-candidate';
      const before = h.editor.getState();
      p.choose('retake');
      assert.equal(h.root.dataset.state, 'recapturing');
      h.root.querySelector<HTMLElement>(selector)!.click();
      assert.equal(h.editor.getState(), before, '忙碌阶段不得改变区域或历史');
      assert.equal(h.root.querySelector<HTMLButtonElement>("[data-action='undo']")!.disabled, true);
      failRetake(new Error('fixture retake cancelled'));
      await h.flushAsync();
      assert.equal(h.root.dataset.state, 'editing');
      h.root.querySelector<HTMLElement>(selector)!.click();
      assert.equal(h.editor.getState().regions.length, selected ? 0 : 1);
    } finally {
      failRetake(new Error('fixture cleanup'));
      h.close();
    }
  }
});


test('工具、来源和后续打码样式切换不重新合成像素，新增区域仍合成', () => {
  const h = fixture({ automaticRegions: [{ id: 'pixel-stable', x: 10, y: 10, width: 40, height: 20 }] });
  try {
    const p = prepareRegionPointer(h);
    const allocations = h.canvasAllocations();
    const canvas = h.root.querySelector('.pdsh-capture-canvas');
    for (const action of ['tool-redact', 'source-draw', 'style-blur', 'style-solid', 'source-auto', 'tool-move', 'tool-redact']) {
      p.choose(action);
      assert.equal(h.canvasAllocations(), allocations, `${action} 不分配合成画布`);
      assert.equal(h.root.querySelector('.pdsh-capture-canvas'), canvas);
    }
    h.root.querySelector<HTMLElement>('.pdsh-capture-region-candidate')!.click();
    assert.ok(h.canvasAllocations() > allocations, '实际新增遮罩必须更新像素');
    const maskedAllocations = h.canvasAllocations();
    const selected = h.editor.getState().regions;
    p.choose('style-mosaic'); p.choose('source-draw'); p.choose('source-auto');
    assert.equal(h.canvasAllocations(), maskedAllocations);
    assert.equal(h.editor.getState().regions, selected);
    assert.equal(selected[0].style, 'solid', '样式只作用于后续区域');
  } finally { h.close(); }
});
