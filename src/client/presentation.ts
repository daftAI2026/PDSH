/**
 * [INPUT]: 依赖 DOM/MutationObserver、官方 AccountMenu 样式归属及 shared/model.ts 的偏好和头像生成。
 * [OUTPUT]: 提供身份结构识别、独立账号状态与可卸载视觉覆盖；拍照复用可见身份边界。
 * [POS]: PDSH 的 rc.2 DOM 适配边界；保留原生账户节点和行为，未知结构拒绝猜测。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { resolvePreferences } from '../shared/model.ts';

const LAUNCHER = '[data-slot="settings.launcher"] button[aria-haspopup="menu"][data-collapsed][data-signed-out]';
const OWNED = '[data-pdsh-name], [data-pdsh-avatar-image], [data-pdsh-avatar-container]';
const MARKERS = ['data-pdsh-original-label', 'data-pdsh-avatar', 'data-pdsh-original-avatar', 'data-pdsh-identity-row'];
const ACCOUNT_STYLES = 'style[data-plugin-css="@deepseek-ai/dsh-client-ui-settings-account/AccountMenu.module.css"]';

function readAccountStyles(doc: Document, trigger: Element) {
  // +--- 只读官方所属样式；借用当前 class，不冻结 CSS Modules hash 或尺寸 ---+
  const sheets = [...doc.querySelectorAll<HTMLStyleElement>(ACCOUNT_STYLES)];
  if (sheets.length !== 1 || sheets[0].dataset.plugin !== '@deepseek-ai/dsh-client-ui-settings-account' ||
    sheets[0].disabled || sheets[0].sheet?.disabled || sheets[0].media) return;
  let rules: CSSStyleRule[];
  try { rules = [...sheets[0].sheet.cssRules].filter(rule => rule.type === 1) as CSSStyleRule[]; }
  catch { return; }
  const simpleClass = (rule: CSSStyleRule) => /^\.([a-zA-Z_][\w-]*)$/.exec(rule.selectorText)?.[1];
  const positive = (value: string) => /^\d+(?:\.\d+)?px$/.test(value) && Number.parseFloat(value) > 0;
  const base = rules.filter(rule => {
    const name = simpleClass(rule);
    return name?.endsWith('_trigger') && trigger.classList.contains(name) && rule.style.display === 'flex' &&
      rule.style.getPropertyValue('align-items') === 'center' && positive(rule.style.height) && !!rule.style.padding;
  });
  const avatar = rules.filter(rule => simpleClass(rule)?.endsWith('_avatar') && rule.style.display === 'flex' &&
    rule.style.getPropertyValue('align-items') === 'center' && rule.style.getPropertyValue('justify-content') === 'center' &&
    ['none', '0 0 auto'].includes(rule.style.getPropertyValue('flex')) &&
    positive(rule.style.width) && rule.style.width === rule.style.height && rule.style.getPropertyValue('border-radius') === '50%');
  if (base.length !== 1 || avatar.length !== 1) return;
  return { avatarClass: simpleClass(avatar[0]), height: base[0].style.height, padding: base[0].style.padding,
    lineHeight: base[0].style.getPropertyValue('line-height') || 'inherit' };
}

export function recognizeSidebarIdentity(doc: Document) {
  const triggers = [...doc.querySelectorAll<HTMLButtonElement>(LAUNCHER)];
  if (triggers.length !== 1) return { status: 'unsupported' as const };
  const trigger = triggers[0];
  if (!['true', 'false'].includes(trigger.dataset.signedOut) || !['true', 'false'].includes(trigger.dataset.collapsed)) return { status: 'unsupported' as const };
  const signedOut = trigger.dataset.signedOut === 'true';
  const wide = trigger.dataset.collapsed === 'false';
  const children = [...trigger.children].filter(node => !node.matches(OWNED));
  const nativeAvatar = children[0];
  const label = wide ? children[1] : null;
  const validAvatar = signedOut ? nativeAvatar?.tagName.toLowerCase() === 'svg' : nativeAvatar?.tagName === 'SPAN' &&
    !!nativeAvatar.querySelector(':scope > img:not([data-pdsh-avatar-image]), :scope > svg');
  if (children.length !== (wide ? 2 : 1) || !validAvatar ||
    (wide && label?.tagName !== 'SPAN')) {
    return { status: 'unsupported' as const };
  }
  const ownedAvatar = trigger.querySelector<HTMLElement>(':scope > [data-pdsh-avatar-container]');
  const avatar = signedOut ? ownedAvatar ?? nativeAvatar : nativeAvatar;
  return { status: 'recognized' as const, trigger, wide, signedOut, nativeAvatar, avatar, label, hasIdentity: !signedOut || !!ownedAvatar };
}

export function mountPresentation(doc: Document) {
  let preferences;
  let currentStatus = 'disabled';
  let currentAccountAvatar = '';
  let currentAccountStatus: 'signed-in' | 'signed-out' | 'unsupported' = 'unsupported';
  let lastStructure: { trigger: Element; avatar: Element; label: Element | null; signedOut: boolean } | undefined;
  let disposed = false;
  const owned = new Set<Element>();
  const marked = new Set<Element>();
  const listeners = new Set<() => void>();
  let rowStyle: HTMLStyleElement | undefined;

  function publish(status, accountStatus: typeof currentAccountStatus, accountAvatar = '') {
    if (currentStatus === status && currentAccountAvatar === accountAvatar && currentAccountStatus === accountStatus) return;
    currentStatus = status; currentAccountAvatar = accountAvatar;
    currentAccountStatus = accountStatus;
    for (const listener of listeners) listener();
  }
  function clearIdentity() {
    rowStyle?.remove(); rowStyle = undefined;
    for (const node of owned) node.remove();
    owned.clear();
    for (const node of marked) for (const attr of MARKERS) node.removeAttribute(attr);
    marked.clear();
    lastStructure = undefined;
  }
  function refresh() {
    if (disposed || !preferences) return;
    const identity = recognizeSidebarIdentity(doc);
    // 原生已显示的头像仅供设置预览；不请求账户服务、不写入配置或日志。
    const accountStatus = identity.status === 'recognized' ? identity.signedOut ? 'signed-out' : 'signed-in' : 'unsupported';
    const accountAvatar = identity.status === 'recognized' && !identity.signedOut ? identity.nativeAvatar.querySelector(':scope > img:not([data-pdsh-avatar-image])')?.getAttribute('src') ?? '' : '';
    if (!preferences.maskIdentity) { clearIdentity(); publish('disabled', accountStatus, accountAvatar); return; }
    if (identity.status !== 'recognized') { clearIdentity(); publish(identity.status, accountStatus); return; }
    const { trigger, wide, nativeAvatar, label, signedOut } = identity;
    if (lastStructure && (lastStructure.trigger !== trigger || lastStructure.avatar !== nativeAvatar ||
      lastStructure.label !== label || lastStructure.signedOut !== signedOut)) clearIdentity();
    lastStructure = { trigger, avatar: nativeAvatar, label, signedOut };
    // +--- React 可重挂同一按钮的子树：回收脱离节点，绝不复制真实账户值 ---+
    for (const node of [...owned]) if (!trigger.contains(node)) { node.remove(); owned.delete(node); }
    for (const node of [...marked]) if (!trigger.contains(node)) {
      for (const attr of MARKERS) node.removeAttribute(attr);
      marked.delete(node);
    }
    let avatar = nativeAvatar;
    if (signedOut) {
      // +--- 保留 React 的 SVG 与登录语义；视觉采用登录后的官方头像和身份行 ---+
      const geometry = readAccountStyles(doc, trigger);
      if (!geometry) {
        clearIdentity(); publish('unsupported', accountStatus); return;
      }
      let container = trigger.querySelector<HTMLElement>(':scope > [data-pdsh-avatar-container]');
      if (!container) {
        container = doc.createElement('span'); container.setAttribute('data-pdsh-avatar-container', '');
        trigger.append(container); owned.add(container);
      }
      if (container.className !== geometry.avatarClass) container.className = geometry.avatarClass;
      const css = `${LAUNCHER}[data-pdsh-identity-row][data-collapsed="false"] { height:${geometry.height};padding:${geometry.padding};line-height:${geometry.lineHeight}; }`;
      if (!rowStyle) { rowStyle = doc.createElement('style'); rowStyle.dataset.pdshIdentityStyle = ''; }
      if (!rowStyle.isConnected) doc.head.append(rowStyle);
      if (rowStyle.textContent !== css) rowStyle.textContent = css;
      trigger.setAttribute('data-pdsh-identity-row', ''); marked.add(trigger);
      nativeAvatar.setAttribute('data-pdsh-original-avatar', ''); marked.add(nativeAvatar);
      avatar = container;
    }
    let image = avatar.querySelector<HTMLImageElement>(':scope > [data-pdsh-avatar-image]');
    if (preferences.useAccountAvatar && !signedOut) {
      if (image) { image.remove(); owned.delete(image); }
      avatar.removeAttribute('data-pdsh-avatar'); marked.delete(avatar);
    } else {
      avatar.setAttribute('data-pdsh-avatar', ''); marked.add(avatar);
      if (!image) {
        image = doc.createElement('img'); image.setAttribute('data-pdsh-avatar-image', '');
        image.alt = ''; image.referrerPolicy = 'no-referrer'; avatar.append(image); owned.add(image);
      }
      const source = signedOut && preferences.useAccountAvatar ? resolvePreferences({ nickname: preferences.nickname }).avatar : preferences.avatar;
      if (image.getAttribute('src') !== source) image.setAttribute('src', source);
    }
    let alias = trigger.querySelector(':scope > [data-pdsh-name]');
    if (wide) {
      label.setAttribute('data-pdsh-original-label', ''); marked.add(label);
      if (!alias) {
        alias = doc.createElement('span'); alias.setAttribute('data-pdsh-name', '');
        trigger.append(alias); owned.add(alias);
      }
      if (alias.className !== label.className) alias.className = label.className;
      if (alias.textContent !== preferences.nickname) alias.textContent = preferences.nickname;
    } else if (alias) { alias.remove(); owned.delete(alias); }
    publish('masked', accountStatus, accountAvatar);
  }
  const observer = new doc.defaultView.MutationObserver(() => {
    // +--- 写入仅在值变化时发生；暂停监听避免自己的属性造成反馈循环 ---+
    observer.disconnect(); refresh(); observe();
  });
  function observe() {
    if (!disposed) observer.observe(doc.documentElement, {
      subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ['data-collapsed', 'data-signed-out', 'class', 'src', 'data-plugin', 'data-plugin-css', 'media', 'disabled'],
    });
  }
  observe();
  return {
    update(value) { observer.disconnect(); preferences = value; refresh(); observe(); },
    refresh() { observer.disconnect(); refresh(); observe(); },
    status: () => currentStatus,
    accountAvatar: () => currentAccountAvatar,
    accountStatus: () => currentAccountStatus,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    dispose() {
      disposed = true; observer.disconnect(); clearIdentity(); listeners.clear();
    },
  };
}
