/**
 * [INPUT]: 依赖浏览器 DOM/MutationObserver 和 model.js 已验证的显示偏好。
 * [OUTPUT]: 提供可更新、可卸载的灰框标记及 sidebar 身份视觉覆盖控制器及仅内存的原生头像预览来源。
 * [POS]: PDSH 的 rc.2 DOM 适配边界；保留原生账户节点和行为，未知结构拒绝猜测。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const LAUNCHER = '[data-slot="settings.launcher"] button[aria-haspopup="menu"][data-collapsed][data-signed-out]';
const OWNED = '[data-pdsh-name], [data-pdsh-avatar-image]';
const MARKERS = ['data-pdsh-original-label', 'data-pdsh-avatar'];

function locateIdentity(doc) {
  const triggers = [...doc.querySelectorAll(LAUNCHER)];
  if (triggers.length !== 1) return { status: 'unsupported' };
  const trigger = triggers[0];
  if (trigger.dataset.signedOut === 'true') return { status: 'signed-out' };
  if (trigger.dataset.signedOut !== 'false') return { status: 'unsupported' };
  const wide = trigger.dataset.collapsed === 'false';
  const children = [...trigger.children].filter(node => !node.matches(OWNED));
  const avatar = children[0];
  const label = wide ? children[1] : null;
  if (children.length !== (wide ? 2 : 1) || avatar?.tagName !== 'SPAN' ||
    !avatar.querySelector(':scope > img:not([data-pdsh-avatar-image]), :scope > svg') ||
    (wide && label?.tagName !== 'SPAN')) {
    return { status: 'unsupported' };
  }
  return { status: 'masked', trigger, wide, avatar, label };
}

export function mountPresentation(doc) {
  let preferences;
  let currentStatus = 'disabled';
  let currentAccountAvatar = '';
  let disposed = false;
  const owned = new Set();
  const marked = new Set();
  const listeners = new Set();
  const originalFrames = doc.body.getAttribute('data-pdsh-frames');

  function publish(status, accountAvatar = '') {
    if (currentStatus === status && currentAccountAvatar === accountAvatar) return;
    currentStatus = status; currentAccountAvatar = accountAvatar;
    for (const listener of listeners) listener();
  }
  function clearIdentity() {
    for (const node of owned) node.remove();
    owned.clear();
    for (const node of marked) for (const attr of MARKERS) node.removeAttribute(attr);
    marked.clear();
  }
  function refresh() {
    if (disposed || !preferences) return;
    if (preferences.frames) {
      if (!doc.body.hasAttribute('data-pdsh-frames')) doc.body.setAttribute('data-pdsh-frames', '');
    } else doc.body.removeAttribute('data-pdsh-frames');
    const identity = locateIdentity(doc);
    // 原生已显示的头像仅供设置预览；不请求账户服务、不写入配置或日志。
    const accountAvatar = identity.avatar?.querySelector(':scope > img:not([data-pdsh-avatar-image])')?.getAttribute('src') ?? '';
    if (!preferences.maskIdentity) { clearIdentity(); publish('disabled', accountAvatar); return; }
    if (identity.status !== 'masked') { clearIdentity(); publish(identity.status); return; }
    const { trigger, wide, avatar, label } = identity;
    // +--- React 可重挂同一按钮的子树：回收脱离节点，绝不复制真实账户值 ---+
    for (const node of [...owned]) if (!trigger.contains(node)) { node.remove(); owned.delete(node); }
    for (const node of [...marked]) if (!trigger.contains(node)) {
      for (const attr of MARKERS) node.removeAttribute(attr);
      marked.delete(node);
    }
    let image = avatar.querySelector(':scope > [data-pdsh-avatar-image]');
    if (preferences.useAccountAvatar) {
      if (image) { image.remove(); owned.delete(image); }
      avatar.removeAttribute('data-pdsh-avatar'); marked.delete(avatar);
    } else {
      avatar.setAttribute('data-pdsh-avatar', ''); marked.add(avatar);
      if (!image) {
        image = doc.createElement('img'); image.setAttribute('data-pdsh-avatar-image', '');
        image.alt = ''; image.referrerPolicy = 'no-referrer'; avatar.append(image); owned.add(image);
      }
      if (image.getAttribute('src') !== preferences.avatar) image.setAttribute('src', preferences.avatar);
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
    publish('masked', accountAvatar);
  }
  const observer = new doc.defaultView.MutationObserver(() => {
    // +--- 写入仅在值变化时发生；暂停监听避免自己的属性造成反馈循环 ---+
    observer.disconnect(); refresh(); observe();
  });
  function observe() {
    if (!disposed) observer.observe(doc.body, {
      subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ['data-collapsed', 'data-signed-out', 'class', 'src'],
    });
  }
  observe();
  return {
    update(value) { observer.disconnect(); preferences = value; refresh(); observe(); },
    refresh() { observer.disconnect(); refresh(); observe(); },
    status: () => currentStatus,
    accountAvatar: () => currentAccountAvatar,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    dispose() {
      disposed = true; observer.disconnect(); clearIdentity(); listeners.clear();
      if (originalFrames === null) doc.body.removeAttribute('data-pdsh-frames');
      else doc.body.setAttribute('data-pdsh-frames', originalFrames);
    },
  };
}
