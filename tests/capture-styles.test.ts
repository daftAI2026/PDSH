/**
 * [INPUT]: 依赖截图工作台三份 CSS 与 style-sources 的 Host 来源账。
 * [OUTPUT]: 阻止 Codex token/fallback 混入 DSH 主题，验证语义 token 可追溯与实时原生几何/动画消费链。
 * [POS]: 工作台视觉移植合同；色谱、透明棋盘格属于编辑内容而非宿主主题。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = ['capture-window.css', 'background-picker.css', 'color-popover.css'].map(file => readFileSync(new URL(`../src/client/capture/${file}`, import.meta.url), 'utf8')).join('\n');
const sources = JSON.parse(readFileSync(new URL('../style-sources.json', import.meta.url), 'utf8'));
test('工作台不携带 Codex 主题变量、数值回退或 UI 硬编码主题色', () => {
  assert.doesNotMatch(css, /--(?:color|radius|font|text|height|shadow|transition|ease|spacing|vscode|cursor)-/);
  assert.doesNotMatch(css, /var\([^)]*,\s*(?:#|rgb|\d+px|\d+ms|\d+rem)/);
  assert.doesNotMatch(css, /\.electron-(?:dark|light)/);
  assert.match(css, /--pdsh-capture-surface:\s*var\(--dsw-alias-bg-layer-2\)/);
  assert.match(css, /--pdsh-capture-space:\s*calc\(var\(--pdsh-field-gap\)\s*\/\s*2\)/);
  assert.match(css, /--pdsh-capture-shadow:\s*var\(--dsw-elevation-prominent\)/);
});
test('工作台引用的每个宿主 token 都在来源账中', () => {
  for (const [, token] of css.matchAll(/var\((--(?:dsw|ds)-[\w-]+)\)/g)) {
    assert.ok(sources.styles.some(entry => entry.variable === token && entry.file), token);
  }
});

test('截图控件实时消费宿主描边、Tooltip 与 Switch 的计算样式，不冻结动画或添加背景模糊', () => {
  const tooltip = readFileSync(new URL('../src/client/dom-tooltip.css', import.meta.url), 'utf8');
  const icons = readFileSync(new URL('../src/client/capture/icons.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(icons, /stroke-width="1\.5"|size = 16/);
  assert.match(css, /stroke-width:\s*calc\(24 \* var\(--pdsh-native-icon-stroke-ratio\)\)/);
  for (const variable of ['--pdsh-native-icon-opacity', '--pdsh-native-icon-size', '--pdsh-action-transition', '--pdsh-action-disabled-opacity', '--pdsh-switch-radius', '--pdsh-switch-thumb-transition', '--pdsh-switch-thumb-shadow', '--pdsh-switch-thumb-radius']) assert.ok(css.includes(`var(${variable})`), variable);
  for (const variable of ['--pdsh-tooltip-padding', '--pdsh-tooltip-duration', '--pdsh-tooltip-ease', '--pdsh-tooltip-max-width', '--pdsh-tooltip-layer']) assert.ok(tooltip.includes(`var(${variable})`), variable);
  assert.match(css, /backdrop-filter:\s*var\(--dsw-mask-blur\)/);
  assert.match(css, /background:\s*var\(--dsw-alias-button-primary-hover\)/);
  assert.doesNotMatch(css, /blur\(3px\)|superellipse\(1\.5\)|0\.001ms|1\.6s|scale\(\.98\)/);
  assert.match(css, /transition:\s*none !important/);
  assert.match(css, /animation:\s*none !important/);
});
