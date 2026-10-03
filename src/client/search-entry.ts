/**
 * [INPUT]: 依赖原生搜索结构、实时 class/显示尺寸/viewBox/计算线宽/根透明度/CSS 变量、可选标题/截图控制器；两者可分别关闭。
 * [OUTPUT]: 提供拍摄时保留的帽子及右侧相机入口与局部焦点修复；线宽按原生坐标比例换算、整体合成透明度，未知几何退让，卸载还原搜索。
 * [POS]: PDSH 版本相关 DOM 适配边界；非官方 child slot，与身份显示控制器相互独立。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { matchNativeIconStroke } from './native-icon.ts';

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

export function mountSearchEntry(doc: Document, { icon = null, label = (): string => '', state = () => ({ pressed: false, busy: false, disabled: false }), onActivate = () => {}, capture = null } = {}) {
  let shell: HTMLElement | null = null, disposed = false, sampledElement = null, sampledKey = '', sampledColor = null;
  function makeControl(source, marker, readState, readLabel, activate, pressed = false) {
    const template = doc.createElement('template'); template.innerHTML = source;
    const svg = template.content.querySelector('svg');
    if (!svg) throw new Error('PDSH trusted entry icon missing');
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
    const button = doc.createElement('button'); button.type = 'button'; button.append(svg);
    const click = () => { if (button.isConnected && !button.hidden && !button.disabled && !disposed) activate(); };
    button.addEventListener('click', click);
    return { button, svg, marker, readState, readLabel, pressed, click, wasBusy: false, pendingFocus: false };
  }
  const controls = [
    ...(icon ? [makeControl(icon, 'data-pdsh-search-entry', state, label, onActivate, true)] : []),
    ...(capture ? [makeControl(capture.icon, 'data-pdsh-capture-entry', capture.state, capture.label, capture.onActivate)] : []),
  ];
  controls[0]?.button.setAttribute('data-pdsh-entry-first', '');
  function detach() {
    for (const control of controls) { control.pendingFocus = false; control.button.remove(); }
    shell?.remove(); shell = null;
  }
  function synchronize() {
    if (disposed || !controls.length) return;
    const native = locate(doc);
    if (!native) { detach(); return; }
    const nativeSvg = native.button.querySelector('svg'), size = doc.defaultView.getComputedStyle(nativeSvg);
    if (!(Number.parseFloat(size.width) > 0 && Number.parseFloat(size.height) > 0)) { detach(); return; }
    const strokes = controls.map(control => matchNativeIconStroke(nativeSvg, control.svg, size));
    if (strokes.some(stroke => !stroke)) { detach(); return; }
    const chain = [];
    for (let node = native.button; node; node = node.parentElement) chain.push(`${node.getAttribute('class') ?? ''}|${node.style.color}`);
    const theme = [doc.documentElement, doc.body].map(node => `${node.className}|${node.getAttribute('data-theme')}|${node.getAttribute('data-dsw-theme')}|${node.style.cssText}`).join(';');
    const key = `${doc.styleSheets.length}:${theme}:${chain.join(';')}`;
    if (sampledElement !== native.button || sampledKey !== key) {
      sampledElement = native.button; sampledKey = key; sampledColor = colorReference(doc, native.button);
    }
    const opacity = Number.parseFloat(size.opacity), hidden = native.wide && native.button.getAttribute('aria-expanded') === 'true';
    for (const [index, control] of controls.entries()) {
      const { button, svg } = control, current = control.readState();
      attribute(svg, 'stroke-width', strokes[index]);
      // +--- 整枚 SVG 合成透明度，禁止逐笔叠加；两个入口消费同一实时几何 ---+
      if (Number.isFinite(opacity) && opacity >= 0 && opacity <= 1) {
        if (svg.style.getPropertyValue('--pdsh-icon-opacity') !== String(opacity)) svg.style.setProperty('--pdsh-icon-opacity', String(opacity));
      } else svg.style.removeProperty('--pdsh-icon-opacity');
      attribute(svg, 'width', size.width); attribute(svg, 'height', size.height);
      attribute(button, 'class', native.button.className);
      attribute(button, control.marker, native.wide ? 'wide' : 'rail');
      attribute(button, 'aria-label', control.readLabel()); attribute(button, 'data-pdsh-tooltip', control.readLabel());
      if (control.pressed) attribute(button, 'aria-pressed', String(current.pressed));
      attribute(button, 'aria-busy', String(current.busy)); button.disabled = current.disabled;
      if (current.busy && !control.wasBusy) control.pendingFocus = doc.activeElement === button;
      if (button.hidden !== hidden) button.hidden = hidden;
      if (sampledColor && button.style.getPropertyValue('--pdsh-search-color') !== sampledColor) button.style.setProperty('--pdsh-search-color', sampledColor);
      else if (!sampledColor) button.style.removeProperty('--pdsh-search-color');
      if (control.wasBusy && !current.busy) {
        if (control.pendingFocus && !button.disabled && !button.hidden && button.isConnected
          && (doc.activeElement === doc.body || doc.activeElement === button)) button.focus();
        control.pendingFocus = false;
      }
      control.wasBusy = current.busy;
    }
    if (native.wide) {
      if (shell) { for (const { button } of controls) button.remove(); shell.remove(); shell = null; }
      // +--- 从右向左校准帽子/相机；任一能力关闭时剩余入口独立邻接搜索 ---+
      let anchor = native.anchor;
      for (const { button } of [...controls].reverse()) {
        if (button.parentElement !== native.parent || button.nextElementSibling !== anchor) native.parent.insertBefore(button, anchor);
        anchor = button;
      }
    } else {
      if (!shell) { shell = doc.createElement('div'); shell.setAttribute('data-pdsh-entry-shell', ''); }
      attribute(shell, 'class', native.search.className);
      let previous: Element | null = null;
      for (const { button } of controls) {
        if (button.parentElement !== shell || button.previousElementSibling !== previous) shell.insertBefore(button, previous ? previous.nextElementSibling : shell.firstElementChild);
        previous = button;
      }
      if (shell.parentElement !== native.parent || shell.nextElementSibling !== native.anchor) native.parent.insertBefore(shell, native.anchor);
    }
  }
  const observer = new doc.defaultView.MutationObserver(records => {
    if (records.some(record => doc.head.contains(record.target))) sampledKey = '';
    synchronize();
  });
  if (controls.length) observer.observe(doc.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'data-theme', 'data-dsw-theme', 'aria-label', 'aria-expanded', 'style', 'width', 'height', 'viewBox', 'stroke-width', 'vector-effect'] });
  const refreshStyles = () => { sampledKey = ''; synchronize(); };
  doc.defaultView.addEventListener('resize', refreshStyles);
  synchronize();
  return {
    refresh: synchronize,
    dispose() {
      if (disposed) return; disposed = true; observer.disconnect(); doc.defaultView.removeEventListener('resize', refreshStyles);
      for (const { button, click } of controls) button.removeEventListener('click', click);
      detach();
    },
  };
}
