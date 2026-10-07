/**
 * [INPUT]: 依赖 rc.2 renderer 的 root/main/sidebar 锚点。
 * [OUTPUT]: 提供只读侧栏快照、订阅及卸载。
 * [POS]: AppFrame DOM 适配器。歧义布局返回未知。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export interface SidebarState {
  getSnapshot(): boolean | undefined;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

function readFrame(doc: Document): Element | null {
  const roots = doc.querySelectorAll('[data-slot="root"]');
  if (roots.length !== 1 || roots[0].children.length !== 1) return null;
  const frame = roots[0].firstElementChild;
  if (frame?.tagName !== 'DIV') return null;
  // +--- 锚点归属先于状态；错误面和其它根布局不猜作 AppFrame ---+
  const sidebars = frame.querySelectorAll('[data-slot="sidebar"]');
  const mains = frame.querySelectorAll('[data-slot="main"]');
  if (sidebars.length !== 1 || mains.length !== 1) return null;
  if (sidebars[0].parentElement?.parentElement !== frame || mains[0].parentElement?.parentElement !== frame) return null;
  return frame;
}

/** 此信号属于固定 rc.2 DOM，不声称是 ctx.layout API。 */
export function createSidebarState(doc: Document): SidebarState {
  let disposed = false;
  let observedFrame = readFrame(doc);
  const listeners = new Set<() => void>();
  const getSnapshot = () => {
    const frame = disposed ? null : readFrame(doc);
    return frame ? frame.hasAttribute('data-sidebar-collapsed') : undefined;
  };
  let previous = getSnapshot();
  const boundary = '[data-slot="root"], [data-slot="sidebar"], [data-slot="main"]';
  const carriesBoundary = (node: Node) => node.nodeType === 1 && (
    (node as Element).matches(boundary) || Boolean((node as Element).querySelector(boundary))
  );
  const touchesFrame = (record: MutationRecord) => {
    const target = record.target as Element;
    if (record.type === 'attributes') {
      if (record.attributeName === 'data-sidebar-collapsed') return target === observedFrame;
      return observedFrame === null || target === observedFrame.parentElement || observedFrame.contains(target) || target.matches(boundary);
    }
    return target === observedFrame || (target.nodeType === 1 && target.matches('[data-slot="root"]')) ||
      [...record.addedNodes, ...record.removedNodes].some(carriesBoundary);
  };
  const observer = new doc.defaultView.MutationObserver(records => {
    if (!records.some(touchesFrame)) return;
    observedFrame = readFrame(doc);
    const current = getSnapshot();
    if (current === previous) return;
    previous = current;
    for (const listener of [...listeners]) listener();
  });
  // +--- 过滤根重挂与语义变化；聊天增删不触发全文档锚点扫描 ---+
  observer.observe(doc.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-sidebar-collapsed', 'data-slot'] });
  return {
    getSnapshot,
    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      listeners.clear();
    },
  };
}
