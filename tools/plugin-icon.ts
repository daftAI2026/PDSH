/**
 * [INPUT]: 依赖 entry-icon.svg 与 style-sources.json 的明暗标签主色快照。
 * [OUTPUT]: 提供清单图标的单路径 SVG，按嵌入页 color-scheme 选色。
 * [POS]: 构建期图标转换器。颜色不读取外部 CSS 变量。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const colorLiteral = /^(?:#[\da-f]{3,8}|rgb\(\s*(?:\d+%?\s*,\s*){2}\d+%?\s*\))$/i;

/**
 * // +--- 保留包图单路径；外部 img 只接收宿主色彩方案，不接收 CSS 变量。 ---+
 * @param glyph - currentColor 帽子线稿。
 * @param lightStroke - 浅色标签主色 token 的固定值。
 * @param darkStroke - 深色标签主色 token 的固定值。
 */
export function createThemeAwarePluginIcon(glyph: string, lightStroke: string, darkStroke: string): string {
  if (!colorLiteral.test(lightStroke) || !colorLiteral.test(darkStroke)) throw new Error('Invalid plugin icon theme color.');
  if (!/^\s*<svg\b/.test(glyph) || (glyph.match(/<path\b/g) ?? []).length !== 1 ||
    !glyph.includes('fill="none"') || !glyph.includes('stroke="currentColor"') || /<style\b/i.test(glyph))
    throw new Error('Plugin icon source must be one transparent currentColor path.');

  const themedGlyph = glyph.replace('stroke="currentColor"', `stroke="${lightStroke}"`);
  const darkTheme = `<style>@media (prefers-color-scheme: dark) { path { stroke: ${darkStroke}; } }</style>`;
  return themedGlyph.replace(/(<svg\b[^>]*>)/, root => `${root}${darkTheme}`);
}
