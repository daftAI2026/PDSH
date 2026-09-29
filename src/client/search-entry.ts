/**
 * [INPUT]: 依赖原生搜索结构、实时class/图标几何/根透明度/CSS变量，以及Host开关状态/翻译。
 * [OUTPUT]: 提供可撤回的线条入口与局部焦点修复；透明度在整枚SVG合成，卸载还原原生搜索。
 * [POS]: PDSH 版本相关 DOM 适配边界；非官方 child slot，与身份显示控制器相互独立。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const SEARCH = 'button[aria-label="搜索会话"], button[aria-label="Search sessions"]';

// +--- 跟踪实际命中的CSS声明，不把主题颜色冻结为RGB ---+
function colorReference(doc, element) {
  const rules = [];
  function visit(list) {
    for (const rule of list) {
      if (rule.selectorText && rule.style) rules.push(rule);
      else if (rule.cssRules) {
        if (rule.constructor.name === 'CSSMediaRule' && !doc.defaultView.matchMedia?.(rule.conditionText).matches) continue;
        if (rule.constructor.name === 'CSSSupportsRule' && !doc.defaultView.CSS?.supports(rule.conditionText)) continue;
        visit(rule.cssRules);
      }
    }
  }
  for (const sheet of [...doc.styleSheets, ...(doc.adoptedStyleSheets ?? [])]) {
    try { visit(sheet.cssRules); } catch { /* 不读跨源样式，不猜颜色。 */ }
  }
  for (let node = element; node; node = node.parentElement) {
    let declaration = '';
    for (const rule of rules) {
      try { if (node.matches(rule.selectorText) && rule.style.color) declaration = rule.style.color; } catch { /* 未支持selector跳过。 */ }
    }
    declaration = node.style.color || declaration;
    if (!declaration || declaration === 'inherit' || declaration === 'currentcolor') continue;
    return /var\(--[\w-]+/.test(declaration) ? declaration : null;
  }
  return null;
}

function locate(doc) {
  const regions = doc.querySelectorAll('[data-slot="sidebar.workspaces"]');
  if (regions.length !== 1) return null;
  const buttons = regions[0].querySelectorAll(SEARCH);
  if (buttons.length !== 1) return null;
  const button = buttons[0], search = button.parentElement, root = regions[0].firstElementChild;
  if (!root || !search || button.type !== 'button' || !button.className || !button.querySelector('svg')) return null;
  const wide = button.hasAttribute('aria-expanded');
  if (wide) {
    const slot = search.parentElement, header = slot?.parentElement;
    if (header?.parentElement !== root || header !== root.firstElementChild || !search.querySelector('input[type="text"]')) return null;
    if (!['true', 'false'].includes(button.getAttribute('aria-expanded'))) return null;
    return { button, search, parent: header, anchor: slot, wide };
  }
  if (search.parentElement !== root || search === root.firstElementChild || !search.className || search.querySelector('input')) return null;
  return { button, search, parent: root, anchor: search, wide };
}

