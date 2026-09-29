/**
 * [INPUT]: 依赖 PDSH 侧栏的严格标题识别与唯一原生身份启动器。
 * [OUTPUT]: 提供拍摄前可恢复的标题/身份占位标记及严格比例校验后的建议遮挡区域。
 * [POS]: DSH 截图隐私边界；仅改临时 DOM 属性，最终像素由 Host 截取。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { recognizedSidebarTitles } from '../sidebar-redaction.ts';
import type { CaptureCandidate } from './model.ts';

const REDACT = 'data-pdsh-capture-redact';
const PROFILE = 'data-pdsh-capture-redact-profile';

export function markDSHPrivacyPlaceholders(doc: Document): () => void {
  const snapshots: Array<{ node: Element; key: string; value: string | null }> = [];
  function mark(node: Element, key: string, value = '') {
    snapshots.push({ node, key, value: node.getAttribute(key) });
    node.setAttribute(key, value);
  }
  for (const title of recognizedSidebarTitles(doc)) mark(title, REDACT, 'text');
  const launchers = doc.querySelectorAll('[data-slot="settings.launcher"] button[aria-haspopup="menu"][data-signed-out="false"]');
  if (launchers.length === 1) {
    const launcher = launchers[0];
    const original = launcher.querySelector(':scope > [data-pdsh-original-label]')
      ?? [...launcher.children].find(child => child.tagName === 'SPAN' && child.textContent?.trim() && !child.hasAttribute('data-pdsh-name'));
    if (original) mark(original, REDACT, 'text');
    const avatar = launcher.querySelector(':scope > [data-pdsh-avatar]')
      ?? launcher.querySelector(':scope > span:has(> img)');
    if (avatar) mark(avatar, PROFILE);
  }
  return () => {
    for (const { node, key, value } of snapshots.reverse()) {
      if (value === null) node.removeAttribute(key); else node.setAttribute(key, value);
    }
  };
}

export function collectDSHCandidates(doc: Document): CaptureCandidate[] {
  const nodes = recognizedSidebarTitles(doc);
  const identity = doc.querySelectorAll('[data-slot="settings.launcher"] button[aria-haspopup="menu"][data-signed-out="false"]');
  if (identity.length === 1) {
    nodes.push(...identity[0].querySelectorAll(':scope > span'));
  }
  return nodes.flatMap((node, index) => {
    const rect = node.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.top >= 0)) return [];
    return [{ id: `dsh:${index}`, x: rect.left, y: rect.top, width: rect.width, height: rect.height }];
  });
}

export function mapCandidatesToPng(candidates: CaptureCandidate[], source: { width: number; height: number }, viewport: { width: number; height: number }): CaptureCandidate[] {
  const x = source.width / viewport.width, y = source.height / viewport.height;
  if (!(Number.isFinite(x) && Number.isFinite(y) && x > 0 && Math.abs(x - y) / Math.max(x, y) < 0.02)) return [];
  return candidates.map(item => ({ ...item, x: item.x * x, y: item.y * y, width: item.width * x, height: item.height * y }));
}
