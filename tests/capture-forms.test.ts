/**
 * [INPUT]: 依赖表单快照适配器和 jsdom 的默认属性/即时状态差异。
 * [OUTPUT]: 验证 checkbox、textarea、select 当前值进入克隆且原控件不变。
 * [POS]: 页面取像表单保真合同；真实 Canvas 另由浏览器验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { prepareViewportForms } from '../src/client/capture/viewport-forms.ts';

test('表单克隆使用当前交互状态而不是初始HTML属性，所有临时标记归还', () => {
  const dom = new JSDOM('<input type="checkbox" checked><textarea data-pdsh-capture-form="existing">初始值</textarea><select><option selected>A</option><option>B</option></select>');
  const doc = dom.window.document;
  const input = doc.querySelector('input'), area = doc.querySelector('textarea'), select = doc.querySelector('select');
  input.checked = false; area.value = '当前草稿'; select.selectedIndex = 1;
  const before = doc.body.outerHTML;
  const adapter = prepareViewportForms(doc, new AbortController().signal);
  for (const node of [input, area, select]) {
    const cloned = node.cloneNode(true);
    adapter.onCloneEachNode(cloned);
    assert.equal(cloned.hasAttribute('data-pdsh-capture-form'), false);
    if (node === input) assert.equal(cloned.hasAttribute('checked'), false);
    if (node === area) assert.equal(cloned.textContent, '当前草稿');
    if (node === select) {
      assert.equal(cloned.options[0].hasAttribute('selected'), false);
      assert.equal(cloned.options[1].hasAttribute('selected'), true);
    }
  }
  adapter.restore();
  assert.equal(doc.body.outerHTML, before);
  assert.equal(input.checked, false); assert.equal(area.value, '当前草稿'); assert.equal(select.selectedIndex, 1);
  dom.window.close();
});
