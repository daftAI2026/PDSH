/**
 * [INPUT]: 依赖 model.ts 的背景命令与状态、color-popover.ts 的颜色同步、presets.ts 的分组语义
 * [OUTPUT]: 对外提供背景控件的事件绑定、当前模式面板及稳定 DOM 状态同步
 * [POS]: capture-window 的背景交互边界，让 editor.ts 只负责编排编辑器生命周期
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { syncCaptureColorPopover } from "./color-popover.ts";
import type {
  CapturePresetId,
  CaptureWindowCommand,
  CaptureWindowState,
} from "./model.ts";
import { captureBackgroundMode, syncCaptureBackgroundPanels } from "./background-modes.ts";
import { isCapturePlainColor } from "./presets.ts";
import {
  syncSystemWallpaperControls,
  wireSystemWallpaperActions,
  type SystemWallpaperEditorActions,
} from "./system-wallpapers.ts";

export type CaptureBackgroundActions = {
  dispatch: (command: CaptureWindowCommand) => void;
  pickWallpaper: () => void;
  readWallpaperDataUrl: () => string | null;
  systemWallpapers?: SystemWallpaperEditorActions;
  setBackgroundColor: (color: string) => void;
};

export function wireCaptureBackgroundActions(
  root: HTMLElement,
  actions: CaptureBackgroundActions,
): void {
  for (const option of root.querySelectorAll<HTMLElement>("[data-background]")) {
    option.addEventListener("click", () => {
      const id = option.dataset.background;
      actions.dispatch({
        kind: "set-background",
        background: { id: id as CapturePresetId, kind: "preset" },
      });
    });
  }
  for (const option of root.querySelectorAll<HTMLElement>("[data-background-color]")) {
    option.addEventListener("click", () => {
      const color = option.dataset.backgroundColor;
      if (color) actions.setBackgroundColor(color);
    });
  }
  const wallpaper = root.querySelector<HTMLButtonElement>("[data-background-wallpaper]");
  wallpaper?.addEventListener("click", () => {
    const dataUrl = actions.readWallpaperDataUrl();
    if (!dataUrl) {
      actions.pickWallpaper();
      return;
    }
    actions.dispatch({ background: { dataUrl, kind: "wallpaper" }, kind: "set-background" });
  });
  wallpaper?.addEventListener("dblclick", actions.pickWallpaper);
  root.querySelector<HTMLButtonElement>("[data-action='change-wallpaper']")?.addEventListener(
    "click",
    actions.pickWallpaper,
  );
  if (actions.systemWallpapers) wireSystemWallpaperActions(root, actions.systemWallpapers);
}

export function syncCaptureBackgroundControls(
  root: HTMLElement,
  state: CaptureWindowState,
  lastBackgroundColor: string,
  wallpaperDataUrl: string | null,
): void {
  for (const option of root.querySelectorAll<HTMLElement>("[data-background]")) {
    const selected = state.background.kind === "preset" &&
      option.dataset.background === state.background.id;
    option.setAttribute("aria-pressed", String(selected));
  }
  for (const option of root.querySelectorAll<HTMLElement>("[data-background-color]")) {
    const selected = state.background.kind === "color" &&
      option.dataset.backgroundColor?.toLowerCase() === state.background.color.toLowerCase();
    option.setAttribute("aria-pressed", String(selected));
  }

  const custom = root.querySelector<HTMLElement>("[data-background-custom]");
  if (custom) {
    const selected = state.background.kind === "color" && !isCapturePlainColor(state.background.color);
    custom.dataset.selected = String(selected);
    custom.setAttribute("aria-pressed", String(selected));
  }
  syncCaptureBackgroundPanels(root, captureBackgroundMode(state.background));
  syncCaptureColorPopover(root, "background", lastBackgroundColor);
  syncWallpaperControls(root, state, wallpaperDataUrl);
  syncSystemWallpaperControls(root, state);
}

function syncWallpaperControls(
  root: HTMLElement,
  state: CaptureWindowState,
  wallpaperDataUrl: string | null,
): void {
  const wallpaper = root.querySelector<HTMLElement>("[data-background-wallpaper]");
  if (wallpaper) {
    wallpaper.dataset.selected = String(
      state.background.kind === "wallpaper" && !state.background.systemId,
    );
  }
  const preview = root.querySelector<HTMLImageElement>("[data-wallpaper-preview]");
  const placeholder = root.querySelector<HTMLElement>("[data-wallpaper-placeholder]");
  const change = root.querySelector<HTMLButtonElement>("[data-action='change-wallpaper']");
  if (preview) {
    preview.src = wallpaperDataUrl ?? "";
    preview.hidden = !wallpaperDataUrl;
  }
  if (placeholder) placeholder.hidden = Boolean(wallpaperDataUrl);
  if (change) change.hidden = !(wallpaperDataUrl && state.background.kind === "wallpaper");
}
