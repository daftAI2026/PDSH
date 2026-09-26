/**
 * [INPUT]: 依赖 rc.2 `sidebar.workspaces` 与 Rows.tsx 的树行/搜索结果结构、原生 HoverCard portal。
 * [OUTPUT]: 提供可撤销的 workspace/session/search 标题 marker 与受 owner 匹配约束的 portal marker。
 * [POS]: 侧栏标题遮罩 DOM 适配器；只标记文本叶，不改原文、命中区域、事件或滚动状态。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */

const REGION = '[data-slot="sidebar.workspaces"]';
const TREE_ITEM = '[role="treeitem"]';
const MARKER = 'data-pdsh-redacted-title';
const STYLE_MARKER = 'data-pdsh-sidebar-redaction-style';
const FADE_RESET = `[${MARKER}] {\n  -webkit-mask-image: none !important;\n  mask-image: none !important;\n}`;

function locateRegion(doc) {
  const regions = doc.querySelectorAll(REGION);
  return regions.length === 1 ? regions[0] : null;
}

function directSpans(node, min, max = min) {
  const children = Array.from(node.children);
  return children.length >= min && children.length <= max
    && children.every(child => child.tagName === 'SPAN');
}

function textLeaf(node) {
  return node?.tagName === 'SPAN'
    && node.childElementCount === 0
    && node.childNodes.length === 1
    && node.firstChild.nodeType === 3
    && node.textContent.trim().length > 0;
}

function identifyTreeRow(row) {
  if (row?.tagName !== 'DIV' || row.getAttribute('role') !== 'treeitem') return null;
  const key = row.getAttribute('data-row-key') || '';
  if (key.startsWith('workspace:') && key.length > 'workspace:'.length
    && directSpans(row, 4)) {
    const host = row.children[2];
    if (host.childElementCount === 1 && textLeaf(host.firstElementChild)) {
      return { row, title: host.firstElementChild, kind: 'workspace' };
    }
  }
  if (key.startsWith('session:') && key.length > 'session:'.length
    && directSpans(row, 4, 5) && textLeaf(row.children[1])) {
    return { row, title: row.children[1], kind: 'session' };
  }
  return null;
}

function identifySearchRow(row, tree) {
  if (row.tagName !== 'DIV' || row.getAttribute('role') !== 'treeitem'
    || row.hasAttribute('data-row-key') || row.parentElement !== tree
    || !['true', 'false'].includes(row.getAttribute('aria-selected'))
    || row.children.length !== 2) return null;
  const [heading, meta] = row.children;
  if (heading.tagName !== 'SPAN' || meta.tagName !== 'SPAN'
    || heading.children.length < 2 || heading.children.length > 3
    || heading.children[0].tagName !== 'SPAN' || !textLeaf(heading.children[1])
    || (heading.children.length === 3 && heading.children[2].tagName !== 'SPAN')
    || meta.children.length < 1 || meta.children.length > 2
    || !textLeaf(meta.children[0])
    || (meta.children.length === 2 && !textLeaf(meta.children[1]))) return null;
  return { row, title: heading.children[1], workspace: meta.children[0], kind: 'search' };
}

function scanRows(region) {
  const rows = [];
  for (const row of region.querySelectorAll(TREE_ITEM)) {
    const identity = identifyTreeRow(row);
    if (identity) rows.push(identity);
  }
  const searches = [];
  for (const tree of region.querySelectorAll('[role="tree"]')) {
    if (!(tree.getAttribute('aria-label') || '').trim()) continue;
    for (const row of tree.querySelectorAll(TREE_ITEM)) {
      const result = identifySearchRow(row, tree);
      if (result) searches.push(result);
    }
  }
  return { rows, searches };
}

function asElement(node, view) {
  if (!node) return null;
  if (node.nodeType === 1) return node;
  if (node.nodeType === 3) return node.parentElement;
  return view.Element && node instanceof view.Element ? node : null;
}

function matchingRowFrom(target, region, view) {
  const element = asElement(target, view);
  const row = element?.closest(TREE_ITEM);
  if (!row || !region.contains(row)) return null;
  return identifyTreeRow(row);
}

