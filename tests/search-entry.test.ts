/**
 * [INPUT]: 依赖 search-entry.ts、帽子/相机线稿资产、原生 SVG 实时 viewBox/strokeWidth/显示尺寸与 rc.2 搜索结构夹具。
 * [OUTPUT]: 验证邻接挂载、状态/导航隔离、动态等效笔画、原生样式/透明度、未知几何退让与资源释放。
 * [POS]: PDSH 入口适配合同；不能替代确切 runtime 的真实 React/布局验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { mountSearchEntry } from '../src/client/search-entry.ts';

const icon = readFileSync(new URL('../src/client/entry-icon.svg', import.meta.url), 'utf8');
const search = (wide, language = 'zh') => `<button type="button" class="live-search-class" aria-label="${language === 'zh' ? '搜索会话' : 'Search sessions'}" ${wide ? 'aria-expanded="false"' : ''}><svg viewBox="0 0 16 16" style="width:${wide ? '14px' : '18px'};height:${wide ? '14px' : '18px'};stroke-width:1"></svg></button>`;
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
test('主题属性切换后重新解析原生搜索颜色声明', () => {
  const { dom, doc, options } = setup();
  const style = doc.createElement('style');
  style.textContent = 'html[data-theme="dark"] .native-search{color:var(--dark-search-color)}';
  doc.head.append(style);
  const entry = mountSearchEntry(doc, options), button = doc.querySelector('[data-pdsh-search-entry]');
  assert.equal(button.style.getPropertyValue('--pdsh-search-color'), 'var(--host-search-color)');
  doc.documentElement.setAttribute('data-theme', 'dark'); entry.refresh();
  assert.equal(button.style.getPropertyValue('--pdsh-search-color'), 'var(--dark-search-color)');
  entry.dispose(); dom.window.close();
});

test('透明度只作用于完整SVG，跟随原生图标而不逐笔加深交叠', async () => {
  const { dom, doc, options } = setup();
  const nativeSvg = doc.querySelector('button[aria-label="搜索会话"] svg');
  nativeSvg.style.opacity = '0.42';
  const entry = mountSearchEntry(doc, options), svg = doc.querySelector('[data-pdsh-search-entry] svg');
  assert.equal(svg.style.getPropertyValue('--pdsh-icon-opacity'), '0.42');
  assert.match(doc.querySelector('[data-pdsh-search-entry]').innerHTML, /stroke-width="1\.5"/);
  nativeSvg.style.opacity = '0.7'; entry.refresh();
  assert.equal(svg.style.getPropertyValue('--pdsh-icon-opacity'), '0.7');
  await tick();
  const changes = [];
  const observer = new dom.window.MutationObserver(records => changes.push(...records));
  observer.observe(svg, { attributes: true, attributeFilter: ['style'] });
  entry.refresh(); await tick();
  assert.equal(changes.length, 0, '相同透明度不重写style，避免观察器反馈循环');
  observer.disconnect();
  entry.dispose(); dom.window.close();
});

test('帽子与相机的运行时stroke跟随原生viewBox、style宽度和显示尺寸', () => {
  const { dom, doc, options } = setup();
  const cameraIcon = readFileSync(new URL('../src/client/camera-icon.svg', import.meta.url), 'utf8');
  const shots = [];
  options.capture = { icon: cameraIcon, label: () => '截取窗口', state: () => ({ busy: false, disabled: false }), onActivate: () => shots.push('capture') };
  const native = doc.querySelector('button[aria-label="搜索会话"]');
  const nativeSvg = native.querySelector('svg');
  // +--- jsdom 不可靠暴露 SVG presentation attribute；显式设置 CSS strokeWidth，模拟 live computed style ---+
  nativeSvg.setAttribute('viewBox', '0 0 16 16');
  nativeSvg.style.strokeWidth = '1';
  nativeSvg.style.width = '14px';
  nativeSvg.style.height = '14px';
  nativeSvg.style.opacity = '0.42';
  const entry = mountSearchEntry(doc, options);
  const hat = doc.querySelector('[data-pdsh-search-entry]');
  const camera = doc.querySelector('[data-pdsh-capture-entry]');
  const hatSvg = hat.querySelector('svg');
  const cameraSvg = camera.querySelector('svg');
  const strokeWidth = svg => Number.parseFloat(svg.style.strokeWidth || svg.getAttribute('stroke-width') || 'NaN');

  assert.equal(strokeWidth(hatSvg), 1.5, '1 user-unit / 16 × 24 user-units maps to the source asset default');
  assert.equal(strokeWidth(cameraSvg), 1.5);
  assert.equal(hatSvg.getAttribute('viewBox'), '0 0 24 24');
  assert.equal(cameraSvg.getAttribute('viewBox'), '0 0 24 24');
  assert.equal(hat.className, native.className);
  assert.equal(camera.className, native.className);
  assert.equal(hat.style.getPropertyValue('--pdsh-search-color'), 'var(--host-search-color)');
  assert.equal(camera.style.getPropertyValue('--pdsh-search-color'), 'var(--host-search-color)');
  assert.equal(hatSvg.style.getPropertyValue('--pdsh-icon-opacity'), '0.42');
  assert.equal(cameraSvg.style.getPropertyValue('--pdsh-icon-opacity'), '0.42');

  nativeSvg.style.strokeWidth = '2';
  nativeSvg.style.width = '20px';
  nativeSvg.style.height = '20px';
  nativeSvg.style.opacity = '0.7';
  entry.refresh();
  assert.equal(strokeWidth(hatSvg), 3, '2 × 24 / 16 keeps the physical stroke equal at 20px display size');
  assert.equal(strokeWidth(cameraSvg), 3, 'hat and camera share the same native visual stroke');
  assert.equal(hatSvg.getAttribute('width'), '20px');
  assert.equal(hatSvg.getAttribute('height'), '20px');
  assert.equal(cameraSvg.getAttribute('width'), '20px');
  assert.equal(cameraSvg.getAttribute('height'), '20px');
  assert.equal(hatSvg.style.getPropertyValue('--pdsh-icon-opacity'), '0.7');
  assert.equal(cameraSvg.style.getPropertyValue('--pdsh-icon-opacity'), '0.7');
  assert.equal(hat.style.getPropertyValue('--pdsh-search-color'), 'var(--host-search-color)');
  assert.equal(camera.style.getPropertyValue('--pdsh-search-color'), 'var(--host-search-color)');

  nativeSvg.style.strokeWidth = '3';
  nativeSvg.style.width = '16px';
  nativeSvg.style.height = '16px';
  entry.refresh();
  assert.equal(strokeWidth(hatSvg), 4.5, '下一次 refresh 再按新的实时笔画重算');
  assert.equal(strokeWidth(cameraSvg), 4.5);
  assert.equal(hatSvg.getAttribute('width'), '16px');
  assert.equal(cameraSvg.getAttribute('width'), '16px');
  entry.dispose(); dom.window.close();
});

test('未知viewBox、无有效原生stroke或非等比显示退让，不回退到资产默认线宽', () => {
  const cameraIcon = readFileSync(new URL('../src/client/camera-icon.svg', import.meta.url), 'utf8');
  const cases = [
    { name: 'missing viewBox', viewBox: null, stroke: '2', width: '14px', height: '14px' },
    { name: 'missing style strokeWidth', viewBox: '0 0 16 16', stroke: null, width: '14px', height: '14px' },
    { name: 'zero strokeWidth', viewBox: '0 0 16 16', stroke: '0', width: '14px', height: '14px' },
    { name: 'non-square viewBox in square display box', viewBox: '0 0 16 8', stroke: '2', width: '14px', height: '14px' },
    { name: 'non-proportional display box', viewBox: '0 0 16 16', stroke: '2', width: '14px', height: '12px' },
  ];
  const mounted = [];

  for (const fixture of cases) {
    const { dom, doc, options } = setup();
    const nativeSvg = doc.querySelector('button[aria-label="搜索会话"] svg');
    if (fixture.viewBox === null) nativeSvg.removeAttribute('viewBox');
    else nativeSvg.setAttribute('viewBox', fixture.viewBox);
    if (fixture.stroke === null) nativeSvg.style.removeProperty('stroke-width');
    else nativeSvg.style.strokeWidth = fixture.stroke;
    nativeSvg.style.width = fixture.width;
    nativeSvg.style.height = fixture.height;
    options.capture = { icon: cameraIcon, label: () => '截取窗口', state: () => ({ busy: false, disabled: false }), onActivate() {} };
    const entry = mountSearchEntry(doc, options);
    const controls = [...doc.querySelectorAll('[data-pdsh-search-entry], [data-pdsh-capture-entry]')].map(node => node.getAttribute('data-pdsh-search-entry') === null ? 'camera' : 'hat');
    if (controls.length) mounted.push({ fixture: fixture.name, controls });
    entry.dispose();
    dom.window.close();
  }

  assert.deepEqual(mounted, [], '无可靠几何时同时跳过帽子与相机，不伪造固定fallback');
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
  sheet.textContent = '.native-search-slot { margin-left: auto; }' + readFileSync(new URL('../src/client/styles.css', import.meta.url), 'utf8');
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

test('相机位于帽子右侧、搜索左侧；整枚图标透明度与原生同步，点击只走截图', async () => {
  const { dom, doc, options, opened } = setup();
  const cameraIcon = readFileSync(new URL('../src/client/camera-icon.svg', import.meta.url), 'utf8');
  const shots = [];
  options.capture = { icon: cameraIcon, label: () => '截取窗口', state: () => ({ busy: false, disabled: false }), onActivate: () => shots.push('capture') };
  const nativeSvg = doc.querySelector('button[aria-label="搜索会话"] svg'); nativeSvg.style.opacity = '0.44';
  const entry = mountSearchEntry(doc, options);
  const hat = doc.querySelector('[data-pdsh-search-entry]'), camera = doc.querySelector('[data-pdsh-capture-entry]');
  assert.equal(hat.nextElementSibling, camera);
  assert.equal(camera.nextElementSibling, doc.querySelector('.native-search-slot'));
  assert.equal(camera.querySelector('svg').style.getPropertyValue('--pdsh-icon-opacity'), '0.44');
  assert.equal(camera.querySelector('svg').getAttribute('width'), '14px');
  camera.click(); assert.deepEqual(shots, ['capture']); assert.deepEqual(opened, []);
  nativeSvg.style.opacity = '0.7'; entry.refresh();
  assert.equal(camera.querySelector('svg').style.getPropertyValue('--pdsh-icon-opacity'), '0.7');
  doc.querySelector('button[aria-expanded]').setAttribute('aria-expanded', 'true'); await tick();
  assert.equal(camera.hidden, true); camera.click(); assert.deepEqual(shots, ['capture']);
  entry.dispose(); assert.equal(doc.querySelector('[data-pdsh-capture-entry]'), null);
  dom.window.close();
});

test('标题组件关闭后，相机单独挂载、搜索展开隐藏并卸载归还', () => {
  const cameraIcon = readFileSync(new URL('../src/client/camera-icon.svg', import.meta.url), 'utf8');
  for (const wide of [true, false]) {
    const { dom, doc } = setup(browser(wide)), before = doc.body.outerHTML;
    let count = 0;
    const entry = mountSearchEntry(doc, { icon: null, capture: {
      icon: cameraIcon, label: () => '截取窗口', state: () => ({ busy: false, disabled: false }), onActivate: () => ++count,
    } });
    assert.equal(doc.querySelector('[data-pdsh-search-entry]'), null);
    const camera = doc.querySelector('[data-pdsh-capture-entry]');
    assert.ok(camera); assert.ok(camera.hasAttribute('data-pdsh-entry-first'));
    camera.click(); assert.equal(count, 1);
    if (wide) {
      doc.querySelector('button[aria-label="搜索会话"]').setAttribute('aria-expanded', 'true'); entry.refresh();
      assert.equal(camera.hidden, true); camera.click(); assert.equal(count, 1);
    }
    entry.dispose(); assert.equal(doc.body.outerHTML, wide ? before.replace('aria-expanded="false"', 'aria-expanded="true"') : before); dom.window.close();
  }
});
