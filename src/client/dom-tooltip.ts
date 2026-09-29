/**
 * [INPUT]: 依赖 PDSH 自有 DOM 控件的 data-pdsh-tooltip 文案及宿主 Tooltip 的 bottom/500ms/portal 参数。
 * [OUTPUT]: 为非 React 的侧栏入口与截图工作台提供可撤回的单一悬浮提示。
 * [POS]: Client 的 DOM/React 桥接边界；React 设置仍直接用宿主 Tooltip，视觉由宿主 token 驱动。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const SELECTOR = '[data-pdsh-tooltip]';
const HOVER_DELAY_MS = 500;
const GAP = 8;
const EDGE = 12;

export function mountDomTooltips(doc: Document) {
  let anchor: HTMLElement | null = null;
  let bubble: HTMLElement | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pointerFocus = false;
  let disposed = false;
  function owned(node: EventTarget | null): HTMLElement | null {
    if (!(node instanceof doc.defaultView.HTMLElement)) return null;
    const target = node.closest<HTMLElement>(SELECTOR);
    return target && (target.matches('[data-pdsh-search-entry], [data-pdsh-capture-entry]') || target.closest('[data-pdsh-capture]')) ? target : null;
  }
  function hide() {
    if (timer !== null) clearTimeout(timer);
    timer = null; bubble?.remove(); bubble = null; anchor = null;
  }
  function show(target: HTMLElement) {
    if (disposed || !target.isConnected || target.matches(':disabled') || !target.getAttribute('data-pdsh-tooltip')) return;
    bubble?.remove();
    bubble = doc.createElement('span'); bubble.className = 'pdsh-native-tooltip';
    bubble.setAttribute('role', 'tooltip'); bubble.textContent = target.getAttribute('data-pdsh-tooltip');
    doc.body.append(bubble);
    const rect = target.getBoundingClientRect();
    const width = bubble.getBoundingClientRect().width;
    const half = width / 2;
    const center = Math.max(EDGE + half, Math.min(rect.left + rect.width / 2, doc.defaultView.innerWidth - EDGE - half));
    const above = rect.bottom + GAP + bubble.getBoundingClientRect().height > doc.defaultView.innerHeight - EDGE;
    bubble.dataset.side = above ? 'top' : 'bottom';
    bubble.style.left = `${center}px`;
    bubble.style.top = `${above ? rect.top - GAP : rect.bottom + GAP}px`;
  }
  function schedule(target: HTMLElement, delay: number) {
    if (anchor === target) return;
    hide(); anchor = target;
    if (delay === 0) show(target);
    else timer = setTimeout(() => { timer = null; if (anchor === target) show(target); }, delay);
  }
  function over(event: MouseEvent) { const target = owned(event.target); if (target) schedule(target, HOVER_DELAY_MS); }
  function out(event: MouseEvent) {
    if (anchor && event.target instanceof doc.defaultView.Node && anchor.contains(event.target)
      && !(event.relatedTarget instanceof doc.defaultView.Node && anchor.contains(event.relatedTarget))) hide();
  }
  function focus(event: FocusEvent) { const target = owned(event.target); if (target && !pointerFocus) schedule(target, 0); }
  function blur(event: FocusEvent) { if (anchor && event.target instanceof doc.defaultView.Node && anchor.contains(event.target)) hide(); }
  function pointer() { pointerFocus = true; hide(); }
  function key(event: KeyboardEvent) { pointerFocus = false; if (event.key === 'Escape' || event.key === 'Tab') hide(); }
  function dismiss() { hide(); }
  doc.addEventListener('mouseover', over); doc.addEventListener('mouseout', out);
  doc.addEventListener('focusin', focus); doc.addEventListener('focusout', blur);
  doc.addEventListener('pointerdown', pointer, true); doc.addEventListener('keydown', key, true);
  doc.addEventListener('click', dismiss, true); doc.defaultView.addEventListener('scroll', dismiss, true);
  doc.defaultView.addEventListener('resize', dismiss);
  return () => {
    if (disposed) return;
    disposed = true; hide();
    doc.removeEventListener('mouseover', over); doc.removeEventListener('mouseout', out);
    doc.removeEventListener('focusin', focus); doc.removeEventListener('focusout', blur);
    doc.removeEventListener('pointerdown', pointer, true); doc.removeEventListener('keydown', key, true);
    doc.removeEventListener('click', dismiss, true); doc.defaultView.removeEventListener('scroll', dismiss, true);
    doc.defaultView.removeEventListener('resize', dismiss);
  };
}
