/**
 * [INPUT]: 依赖 shared 包配置身份、编辑器状态机、presets.ts 唯一预设目录与既有浏览器偏好存储。
 * [OUTPUT]: 保存非敏感编辑偏好及闭集图库 ID，不保存像素、Blob、路径或会话头像遮罩覆盖。
 * [POS]: capture-window 的偏好边界；头像覆盖只活在当前工作台，媒体由独立 IndexedDB gallery 恢复，stable/RC 按 root 身份分域。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { ROOT_ENTRY_ID } from "../../shared/components.ts";
import { isGalleryWallpaperId } from "../../shared/wallpaper-gallery.ts";
import {
  applyCaptureCommand,
  CAPTURE_DEFAULT_PADDING,
  CAPTURE_MAX_PADDING,
  CAPTURE_MIN_PADDING,
  type CaptureBackground,
  type CapturePresetId,
  type CaptureWindowCommand,
  type CaptureWindowState,
} from "./model.ts";

const LEGACY_MAX_PADDING = 160;

import { capturePresets } from "./presets.ts";

export const CAPTURE_PREFERENCES_KEY = `${ROOT_ENTRY_ID}-window-capture-prefs`;

export type CapturePreferenceStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

export type CapturePreferenceBackground =
  | Exclude<CaptureBackground, { kind: "wallpaper" }>
  | { kind: "wallpaper"; systemId?: string };

export type CaptureWindowPreferences = {
  background: CapturePreferenceBackground;
  padding: number;
  paddingUnit: "percent" | "logical-px";
  privacyEnabled: boolean;
  shadow: boolean;
};

const DEFAULT_CAPTURE_PREFERENCES: CaptureWindowPreferences = {
  background: { id: "sea", kind: "preset" },
  padding: CAPTURE_DEFAULT_PADDING,
  paddingUnit: "percent",
  privacyEnabled: true,
  shadow: true,
};

export function loadCapturePreferences(
  storage: CapturePreferenceStorage,
): CaptureWindowPreferences {
  try {
    const value = storage.getItem(CAPTURE_PREFERENCES_KEY);
    if (!value) return defaultCapturePreferences();
    return normalizeCapturePreferences(JSON.parse(value));
  } catch {
    return defaultCapturePreferences();
  }
}

export function saveCapturePreferences(
  storage: CapturePreferenceStorage,
  state: CaptureWindowState,
): void {
  const background = state.background.kind === "wallpaper"
    ? { kind: "wallpaper" as const, ...(isSavedWallpaperId(state.background.systemId) ? { systemId: state.background.systemId } : {}) }
    : state.background;
  const preferences: CaptureWindowPreferences = {
    background,
    padding: state.padding,
    paddingUnit: "percent",
    privacyEnabled: state.privacyEnabled,
    shadow: state.shadow,
  };
  try {
    storage.setItem(CAPTURE_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
  }
}

export function applyCapturePreferences(
  state: CaptureWindowState,
  preferences: CaptureWindowPreferences,
  wallpaperDataUrl?: string | null,
): CaptureWindowState {
  let background: CaptureBackground;
  if (preferences.background.kind === "wallpaper") {
    const systemId = isSavedWallpaperId(preferences.background.systemId) ? preferences.background.systemId : undefined;
    background = wallpaperDataUrl
      ? { dataUrl: wallpaperDataUrl, kind: "wallpaper", ...(systemId ? { systemId } : {}) }
      : { id: "sea", kind: "preset" };
  } else {
    background = preferences.background;
  }
  return {
    ...applyCaptureCommand(state, { background, kind: "set-background" }),
    padding: applyCaptureCommand(state, {
      kind: "set-padding",
      padding: preferences.paddingUnit === "logical-px"
        ? preferences.padding * Math.max(1, state.source.scaleFactor) * 100 / Math.max(1, Math.min(state.source.width, state.source.height))
        : preferences.padding,
    }).padding,
    privacyEnabled: preferences.privacyEnabled,
    shadow: preferences.shadow,
  };
}

export function isCapturePreferenceCommand(command: CaptureWindowCommand): boolean {
  // +--- 会话头像覆盖不得落入稳定/RC 浏览器偏好。 ---+
  if (command.kind === "set-avatar-mask") return false;
  return command.kind === "set-background" ||
    command.kind === "set-transparent-background" ||
    command.kind === "set-padding" ||
    command.kind === "set-privacy" ||
    command.kind === "set-shadow";
}

function normalizeCapturePreferences(input: unknown): CaptureWindowPreferences {
  const normalized = defaultCapturePreferences();
  if (!input || typeof input !== "object") return normalized;
  const record = input as Record<string, unknown>;
  if (typeof record.privacyEnabled === "boolean") {
    normalized.privacyEnabled = record.privacyEnabled;
  }
  if (typeof record.shadow === "boolean") normalized.shadow = record.shadow;
  if (typeof record.padding === "number" && Number.isFinite(record.padding)) {
    // 旧记录没有单位；等源图尺寸可用后再换算，不能把旧像素当百分比。
    normalized.paddingUnit = record.paddingUnit === "percent" ? "percent" : "logical-px";
    normalized.padding = Math.min(
      normalized.paddingUnit === "percent" ? CAPTURE_MAX_PADDING : LEGACY_MAX_PADDING,
      Math.max(CAPTURE_MIN_PADDING, Math.round(record.padding)),
    );
  }
  const background = normalizeBackground(record.background);
  if (background) normalized.background = background;
  return normalized;
}

function normalizeBackground(value: unknown): CapturePreferenceBackground | null {
  if (!value || typeof value !== "object") return null;
  const background = value as Record<string, unknown>;
  if (background.kind === "wallpaper" && isSavedWallpaperId(background.systemId)) {
    return { kind: "wallpaper", systemId: background.systemId };
  }
  if (background.kind === "transparent" || background.kind === "wallpaper") {
    return { kind: background.kind };
  }
  if (
    background.kind === "preset" &&
    typeof background.id === "string" &&
    capturePresets.some(preset => preset.id === background.id)
  ) {
    return { id: background.id as CapturePresetId, kind: "preset" };
  }
  if (background.kind === "color" && typeof background.color === "string") {
    return { color: background.color, kind: "color" };
  }
  return null;
}

function isSavedWallpaperId(value: unknown): value is string {
  return value === "system-wallpaper-current" || isGalleryWallpaperId(value);
}

function defaultCapturePreferences(): CaptureWindowPreferences {
  return {
    ...DEFAULT_CAPTURE_PREFERENCES,
    background: { ...DEFAULT_CAPTURE_PREFERENCES.background },
  };
}


export function shouldRestoreCurrentWallpaper(storage: CapturePreferenceStorage | null): boolean {
  try {
    if (!storage?.getItem(CAPTURE_PREFERENCES_KEY)) return true;
    const { background } = loadCapturePreferences(storage);
    return background.kind === "wallpaper" && background.systemId === "system-wallpaper-current";
  } catch {
    return false;
  }
}
