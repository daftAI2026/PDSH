/**
 * [INPUT]: 依赖 styles.css 的真实 selector、来源账和 rc.2 ChatNode DOM 合同。
 * [OUTPUT]: 验证助手节点能命中灰框、工具/隐藏节点不误框，样式无数值颜色尺寸 fallback。
 * [POS]: PDSH 的样式合同，防止把 Conversation 内部 kind 当作 Chat DOM dispatch kind。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
test('框住 rc.2 的用户/steering/assistant-step，不框工具或隐藏节点', () => {
  const dom = new JSDOM(`<head><style>${css}</style></head><body data-pdsh-frames><div data-slot="conversation.view"><div id="user" data-chat-flow-kind="user"></div><div id="steering" data-chat-flow-kind="steering"></div><div id="assistant" data-chat-flow-kind="assistant-step"></div><div id="tool" data-chat-flow-kind="tool"></div><div id="hidden" data-chat-flow-kind="assistant-step" hidden></div></div></body>`);
  const selector = dom.window.document.styleSheets[0].cssRules[0].selectorText;
  assert.deepEqual([...dom.window.document.querySelectorAll(selector)].map(node => node.id), ['user', 'steering', 'assistant']);
  dom.window.document.body.removeAttribute('data-pdsh-frames');
  assert.equal(dom.window.document.querySelectorAll(selector).length, 0);
  dom.window.close();
});
test('所有 token 有提供文件，不硬编码颜色、尺寸或 fallback', () => {
  assert.doesNotMatch(css.replace(/\/\*[\s\S]*?\*\//g, ''), /#[a-f\d]{3,8}\b|rgba?\(|\b\d+(?:\.\d+)?(?:px|rem|em)\b/i);
  assert.doesNotMatch(css, /var\([^)]*,/);
  const sources = JSON.parse(readFileSync(new URL('./style-sources.json', import.meta.url), 'utf8'));
  for (const [, variable] of css.matchAll(/var\((--[\w-]+)\)/g)) {
    assert.ok(sources.styles.some(entry => entry.variable === variable && entry.file), variable);
  }
});
