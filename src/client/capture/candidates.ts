/**
 * [INPUT]: 依赖共享 sidebar title/唯一 identity 识别、model 矩形契约、DOM 可见性和 viewport 几何。
 * [OUTPUT]: 提供最多150个视口裁剪后的局部候选，ID 仅绑定当前 Document 中的 Element 身份。
 * [POS]: 自动遮挡的 DOM 建议层；与临时隐私预遮挡分离，不推断原生窗口像素原点。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { recognizedSidebarTitles } from '../sidebar-redaction.ts';
import { recognizeSidebarIdentity } from '../presentation.ts';
import type { CaptureCandidate, CaptureRect } from './model.ts';

const MAX_CANDIDATES = 150;
const MIN_CANDIDATE_WIDTH = 24;
const MIN_CANDIDATE_HEIGHT = 12;
const GENERIC_SELECTOR = 'p, li, pre, blockquote, h1, h2, h3, h4, h5, h6, td, img, textarea, [contenteditable="true"]';
const OWNED_UI_ATTRIBUTES = ['data-pdsh-capture', 'data-pdsh-capture-host', 'data-pdsh-capture-hide', 'data-capture-hide'];

type CandidateNode = { node: Element; strict: boolean };
type AcceptedCandidate = { node: Element; rect: CaptureRect };
type DocumentIdentities = { elements: WeakMap<Element, string>; next: number };
const documentIdentities = new WeakMap<Document, DocumentIdentities>();

function isOwnedUI(node: Element): boolean {
  for (let current: Element | null = node; current; current = current.parentElement) {
    if (OWNED_UI_ATTRIBUTES.some(attribute => current.hasAttribute(attribute))) return true;
    if (current.getAttribute('role') === 'tooltip' || current.classList.contains('pdsh-native-tooltip')
      || current.hasAttribute('data-color-popover')) return true;
  }
  return false;
}

function isVisible(node: Element, doc: Document): boolean {
  const view = doc.defaultView;
  for (let current: Element | null = node; current; current = current.parentElement) {
    if (current.hasAttribute('hidden') || current.hasAttribute('inert') || current.getAttribute('aria-hidden') === 'true') return false;
    const style = view?.getComputedStyle(current);
    if (!style) continue;
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse'
      || style.contentVisibility === 'hidden') return false;
    if (style.opacity !== '' && Number.isFinite(Number(style.opacity)) && Number(style.opacity) <= 0) return false;
  }
  return true;
}

function hasUsefulContent(node: Element): boolean {
  if (node.tagName === 'IMG') return true;
  if (node.tagName === 'TEXTAREA') return ((node as HTMLTextAreaElement).value || '').trim().length > 0;
  return (node.textContent || '').trim().length >= 3;
}

function clipsOverflow(value: string): boolean {
  return value === 'hidden' || value === 'clip' || value === 'auto' || value === 'scroll' || value === 'overlay';
}

function hasTransform(style: CSSStyleDeclaration): boolean {
  if (style.transform && style.transform !== 'none') return true;
  const translate = style.getPropertyValue('translate').trim();
  const rotate = style.getPropertyValue('rotate').trim();
  const scale = style.getPropertyValue('scale').trim();
  const zoom = style.getPropertyValue('zoom').trim();
  return (translate !== '' && translate !== 'none') || (rotate !== '' && rotate !== 'none')
    || (scale !== '' && scale !== 'none' && !/^1(?:\s+1)?$/.test(scale))
    || (zoom !== '' && zoom !== 'normal' && Number.parseFloat(zoom) !== 1);
}

function transformedClipAncestor(node: Element, view: Window): boolean {
  for (let current: Element | null = node; current; current = current.parentElement) {
    if (hasTransform(view.getComputedStyle(current))) return true;
  }
  return false;
}

function clippedRect(node: Element, doc: Document, viewportWidth: number, viewportHeight: number, strict: boolean): CaptureRect | null {
  const rect = node.getBoundingClientRect();
  const { left, top, width, height } = rect;
  if (![left, top, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  const right = left + width, bottom = top + height;
  if (!Number.isFinite(right) || !Number.isFinite(bottom)) return null;
  let x = Math.max(0, left), y = Math.max(0, top);
  let clippedRight = Math.min(viewportWidth, right), clippedBottom = Math.min(viewportHeight, bottom);

  // +--- 滚动容器会在视口内再次裁切后代，建议区域不能越过其可见 scrollport ---+
  const view = doc.defaultView;
  for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const style = view?.getComputedStyle(ancestor);
    if (!style) continue;
    const overflowX = style.overflowX || style.overflow;
    const overflowY = style.overflowY || style.overflow;
    if (!clipsOverflow(overflowX) && !clipsOverflow(overflowY)) continue;
    // BCR 已包含变换，而 client 边界仍是局部尺寸；无法对齐时不猜裁切结果。
    if (view && transformedClipAncestor(ancestor, view)) return null;
    const bounds = ancestor.getBoundingClientRect();
    if (![bounds.left, bounds.top, ancestor.clientLeft, ancestor.clientTop, ancestor.clientWidth, ancestor.clientHeight].every(Number.isFinite)) return null;
    const clipLeft = bounds.left + ancestor.clientLeft;
    const clipTop = bounds.top + ancestor.clientTop;
    if (clipsOverflow(overflowX)) {
      x = Math.max(x, clipLeft);
      clippedRight = Math.min(clippedRight, clipLeft + ancestor.clientWidth);
    }
    if (clipsOverflow(overflowY)) {
      y = Math.max(y, clipTop);
      clippedBottom = Math.min(clippedBottom, clipTop + ancestor.clientHeight);
    }
  }

  const clippedWidth = clippedRight - x, clippedHeight = clippedBottom - y;
  if (!(clippedWidth > 0 && clippedHeight > 0)
    || (!strict && (clippedWidth < MIN_CANDIDATE_WIDTH || clippedHeight < MIN_CANDIDATE_HEIGHT))) return null;
  return { x, y, width: clippedWidth, height: clippedHeight };
}

function nodeIdentity(doc: Document, node: Element): string {
  let state = documentIdentities.get(doc);
  if (!state) {
    state = { elements: new WeakMap(), next: 1 };
    documentIdentities.set(doc, state);
  }
  let id = state.elements.get(node);
  if (!id) {
    id = `dsh:node-${state.next++}`;
    state.elements.set(node, id);
  }
  return id;
}

export function collectDOMCandidates(doc: Document): CaptureCandidate[] {
  const view = doc.defaultView;
  const viewportWidth = doc.documentElement.clientWidth || view?.innerWidth || 0;
  const viewportHeight = doc.documentElement.clientHeight || view?.innerHeight || 0;
  if (!(Number.isFinite(viewportWidth) && viewportWidth > 0 && Number.isFinite(viewportHeight) && viewportHeight > 0)) return [];

  const strictNodes: Element[] = [...recognizedSidebarTitles(doc)];
  const identity = recognizeSidebarIdentity(doc);
  if (identity.status === 'recognized') {
    strictNodes.push(identity.avatar);
    const visibleLabel = identity.trigger.querySelector(':scope > [data-pdsh-name]') ?? identity.label;
    if (visibleLabel) strictNodes.push(visibleLabel);
  }

  const ordered: CandidateNode[] = [
    ...strictNodes.map(node => ({ node, strict: true })),
    ...Array.from(doc.querySelectorAll(GENERIC_SELECTOR), node => ({ node, strict: false })),
  ];
  const accepted: AcceptedCandidate[] = [];

  for (const candidate of ordered) {
    if (accepted.length >= MAX_CANDIDATES) break;
    const { node, strict } = candidate;
    if (!node.isConnected || isOwnedUI(node) || !isVisible(node, doc)) continue;
    if (!strict && !hasUsefulContent(node)) continue;
    // 严格节点先入列；通用节点按 querySelectorAll 的 DOM 前序到达，包含关系只保留首个可用区域。
    if (accepted.some(item => item.node === node || item.node.contains(node) || node.contains(item.node))) continue;
    const clipped = clippedRect(node, doc, viewportWidth, viewportHeight, strict);
    if (!clipped) continue;
    accepted.push({ node, rect: clipped });
  }

  return accepted.map(({ node, rect }) => ({ id: nodeIdentity(doc, node), ...rect }));
}
