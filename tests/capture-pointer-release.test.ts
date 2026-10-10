/**
 * [INPUT]: 依赖生产视口、编辑模型与 jsdom 合成指针序列。
 * [OUTPUT]: 验失捕获等待匹配 pointerup；取消路径不提交半笔。
 * [POS]: capture 状态机合同；重放实测顺序，不模拟 Blink 捕获实现。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createCaptureEditorViewport } from '../src/client/capture/editor-viewport.ts';
import { createCaptureWindowState } from '../src/client/capture/model.ts';

function fixture(run: (f: { send: (kind: string, buttons?: number, where?: 'stage' | 'document', id?: number) => void;
  count: () => number; blur: () => void; cancel: () => void }) => void): void {
  const dom = new JSDOM('<main data-state="editing"><section><div><canvas width="120" height="80"></canvas></div></section></main>');
  const previous = globalThis.Element;
  Object.assign(globalThis, { Element: dom.window.Element });
  const root = dom.window.document.querySelector('main')!;
  const stage = root.querySelector('section')!;
  const frame = stage.querySelector('div')!;
  const canvas = frame.querySelector('canvas')!;
  canvas.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 120, bottom: 80, width: 120, height: 80, toJSON() {} });
  const state = { ...createCaptureWindowState({ width: 120, height: 80 }), tool: 'redact' as const, redactionSource: 'draw' as const, padding: 0 };
  let count = 0;
  stage.setPointerCapture = () => {};
  stage.hasPointerCapture = () => false;
  const viewport = createCaptureEditorViewport({ root, readState: () => state,
    dispatchRegion: () => { count++; }, setZoom: () => {}, createManualRegionId: () => 'manual-test' });
  viewport.bind(stage, frame, canvas);
  try { run({ count: () => count, blur: () => dom.window.dispatchEvent(new dom.window.Event('blur')),
    cancel: viewport.cancelGesture,
    send(kind, buttons = kind === 'pointerdown' ? 1 : 0, where = 'stage', id = 1) {
      const end = kind === 'pointerup';
      const event = new dom.window.MouseEvent(kind, { bubbles: true, cancelable: true, button: 0, buttons,
        clientX: end ? 70 : 20, clientY: end ? 60 : 20 });
      Object.defineProperty(event, 'pointerId', { value: id });
      (where === 'stage' ? stage : dom.window.document).dispatchEvent(event);
    } });
  } finally { viewport.destroy(); dom.window.close(); Object.assign(globalThis, { Element: previous }); }
}

test('松键失捕获后只由同指针匹配 pointerup提交，连续十笔不丢失、不重复', () => fixture(f => {
  for (let i = 0; i < 10; i++) {
    f.send('pointerdown'); f.send('gotpointercapture', 1); f.send('lostpointercapture', 0);
    f.send('pointermove', 0);
    assert.equal(f.count(), i, '失捕获不能伪造提交');
    f.send('pointerup', 0, 'document', 2);
    assert.equal(f.count(), i, '其他指针不能提交');
    f.send('pointerup', 0, i % 2 ? 'stage' : 'document');
    f.send('pointerup', 0, 'stage');
    assert.equal(f.count(), i + 1, '匹配 pointerup 须且仅须提交一次');
  }
}));

test('仍按键的失捕获、失焦、取消、模式切换都丢弃半笔', () => fixture(f => {
  for (const reason of ['pressed', 'blur', 'cancel', 'mode']) {
    f.send('pointerdown'); f.send('lostpointercapture', reason === 'pressed' ? 1 : 0);
    if (reason === 'blur') f.blur();
    if (reason === 'cancel') f.send('pointercancel', 0, 'document');
    if (reason === 'mode') f.cancel();
    f.send('pointerup', 0, 'document');
    assert.equal(f.count(), 0, reason);
  }
}));

test('遗漏松开后新笔取消旧草稿，不锁住下次输入', () => fixture(f => {
  f.send('pointerdown'); f.send('lostpointercapture', 0);
  f.send('pointerdown'); f.send('pointerup');
  assert.equal(f.count(), 1);
}));

test('遗漏松开后舞台外新点击不能冒充旧笔终态', () => fixture(f => {
  f.send('pointerdown'); f.send('lostpointercapture', 0);
  f.send('pointerdown', 1, 'document'); f.send('pointerup', 0, 'document');
  assert.equal(f.count(), 0, '工具栏新点击必须先取消旧草稿');
  f.send('pointerdown'); f.send('pointerup');
  assert.equal(f.count(), 1);
}));


test('尚未激活捕获时零按钮移动不吞掉随后匹配 pointerup', () => fixture(f => {
  f.send('pointerdown'); f.send('pointermove', 0);
  assert.equal(f.count(), 0, '移动不是提交终态');
  f.send('pointerup'); f.send('pointerup');
  assert.equal(f.count(), 1, '没有 got/lost 也由匹配 pointerup 提交一次');
}));
