/**
 * [INPUT]: 依赖原生 SVG 或同页官方 symbol 的实时坐标与计算描边。
 * [OUTPUT]: 提供原生描边密度读取和不同 SVG 坐标系间的线宽匹配；未知或非等比几何返回 null。
 * [POS]: search-entry 与 native-style-probe 共用的图标几何边界，显示比例和图稿坐标不能混为一谈。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
function viewBox(node: Element) {
  const values = node.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  return values?.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0 ? values : null;
}

// +--- 外层 use 只提供显示尺寸；坐标与描边归实时 symbol，不猜图标名或宿主版本 ---+
function artwork(source: Element): Element | null {
  if (source.hasAttribute('viewBox')) return source;
  if (source.children.length !== 1 || source.firstElementChild.localName !== 'use') return null;
  const use = source.firstElementChild;
  const href = use.getAttribute('href') ?? use.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
  if (!/^#[A-Za-z_][\w.-]*$/.test(href ?? '')) return null;
  if (['x', 'y', 'width', 'height', 'transform'].some(name => use.hasAttribute(name))) return null;
  const matches = source.ownerDocument.querySelectorAll(`[id="${href.slice(1)}"]`);
  if (matches.length !== 1) return null;
  const symbol = matches[0];
  if (symbol.localName !== 'symbol' || !symbol.closest('svg[data-dsh-icon-sprite]') ||
    symbol.querySelector('use, [transform], [vector-effect]')) return null;
  return symbol;
}

export function readNativeStrokeRatio(source: Element, size: CSSStyleDeclaration): number | null {
  const native = artwork(source);
  if (!native) return null;
  const box = viewBox(native);
  const ink = native === source ? size : source.ownerDocument.defaultView.getComputedStyle(native);
  const width = Number.parseFloat(size.width), height = Number.parseFloat(size.height);
  const rawStroke = ink.strokeWidth?.trim() ?? '';
  if (!box || !/^(?:\d*\.)?\d+(?:px)?$/.test(rawStroke)) return null;
  const stroke = Number.parseFloat(rawStroke);
  if (!(width > 0 && height > 0 && stroke > 0)) return null;
  if (width * box[3] !== height * box[2]) return null;
  if (size.vectorEffect && size.vectorEffect !== 'none') return null;
  if (ink.vectorEffect && ink.vectorEffect !== 'none') return null;
  if (ink.transform && ink.transform !== 'none') return null;
  return stroke / box[2];
}

export function matchNativeIconStroke(source: Element, target: Element, size: CSSStyleDeclaration): string | null {
  const ratio = readNativeStrokeRatio(source, size), ownBox = viewBox(target);
  if (ratio === null || !ownBox) return null;
  // 非等比例显示的线宽随方向变化；单一描边数值不能保真。
  if (Number.parseFloat(size.width) * ownBox[3] !== Number.parseFloat(size.height) * ownBox[2]) return null;
  return String(ratio * ownBox[2]);
}
