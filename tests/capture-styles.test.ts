/**
 * [INPUT]: 依赖截图工作台三份 CSS 与 style-sources 的 Host 来源账。
 * [OUTPUT]: 阻止 Codex token/fallback 混入 DSH 主题，验证语义 token 可追溯与实时原生几何/动画消费链与色谱内容几何隔离，固定检查器布局与等高设置动作槽。
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


test('色谱指示器使用参考内容几何而非Host按钮尺寸，CSS不污染宿主拾色器', () => {
  const picker = readFileSync(new URL('../src/client/capture/color-popover.css', import.meta.url), 'utf8');
  assert.match(picker, /--pdsh-capture-picker-pointer-size:\s*28px/);
  const pointer = picker.match(/\.pdsh-capture-color-popover \.react-colorful__pointer \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(pointer, '指示器规则限定在自有浮层');
  assert.match(pointer, /height:\s*var\(--pdsh-capture-picker-pointer-size\)/);
  assert.match(pointer, /width:\s*var\(--pdsh-capture-picker-pointer-size\)/);
  assert.match(pointer, /border:\s*2px solid #fff/);
  assert.doesNotMatch(pointer, /--pdsh-action-size|--dsw-focus-ring-width|--dsw-alias-border-inverted/);
  assert.doesNotMatch(picker, /^\.react-colorful(?:[\s.{:]|__)/m);
  assert.equal(sources.capturePicker.pointerSize, 28);
  assert.equal(sources.capturePicker.pointerRole, '编辑内容色谱坐标指示器，不是Host按钮');
});

test('检查器为双层焦点环保留内侧空间，拾色器图标适配色块而非硬塞Host尺寸', () => {
  const shell = readFileSync(new URL('../src/client/capture/capture-window.css', import.meta.url), 'utf8');
  const backgrounds = readFileSync(new URL('../src/client/capture/background-picker.css', import.meta.url), 'utf8');
  assert.match(shell, /--pdsh-capture-control-gutter:\s*calc\(var\(--dsw-focus-ring-width\)\s*\*\s*2\)/);
  const content = shell.match(/\.pdsh-capture-inspector-content \{([\s\S]*?)\n\}/)?.[1];
  assert.match(content ?? '', /padding-inline:\s*var\(--pdsh-capture-control-gutter\)/);
  assert.match(backgrounds, /padding:\s*max\(var\(--pdsh-capture-space\),\s*var\(--pdsh-capture-control-gutter\)\)/);
  const icon = backgrounds.match(/\[data-pdsh-capture\] \.pdsh-capture-color-label \[data-capture-icon\] \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(icon, '局部图标规则须胜过全局Host图标选择器');
  for (const dimension of ['width', 'height']) assert.match(icon, new RegExp(`${dimension}:\\s*min\\(var\\(--pdsh-native-icon-size\\),\\s*calc\\(100% - var\\(--pdsh-capture-control-gutter\\)\\)\\)`));
  assert.equal(sources.captureInspector.gutterToken, '--dsw-focus-ring-width');
});


test('右侧固定240px，工作区剩余宽度与Host间距互不耦合', () => {
  assert.match(css, /--pdsh-capture-inspector-width:\s*240px/);
  const workspace = css.match(/\.pdsh-capture-workspace \{([\s\S]*?)\n\}/)?.[1];
  assert.match(workspace ?? '', /grid-template-columns:\s*minmax\(0, 1fr\) var\(--pdsh-capture-inspector-width\)/);
  assert.equal(sources.captureInspector.widthPx, 240);
});

test('截图身份开关占用与原生按钮等高的字段槽，上下留白仍复用字段token', () => {
  const settings = readFileSync(new URL('../src/client/styles.css', import.meta.url), 'utf8');
  const slot = settings.match(/\.pdsh-detail-row > \.pdsh-switch-tooltip \{([^}]+)\}/)?.[1];
  assert.match(slot ?? '', /min-height:\s*var\(--pdsh-action-size\)/);
  assert.match(slot ?? '', /align-items:\s*center/);
  assert.match(settings, /\.pdsh-detail-row \{[^}]*padding-block:\s*var\(--pdsh-section-inset\)/);
});


test('纯色与渐变、图片共用五列圆角方框，不再另设圆形八列色点', () => {
  const backgrounds = readFileSync(new URL('../src/client/capture/background-picker.css', import.meta.url), 'utf8');
  assert.doesNotMatch(backgrounds, /\.pdsh-capture-background-grid-plain[^{]*\{[^}]*repeat\(8/);
  assert.doesNotMatch(backgrounds, /\.pdsh-capture-background-grid-plain[^}]*border-radius:\s*50%/);
  assert.match(backgrounds, /\.pdsh-capture-background-grid \{[^}]*repeat\(5, minmax\(0, 1fr\)\)/);
});

test('选中内外双环各收为Host焦点宽度的一半，键盘焦点与安全边距不缩小', () => {
  const backgrounds=readFileSync(new URL('../src/client/capture/background-picker.css',import.meta.url),'utf8');
  assert.match(backgrounds,/--pdsh-capture-selection-ring-width:\s*calc\(var\(--dsw-focus-ring-width\)\s*\/\s*2\)/);
  assert.match(backgrounds,/box-shadow:\s*0 0 0 var\(--pdsh-capture-selection-ring-width\).*calc\(var\(--pdsh-capture-selection-ring-width\)\s*\*\s*2\)/);
  assert.match(backgrounds,/outline:\s*var\(--dsw-focus-ring-width\) solid/);
  assert.equal(sources.captureInspector.selectionRingMultiplier,0.5);
});


test('色球填色层显式保持圆形，DSH elevation浮层不叠第二道描边', () => {
  const picker = readFileSync(new URL('../src/client/capture/color-popover.css', import.meta.url), 'utf8');
  for (const selector of ['pointer', 'pointer-fill']) {
    const rule = picker.match(new RegExp('\\.pdsh-capture-color-popover \\.react-colorful__' + selector + ' \\{([\\s\\S]*?)\\n\\}'))?.[1];
    assert.ok(rule, selector);
    assert.match(rule, /corner-shape:\s*round/, `${selector}不能依赖不继承的corner-shape`);
  }
  const shell = picker.match(/\.pdsh-capture-color-popover \{([\s\S]*?)\n\}/)?.[1];
  assert.match(shell ?? '', /border:\s*0;/);
  assert.match(shell ?? '', /box-shadow:\s*var\(--dsw-elevation-panel\)/);
});