function cardTitle(card, kind, view) {
  if (card.tagName !== 'DIV' || card.childElementCount !== 1) return null;
  if (view.getComputedStyle(card).position !== 'fixed') return null;
  const content = card.firstElementChild;
  if (content.tagName !== 'DIV' || content.children.length < 1) return null;
  const title = content.firstElementChild;
  if (title.tagName !== 'DIV' || title.childElementCount !== 0
    || title.childNodes.length !== 1 || title.firstChild.nodeType !== 3
    || title.textContent.trim().length === 0) return null;
  if (kind === 'workspace') {
    if (content.children.length !== 3
      || Array.from(content.children).some(child => child.tagName !== 'DIV')) return null;
  } else if (content.children.length < 2 || content.children[1].tagName !== 'DIV') {
    return null;
  }
  return title;
}

/** 在单一 document 中挂载严格结构匹配、可撤销的侧栏标题遮罩。 */
export function mountSidebarRedaction(doc) {
  const view = doc.defaultView;
  const ownedMarkers = new Map();
  const portalListeners = new Map();
  let enabled = false;
  let disposed = false;
  let region = null;
  let activeOwner = null;
  const trackedPortals = new Map();
  let style = null;

  function restoreMarker(node, saved) {
    if (node.getAttribute(MARKER) !== saved.applied) return;
    if (saved.had) node.setAttribute(MARKER, saved.value);
    else node.removeAttribute(MARKER);
  }

  function releaseMarker(node) {
    const saved = ownedMarkers.get(node);
    if (!saved) return;
    restoreMarker(node, saved);
    ownedMarkers.delete(node);
  }

  function setMarker(node, value) {
    let saved = ownedMarkers.get(node);
    const current = node.getAttribute(MARKER);
    if (!saved) {
      saved = { had: node.hasAttribute(MARKER), value: current, applied: null };
      ownedMarkers.set(node, saved);
    } else if (saved.applied !== null && current !== saved.applied) {
      // 保留控制器持有期间外部写入的 marker 值，停用时归还该值。
      saved.had = node.hasAttribute(MARKER);
      saved.value = current;
    }
    if (current !== value) node.setAttribute(MARKER, value);
    saved.applied = value;
  }

  function ensureStyle(needed) {
    if (!needed) {
      style?.remove();
      style = null;
      return;
    }
    if (style?.isConnected) return;
    style = doc.createElement('style');
    style.setAttribute(STYLE_MARKER, '');
    style.textContent = FADE_RESET;
    (doc.head || doc.documentElement).append(style);
  }

  function detachPortalListeners() {
    for (const [card, listener] of portalListeners) card.removeEventListener('pointerout', listener);
    portalListeners.clear();
  }

  function clearOwner() {
    activeOwner = null;
    detachPortalListeners();
  }

  function portalTargets(rows) {
    if (!activeOwner || !doc.body || !activeOwner.row.isConnected) return [];
    const current = identifyTreeRow(activeOwner.row);
    if (!current) return [];
    const sameNameOwners = rows.filter(item => item.title.textContent === current.title.textContent);
    if (sameNameOwners.length !== 1) return [];
    const candidates = [];
    for (const card of doc.body.children) {
      if (activeOwner.baselineCards.has(card)) continue;
      const title = cardTitle(card, current.kind, view);
      if (title && title.textContent === current.title.textContent) candidates.push({ card, title, kind: current.kind });
    }
    if (candidates.length !== 1) return [];
    const [candidate] = candidates;
    trackedPortals.set(candidate.card, candidate.kind);
    return candidates;
  }

  function refreshTrackedPortals() {
    for (const card of trackedPortals.keys()) {
      if (!card.isConnected) {
        trackedPortals.delete(card);
        const listener = portalListeners.get(card);
        if (listener) {
          card.removeEventListener('pointerout', listener);
          portalListeners.delete(card);
        }
      }
    }
  }

  function trackedPortalTargets() {
    const result = new Map();
    for (const [card, kind] of trackedPortals) {
      // 每次从同一个已确认 card 重新验证结构，不缓存文本或标题节点。
      const title = cardTitle(card, kind, view);
      if (title) result.set(title, kind);
    }
    return result;
  }

  function onRegionPointerOver(event) {
    if (!region) return;
    const next = matchingRowFrom(event.target, region, view);
    if (next?.row === activeOwner?.row) return;
    if (next) {
      activeOwner = { ...next, baselineCards: new Set(doc.body?.children || []) };
    } else {
      clearOwner();
    }
    synchronize();
  }

  function onRegionPointerOut(event) {
    if (!activeOwner || !region) return;
    const from = matchingRowFrom(event.target, region, view);
    if (from?.row !== activeOwner.row) return;
    const related = asElement(event.relatedTarget, view);
    if (related && activeOwner.row.contains(related)) return;
    if (enabled && related && portalTargets(scanRows(region).rows).some(item => item.card.contains(related))) return;
    clearOwner();
    synchronize();
  }

  function setRegion(next) {
    if (next === region) return;
    if (region) {
      region.removeEventListener('pointerover', onRegionPointerOver);
      region.removeEventListener('pointerout', onRegionPointerOut);
    }
    clearOwner();
    region = next;
    if (region) {
      region.addEventListener('pointerover', onRegionPointerOver);
      region.addEventListener('pointerout', onRegionPointerOut);
    }
  }

  function syncPortalListeners(targets) {
    const nextCards = new Set(targets.map(target => target.card));
    for (const [card, listener] of portalListeners) {
      if (!nextCards.has(card)) {
        card.removeEventListener('pointerout', listener);
        portalListeners.delete(card);
      }
    }
    for (const card of nextCards) {
      if (portalListeners.has(card)) continue;
      const listener = event => {
        if (!activeOwner) return;
        const related = asElement(event.relatedTarget, view);
        if (related && (activeOwner.row.contains(related)
          || Array.from(portalListeners.keys()).some(other => other.contains(related)))) return;
        clearOwner();
        synchronize();
      };
      card.addEventListener('pointerout', listener);
      portalListeners.set(card, listener);
    }
  }

  function collectTargets(currentRegion) {
    const result = new Map();
    const { rows, searches } = scanRows(currentRegion);
    for (const item of rows) result.set(item.title, item.kind);
    for (const item of searches) {
      result.set(item.title, 'search');
      result.set(item.workspace, 'search');
    }
    const portals = portalTargets(rows);
    for (const item of portals) result.set(item.title, item.kind);
    syncPortalListeners(portals);
    for (const [title, kind] of trackedPortalTargets()) result.set(title, kind);
    return result;
  }

  function reconcile(targets) {
    for (const [node, kind] of targets) setMarker(node, kind);
    for (const node of ownedMarkers.keys()) {
      if (!targets.has(node)) releaseMarker(node);
    }
  }

  function relevant(records, currentRegion) {
    for (const record of records) {
      if ((currentRegion && (record.target === currentRegion || currentRegion.contains(record.target)))
        || (region && record.target === region)) return true;
      const changed = [...record.addedNodes, ...record.removedNodes];
      if (changed.some(node => node.nodeType === 1
        && (node.matches?.(REGION) || node.querySelector?.(REGION)))) return true;
      if (record.type === 'attributes' && record.attributeName === 'data-slot'
        && record.target.matches?.(REGION)) return true;
      if (record.target === doc.body || record.target === doc.documentElement) {
        if (activeOwner && record.target === doc.body) return true;
      }
      if (Array.from(trackedPortals.keys()).some(card => !card.isConnected
        || card === record.target || card.contains(record.target)
        || changed.some(node => node === card || node.contains?.(card) || card.contains(node)))) return true;
      if (activeOwner && Array.from(portalListeners.keys()).some(card => card === record.target || card.contains(record.target))) return true;
    }
    return false;
  }

  function synchronize() {
    if (disposed) return;
    refreshTrackedPortals();
    const nextRegion = locateRegion(doc);
    setRegion(nextRegion);
    if (!region) {
      const targets = enabled ? trackedPortalTargets() : new Map();
      reconcile(targets);
      ensureStyle(targets.size > 0);
      return;
    }
    if (activeOwner && !region.contains(activeOwner.row)) clearOwner();
    const targets = enabled ? collectTargets(region) : new Map();
    if (!enabled) detachPortalListeners();
    reconcile(targets);
    ensureStyle(targets.size > 0);
  }

  const observer = view?.MutationObserver ? new view.MutationObserver(records => {
    const currentRegion = locateRegion(doc);
    if (relevant(records, currentRegion)) synchronize();
  }) : null;
  observer?.observe(doc.documentElement, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['data-slot', 'data-row-key', 'role', 'aria-label', 'aria-selected', 'style', 'class', MARKER],
  });

  synchronize();
  return {
    update(value) {
      enabled = value === true;
      synchronize();
    },
    refresh: synchronize,
    dispose() {
      if (disposed) return;
      disposed = true;
      observer?.disconnect();
      if (region) {
        region.removeEventListener('pointerover', onRegionPointerOver);
        region.removeEventListener('pointerout', onRegionPointerOut);
      }
      clearOwner();
      for (const [node, saved] of ownedMarkers) restoreMarker(node, saved);
      ownedMarkers.clear();
      style?.remove();
      style = null;
      region = null;
    },
  };
}
