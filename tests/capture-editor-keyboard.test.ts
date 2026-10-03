/**
 * [INPUT]: 依赖工作台键盘适配、真实jsdom焦点与背景模型，夹具含tab/面板/隐藏控件。
 * [OUTPUT]: 验证Tab循环只经过可见可用tab stop，排除负tabindex、hidden/inert与CSS隐藏面板；不替代Desktop键盘验收。
 * [POS]: 截图面板切换的焦点围栏合同，避免隐藏选项与非选中Tabs被工作台全局trap误入。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { wireKeyboard } from '../src/client/capture/editor-keyboard.ts';
import { createCaptureWindowState } from '../src/client/capture/model.ts';

test('Tab及Shift+Tab跳过隐藏面板、负tabindex与disabled，保持单一Tabs入口', () => {
  const dom = new JSDOM('<main><button id="close">close</button><div role="tablist"><button role="tab" id="selected" tabindex="0">Color</button><button role="tab" id="other" tabindex="-1">Image</button></div><section role="tabpanel" tabindex="0" id="panel"><button id="swatch">swatch</button></section><section hidden><button>hidden</button></section><section inert><button>inert</button></section><section style="display:none"><button>display-none</button></section><button disabled>disabled</button><button id="save">save</button></main>', { pretendToBeVisual: true });
  const prior = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  try {
    const root = dom.window.document.querySelector('main');
    wireKeyboard(root, createCaptureWindowState({ width: 800, height: 600, scaleFactor: 1 }), () => {}, () => {}, async () => {});
    const tab = (shiftKey = false) => root.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }));
    assert.equal(dom.window.document.activeElement.id, 'close');
    for (const id of ['selected','panel','swatch','save','close']) { tab(); assert.equal(dom.window.document.activeElement.id, id); }
    for (const id of ['save','swatch','panel','selected','close']) { tab(true); assert.equal(dom.window.document.activeElement.id, id); }
  } finally {
    dom.window.close(); if (prior) Object.defineProperty(globalThis, 'document', prior); else delete globalThis.document;
  }
});
