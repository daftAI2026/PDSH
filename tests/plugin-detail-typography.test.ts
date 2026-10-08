/**
 * [INPUT]: 依赖 jsdom、真实详情标题适配器与生产样式。
 * [OUTPUT]: 验证仅标记自身标题、胶囊不变、未知结构退让及所有权归还。
 * [POS]: 排版范围和生命周期合同；原生 CSS 的字形效果由真实浏览器另验。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { mountPluginDetailTypography } from '../src/client/plugin-detail-typography.ts';
function fixture() {
  return new JSDOM('<section data-plugin-detail="@daftai/pdsh"><div><h3>DSH 私密模式</h3><span data-tone="neutral">v0.5.4</span></div></section><section data-plugin-detail="other"><h3>Other</h3><span data-tone="neutral">v1.0.0</span></section>');
}
test('只裁自身大标题字体留白，不改变版本胶囊或其他详情', () => {
  const dom = fixture(), doc = dom.window.document;
  const before = doc.body.innerHTML, version = doc.querySelector('h3').nextElementSibling.outerHTML;
  const control = mountPluginDetailTypography(doc);
  assert.equal(doc.querySelectorAll('[data-pdsh-detail-heading]').length, 1);
  assert.equal(doc.querySelector('h3').nextElementSibling.outerHTML, version);
  const css = readFileSync(new URL('../src/client/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\[data-pdsh-detail-heading\]\s*\{[^}]*text-box:\s*trim-both cap alphabetic/);
  assert.doesNotMatch(css, /pdsh-version-glyph-offset/);
  control.dispose(); assert.equal(doc.body.innerHTML, before); dom.window.close();
});
test('外部接管标题标记后不重写，卸载保留外部值', async () => {
  const dom = fixture(), doc = dom.window.document, title = doc.querySelector('h3');
  const control = mountPluginDetailTypography(doc);
  title.setAttribute('data-pdsh-detail-heading', 'external');
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(title.getAttribute('data-pdsh-detail-heading'), 'external');
  control.dispose(); assert.equal(title.getAttribute('data-pdsh-detail-heading'), 'external'); dom.window.close();
});
test('重复详情或未知标题结构撤销自有标记', async () => {
  const dom = fixture(), doc = dom.window.document, title = doc.querySelector('h3');
  const control = mountPluginDetailTypography(doc);
  const duplicate = doc.querySelector('section').cloneNode(true); doc.body.append(duplicate);
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(title.hasAttribute('data-pdsh-detail-heading'), false);
  duplicate.remove(); title.innerHTML = '<span>nested</span>';
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(title.hasAttribute('data-pdsh-detail-heading'), false);
  control.dispose(); dom.window.close();
});