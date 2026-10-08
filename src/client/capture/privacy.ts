/**
 * [INPUT]: 依赖 sidebar-redaction/presentation 的严格识别、capture 候选层和共享灰条样式。
 * [OUTPUT]: 按独立状态临时标记标题、名称和头像容器；未登录保留原生更多。
 * [POS]: DSH 截图隐私边界；头像标记不含名称，所有临时属性由拍摄流程按所有权归还。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { recognizedSidebarTitles } from '../sidebar-redaction.ts';
import { recognizeSidebarIdentity } from '../presentation.ts';
import { collectDOMCandidates } from './candidates.ts';
import type { CaptureCandidate } from './model.ts';

const REDACT = 'data-pdsh-capture-redact';
const PROFILE = 'data-pdsh-capture-redact-profile';
const AVATAR_ONLY = 'data-pdsh-capture-redact-avatar-only';

export function markDSHPrivacyPlaceholders(doc: Document, { maskTitles = true, maskIdentity = true, maskAvatar = maskIdentity }: { maskTitles?: boolean; maskIdentity?: boolean; maskAvatar?: boolean } = {}): () => void {
  const snapshots: Array<{ node: Element; key: string; value: string | null; owned: string }> = [];
  function mark(node: Element, key: string, value = '') {
    snapshots.push({ node, key, value: node.getAttribute(key), owned: value });
    node.setAttribute(key, value);
  }
  if (maskTitles) for (const title of recognizedSidebarTitles(doc)) mark(title, REDACT, 'text');
  if (maskIdentity || maskAvatar) {
    const identity = recognizeSidebarIdentity(doc);
    if (identity.status === 'recognized' && identity.hasIdentity) {
      if (maskIdentity) {
        const names = new Set<Element>();
        if (identity.label && !identity.signedOut) names.add(identity.label);
        const ownedName = identity.trigger.querySelector(':scope > [data-pdsh-name]');
        if (ownedName) names.add(ownedName);
        for (const name of names) mark(name, REDACT, 'text');
      }
      if (maskAvatar) {
        mark(identity.avatar, PROFILE);
        mark(identity.avatar, AVATAR_ONLY);
      }
    }
  }
  let restored = false;
  return () => {
    if (restored) return; restored = true;
    for (const { node, key, value, owned } of snapshots.reverse()) {
      if (node.getAttribute(key) !== owned) continue;
      if (value === null) node.removeAttribute(key); else node.setAttribute(key, value);
    }
  };
}

export function collectDSHCandidates(doc: Document): CaptureCandidate[] {
  return collectDOMCandidates(doc);
}

export function mapCandidatesToPng(candidates: CaptureCandidate[], source: { width: number; height: number }, viewport: { width: number; height: number }): CaptureCandidate[] {
  const x = source.width / viewport.width, y = source.height / viewport.height;
  if (!(Number.isFinite(x) && Number.isFinite(y) && x > 0 && Math.abs(x - y) / Math.max(x, y) < 0.02)) return [];
  return candidates.map(item => ({ ...item, x: item.x * x, y: item.y * y, width: item.width * x, height: item.height * y }));
}
