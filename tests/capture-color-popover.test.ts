/**
 * [INPUT]: 依赖生产选色浮层、jsdom 与可控指针边界。
 * [OUTPUT]: 验证白色和黑色端点不丢失色相，黑色调色保留饱和度；外部颜色同步更新同一交互状态。
 * [POS]: 选色色域回归；DOM 窄桩不证明 Desktop 绘制或真实指针捕获。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { captureHexFromHsv, captureHsvFromHex, syncCaptureColorPopover, wireCaptureColorPopovers } from '../src/client/capture/color-popover.ts';

function fixture(initial: string) {
  const dom = new JSDOM('<main><button data-color-trigger="background">color</button></main>', { pretendToBeVisual: true });
  const globals = { document: dom.window.document, window: dom.window, HTMLElement: dom.window.HTMLElement };
  const previous = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { value, configurable: true });
  const root = dom.window.document.querySelector('main')!;
  let color = initial;
  const changes: string[] = [];
  const dispose = wireCaptureColorPopovers(root, { label: () => 'fixture', readColor: () => color, onOpen() {}, onChange(_, next) { color = next; changes.push(next); syncCaptureColorPopover(root, 'background', next); } });
  root.querySelector('button')!.click();
  function move(kind: 'saturation' | 'hue', x: number, y = 0) {
    const interactive = root.querySelector<HTMLElement>(`[data-color-${kind}] .react-colorful__interactive`)!;
    interactive.getBoundingClientRect = () => new dom.window.DOMRect(100, 50, 200, 100);
    interactive.setPointerCapture = () => {};
    interactive.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, clientX: 100 + 200 * x, clientY: 50 + 100 * y }));
    return color;
  }
  return { root, move, changes, set(next: string) { color = next; syncCaptureColorPopover(root, 'background', next); }, close() { dispose(); dom.window.close(); for (const [key, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } } };
}

test('选到白色后重返彩色区保留原色相，不重置为红色色域', () => {
  const initial = '#37b3b8';
  const h = fixture(initial);
  try {
    assert.equal(h.move('saturation', 0, 0), '#ffffff');
    assert.equal(h.move('saturation', 1, 0), captureHexFromHsv({ hue: captureHsvFromHex(initial).hue, saturation: 100, value: 100 }));
  } finally { h.close(); }
});

test('黑色端点调整色相后抬亮度，保留新色相与原饱和度', () => {
  const initial = '#37b3b8';
  const h = fixture(initial);
  try {
    const saturation = captureHsvFromHex(initial).saturation;
    assert.equal(h.move('saturation', saturation / 100, 1), '#000000');
    assert.equal(h.move('hue', 1 / 3), '#000000');
    const pointer = h.root.querySelector<HTMLElement>('[data-color-saturation] .react-colorful__pointer')!;
    assert.ok(Math.abs(Number.parseFloat(pointer.style.left) - saturation) < 0.000001, '黑色色相变更不清空饱和度坐标');
    assert.equal(h.move('saturation', saturation / 100, 0), captureHexFromHsv({ hue: 120, saturation, value: 100 }));
  } finally { h.close(); }
});

test('父模型回显 HEX 不量化或重置选色坐标，黑色调色不重复提交颜色', () => {
  const h = fixture('#37b3b8');
  try {
    h.move('saturation', 0.701234, 0.271234);
    const pointer = h.root.querySelector<HTMLElement>('[data-color-saturation] .react-colorful__pointer')!;
    assert.ok(Math.abs(Number.parseFloat(pointer.style.left) - 70.1234) < 0.000001);
    assert.ok(Math.abs(Number.parseFloat(pointer.style.top) - 27.1234) < 0.000001);
    h.move('saturation', 0.7, 1);
    const count = h.changes.length;
    h.move('hue', 1 / 3);
    assert.equal(h.changes.length, count);
  } finally { h.close(); }
});

test('外部同步新彩色值后使用新色域，灰色同步仍保留该色相', () => {
  const h = fixture('#37b3b8');
  try {
    h.set('#0000ff');
    h.set('#888888');
    assert.equal(h.move('saturation', 1, 0), '#0000ff');
  } finally { h.close(); }
});
