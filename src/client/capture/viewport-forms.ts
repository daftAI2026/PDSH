/**
 * [INPUT]: 依赖当前页面表单的即时状态与栅格化引擎的克隆回调。
 * [OUTPUT]: 提供表单快照克隆器及临时标记归还；不改变原控件值或事件。
 * [POS]: 全视口采集的表单保真适配，弥补 DOM 默认属性与当前交互状态之间的差异。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const MARKER = 'data-pdsh-capture-form';

export function prepareViewportForms(doc: Document, signal: AbortSignal) {
  const states = new Map<string, { value: string; checked?: boolean; selected?: boolean[]; tag: string }>();
  const originals: { node: Element; previous: string | null }[] = [];
  for (const node of doc.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')) {
    const key = String(states.size);
    states.set(key, {
      value: node.value,
      checked: node.tagName === 'INPUT' ? (node as HTMLInputElement).checked : undefined,
      selected: node.tagName === 'SELECT' ? Array.from((node as HTMLSelectElement).options, option => option.selected) : undefined,
      tag: node.tagName,
    });
    originals.push({ node, previous: node.getAttribute(MARKER) });
    node.setAttribute(MARKER, key);
  }
  return {
    onCloneEachNode(cloned: Node) {
      if (signal.aborted) throw new Error('Capture cancelled');
      if (cloned.nodeType !== 1) return;
      const element = cloned as HTMLElement;
      const key = element.getAttribute(MARKER);
      const state = key === null ? undefined : states.get(key);
      if (!state) return;
      element.removeAttribute(MARKER);
      if (state.tag === 'TEXTAREA') element.textContent = state.value;
      else if (state.tag === 'INPUT') {
        element.setAttribute('value', state.value);
        element.toggleAttribute('checked', state.checked);
      } else {
        Array.from((element as HTMLSelectElement).options).forEach((option, index) => option.toggleAttribute('selected', state.selected[index]));
      }
    },
    restore() {
      for (const { node, previous } of originals) {
        if (previous === null) node.removeAttribute(MARKER);
        else node.setAttribute(MARKER, previous);
      }
      originals.length = 0;
      // 迟到克隆已由取消守卫拒绝；不延长用户草稿的生命周期。
      states.clear();
    },
  };
}
