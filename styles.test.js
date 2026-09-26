/**
 * [INPUT]: 依赖 styles.css 的真实 selector、来源账和 rc.2 ChatNode DOM 合同。
 * [OUTPUT]: 验证旧消息描边选择器、编辑行原生高度与错误边线来源，禁止数值颜色尺寸 fallback。
 * [POS]: PDSH 的样式合同，防止把 Conversation 内部 kind 当作 Chat DOM dispatch kind。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
test('灰条仅作用于自有标题标记，不给聊天消息描边或隐藏整行', () => {
  assert.doesNotMatch(css, /data-chat-flow-kind|data-pdsh-frames|conversation\.view/);
  assert.match(css, /\[data-pdsh-redacted-title\]/);
  assert.match(css, /\[data-pdsh-redacted-title\][^}]*color:\s*transparent/);
  assert.match(css, /\[data-pdsh-redacted-title\]::after\s*\{[^}]*pointer-events:\s*none/);
  assert.doesNotMatch(css.match(/\[data-pdsh-redacted-title\]\s*\{[^}]*\}/)?.[0] ?? '', /display:\s*none|visibility:\s*hidden/);
});
test('所有 token 有提供文件，不硬编码颜色、尺寸或 fallback', () => {
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /#[a-f\d]{3,8}\b|rgba?\(|\b\d+(?:\.\d+)?(?:px|rem|em)\b/i);
  assert.doesNotMatch(css, /var\([^)]*,/);
  const sources = JSON.parse(readFileSync(new URL('./style-sources.json', import.meta.url), 'utf8'));
  for (const [, variable] of css.matchAll(/var\((--[\w-]+)\)/g)) {
    assert.ok(sources.styles.some(entry => entry.variable === variable && entry.file), variable);
  }
});
test('设置分组使用宿主字号和卡片语义，而非浏览器默认段落编排', () => {
  assert.match(css, /\.pdsh-settings\s*\{[^}]*font:\s*var\(--dsw-font-xs-13\)/);
  assert.match(css, /\.pdsh-group\s*\{[^}]*background:\s*var\(--dsw-alias-settings-card-fill\)/);
  assert.match(css, /\.pdsh-hint\s*\{[^}]*font:\s*var\(--dsw-font-xxs-12\)/);
});

test('头像与昵称横向编排；入口自己承担自动留白，隐藏时不覆盖原生搜索对齐', () => {
  assert.match(css, /\.pdsh-identity\s*\{[^}]*display:\s*flex/);
  assert.match(css, /\.pdsh-profile-copy\s*\{[^}]*flex:\s*1/);
  assert.match(css, /\.pdsh-detail-row\s*\{[^}]*justify-content:\s*space-between/);
  assert.match(css, /\.pdsh-avatar-options\[hidden\]\s*\{[^}]*display:\s*none/);
  assert.match(css, /\[data-pdsh-search-entry="wide"\]\s*\{[^}]*margin-left:\s*auto/);
  assert.match(css, /\[data-pdsh-search-entry="wide"\]:not\(\[hidden\]\) \+ div\s*\{[^}]*margin-left:\s*0/);
});

test('编辑与阅读态同用原生Button的最小高度；非法输入边线使用宿主错误token', () => {
  const source = readFileSync(new URL('./client-entry.jsx', import.meta.url), 'utf8');
  assert.match(source, /<Button[^>]*data-pdsh-button-probe/);
  assert.match(source, /--pdsh-action-size/);
  assert.match(css, /\.pdsh-inline-editor\s*\{[^}]*min-height:\s*var\(--pdsh-action-size\)/);
  assert.match(css, /:has\(input\[aria-invalid="true"\]\)[^}]*border-color:\s*var\(--dsw-alias-state-error-primary\)/);
});
