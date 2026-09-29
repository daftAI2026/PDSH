/**
 * [INPUT]: 依赖非 React 控件的委托提示适配器与 jsdom 事件。
 * [OUTPUT]: 验证自有控件提示的方位/退出/卸载和非插件节点隔离。
 * [POS]: 原生 DOM 与 DSH Tooltip 参数的桥接合同，不冒充桌面端像素验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountDomTooltips } from '../src/client/dom-tooltip.ts';

test('只为自有 DOM 控件显示 DSH 参数提示，点击与卸载清理', () => {
  const dom = new JSDOM('<body><button data-pdsh-search-entry="wide" data-pdsh-tooltip="遮挡侧栏标题">帽子</button><button data-pdsh-tooltip="外部">宿主</button></body>');
  const doc = dom.window.document;
  const dispose = mountDomTooltips(doc);
  const own = doc.querySelector('[data-pdsh-search-entry]');
  own.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true }));
  const bubble = doc.querySelector('[role="tooltip"]');
  assert.equal(bubble?.textContent, '遮挡侧栏标题');
  assert.equal(bubble?.dataset.side, 'bottom');
  own.click(); assert.equal(doc.querySelector('[role="tooltip"]'), null);
  doc.querySelector('button:last-child').dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true }));
  assert.equal(doc.querySelector('[role="tooltip"]'), null);
  own.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true }));
  assert.ok(doc.querySelector('[role="tooltip"]'));
  dispose(); assert.equal(doc.querySelector('[role="tooltip"]'), null);
  dom.window.close();
});
test('工作台区域提示延迟 500ms，离开后取消并不使用浏览器 title', async () => {
  const dom = new JSDOM('<body><div data-pdsh-capture><div data-region data-pdsh-tooltip="移除遮挡"></div></div></body>');
  const doc = dom.window.document;
  const dispose = mountDomTooltips(doc);
  const region = doc.querySelector('[data-region]');
  assert.equal(region.hasAttribute('title'), false);
  region.dispatchEvent(new dom.window.MouseEvent('mouseover', { bubbles: true }));
  assert.equal(doc.querySelector('[role="tooltip"]'), null);
  await new Promise(resolve => setTimeout(resolve, 520));
  assert.equal(doc.querySelector('[role="tooltip"]')?.textContent, '移除遮挡');
  region.dispatchEvent(new dom.window.MouseEvent('mouseout', { bubbles: true }));
  assert.equal(doc.querySelector('[role="tooltip"]'), null);
  dispose(); dom.window.close();
});
