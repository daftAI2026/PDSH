/**
 * [INPUT]: 依赖 entry-icon.svg、主题来源账与清单图标生成器。
 * [OUTPUT]: 验证外部 SVG 仅按宿主 color-scheme 选择标签主色快照。
 * [POS]: 包图主题合同；不模拟 DOM adapter，也不声称验证宿主浏览器。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createThemeAwarePluginIcon } from '../tools/plugin-icon.ts';

const artwork = JSON.parse(readFileSync(new URL('../style-sources.json', import.meta.url), 'utf8')).artwork;
const glyph = readFileSync(new URL('../src/client/entry-icon.svg', import.meta.url), 'utf8')
  .replace(/<!--[^]*?-->\s*/, '');

test('清单图标以宿主 color-scheme 选择标签主色 token 快照', () => {
  assert.equal(artwork.foreground.variable, '--dsw-alias-label-primary');
  assert.equal(artwork.darkForeground.variable, '--dsw-alias-label-primary');
  const icon = createThemeAwarePluginIcon(glyph, artwork.foreground.value, artwork.darkForeground.value);

  assert.ok(icon.includes(`stroke="${artwork.foreground.value}"`), '默认色来自浅色标签主色 token');
  assert.ok(icon.includes(`@media (prefers-color-scheme: dark) { path { stroke: ${artwork.darkForeground.value}; } }`),
    'SVG 的媒体查询使用宿主显式 color-scheme，不读取 OS 偏好');
  assert.equal([...icon.matchAll(/<path\b/g)].length, 1, '亮暗主题共用单一复合帽子路径');
  assert.match(icon, /fill="none"/, '图标保持透明底');
  assert.doesNotMatch(icon, /currentColor|var\(|filter:|background|<(?:rect|circle)\b/i,
    '外部 img 不依赖宿主变量继承，不引入底形或滤镜');
});
