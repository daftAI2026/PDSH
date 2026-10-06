/**
 * [INPUT]: 依赖 model.ts 的唯一背景状态与 presets.ts 的类别判定。
 * [OUTPUT]: 提供四模式映射、工作台内最近素材记忆与面板可见/焦点同步。
 * [POS]: 背景类别的纯语义边界；Tab 值从真实背景派生，最近素材仅是本次工作台 UI 记忆，持久图库像素不由此处管理。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { CaptureBackground } from './model.ts';
import { captureBackgroundSection } from './presets.ts';

export const CAPTURE_BACKGROUND_MODES = ['none', 'plain-color', 'gradients', 'wallpapers'] as const;
export type CaptureBackgroundMode = typeof CAPTURE_BACKGROUND_MODES[number];

export function captureBackgroundMode(background: CaptureBackground): CaptureBackgroundMode {
  const section = captureBackgroundSection(background);
  return section === 'system-wallpapers' ? 'wallpapers' : section;
}

export function createCaptureBackgroundMemory(initial: CaptureBackground) {
  const selections: Record<CaptureBackgroundMode, CaptureBackground> = {
    none: { kind: 'transparent' },
    'plain-color': { kind: 'color', color: '#2B3440' },
    gradients: { kind: 'preset', id: 'rose' },
    wallpapers: { kind: 'preset', id: 'sea' },
  };
  function remember(background: CaptureBackground): void {
    selections[captureBackgroundMode(background)] = { ...background };
  }
  remember(initial);
  function forgetWallpaper(id: string): void {
    if (selections.wallpapers.kind === 'wallpaper' && selections.wallpapers.systemId === id) {
      selections.wallpapers = { id: 'sea', kind: 'preset' };
    }
  }
  return { forgetWallpaper, remember, read: (mode: CaptureBackgroundMode): CaptureBackground => ({ ...selections[mode] }) };
}

export function captureBackgroundPanelAttributes(id: string, mode: CaptureBackgroundMode, active: boolean): string {
  return `role="tabpanel" id="${id}-${mode}-panel" aria-labelledby="${id}-${mode}" tabindex="${active && mode !== "none" ? 0 : -1}"${active ? '' : ' hidden inert'}`;
}

export function syncCaptureBackgroundPanels(root: HTMLElement, activeMode: CaptureBackgroundMode): void {
  for (const panel of root.querySelectorAll<HTMLElement>('[data-background-section]')) {
    const active = panel.dataset.backgroundSection === activeMode;
    panel.dataset.active = String(active);
    panel.hidden = !active;
    panel.toggleAttribute('inert', !active);
    panel.tabIndex = active && activeMode !== "none" ? 0 : -1;
  }
}