function attribute(node, name, value) {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

export function mountSearchEntry(doc, { icon, label, state, onActivate }) {
  const template = doc.createElement('template'); template.innerHTML = icon;
  const svg = template.content.querySelector('svg');
  if (!svg) throw new Error('PDSH trusted entry icon missing');
  svg.removeAttribute('width'); svg.removeAttribute('height');
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  const button = doc.createElement('button'); button.type = 'button'; button.append(svg);
  // +--- 操作由Host控制器承接；不冒充搜索点击或隔离会话 ---+
  const activate = () => { if (button.isConnected && !button.hidden && !button.disabled && !disposed) onActivate(); };
  button.addEventListener('click', activate);
  let pendingFocus = false, wasBusy = false;
  let shell = null, disposed = false, sampledElement = null, sampledKey = '', sampledColor = null;
  function detach() { pendingFocus = false; button.remove(); shell?.remove(); shell = null; }
  function synchronize() {
    if (disposed) return;
    const native = locate(doc);
    if (!native) { detach(); return; }
    const size = doc.defaultView.getComputedStyle(native.button.querySelector('svg'));
    if (!(Number.parseFloat(size.width) > 0 && Number.parseFloat(size.height) > 0)) { detach(); return; }
    // +--- 只对整枚 SVG 合成透明度；逐 path 的半透明会让笔画交叠处加深 ---+
    const opacity = Number.parseFloat(size.opacity);
    if (Number.isFinite(opacity) && opacity >= 0 && opacity <= 1) {
      if (svg.style.getPropertyValue('--pdsh-icon-opacity') !== String(opacity)) svg.style.setProperty('--pdsh-icon-opacity', String(opacity));
    } else if (svg.style.getPropertyValue('--pdsh-icon-opacity')) svg.style.removeProperty('--pdsh-icon-opacity');
    attribute(button, 'class', native.button.className);
    attribute(button, 'data-pdsh-search-entry', native.wide ? 'wide' : 'rail');
    attribute(button, 'aria-label', label()); attribute(button, 'title', label());
    const current = state();
    if (current.busy && !wasBusy) pendingFocus = doc.activeElement === button;
    attribute(button, 'aria-pressed', String(current.pressed)); attribute(button, 'aria-busy', String(current.busy));
    button.disabled = current.disabled;
    const chain = [];
    for (let node = native.button; node; node = node.parentElement) chain.push(`${node.getAttribute('class') ?? ''}|${node.style.color}`);
    const key = `${doc.styleSheets.length}:${chain.join(';')}`;
    if (sampledElement !== native.button || sampledKey !== key) {
      sampledElement = native.button; sampledKey = key; sampledColor = colorReference(doc, native.button);
    }
    const color = sampledColor;
    if (color && button.style.getPropertyValue('--pdsh-search-color') !== color) button.style.setProperty('--pdsh-search-color', color);
    else if (!color) button.style.removeProperty('--pdsh-search-color');
    attribute(svg, 'width', size.width); attribute(svg, 'height', size.height);
    const hidden = native.wide && native.button.getAttribute('aria-expanded') === 'true';
    if (button.hidden !== hidden) button.hidden = hidden;
    if (native.wide) {
      if (shell) { button.remove(); shell.remove(); shell = null; }
      // +--- 入口在左：留白由自有按钮承担；邻接 CSS 仅在入口可见时撤去 slot 的自动外边距 ---+
      if (button.parentElement !== native.parent || button.nextElementSibling !== native.anchor) native.parent.insertBefore(button, native.anchor);
    } else {
      if (!shell) { shell = doc.createElement('div'); shell.setAttribute('data-pdsh-entry-shell', ''); }
      attribute(shell, 'class', native.search.className);
      if (button.parentElement !== shell) shell.append(button);
      if (shell.parentElement !== native.parent || shell.nextElementSibling !== native.anchor) native.parent.insertBefore(shell, native.anchor);
    }
    if (wasBusy && !current.busy) {
      // 只修复请求禁用造成的焦点空洞，用户移焦或搜索展开时不抢回。
      if (pendingFocus && !button.disabled && !button.hidden && button.isConnected
        && (doc.activeElement === doc.body || doc.activeElement === button)) button.focus();
      pendingFocus = false;
    }
    wasBusy = current.busy;
  }
  const observer = new doc.defaultView.MutationObserver(records => {
    if (records.some(record => doc.head.contains(record.target))) sampledKey = '';
    synchronize();
  });
  observer.observe(doc.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'data-theme', 'data-dsw-theme', 'aria-label', 'aria-expanded', 'style', 'width', 'height'] });
  synchronize();
  return {
    refresh: synchronize,
    dispose() { disposed = true; observer.disconnect(); button.removeEventListener('click', activate); detach(); },
  };
}
