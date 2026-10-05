/**
 * [INPUT]: 依赖 capture privacy 的候选识别出口、redactions 选择解析与 jsdom 几何桩。
 * [OUTPUT]: 验证 DOM 候选可见性/裁剪/上限、严格侧栏优先，以及移动节点重定位而替换节点不继承旧选择。
 * [POS]: 自动遮挡建议的 DOM 识别合同；不证明页面到原生整窗的像素坐标映射。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { collectDSHCandidates } from '../src/client/capture/privacy.ts';
import { resolveSelectedCaptureRegions } from '../src/client/capture/redactions.ts';
import type { CaptureRegion } from '../src/client/capture/model.ts';

function rect(element: Element, left: number, top: number, width: number, height: number) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({ left, top, right: left + width, bottom: top + height, x: left, y: top, width, height, toJSON() {} }),
  });
}

function candidates(dom: JSDOM) {
  return collectDSHCandidates(dom.window.document);
}

test('部分视口可见的通用候选只暴露视口交集几何', () => {
  const dom = new JSDOM('<p>可见文本候选</p>');
  const node = dom.window.document.querySelector('p')!;
  rect(node, -5, 4, 40, 20);
  assert.deepEqual(candidates(dom).map(({ x, y, width, height }) => ({ x, y, width, height })), [
    { x: 0, y: 4, width: 35, height: 20 },
  ]);
  dom.window.close();
});

test('通用候选的有限几何与最小可见边界独立验证', () => {
  const dom = new JSDOM('<p>过窄文本</p><p>过矮文本</p><p>非数坐标</p><p>无限尺寸</p><p>边界文本</p>');
  const nodes = [...dom.window.document.querySelectorAll('p')];
  rect(nodes[0], 10, 10, 23, 12);
  rect(nodes[1], 10, 30, 24, 11);
  rect(nodes[2], Number.NaN, 50, 30, 20);
  rect(nodes[3], 10, 70, Number.POSITIVE_INFINITY, 20);
  rect(nodes[4], 10, 90, 24, 12);
  assert.deepEqual(candidates(dom).map(({ x, y, width, height }) => ({ x, y, width, height })), [
    { x: 10, y: 90, width: 24, height: 12 },
  ]);
  dom.window.close();
});

test('候选还需与 DSH 聊天滚动祖先的 overflow scrollport 相交', () => {
  const dom = new JSDOM('<div style="overflow:auto"><p>滚动区域内文本候选</p></div>');
  const doc = dom.window.document;
  const scroller = doc.querySelector('div')!, paragraph = doc.querySelector('p')!;
  rect(scroller, 20, 20, 100, 60);
  Object.defineProperties(scroller, {
    clientLeft: { configurable: true, value: 2 },
    clientTop: { configurable: true, value: 3 },
    clientWidth: { configurable: true, value: 96 },
    clientHeight: { configurable: true, value: 50 },
  });
  rect(paragraph, 10, 10, 140, 90);
  assert.deepEqual(candidates(dom).map(({ x, y, width, height }) => ({ x, y, width, height })), [
    { x: 22, y: 23, width: 96, height: 50 },
  ]);
  dom.window.close();
});

test('无法换算的变换滚动祖先不生成猜测区域', () => {
  const dom = new JSDOM('<section style="transform:scale(1.2)"><div style="overflow:hidden"><p>变换容器中的可见文本</p></div></section>');
  const doc = dom.window.document;
  const transformed = doc.querySelector('section')!, scroller = doc.querySelector('div')!, paragraph = doc.querySelector('p')!;
  rect(transformed, 0, 0, 200, 120);
  rect(scroller, 20, 20, 100, 60);
  Object.defineProperties(scroller, {
    clientLeft: { configurable: true, value: 0 },
    clientTop: { configurable: true, value: 0 },
    clientWidth: { configurable: true, value: 100 },
    clientHeight: { configurable: true, value: 60 },
  });
  rect(paragraph, 30, 30, 80, 24);
  assert.deepEqual(candidates(dom), []);
  dom.window.close();
});

test('隐藏、不可见和完全处于视口外的候选跳过', () => {
  const dom = new JSDOM('<main><p style="display:none">隐藏节点</p><section hidden><p>隐藏祖先</p></section><section inert><p>惰性祖先</p></section><section style="visibility:hidden"><p>不可见祖先</p></section><section style="opacity:0"><p>透明祖先</p></section><p aria-hidden="true">辅助隐藏</p><p>视口之外</p></main>');
  const doc = dom.window.document;
  for (const [index, node] of [...doc.querySelectorAll('p')].entries()) rect(node, index === 6 ? 1100 : 10, 10, 120, 24);
  assert.deepEqual(candidates(dom), []);
  dom.window.close();
});

test('通用文本阈值、textarea 非空与无文本图片规则分开执行', () => {
  const dom = new JSDOM('<p>ok</p><p>   </p><textarea></textarea><textarea>   </textarea><textarea>有效内容</textarea><div contenteditable="true"> </div><img alt="">');
  const doc = dom.window.document;
  for (const [index, node] of [...doc.querySelectorAll('p, textarea, [contenteditable], img')].entries()) {
    rect(node, 20 + index * 40, 30, 36, 20);
  }
  const result = candidates(dom);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(({ x }) => x), [180, 260], '仅非空 textarea 和无文本图片进入候选');
  dom.window.close();
});

test('嵌套语义块折叠为最外层候选，不重复建议子段落', () => {
  const dom = new JSDOM('<blockquote>引用文本<p>引用内部段落</p></blockquote>');
  const quote = dom.window.document.querySelector('blockquote')!;
  const paragraph = dom.window.document.querySelector('p')!;
  rect(quote, 10, 20, 300, 100);
  rect(paragraph, 20, 30, 280, 40);
  assert.equal(candidates(dom).length, 1);
  assert.deepEqual(candidates(dom).map(({ x, y, width, height }) => ({ x, y, width, height })), [
    { x: 10, y: 20, width: 300, height: 100 },
  ]);
  dom.window.close();
});

test('候选最多 150 个，严格识别的侧栏标题优先于通用节点', () => {
  const paragraphMarkup = Array.from({ length: 151 }, (_, index) => `<p>通用段落 ${index}</p>`).join('');
  const dom = new JSDOM(`<div data-slot="sidebar.workspaces"><div role="treeitem" data-row-key="session:one"><span></span><span>严格标题</span></div></div>${paragraphMarkup}`);
  const doc = dom.window.document;
  const paragraphs = [...doc.querySelectorAll('p')];
  for (const [index, node] of paragraphs.entries()) rect(node, 10, 10 + index * 2, 160, 20);
  let overCapGeometryReads = 0;
  Object.defineProperty(paragraphs[150], 'getBoundingClientRect', {
    configurable: true,
    value: () => { overCapGeometryReads++; throw new Error('cap must stop before measuring later candidates'); },
  });
  const title = doc.querySelector('[data-row-key="session:one"] span:nth-child(2)')!;
  rect(title, 700, 40, 120, 24);
  const result = candidates(dom);
  assert.equal(result.length, 150);
  assert.ok(result.some(({ x }) => x === 700), '严格识别标题在 cap 之前保留');
  assert.equal(overCapGeometryReads, 0, '达到候选上限后不再读取后续几何');
  dom.window.close();
});

test('身份候选只复用唯一启动器识别，并保留原生头像盒与名称节点', () => {
  const dom = new JSDOM('<div data-slot="settings.launcher"><button aria-haspopup="menu" data-collapsed="false" data-signed-out="false"><span><img src="avatar.png"></span><span>原生名称</span></button></div>');
  const doc = dom.window.document;
  const avatar = doc.querySelector('button > span:first-child')!;
  const label = doc.querySelector('button > span:nth-child(2)')!;
  rect(avatar, 10, 10, 32, 32);
  rect(avatar.querySelector('img')!, 10, 10, 32, 32);
  rect(label, 50, 10, 100, 24);
  assert.deepEqual(candidates(dom).map(({ x }) => x), [10, 50]);
  dom.window.close();
});

test('节点移动与候选插入不改变原 ID，替换节点不能继承旧选择身份', () => {
  const dom = new JSDOM('<p>原始候选</p>');
  const doc = dom.window.document;
  const original = doc.querySelector('p')!;
  rect(original, 10, 10, 100, 24);
  const firstId = candidates(dom)[0]?.id;
  assert.ok(firstId);
  const selection: CaptureRegion[] = [{ id: firstId, source: 'automatic', style: 'mosaic', rect: { x: 10, y: 10, width: 100, height: 24 } }];

  const inserted = doc.createElement('p'); inserted.textContent = '后来插入'; rect(inserted, 10, 50, 100, 24);
  doc.body.prepend(inserted);
  assert.equal(candidates(dom).find(({ y }) => y === 10)?.id, firstId);

  const moved = doc.createElement('div');
  original.before(moved); moved.append(original);
  rect(original, 15, 14, 100, 24);
  const movedCandidates = candidates(dom);
  assert.equal(movedCandidates.find(({ y }) => y === 14)?.id, firstId);
  assert.deepEqual(resolveSelectedCaptureRegions(selection, movedCandidates)[0].rect, { x: 15, y: 14, width: 100, height: 24 });

  const replacement = doc.createElement('p'); replacement.textContent = '替换候选'; rect(replacement, 15, 14, 100, 24);
  original.replaceWith(replacement);
  const replacementCandidates = candidates(dom);
  const replacementId = replacementCandidates.find(({ y }) => y === 14)?.id;
  assert.ok(replacementId);
  assert.notEqual(replacementId, firstId);
  assert.deepEqual(resolveSelectedCaptureRegions(selection, replacementCandidates), [], '相同位置的新节点不能复活旧选区');
  dom.window.close();
});

test('排除工作台、capture-hide、自有 tooltip 与提示 portal，但保留宿主正文', () => {
  const dom = new JSDOM('<div data-pdsh-capture><p>工作台内容</p></div><div data-pdsh-capture-hide><p>自有隐藏浮层</p></div><div role="tooltip"><p>宿主提示泡</p></div><span class="pdsh-native-tooltip">PDSH 提示泡内容</span><p>普通宿主正文</p>');
  const doc = dom.window.document;
  for (const [index, node] of [...doc.querySelectorAll('p, .pdsh-native-tooltip')].entries()) rect(node, 20 + index * 80, 20, 120, 24);
  const result = candidates(dom);
  assert.equal(result.length, 1);
  assert.equal(result[0].x, 340);
  dom.window.close();
});
