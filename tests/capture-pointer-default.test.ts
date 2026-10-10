/**
 * [INPUT]: 依赖生产视口控制器、编辑模型与 jsdom 指针事件。
 * [OUTPUT]: 验手绘和平移独占默认动作；拒绝输入保留原生动作，仍按键失捕获仍取消。
 * [POS]: capture 手势起点合同；不替代 Electron 原生指针验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createCaptureEditorViewport } from '../src/client/capture/editor-viewport.ts';
import { createCaptureWindowState } from '../src/client/capture/model.ts';

test('接受的手绘与平移取消浏览器默认动作，忽略输入不取消', () => {
  const dom = new JSDOM('<main data-state="editing"><section><div><canvas></canvas></div></section></main>');
  const previous = globalThis.Element;
  Object.assign(globalThis, { Element: dom.window.Element });
  const root = dom.window.document.querySelector('main')!;
  const stage = root.querySelector('section')!;
  const frame = stage.querySelector('div')!;
  const canvas = frame.querySelector('canvas')!;
  let state = createCaptureWindowState({ width: 120, height: 80 });
  let commits = 0;
  stage.setPointerCapture = () => {};
  stage.hasPointerCapture = () => false;
  const viewport = createCaptureEditorViewport({ root, readState: () => state,
    dispatchRegion: () => { commits++; }, setZoom: () => {}, createManualRegionId: () => 'manual-test' });
  const pointer = (type: string, button = 0) => {
    const event = new dom.window.MouseEvent(type, { bubbles: true, cancelable: true, button, buttons: type === 'lostpointercapture' ? 1 : 0, clientX: 20, clientY: 20 });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    stage.dispatchEvent(event);
    return event;
  };
  try {
    viewport.bind(stage, frame, canvas);
    for (const draw of [false, true]) {
      state = { ...state, tool: draw ? 'redact' : 'move', redactionSource: 'draw' };
      assert.equal(pointer('pointerdown').defaultPrevented, true, '接受手势必须阻止原生选择或拖拽争夺捕获');
      pointer('lostpointercapture'); pointer('pointerup');
      assert.equal(commits, 0, '不可为保留首笔而放宽真实失捕获取消');
    }
    state = { ...state, tool: 'redact', redactionSource: 'auto' };
    assert.equal(pointer('pointerdown').defaultPrevented, false);
    assert.equal(pointer('pointerdown', 2).defaultPrevented, false);
    state = { ...state, redactionSource: 'draw' };
    stage.setPointerCapture = () => { throw Error('inactive pointer'); };
    assert.equal(pointer('pointerdown').defaultPrevented, false, '未获得捕获不得吞掉默认动作');
  } finally { viewport.destroy(); dom.window.close(); Object.assign(globalThis, { Element: previous }); }
});
