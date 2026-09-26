/**
 * [INPUT]: 依赖 rc.2 sidebar.workspaces 的原生搜索结构、实时 class/图标尺寸及调用方的导航/翻译。
 * [OUTPUT]: 提供可撤回的搜索邻接入口；保留搜索节点，不复制整个区域或写原生状态。
 * [POS]: PDSH 版本相关 DOM 适配边界；非官方 child slot，与身份显示控制器相互独立。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const SEARCH = 'button[aria-label="搜索会话"], button[aria-label="Search sessions"]';

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

export function mountSearchEntry(doc, { icon, label, open }) {
  const template = doc.createElement('template'); template.innerHTML = icon;
  const svg = template.content.querySelector('svg');
  if (!svg) throw new Error('PDSH trusted entry icon missing');
  svg.removeAttribute('width'); svg.removeAttribute('height');
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
  const button = doc.createElement('button'); button.type = 'button'; button.append(svg);
  // +--- 只调用官方导航；不冒充原生搜索点击或隐私会话 ---+
  const activate = () => { if (button.isConnected && !button.hidden && !disposed) open(); };
  button.addEventListener('click', activate);
  let shell = null, disposed = false;
  function detach() { button.remove(); shell?.remove(); shell = null; }
  function synchronize() {
    if (disposed) return;
    const native = locate(doc);
    if (!native) { detach(); return; }
    const size = doc.defaultView.getComputedStyle(native.button.querySelector('svg'));
    if (!(Number.parseFloat(size.width) > 0 && Number.parseFloat(size.height) > 0)) { detach(); return; }
    attribute(button, 'class', native.button.className);
    attribute(button, 'data-pdsh-search-entry', native.wide ? 'wide' : 'rail');
    attribute(button, 'aria-label', label()); attribute(button, 'title', label());
    attribute(svg, 'width', size.width); attribute(svg, 'height', size.height);
    const hidden = native.wide && native.button.getAttribute('aria-expanded') === 'true';
    if (button.hidden !== hidden) button.hidden = hidden;
    if (native.wide) {
      if (shell) { button.remove(); shell.remove(); shell = null; }
      // searchSlot 的 margin-left:auto 归原生所有；放其后才能真正贴邻，不改该布局规则。
      if (button.parentElement !== native.parent || button.previousElementSibling !== native.anchor) native.parent.insertBefore(button, native.anchor.nextSibling);
    } else {
      if (!shell) { shell = doc.createElement('div'); shell.setAttribute('data-pdsh-entry-shell', ''); }
      attribute(shell, 'class', native.search.className);
      if (button.parentElement !== shell) shell.append(button);
      if (shell.parentElement !== native.parent || shell.nextElementSibling !== native.anchor) native.parent.insertBefore(shell, native.anchor);
    }
  }
  const observer = new doc.defaultView.MutationObserver(synchronize);
  observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-label', 'aria-expanded', 'style', 'width', 'height'] });
  synchronize();
  return {
    refresh: synchronize,
    dispose() { disposed = true; observer.disconnect(); button.removeEventListener('click', activate); detach(); },
  };
}
