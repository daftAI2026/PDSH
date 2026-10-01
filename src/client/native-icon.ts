/**
 * [INPUT]: 依赖原生 SVG 的 viewBox、显示尺寸与计算描边；不使用图稿默认值兜底。
 * [OUTPUT]: 提供原生描边密度读取和不同 SVG 坐标系间的线宽匹配；未知或非等比几何返回 null。
 * [POS]: search-entry 与 native-style-probe 共用的图标几何边界，显示比例和图稿坐标不能混为一谈。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
function viewBox(node: Element) {
  const values = node.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
  return values?.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0 ? values : null;
}

export function readNativeStrokeRatio(source: Element, size: CSSStyleDeclaration): number | null {
  const box = viewBox(source);
  const width = Number.parseFloat(size.width), height = Number.parseFloat(size.height);
  const rawStroke = size.strokeWidth?.trim() ?? '';
  if (!box || !/^(?:\d*\.)?\d+(?:px)?$/.test(rawStroke)) return null;
  const stroke = Number.parseFloat(rawStroke);
  if (!(width > 0 && height > 0 && stroke > 0)) return null;
  if (width * box[3] !== height * box[2]) return null;
  if (size.vectorEffect && size.vectorEffect !== 'none') return null;
  return stroke / box[2];
}

export function matchNativeIconStroke(source: Element, target: Element, size: CSSStyleDeclaration): string | null {
  const ratio = readNativeStrokeRatio(source, size), ownBox = viewBox(target);
  if (ratio === null || !ownBox) return null;
  // 非等比例显示的线宽随方向变化；单一描边数值不能保真。
  if (Number.parseFloat(size.width) * ownBox[3] !== Number.parseFloat(size.height) * ownBox[2]) return null;
  return String(ratio * ownBox[2]);
}
