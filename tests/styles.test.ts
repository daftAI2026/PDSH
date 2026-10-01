/**
 * [INPUT]: 依赖 styles.css 的真实 selector 与 rc.2 原生样式来源账。
 * [OUTPUT]: 验证标题灰条、头像换行、控件几何、更新成功色及入口根透明度；按压态不新增常驻底色。
 * [POS]: PDSH 的样式合同，追溯语义视觉来源并保护原生入口按钮交互、来源标签邻接、昵称留白与实时原生控件测量边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const css = readFileSync(new URL('../src/client/styles.css', import.meta.url), 'utf8');
test('拍照标题后首行不画分隔线，后续字段和身份原有分隔仍保留',()=>{
  assert.match(css,/\.pdsh-fields-group\s*>\s*\.pdsh-group-header\s*\+\s*\.pdsh-detail-row\s*\{\s*border-top:\s*0;\s*\}/);
  assert.match(css,/\.pdsh-detail-row\s*\{[^}]*border-top:\s*var\(--pdsh-outline-width\) solid var\(--dsw-alias-border-l2\)/);
});
test('截图通知不保留自造底角常驻样式', () => {
  assert.doesNotMatch(css, /data-pdsh-capture-notice/);
  const captureCss = readFileSync(new URL('../src/client/capture/capture-window.css', import.meta.url), 'utf8');
  assert.doesNotMatch(captureCss, /\.pdsh-capture-toast/);
});
test('灰条仅作用于自有标题标记，不给聊天消息描边或隐藏整行', () => {
  assert.doesNotMatch(css, /data-chat-flow-kind|data-pdsh-frames|conversation\.view/);
  assert.match(css, /\[data-pdsh-redacted-title\]/);
  assert.match(css, /\[data-pdsh-redacted-title\][^}]*color:\s*transparent/);
  assert.match(css, /\[data-pdsh-redacted-title\]::after,[^{]+\{[^}]*pointer-events:\s*none/);
  assert.doesNotMatch(css.match(/\[data-pdsh-redacted-title\]\s*\{[^}]*\}/)?.[0] ?? '', /display:\s*none|visibility:\s*hidden/);
});
test('所有 token 有提供文件，不硬编码颜色、尺寸或 fallback', () => {
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /#[a-f\d]{3,8}\b|rgba?\(|\b\d+(?:\.\d+)?(?:px|rem|em)\b/i);
  assert.doesNotMatch(css, /var\([^)]*,/);
  const sources = JSON.parse(readFileSync(new URL('../style-sources.json', import.meta.url), 'utf8'));
  for (const [, variable] of css.matchAll(/var\((--[\w-]+)\)/g)) {
    assert.ok(sources.styles.some(entry => entry.variable === variable && entry.file), variable);
  }
});
test('设置分组使用宿主字号和卡片语义，而非浏览器默认段落编排', () => {
  assert.match(css, /\.pdsh-settings\s*\{[^}]*font:\s*var\(--dsw-font-xs-13\)/);
  assert.match(css, /\.pdsh-group\s*\{[^}]*background:\s*var\(--dsw-alias-settings-card-fill\)/);
  assert.match(css, /\.pdsh-hint\s*\{[^}]*font:\s*var\(--dsw-font-xxs-12\)/);
});
test('升级箭头采用宿主成功色，限定在自有 SVG 而不覆盖原生按钮状态', () => {
  assert.match(css, /\.pdsh-update-trigger svg\s*\{[^}]*color:\s*var\(--dsw-alias-state-success-primary\)/);
});

test('头像与昵称横向编排；入口自己承担自动留白，隐藏时不覆盖原生搜索对齐', () => {
  assert.match(css, /\.pdsh-identity\s*\{[^}]*display:\s*flex/);
  assert.match(css, /\.pdsh-profile-copy\s*\{[^}]*flex:\s*0 1 auto/);
  assert.match(css, /\.pdsh-avatar-source-label\s*\{[^}]*margin-inline-end:\s*calc\(var\(--pdsh-button-inset\) \+ var\(--pdsh-button-inset\)\)/);
  assert.match(css, /\.pdsh-profile-copy\s*\{[^}]*max-width:\s*calc\(100% - var\(--pdsh-control-size\) - var\(--pdsh-control-size\) - var\(--pdsh-section-inset\)\)/);
  assert.match(css, /\.pdsh-detail-row\s*\{[^}]*justify-content:\s*space-between/);
  assert.match(css, /\.pdsh-avatar-actions\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(css, /\.pdsh-avatar-actions\s*\{[^}]*max-width:\s*100%/);
  assert.doesNotMatch(css, /pdsh-source-value|pdsh-avatar-options|pdsh-footer/);
  assert.match(css, /\[data-pdsh-search-entry="wide"\], \[data-pdsh-capture-entry="wide"\]\[data-pdsh-entry-first\]\s*\{[^}]*margin-left:\s*auto/);
  assert.match(css, /\[data-pdsh-search-entry="wide"\]:not\(\[hidden\]\) \+ div\s*\{[^}]*margin-left:\s*0/);
});

test('线条图标透明度在SVG根合成，不在path/circle分别混色', () => {
  assert.match(css, /\[data-pdsh-search-entry\] svg, \[data-pdsh-capture-entry\] svg\s*\{[^}]*opacity:\s*var\(--pdsh-icon-opacity\)/);
  assert.doesNotMatch(css, /stroke-opacity|fill-opacity|\[data-pdsh-(?:search|capture)-entry\]\s+(?:path|circle)/);
});

test('帽子按压态不新增常驻底色；保留根透明度与原生按钮交互', () => {
  const pressedRule = css.match(/\[data-pdsh-search-entry\]\[aria-pressed="true"\]\s*\{[^}]*\}/)?.[0] ?? '';
  assert.doesNotMatch(pressedRule, /background(?:-color)?\s*:/, 'pressed 状态不画常驻底色');
  assert.match(css, /\[data-pdsh-search-entry\] svg, \[data-pdsh-capture-entry\] svg\s*\{[^}]*opacity:\s*var\(--pdsh-icon-opacity\)/);
  const adapter = readFileSync(new URL('../src/client/search-entry.ts', import.meta.url), 'utf8');
  assert.match(adapter, /attribute\(button, 'class', native\.button\.className\)/, '复用宿主按钮 class，保留原生 hover/focus 外观');
  assert.match(adapter, /button\.addEventListener\('click', click\)/, '帽子交互仍由入口按钮的 click 委托给状态控制器');
  assert.match(adapter, /attribute\(button, 'aria-pressed', String\(current\.pressed\)\)/, '保留可访问的按压状态，不用自绘底色表达');
});

test('编辑与阅读态同用原生Button的最小高度；非法输入边线使用宿主错误token', () => {
  const source = readFileSync(new URL('../src/client/native-style-view.tsx', import.meta.url), 'utf8');
  assert.match(source, /<Button[^>]*data-pdsh-button-probe/);
  assert.match(source, /import\s+\{\s*mountNativeStyleProbe\s*\}\s+from\s+'\.\/native-style-probe\.ts'/);
  assert.equal([...source.matchAll(/mountNativeStyleProbe\s*\(/g)].length, 1, '装配层只拥有一个原生样式探针控制器');
  const effect = source.match(/useLayoutEffect\(\(\)\s*=>\s*\{([\s\S]*?)\},\s*\[doc\]\)/)?.[1] ?? '';
  assert.match(effect, /const\s+(\w+)\s*=\s*mountNativeStyleProbe\(doc,\s*ref\.current\)/);
  assert.match(effect, /return\s*\(\)\s*=>\s*\w+\.dispose\(\)/, 'React probe 卸载时必须归还 controller 的资源');
  assert.doesNotMatch(effect, /getComputedStyle|style\.setProperty/, '测量与变量所有权属于独立适配器，不留在装配层');
  assert.doesNotMatch(source, /doc\.body\.style\.setProperty\(['"]--pdsh-/);
  assert.match(css, /\.pdsh-inline-editor\s*\{[^}]*min-height:\s*var\(--pdsh-action-size\)/);
  assert.match(css, /:has\(input\[aria-invalid="true"\]\)[^}]*border-color:\s*var\(--dsw-alias-state-error-primary\)/);
});

test('样式探针不可见且脱离页面流；不可用display:none吞掉真实控件几何', () => {
  const source = readFileSync(new URL('../src/client/component-runtime.tsx', import.meta.url), 'utf8');
  assert.match(source, /data-pdsh-probe/, '装配层使用唯一自有 probe 根');
  const rules = [...css.matchAll(/[^{}]*\[data-pdsh-probe\][^{}]*\{[^}]+\}/g)].map(([rule]) => rule).join('\n');
  assert.ok(rules, 'probe 必须有视觉隐藏与布局隔离规则');
  assert.match(rules, /position:\s*(?:absolute|fixed)/);
  assert.match(rules, /visibility:\s*hidden/);
  assert.match(rules, /pointer-events:\s*none/);
  assert.doesNotMatch(rules, /display:\s*none/, 'display:none 会令真实控件尺寸不可测');
  assert.match(css, /\[data-pdsh-probe\]\s*>\s*span\s*\{[^}]*display:\s*block/,
    'ResizeObserver 所见的 React 探针根必须建立实际 block box');

  const dom = new JSDOM('<body><div data-pdsh-probe><span class="native-geometry"></span></div></body>');
  const style = dom.window.document.createElement('style');
  style.textContent = `${css}\n.native-geometry { height: 40px; }`;
  dom.window.document.head.append(style);
  const probe = dom.window.document.querySelector('[data-pdsh-probe]');
  const probeStyle = dom.window.getComputedStyle(probe);
  assert.equal(probeStyle.visibility, 'hidden');
  assert.equal(probeStyle.pointerEvents, 'none');
  assert.ok(['absolute', 'fixed'].includes(probeStyle.position));
  assert.notEqual(probeStyle.display, 'none');
  assert.equal(dom.window.getComputedStyle(probe.firstElementChild).height, '40px', '隐藏只影响绘制，不抹掉控件几何');
  dom.window.close();
});

test('Tooltip 探针只对自有锚点发mouseover，不合成焦点或抢 activeElement', () => {
  const source = readFileSync(new URL('../src/client/native-style-view.tsx', import.meta.url), 'utf8');
  const component = source;
  assert.match(component, /data-pdsh-tooltip-probe/);
  assert.match(component, /new doc\.defaultView\.MouseEvent\('mouseover'/);
  assert.doesNotMatch(component, /FocusEvent|\.focus\s*\(/, '不伪造键盘焦点，不改变宿主 activeElement');
});

test('字段自带内边距，不与组gap重复叠加；昵称在右侧紧凑编辑', () => {
  assert.match(css, /\.pdsh-group\s*\{[^}]*gap:\s*0/);
  assert.doesNotMatch(css, /\.pdsh-group > h4/);
  const source = readFileSync(new URL('../src/client/settings-card.tsx', import.meta.url), 'utf8');
  assert.match(source, /className="pdsh-row pdsh-group-header"/);
  assert.match(css, /\.pdsh-detail-row\s*\{[^}]*padding-block:\s*var\(--pdsh-section-inset\)/);
  assert.match(css, /\.pdsh-group:is\(\.pdsh-identity-group,\s*\.pdsh-fields-group\)\s*\{[^}]*padding-bottom:\s*0/);
  assert.match(css, /:is\(\.pdsh-identity-group,\s*\.pdsh-fields-group\) > p:last-child\s*\{[^}]*padding-bottom:\s*var\(--pdsh-section-inset\)/);
  assert.match(css, /\.pdsh-nickname-editor\s*\{[^}]*flex:\s*0 1 auto/);
  assert.match(css, /\.pdsh-avatar-actions\s*\{[^}]*gap:\s*var\(--pdsh-field-gap\)/);
  assert.doesNotMatch(css.match(/\.pdsh-profile-copy\s*\{[^}]*\}/)?.[0] ?? '', /pdsh-button-inset/);
});
