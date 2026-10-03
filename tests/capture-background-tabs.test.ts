/**
 * [INPUT]: 依赖真实 Tabs 适配器、React 元素与只观察 Host 控件参数的根桩。
 * [OUTPUT]: 验证四项顺序、受控模式、禁用围栏、键盘即时反馈和精确根释放。
 * [POS]: 原生委托边界合同；不伪造 Host 键盘实现，不代替实机验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { JSDOM } from 'jsdom';
import { CAPTURE_BACKGROUND_MODES } from '../src/client/capture/background-modes.ts';

test('四模式委托Host原生控件，选择受控、忙碌拒绝、销毁精确归还', () => {
  const dom = new JSDOM('<main/>');
  const container = dom.window.document.querySelector('main');
  const renders = [], changes = [];
  let unmounts = 0;
  const SegmentedControl = () => null;
  const module = { exports: {} };
  const code = transformSync(readFileSync(new URL('../src/client/capture/background-tabs.tsx', import.meta.url), 'utf8'), { loader:'tsx', format:'cjs' }).code;
  runInNewContext(code, { module, exports:module.exports, require(id) {
    if(id==='react') return React;
    if(id==='react-dom/client') return { createRoot: () => ({render:node=>renders.push(node),unmount:()=>unmounts++}) };
    if(id==='@deepseek-ai/dsh-client-ui-primitives') return {SegmentedControl};
    if(id==='./background-modes.ts') return {CAPTURE_BACKGROUND_MODES};
    throw Error(id);
  } });
  try {
    const tabs = module.exports.mountCaptureBackgroundTabs(container, {id:'fixture',value:'none',label:'背景',
      labels:{none:'无背景','plain-color':'纯色',gradients:'渐变',wallpapers:'图片'},disabled:false,onChange:mode=>changes.push(mode)});
    assert.equal(renders[0].type, SegmentedControl);
    assert.deepEqual(Array.from(renders[0].props.options, option=>option.label), ['无背景','纯色','渐变','图片']);
    const oldChange = renders[0].props.onChange;
    oldChange('gradients'); assert.deepEqual(changes,['gradients']);
    tabs.update('gradients',true); assert.equal(renders.at(-1).props.value,'gradients');
    oldChange('none'); assert.deepEqual(changes,['gradients']);
    container.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
    assert.ok(container.hasAttribute('data-keyboard'));
    container.dispatchEvent(new dom.window.Event('pointerdown',{bubbles:true}));
    assert.equal(container.hasAttribute('data-keyboard'),false);
    const before = renders.length;
    tabs.destroy(); tabs.destroy(); tabs.update('none',false); oldChange('none');
    assert.equal(unmounts,1); assert.equal(renders.length,before); assert.deepEqual(changes,['gradients']);
    container.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'End',bubbles:true}));
    assert.equal(container.hasAttribute('data-keyboard'),false);
  } finally { dom.window.close(); }
});
