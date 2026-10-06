/**
 * [INPUT]: 依赖 `loadCaptureImage`、可控 Image 与最小 AbortSignal 事件源。
 * [OUTPUT]: 验证预取消不创建 Image、加载取消即时结算/移除 src 并归还监听，成功保留可渲染源，错误路径释放资源。
 * [POS]: Capture 图片加载端口的资源合同；模拟 Image 事件，不解码真实图片或启动 Desktop。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadCaptureImage } from '../src/client/capture/wallpaper.ts';

type Listener = EventListenerOrEventListenerObject;

class ControlledImage {
  readonly listeners = new Map<string, Set<Listener>>();
  source = '';
  sourceRemoved = false;

  addEventListener(type: string, listener: Listener): void {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  set src(value: string) {
    this.source = value;
    this.sourceRemoved = false;
  }

  get src(): string {
    return this.source;
  }

  removeAttribute(name: string): void {
    if (name !== 'src') return;
    this.source = '';
    this.sourceRemoved = true;
  }

  emit(type: string): void {
    const event = new Event(type);
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      if (typeof listener === 'function') listener.call(this as unknown as EventTarget, event);
      else listener.handleEvent(event);
    }
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

function controlledSignal(initiallyAborted = false) {
  let aborted = initiallyAborted;
  const listeners = new Set<Listener>();
  const signal = {
    get aborted() { return aborted; },
    addEventListener(type: string, listener: Listener) { if (type === 'abort') listeners.add(listener); },
    removeEventListener(type: string, listener: Listener) { if (type === 'abort') listeners.delete(listener); },
    get abortListenerCount() { return listeners.size; },
    abort() {
      if (aborted) return;
      aborted = true;
      const event = new Event('abort');
      for (const listener of [...listeners]) {
        if (typeof listener === 'function') listener.call(signal as unknown as EventTarget, event);
        else listener.handleEvent(event);
      }
    },
  };
  return signal;
}

function installImageFactory() {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const images: ControlledImage[] = [];
  Object.defineProperty(globalThis, 'Image', { configurable: true, value: class extends ControlledImage {
    constructor() { super(); images.push(this); }
  } });
  return {
    images,
    restore() {
      if (previous) Object.defineProperty(globalThis, 'Image', previous);
      else delete (globalThis as Record<string, unknown>).Image;
    },
  };
}

test('pre-aborted image load rejects without constructing Image', async () => {
  const imageFactory = installImageFactory();
  try {
    const signal = controlledSignal(true);
    await assert.rejects(loadCaptureImage('blob:fixture', signal as unknown as AbortSignal), error => error.name === 'AbortError');
    assert.equal(imageFactory.images.length, 0);
    assert.equal(signal.abortListenerCount, 0);
  } finally { imageFactory.restore(); }
});

test('abort immediately settles, stops the owned image request and removes all listeners', async () => {
  const imageFactory = installImageFactory();
  try {
    const signal = controlledSignal();
    const pending = loadCaptureImage('blob:fixture', signal as unknown as AbortSignal);
    const image = imageFactory.images[0];
    assert.equal(image.src, 'blob:fixture');
    assert.equal(image.listenerCount('load'), 1);
    assert.equal(image.listenerCount('error'), 1);
    assert.equal(signal.abortListenerCount, 1);
    signal.abort();
    await assert.rejects(pending, error => error.name === 'AbortError');
    assert.equal(image.sourceRemoved, true);
    assert.equal(image.listenerCount('load'), 0);
    assert.equal(image.listenerCount('error'), 0);
    assert.equal(signal.abortListenerCount, 0);
    image.emit('load');
    assert.equal(image.source, '', 'a late load event cannot revive a canceled source');
  } finally { imageFactory.restore(); }
});

test('successful load keeps its source but returns load/error/abort listeners', async () => {
  const imageFactory = installImageFactory();
  try {
    const signal = controlledSignal();
    const pending = loadCaptureImage('blob:retained', signal as unknown as AbortSignal);
    const image = imageFactory.images[0];
    image.emit('load');
    assert.equal(await pending, image);
    assert.equal(image.src, 'blob:retained', 'the compositor needs the loaded image source');
    assert.equal(image.sourceRemoved, false);
    assert.equal(image.listenerCount('load'), 0);
    assert.equal(image.listenerCount('error'), 0);
    assert.equal(signal.abortListenerCount, 0);
    signal.abort();
    assert.equal(image.src, 'blob:retained', 'abort after settlement must not clear a successful image');
  } finally { imageFactory.restore(); }
});

test('image error rejects after clearing src and removing all listeners', async () => {
  const imageFactory = installImageFactory();
  try {
    const signal = controlledSignal();
    const pending = loadCaptureImage('blob:broken', signal as unknown as AbortSignal);
    const image = imageFactory.images[0];
    image.emit('error');
    await assert.rejects(pending, /Unable to load image/);
    assert.equal(image.sourceRemoved, true);
    assert.equal(image.listenerCount('load'), 0);
    assert.equal(image.listenerCount('error'), 0);
    assert.equal(signal.abortListenerCount, 0);
  } finally { imageFactory.restore(); }
});
