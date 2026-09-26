/**
 * [INPUT]: 依赖 search-entry.js、固定入口资产和 rc.2 搜索展开/收起结构夹具。
 * [OUTPUT]: 验证邻接挂载、开关与导航隔离、原生样式复用、搜索展开退让、重挂与完整释放。
 * [POS]: PDSH 入口适配合同；不能替代确切 runtime 的真实 React/布局验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { mountSearchEntry } from './search-entry.js';

const icon = readFileSync(new URL('./entry-icon.svg', import.meta.url), 'utf8');
const search = (wide, language = 'zh') => `<button type="button" class="live-search-class" aria-label="${language === 'zh' ? '搜索会话' : 'Search sessions'}" ${wide ? 'aria-expanded="false"' : ''}><svg style="width:${wide ? '14px' : '18px'};height:${wide ? '14px' : '18px'}"></svg></button>`;
const browser = (wide = true, language = 'zh') => `<div data-slot="sidebar.workspaces"><div class="browser-root"><div class="native-header">${wide ? `<span>工作区</span><div class="native-search-slot"><div class="native-search">${search(true, language)}<input type="text" value="原生搜索" /></div></div><div class="native-actions"></div>` : '<div class="native-actions"></div>'}</div>${wide ? '' : `<div class="native-rail-search">${search(false, language)}</div>`}<div role="tree"></div></div></div>`;
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function setup(html = browser()) {
  const dom = new JSDOM(`<head><style>.native-search{color:var(--host-search-color)} .native-rail-search{color:var(--host-rail-color)}</style></head><body>${html}</body>`), doc = dom.window.document;
  const opened = [], options = { icon, label: () => '遮挡侧栏标题', state: () => ({ pressed: false, disabled: false, busy: false }), onActivate: () => opened.push('toggle') };
  return { dom, doc, opened, options };
}

test('展开态紧接搜索左侧追加；复用 live class/图标尺寸，不改原生搜索', () => {
  const { dom, doc, options, opened } = setup(), before = doc.body.outerHTML;
  const native = doc.querySelector('button'), input = doc.querySelector('input');
  let searches = 0; native.addEventListener('click', () => ++searches);
  const entry = mountSearchEntry(doc, options), button = doc.querySelector('[data-pdsh-search-entry]');
  assert.ok(button);
  assert.equal(button.nextElementSibling, doc.querySelector('.native-search-slot'));
  assert.equal(doc.querySelector('.native-search-slot').hasAttribute('style'), false);
  assert.equal(button.className, native.className);
  assert.equal(button.querySelector('svg').getAttribute('width'), '14px');
  assert.equal(button.hasAttribute('aria-keyshortcuts'), false);
  assert.equal(button.getAttribute('aria-pressed'), 'false');
  assert.equal(button.style.getPropertyValue('--pdsh-search-color'), 'var(--host-search-color)');
  button.click(); assert.deepEqual(opened, ['toggle']); assert.equal(searches, 0);
  native.click(); assert.equal(searches, 1); assert.equal(doc.querySelector('input'), input);
  assert.equal(input.value, '原生搜索');
  entry.dispose(); assert.equal(doc.body.outerHTML, before);
  button.click(); assert.deepEqual(opened, ['toggle']); dom.window.close();
});

test('切换状态/忙态同步；颜色保留原生变量表达式并跟随来源变更', () => {
  const { dom, doc, options } = setup();
  let state = { pressed: true, disabled: false, busy: false };
  options.state = () => state;
  const entry = mountSearchEntry(doc, options), button = doc.querySelector('[data-pdsh-search-entry]');
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  state = { ...state, busy: true, disabled: true }; entry.refresh();
  assert.equal(button.disabled, true); assert.equal(button.getAttribute('aria-busy'), 'true');
  doc.querySelector('.native-search').style.color = 'var(--updated-search-color)'; entry.refresh();
  assert.equal(button.style.getPropertyValue('--pdsh-search-color'), 'var(--updated-search-color)');
  doc.querySelector('.native-search').style.color = 'rgb(1, 2, 3)'; entry.refresh();
  assert.equal(button.style.getPropertyValue('--pdsh-search-color'), '');
  entry.dispose(); dom.window.close();
});

test('搜索展开时隐藏；关闭后复现；翻译和原生 class 改动同步', async () => {
  const { dom, doc, options, opened } = setup();
  const entry = mountSearchEntry(doc, options), native = doc.querySelector('button[aria-expanded]');
  const button = doc.querySelector('[data-pdsh-search-entry]');
  native.setAttribute('aria-expanded', 'true'); await tick();
  assert.equal(button.hidden, true); button.click(); assert.equal(opened.length, 0);
  native.setAttribute('aria-expanded', 'false'); native.className = 'new-native-class';
  native.setAttribute('aria-label', 'Search sessions');
  await tick(); assert.equal(button.hidden, false); assert.equal(button.className, 'new-native-class');
  entry.dispose(); dom.window.close();
});

test('收起态复用原生 rail 外壳，重挂/展开后无残留或重复入口', async () => {
  const { dom, doc, options } = setup(browser(false, 'en'));
  const entry = mountSearchEntry(doc, options), native = doc.querySelector('button[aria-label="Search sessions"]');
  const shell = doc.querySelector('[data-pdsh-entry-shell]');
  assert.equal(shell.className, native.parentElement.className);
  assert.equal(shell.nextElementSibling, native.parentElement);
  assert.equal(shell.querySelector('svg').getAttribute('height'), '18px');
  doc.body.innerHTML = browser(); await tick();
  assert.equal(doc.querySelectorAll('[data-pdsh-search-entry]').length, 1);
  assert.equal(doc.querySelector('[data-pdsh-entry-shell]'), null);
  doc.body.innerHTML = browser(false); await tick();
  assert.equal(doc.querySelectorAll('[data-pdsh-search-entry]').length, 1);
  assert.equal(doc.querySelectorAll('[data-pdsh-entry-shell]').length, 1);
  entry.dispose(); doc.body.innerHTML = browser(); await tick();
  assert.equal(doc.querySelector('[data-pdsh-search-entry]'), null); dom.window.close();
});

test('未知/多区域/多搜索节点及未可测图标都退让，结构恢复后重新挂载', async () => {
  const { dom, doc, options } = setup();
  const entry = mountSearchEntry(doc, options);
  for (const html of [browser() + browser(), browser().replace('</button>', '</button>' + search(true)), browser().replace('搜索会话', 'Unknown search'), browser().replace('width:14px;height:14px', 'width:0px;height:0px'), browser().replace('type="text"', 'type="password"')]) {
    doc.body.innerHTML = html; await tick(); assert.equal(doc.querySelector('[data-pdsh-search-entry]'), null);
    doc.body.innerHTML = browser(); await tick(); assert.equal(doc.querySelectorAll('[data-pdsh-search-entry]').length, 1);
  }
  entry.dispose(); dom.window.close();
});

test('翻译 refresh 使用同一个入口；外部移除后修复；重复 dispose 安全', async () => {
  const { dom, doc, options } = setup(); let language = '中文';
  options.label = () => language;
  const entry = mountSearchEntry(doc, options), button = doc.querySelector('[data-pdsh-search-entry]');
  language = 'English'; entry.refresh(); assert.equal(button.getAttribute('aria-label'), 'English');
  button.remove(); await tick(); assert.equal(doc.querySelector('[data-pdsh-search-entry]'), button);
  entry.dispose(); entry.dispose(); await tick(); assert.equal(doc.querySelector('[data-pdsh-search-entry]'), null);
  dom.window.close();
});

test('左侧入口接管自动留白；搜索展开和卸载恢复原生 slot 对齐', () => {
  const { dom, doc, options } = setup();
  const sheet = doc.createElement('style');
  sheet.textContent = '.native-search-slot { margin-left: auto; }' + readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  doc.head.append(sheet);
  const slot = doc.querySelector('.native-search-slot'), native = doc.querySelector('button[aria-expanded]');
  const style = node => dom.window.getComputedStyle(node);
  assert.equal(style(slot).marginLeft, 'auto');
  const entry = mountSearchEntry(doc, options), button = doc.querySelector('[data-pdsh-search-entry]');
  assert.equal(style(button).marginLeft, 'auto');
  assert.equal(style(slot).marginLeft, '0px');
  native.setAttribute('aria-expanded', 'true'); entry.refresh();
  assert.equal(button.hidden, true); assert.equal(style(slot).marginLeft, 'auto');
  native.setAttribute('aria-expanded', 'false'); entry.refresh();
  assert.equal(style(slot).marginLeft, '0px');
  entry.dispose(); assert.equal(style(slot).marginLeft, 'auto');
  assert.equal(slot.hasAttribute('style'), false); dom.window.close();
});

test('帽子开关请求后修复自己的焦点空洞，不抢回用户移走的焦点', () => {
  const { dom, doc, options } = setup();
  let state = { pressed: false, busy: false, disabled: false };
  options.state = () => state;
  const entry = mountSearchEntry(doc, options), button = doc.querySelector('[data-pdsh-search-entry]');
  doc.body.tabIndex = -1;
  button.focus(); state = { ...state, busy: true, disabled: true }; entry.refresh(); doc.body.focus();
  state = { ...state, busy: false, disabled: false }; entry.refresh();
  assert.equal(doc.activeElement, button);
  button.focus(); state = { ...state, busy: true, disabled: true }; entry.refresh();
  const elsewhere = doc.createElement('button'); doc.body.append(elsewhere); elsewhere.focus();
  state = { ...state, busy: false, disabled: false }; entry.refresh();
  assert.equal(doc.activeElement, elsewhere);
  entry.dispose(); dom.window.close();
});
