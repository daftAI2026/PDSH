/**
 * [INPUT]: 依赖宿主实际渲染的 Input/Button/Switch/SettingsValueField/Tooltip 探针和 native-icon 的坐标换算。
 * [OUTPUT]: 提供 mountNativeStyleProbe 控制器；主题、样式、尺寸变化重采并跟随控件重建转移观察权，数值未变不写回，来源缺失撤销旧值，卸载归还自有变量。
 * [POS]: Client 的原生样式效果边界；React 只装配真实控件，设置、截图和 DOM Tooltip 共用实时测量值。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { readNativeStrokeRatio } from './native-icon.ts';

export function mountNativeStyleProbe(doc: Document, root: HTMLElement) {
  const view = doc.defaultView!;
  const previous = new Map<string, { value: string; priority: string }>();
  const hadBodyStyle = doc.body.hasAttribute('style');
  let disposed = false, queued = false;
  let targets = new Set<Element>();
  function synchronizeTargets(next: Set<Element>) {
    for (const node of targets) if (!next.has(node)) resize?.unobserve(node);
    for (const node of next) if (!targets.has(node)) resize?.observe(node);
    targets = next;
  }
  function write(key: string, value: string | null) {
    if (!previous.has(key)) previous.set(key, { value: doc.body.style.getPropertyValue(key), priority: doc.body.style.getPropertyPriority(key) });
    if (value === null) {
      if (doc.body.style.getPropertyValue(key)) doc.body.style.removeProperty(key);
    } else if (doc.body.style.getPropertyValue(key) !== value) doc.body.style.setProperty(key, value);
  }
  const length = (value: string, allowZero = false) => {
    const number = Number.parseFloat(value);
    return Number.isFinite(number) && (allowZero ? number >= 0 : number > 0) ? value : null;
  };
  const text = (value: string) => value.trim() || null;
  const opacity = (value: string) => value.trim() && Number(value) >= 0 && Number(value) <= 1 ? value : null;
  function sample() {
    if (disposed) return;
    if (!root.isConnected) {
      synchronizeTargets(new Set());
      for (const key of previous.keys()) write(key, null);
      return;
    }
    const nextTargets = new Set<Element>([root]);
    const seen = new Set<string>();
    function put(key: string, value: string | null) { seen.add(key); write(key, value); }
    const input = root.querySelector('input');
    if (input?.parentElement) {
      nextTargets.add(input.parentElement);
      const style = view.getComputedStyle(input.parentElement);
      put('--pdsh-outline-width', length(style.borderTopWidth, true));
      put('--pdsh-control-size', length(style.height));
    }
    const button = root.querySelector('[data-pdsh-button-probe]');
    if (button) {
      nextTargets.add(button);
      const style = view.getComputedStyle(button);
      put('--pdsh-action-size', length(style.height));
      put('--pdsh-button-inset', length(style.paddingInlineStart, true));
      put('--pdsh-button-gap', length(style.gap, true));
      put('--pdsh-action-radius', text(style.borderRadius));
      put('--pdsh-action-corner-shape', text(style.getPropertyValue('corner-shape')));
      put('--pdsh-action-disabled-opacity', opacity(style.opacity));
      put('--pdsh-action-transition', text(style.transition));
      const icon = button.querySelector('svg');
      if (icon) {
        nextTargets.add(icon);
        const iconStyle = view.getComputedStyle(icon), ratio = readNativeStrokeRatio(icon, iconStyle);
        put('--pdsh-native-icon-stroke-ratio', ratio === null ? null : String(ratio));
        put('--pdsh-native-icon-opacity', opacity(iconStyle.opacity));
        put('--pdsh-native-icon-size', length(iconStyle.width));
      }
    }
    const track = root.querySelector('[role="switch"]');
    if (track?.firstElementChild) {
      nextTargets.add(track); nextTargets.add(track.firstElementChild);
      const style = view.getComputedStyle(track), thumb = view.getComputedStyle(track.firstElementChild);
      put('--pdsh-switch-width', length(style.width));
      put('--pdsh-switch-height', length(style.height));
      put('--pdsh-switch-radius', text(style.borderRadius));
      put('--pdsh-switch-thumb-size', length(thumb.width));
      put('--pdsh-switch-thumb-transition', text(thumb.transition));
      put('--pdsh-switch-thumb-shadow', text(thumb.boxShadow));
      put('--pdsh-switch-thumb-radius', text(thumb.borderRadius));
    }
    const field = root.querySelector('[data-pdsh-field-probe]')?.firstElementChild;
    if (field?.firstElementChild) {
      nextTargets.add(field); nextTargets.add(field.firstElementChild);
      const style = view.getComputedStyle(field), header = view.getComputedStyle(field.firstElementChild);
      put('--pdsh-section-inset', length(style.paddingTop, true));
      put('--pdsh-field-gap', length(style.gap, true));
      put('--pdsh-action-gap', length(header.gap, true));
    }
    const tooltip = root.querySelector('[role="tooltip"]');
    if (tooltip) {
      nextTargets.add(tooltip);
      // 只让自有不可见探针命中 Host 的 portal 规则，不改用户的 Tooltip。
      if (!tooltip.hasAttribute('data-portal')) tooltip.setAttribute('data-portal', '');
      const style = view.getComputedStyle(tooltip);
      put('--pdsh-tooltip-padding', text(style.padding));
      put('--pdsh-tooltip-duration', text(style.animationDuration));
      put('--pdsh-tooltip-ease', text(style.animationTimingFunction));
      put('--pdsh-tooltip-max-width', text(style.maxWidth));
      put('--pdsh-tooltip-layer', text(style.zIndex));
    }
    // 同步局部控件的观察权，兄弟盒不应遮住局部几何变化。
    synchronizeTargets(nextTargets);
    // 来源节点消失也要撤销旧测量；不能用上次读数伪装当前宿主参数。
    for (const key of previous.keys()) if (!seen.has(key)) write(key, null);
  }
  function schedule() {
    if (queued || disposed) return;
    queued = true;
    view.queueMicrotask(() => { queued = false; sample(); });
  }
  const observer = new view.MutationObserver(schedule);
  const resize = view.ResizeObserver ? new view.ResizeObserver(schedule) : null;
  const media = ['(prefers-color-scheme: dark)', '(prefers-reduced-motion: reduce)'].map(query => view.matchMedia?.(query)).filter(Boolean);
  observer.observe(doc.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-dsw-theme', 'href', 'disabled', 'viewBox', 'stroke-width', 'vector-effect', 'width', 'height'] });
  view.addEventListener('resize', schedule);
  doc.addEventListener('load', schedule, true);
  for (const query of media) query.addEventListener('change', schedule);
  sample();
  return {
    dispose() {
      if (disposed) return;
      disposed = true; observer.disconnect(); resize?.disconnect(); targets.clear();
      view.removeEventListener('resize', schedule); doc.removeEventListener('load', schedule, true);
      for (const query of media) query.removeEventListener('change', schedule);
      for (const [key, state] of previous) {
        if (state.value) doc.body.style.setProperty(key, state.value, state.priority);
        else doc.body.style.removeProperty(key);
      }
      if (!hadBodyStyle && !doc.body.getAttribute('style')) doc.body.removeAttribute('style');
      previous.clear();
    },
  };
}
