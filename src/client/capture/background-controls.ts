/**
 * [INPUT]: 依赖 model.ts 的背景命令与状态、color-popover.ts 颜色同步、presets.ts 分组语义及本地图库/可选系统壁纸动作
 * [OUTPUT]: 提供背景事件和增量投影。只选中图库素材，不选中加号动作。
 * [POS]: capture-window 背景交互边界。异步恢复不重读库存或重绘整树。
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
  wireSystemWallpaperActions,
  type SystemWallpaperEditorActions,
} from "./system-wallpapers.ts";

export type CaptureBackgroundActions = {
  dispatch: (command: CaptureWindowCommand) => void;
  gallery?: { remove: (id: string) => void; select: (id: string) => void };
  pickWallpaper: () => void;
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
  wallpaper?.addEventListener("click", actions.pickWallpaper);
  for (const tile of root.querySelectorAll<HTMLElement>("[data-gallery-user-image], [data-gallery-wallpaper]")) {
    tile.addEventListener("click", () => {
      const id = tile.dataset.galleryUserImage ?? tile.dataset.galleryWallpaper;
      if (id) actions.gallery?.select(id);
    });
  }
  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-gallery-remove]")) {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const id = button.dataset.galleryRemove;
      if (id) actions.gallery?.remove(id);
    });
  }
  if (actions.systemWallpapers) wireSystemWallpaperActions(root, actions.systemWallpapers);
}

export function syncCaptureBackgroundControls(
  root: HTMLElement,
  state: CaptureWindowState,
  lastBackgroundColor: string,
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
  const wallpaper = root.querySelector<HTMLElement>("[data-background-wallpaper]:not([data-gallery-add-image])");
  if (wallpaper) {
    wallpaper.dataset.selected = String(state.background.kind === "wallpaper" && !state.background.systemId);
  }
  // +--- 所有图库来源共享一个选中态投影，覆盖晚于库存完成的媒体恢复。 ---+
  for (const tile of root.querySelectorAll<HTMLElement>("[data-gallery-user-image], [data-gallery-wallpaper]")) {
    const id = tile.dataset.galleryUserImage ?? tile.dataset.galleryWallpaper;
    const selected = state.background.kind === "wallpaper" && state.background.systemId === id;
    tile.dataset.selected = String(selected);
    tile.setAttribute("aria-pressed", String(selected));
  }
}
