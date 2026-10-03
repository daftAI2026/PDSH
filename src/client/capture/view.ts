/**
 * [INPUT]: 依赖 model.ts 的编辑状态、copy.ts 的本地化文案、presets.ts 的背景分层与 icons.ts 的图标
 * [OUTPUT]: 对外提供稳定四模式面板 DOM 模板，隐藏面板保留 ARIA 关联但退出焦点，以及重建时保留检查器滚动和焦点的视图记忆工具；类别不重复标题、渐变始终完整展开，padding 刻度仅作装饰
 * [POS]: DSH 工作台的声明式视图边界；无系统壁纸 adapter 时不展示失效控制，避免伪能力
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { captureBackgroundPanelAttributes, captureBackgroundMode } from "./background-modes.ts";
import type { CaptureWindowCopy } from "./copy.ts";
import { escapeAttribute } from "./color-popover.ts";
import { captureIcon } from "./icons.ts";
import {
  CAPTURE_MAX_PADDING,
  CAPTURE_MIN_PADDING,
  CAPTURE_PADDING_STEP,
  CAPTURE_MAX_ZOOM,
  CAPTURE_MIN_ZOOM,
  type CaptureWindowState,
} from "./model.ts";
import {
  SYSTEM_WALLPAPER_CURRENT_ID,
  type SystemWallpaperState,
} from "./system-wallpapers.ts";
import {
  type CapturePresetSection,
  captureBackgroundSection,
  capturePlainColors,
  capturePresetSection,
  capturePresetSwatch,
  isCapturePlainColor,
} from "./presets.ts";

export type CaptureWindowViewOptions = {
  backgroundTabsId?: string;
  lastBackgroundColor?: string;
  systemWallpapers?: SystemWallpaperState;
  wallpaperDataUrl?: string | null;
};

export type CaptureWindowRenderMemory = {
  action?: string;
  inspectorScrollTop: number;
  wallpaper?: string;
};

export function rememberCaptureWindowRender(root: HTMLElement): CaptureWindowRenderMemory {
  const inspector = root.querySelector<HTMLElement>(".pdsh-capture-inspector-scroll");
  const active = document.activeElement instanceof HTMLElement && root.contains(document.activeElement)
    ? document.activeElement
    : null;
  return {
    action: active?.dataset.action,
    inspectorScrollTop: inspector?.scrollTop ?? 0,
    wallpaper: active?.dataset.systemWallpaper,
  };
}

export function restoreCaptureWindowRender(
  root: HTMLElement,
  memory: CaptureWindowRenderMemory,
): void {
  const inspector = root.querySelector<HTMLElement>(".pdsh-capture-inspector-scroll");
  if (inspector) inspector.scrollTop = memory.inspectorScrollTop;
  if (memory.wallpaper) {
    [...root.querySelectorAll<HTMLElement>("[data-system-wallpaper]")]
      .find((option) => option.dataset.systemWallpaper === memory.wallpaper)
      ?.focus();
  } else if (memory.action) {
    root.querySelector<HTMLElement>(`[data-action='${memory.action}']`)?.focus();
  }
}

export function captureWindowTemplate(
  state: CaptureWindowState,
  copy: CaptureWindowCopy,
  options: CaptureWindowViewOptions = {},
): string {
  const lastBackgroundColor = options.lastBackgroundColor ?? "#2B3440";
  const wallpaperDataUrl = options.wallpaperDataUrl ?? (
    state.background.kind === "wallpaper" && !state.background.systemId
      ? state.background.dataUrl
      : null
  );
  const systemWallpapers = options.systemWallpapers ?? { entries: [], status: "unavailable" as const };
  return `
    <div class="pdsh-capture-backdrop" aria-hidden="true"></div>
    <section class="pdsh-capture-dialog" role="dialog" aria-modal="true" aria-labelledby="pdsh-capture-title">
      <header class="pdsh-capture-header">
        <div class="pdsh-capture-heading">
          ${captureIcon("camera")}
          <h1 class="pdsh-capture-title" id="pdsh-capture-title">${copy.title}</h1>
        </div>
        ${iconButton("close", "x", copy.close)}
      </header>
      <div class="pdsh-capture-workspace">
        <section class="pdsh-capture-preview-pane" aria-label="${copy.preview}">
          ${captureToolbarTemplate(state, copy)}
          <div class="pdsh-capture-stage" data-tool="${state.tool}">
            <div class="pdsh-capture-canvas-frame">
              <div class="pdsh-capture-region-layer" aria-hidden="true"></div>
            </div>
          </div>
        </section>
        ${inspectorTemplate(state, copy, lastBackgroundColor, wallpaperDataUrl, systemWallpapers, options.backgroundTabsId ?? "pdsh-capture-background")}
      </div>
      ${footerTemplate(copy)}
    </section>
  `;
}

export function captureToolbarTemplate(
  state: CaptureWindowState,
  copy: CaptureWindowCopy,
): string {
  const hint = captureRegionHint(state, copy);
  return `
    <div class="pdsh-capture-toolbar">
      <span class="pdsh-capture-region-hint">${hint}</span>
      <div class="pdsh-capture-toolbar-controls" role="group" aria-label="${copy.tools}">
        ${iconButton("tool-move", "hand", copy.move, false, state.tool === "move")}
        ${iconButton("tool-redact", "square-dashed", copy.redact, false, state.tool === "redact")}
        ${state.tool === "redact" ? redactControlsTemplate(state, copy) : ""}
        ${toolbarDivider()}
        ${iconButton("undo", "undo", copy.undo, state.history.past.length === 0)}
        ${iconButton("redo", "redo", copy.redo, state.history.future.length === 0)}
        ${toolbarDivider()}
        ${iconButton("zoom-out", "zoom-out", copy.zoomOut, state.zoom <= CAPTURE_MIN_ZOOM)}
        <button class="pdsh-capture-zoom-reset" data-action="zoom-reset" type="button" data-pdsh-tooltip="${copy.zoomReset}">${Math.round(state.zoom * 100)}%</button>
        ${iconButton("zoom-in", "zoom-in", copy.zoomIn, state.zoom >= CAPTURE_MAX_ZOOM)}
        ${iconButton("zoom-fit", "maximize", copy.zoomReset)}
      </div>
    </div>
  `;
}

function captureRegionHint(state: CaptureWindowState, copy: CaptureWindowCopy): string {
  if (state.tool !== "redact") return "";
  return state.redactionSource === "auto" ? copy.regionHint : copy.regionHintDraw;
}

function redactControlsTemplate(state: CaptureWindowState, copy: CaptureWindowCopy): string {
  return `
    ${toolbarDivider()}
    ${iconButton("source-auto", "scan-search", copy.sourceAuto, false, state.redactionSource === "auto", undefined, copy.sourceAutoHint)}
    ${iconButton("source-draw", "pen-line", copy.sourceDraw, false, state.redactionSource === "draw", undefined, copy.sourceDrawHint)}
    ${toolbarDivider()}
    ${iconButton("style-mosaic", "grid-3x3", copy.mosaic, false, state.redactionStyle === "mosaic", "mosaic")}
    ${iconButton("style-blur", "droplet", copy.blur, false, state.redactionStyle === "blur", "blur")}
    ${iconButton("style-solid", "square", copy.solid, false, state.redactionStyle === "solid", "solid")}
    ${solidColorTemplate(state, copy)}
  `;
}

function toolbarDivider(): string {
  return '<span class="pdsh-capture-toolbar-divider" aria-hidden="true"></span>';
}

function inspectorTemplate(
  state: CaptureWindowState,
  copy: CaptureWindowCopy,
  lastBackgroundColor: string,
  wallpaperDataUrl: string | null,
  systemWallpapers: SystemWallpaperState,
  backgroundTabsId: string,
): string {
  return `
    <aside class="pdsh-capture-inspector">
      <h2 class="pdsh-capture-section-title" id="pdsh-capture-background-title">${copy.background}</h2>
      <div class="pdsh-capture-inspector-scroll" tabindex="0" role="region" aria-labelledby="pdsh-capture-background-title">
      <div class="pdsh-capture-inspector-content">
      <section class="pdsh-capture-section">
        ${backgroundGridTemplate(state, copy, lastBackgroundColor, wallpaperDataUrl, systemWallpapers, backgroundTabsId)}
      </section>
      <section class="pdsh-capture-section">
        <div class="pdsh-capture-row pdsh-capture-padding-heading">
          <h2 class="pdsh-capture-section-title">${copy.padding}</h2>
          <span class="pdsh-capture-value" data-value="padding">${state.padding}%</span>
        </div>
        <div class="pdsh-capture-range-field">
          <input class="pdsh-capture-range" data-input="padding" aria-label="${copy.padding}" type="range" min="${CAPTURE_MIN_PADDING}" max="${CAPTURE_MAX_PADDING}" step="${CAPTURE_PADDING_STEP}" value="${state.padding}">
          <div class="pdsh-capture-range-ticks" aria-hidden="true">
            ${Array.from({ length: 11 }, (_, index) => `<i style="--capture-tick-position: ${index * 10}%"></i>`).join("")}
          </div>
        </div>
      </section>
      <section class="pdsh-capture-section pdsh-capture-row">
        <h2 class="pdsh-capture-section-title">${copy.shadow}</h2>
        <input class="pdsh-capture-switch" data-input="shadow" type="checkbox" aria-label="${copy.shadow}" ${checked(state.shadow)}>
      </section>
      <section class="pdsh-capture-section pdsh-capture-row">
        <div class="pdsh-capture-privacy-copy">
          <h2 class="pdsh-capture-section-title">${copy.privacy}</h2>
          <p class="pdsh-capture-section-description">${copy.privacyDescription}</p>
        </div>
        <input class="pdsh-capture-switch" data-input="privacy" type="checkbox" aria-label="${copy.privacy}" ${checked(state.privacyEnabled)}>
      </section>
      </div>
      </div>
    </aside>
  `;
}

function solidColorTemplate(state: CaptureWindowState, copy: CaptureWindowCopy): string {
  return `
    <button class="pdsh-capture-solid-color" data-color-trigger="solid" type="button" aria-label="${copy.maskColor}" data-pdsh-tooltip="${copy.maskColor}" aria-haspopup="dialog" aria-expanded="false" data-state="closed" ${state.redactionStyle === "solid" ? "" : "hidden"}>
      <span style="--capture-solid-color:${state.solidColor}"></span>
    </button>
  `;
}

function backgroundGridTemplate(
  state: CaptureWindowState,
  copy: CaptureWindowCopy,
  lastBackgroundColor: string,
  wallpaperDataUrl: string | null,
  systemWallpapers: SystemWallpaperState,
  backgroundTabsId: string,
): string {
  const custom = state.background.kind === "color" && !isCapturePlainColor(state.background.color);
  const wallpaper = state.background.kind === "wallpaper" && !state.background.systemId;
  const customIcon = `<span data-background-custom-icon>${captureIcon("pipette")}</span>`;
  const wallpaperImage = wallpaperDataUrl ?? "";
  const changeImageHidden = wallpaper && wallpaperDataUrl ? "" : " hidden";
  const gradients = capturePresetSection("gradients");
  const wallpapers = capturePresetSection("wallpapers");
  const activeSection = captureBackgroundMode(state.background);
  const wallpapersActive = activeSection === "wallpapers";
  const visibleWallpapers = systemWallpapers.entries.filter((entry) => entry.id === SYSTEM_WALLPAPER_CURRENT_ID || entry.loadStatus !== undefined);
  const currentWallpaper = visibleWallpapers.length > 0 && visibleWallpapers.every((entry) =>
    entry.loadStatus === undefined || entry.loadStatus === "ready" || entry.loadStatus === "loading");
  const currentWallpaperLoading = systemWallpapers.status === "loading";
  const currentWallpaperDisabled = currentWallpaperLoading || systemWallpapers.status === "unavailable";
  const currentWallpaperSelected = state.background.kind === "wallpaper" &&
    state.background.systemId === SYSTEM_WALLPAPER_CURRENT_ID;
  return `
    <div data-background-tabs></div>
    <div class="pdsh-capture-background-sections">
      <section class="pdsh-capture-background-section" data-background-section="none" data-active="${activeSection === 'none'}" ${captureBackgroundPanelAttributes(backgroundTabsId, 'none', activeSection === 'none')}>
      </section>
      ${presetSectionTemplate(gradients, state, activeSection, backgroundTabsId)}
      <section class="pdsh-capture-background-section" data-background-section="wallpapers" data-active="${wallpapersActive}" ${captureBackgroundPanelAttributes(backgroundTabsId, "wallpapers", wallpapersActive)}>
        ${systemWallpapers.status === "unavailable" || currentWallpaper ? "" : `<button class="pdsh-capture-background-expand" data-action="load-current-wallpaper" data-pdsh-tooltip="${escapeAttribute(copy.wallpaperDownloadHint)}" data-selected="${currentWallpaperSelected}" type="button" aria-busy="${currentWallpaperLoading}" aria-pressed="${currentWallpaperSelected}"${currentWallpaperDisabled ? " disabled" : ""}>${copy.getCurrentWallpaper}</button>`}
        <div class="pdsh-capture-background-grid">
          ${presetButtonsTemplate(wallpapers, state)}
          ${visibleWallpapers.map((entry) => {
            const loading = entry.loadStatus === "loading";
            const label = entry.id === SYSTEM_WALLPAPER_CURRENT_ID ? copy.currentDesktop : entry.name;
            const hint = entry.loadStatus === "error" ? `${label} · ${copy.retryWallpaper}` : label;
            const selected = state.background.kind === "wallpaper" && state.background.systemId === entry.id;
            return `<button class="pdsh-capture-background-option pdsh-capture-wallpaper-label" data-system-wallpaper="${escapeAttribute(entry.id)}" data-load-status="${entry.loadStatus ?? "ready"}" type="button" data-selected="${selected}" aria-pressed="${selected}" aria-busy="${loading}" aria-label="${escapeAttribute(hint)}" data-pdsh-tooltip="${escapeAttribute(hint)}"${loading ? " disabled" : ""}>${loading ? '<span class="pdsh-capture-skeleton" aria-hidden="true"></span>' : entry.loadStatus === "error" ? captureIcon("retake") : entry.thumbnail ? `<img src="${escapeAttribute(entry.thumbnail)}" alt="">` : captureIcon("download")}</button>`;
          }).join("")}
          <button class="pdsh-capture-background-option pdsh-capture-wallpaper-label" data-background-wallpaper type="button" data-selected="${wallpaper}" aria-label="${copy.wallpaper}" data-pdsh-tooltip="${copy.wallpaper}"><img data-wallpaper-preview src="${wallpaperImage}" alt="" ${wallpaperDataUrl ? "" : "hidden"}><span data-wallpaper-placeholder ${wallpaperDataUrl ? "hidden" : ""}>${captureIcon("plus")}</span></button>
        </div>
        <input class="pdsh-capture-wallpaper-input" data-input="wallpaper" type="file" accept="image/png,image/jpeg,image/webp">
        <button class="pdsh-capture-change-wallpaper" data-action="change-wallpaper" type="button"${changeImageHidden}>${copy.changeImage}</button>
        ${currentWallpaperStatusTemplate(systemWallpapers.status, copy)}
      </section>
      <section class="pdsh-capture-background-section" data-background-section="plain-color" data-active="${activeSection === "plain-color"}" ${captureBackgroundPanelAttributes(backgroundTabsId, "plain-color", activeSection === "plain-color")}>
        <div class="pdsh-capture-background-grid pdsh-capture-background-grid-plain">
          ${plainColorButtonsTemplate(state, capturePlainColors)}
          <button class="pdsh-capture-background-option pdsh-capture-color-label" data-background-custom data-color-trigger="background" data-selected="${custom}" aria-pressed="${custom}" type="button" aria-label="${copy.custom}" data-pdsh-tooltip="${copy.custom}" aria-haspopup="dialog" aria-expanded="false" data-state="closed" style="--capture-swatch:${lastBackgroundColor}">${customIcon}</button>
        </div>
      </section>
    </div>
  `;
}

function currentWallpaperStatusTemplate(
  status: SystemWallpaperState["status"],
  copy: CaptureWindowCopy,
): string {
  if (status === "loading") {
    return `<p class="pdsh-capture-section-description" data-current-wallpaper-status aria-live="polite">${copy.currentWallpaperLoading}</p>`;
  }
  if (status === "error") {
    return `<p class="pdsh-capture-section-description" data-current-wallpaper-status role="alert">${copy.currentWallpaperError}</p>`;
  }
  if (status === "unavailable") return "";
  return "";
}

function plainColorButtonsTemplate(
  state: CaptureWindowState,
  colors: readonly string[],
): string {
  return colors.map((color) => {
    const selected = state.background.kind === "color" &&
      state.background.color.toLowerCase() === color.toLowerCase();
    return `<button class="pdsh-capture-background-option" data-background-color="${color}" type="button" aria-label="${color}" data-pdsh-tooltip="${color}" aria-pressed="${selected}" style="--capture-swatch:${color}"></button>`;
  }).join("");
}

function presetSectionTemplate(
  section: CapturePresetSection,
  state: CaptureWindowState,
  activeSection: ReturnType<typeof captureBackgroundSection>,
  backgroundTabsId: string,
): string {
  return `
    <section class="pdsh-capture-background-section" data-background-section="${section.id}" data-active="${activeSection === section.id}" ${captureBackgroundPanelAttributes(backgroundTabsId, section.id, activeSection === section.id)}>
      <div class="pdsh-capture-background-grid">${presetButtonsTemplate(section, state)}</div>
    </section>
  `;
}

function presetButtonsTemplate(
  section: CapturePresetSection,
  state: CaptureWindowState,
): string {
  return section.presets.map((preset) => {
    const { id } = preset;
    const selected = state.background.kind === "preset" && state.background.id === id;
    return `<button class="pdsh-capture-background-option" data-background="${id}" type="button" aria-label="${id}" data-pdsh-tooltip="${id}" aria-pressed="${selected}" style="--capture-swatch:${capturePresetSwatch(preset)}"></button>`;
  }).join("");
}

function footerTemplate(copy: CaptureWindowCopy): string {
  return `
    <footer class="pdsh-capture-footer">
      <button class="pdsh-capture-button" data-action="retake" type="button">${captureIcon("retake")}<span>${copy.retake}</span></button>
      <span class="pdsh-capture-footer-spacer"></span>
      <button class="pdsh-capture-button pdsh-capture-button-secondary" data-action="save" type="button">${captureIcon("save")}<span>${copy.save}</span></button>
      <button class="pdsh-capture-button pdsh-capture-button-primary" data-action="copy" type="button">${captureIcon("copy")}<span>${copy.copy}</span></button>
    </footer>
  `;
}

function iconButton(
  action: string,
  icon: Parameters<typeof captureIcon>[0],
  label: string,
  disabled = false,
  pressed?: boolean,
  redactionStyle?: string,
  title = label,
): string {
  const pressedAttribute = pressed === undefined ? "" : ` aria-pressed="${pressed}"`;
  const styleAttribute = redactionStyle ? ` data-redaction-style="${redactionStyle}"` : "";
  return `<button class="pdsh-capture-icon-button" data-action="${action}"${styleAttribute} type="button" aria-label="${label}" data-pdsh-tooltip="${title}"${pressedAttribute} ${disabled ? "disabled" : ""}>${captureIcon(icon)}</button>`;
}

function checked(value: boolean): string {
  return value ? "checked" : "";
}
