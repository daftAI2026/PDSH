/**
 * [INPUT]: 依赖 model.ts 的编辑状态、copy.ts 的本地化文案、presets.ts 的背景分层、持久 Gallery 目录、有限系统目录/失败码校验与 icons.ts 图标
 * [OUTPUT]: 提供背景图库、独立标题和身份遮罩。背景 h2 标记语言。空图库不重复说明。
 * [POS]: DSH 工作台声明式视图。身份开关标记头像与名称。加号只发起动作，不承载像素或选中态。
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
import type { SystemWallpaperState } from "./system-wallpapers.ts";
import { isSystemWallpaperClientErrorCode } from './system-wallpaper-remote.ts';
import { isSystemWallpaperId, WALLPAPER_LIMITS } from '../../shared/system-wallpaper-protocol.ts';
import { isUserWallpaperId, type WallpaperGalleryAsset } from '../../shared/wallpaper-gallery.ts';
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
  galleryAssets?: readonly WallpaperGalleryAsset[];
  galleryStatus?: 'error' | 'idle' | 'loading' | 'ready';
  galleryBusyId?: string | null;
};

export type CaptureWindowRenderMemory = {
  action?: string;
  importingImage?: boolean;
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
    importingImage: active?.hasAttribute('data-background-wallpaper') || active?.hasAttribute('data-gallery-import-focus'),
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
  if (memory.importingImage) {
    const addImage = root.querySelector<HTMLButtonElement>('[data-background-wallpaper]');
    const target = addImage?.disabled
      ? root.querySelector<HTMLElement>('[data-gallery-import-focus]')
      : addImage;
    if (target && !target.closest('[hidden], [inert]')) target.focus();
  } else if (memory.wallpaper) {
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
  const systemWallpapers = options.systemWallpapers ?? { entries: [], status: "unavailable" as const };
  return `
    <div class="pdsh-capture-backdrop" aria-hidden="true"></div>
    <section class="pdsh-capture-dialog" role="dialog" aria-modal="true" aria-labelledby="pdsh-capture-editor-title">
      <header class="pdsh-capture-header">
        <div class="pdsh-capture-heading">
          ${captureIcon("camera")}
          <h1 class="pdsh-capture-title" id="pdsh-capture-editor-title">${copy.title}</h1>
        </div>
        ${iconButton("close", "x", copy.close)}
      </header>
      <div class="pdsh-capture-workspace">
        <section class="pdsh-capture-preview-pane" aria-label="${copy.preview}">
          ${captureToolbarTemplate(state, copy)}
          <div class="pdsh-capture-stage" data-tool="${state.tool}">
            <div class="pdsh-capture-canvas-frame">
              <div class="pdsh-capture-region-layer"></div>
            </div>
          </div>
        </section>
        ${inspectorTemplate(state, copy, lastBackgroundColor, systemWallpapers, options.backgroundTabsId ?? "pdsh-capture-background", options)}
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
  systemWallpapers: SystemWallpaperState,
  backgroundTabsId: string,
  options: CaptureWindowViewOptions,
): string {
  return `
    <aside class="pdsh-capture-inspector">
      <h2 class="pdsh-capture-section-title" id="pdsh-capture-background-title" lang="${copy.lang}">${copy.background}</h2>
      <div class="pdsh-capture-inspector-scroll" tabindex="0" role="region" aria-labelledby="pdsh-capture-background-title">
      <div class="pdsh-capture-inspector-content">
      <section class="pdsh-capture-section">
        ${backgroundGridTemplate(state, copy, lastBackgroundColor, systemWallpapers, backgroundTabsId, options)}
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
      <section class="pdsh-capture-section pdsh-capture-row">
        <div class="pdsh-capture-privacy-copy">
          <h2 class="pdsh-capture-section-title">${copy.identityMask}</h2>
          <p class="pdsh-capture-section-description">${copy.identityMaskDescription}</p>
        </div>
        <input class="pdsh-capture-switch" data-input="identity-mask" type="checkbox" aria-label="${copy.identityMask}" ${checked(state.identityMaskEnabled)}>
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
  systemWallpapers: SystemWallpaperState,
  backgroundTabsId: string,
  options: CaptureWindowViewOptions,
): string {
  const custom = state.background.kind === "color" && !isCapturePlainColor(state.background.color);
  const customIcon = `<span data-background-custom-icon>${captureIcon("pipette")}</span>`;
  const gradients = capturePresetSection("gradients");
  const wallpapers = capturePresetSection("wallpapers");
  const activeSection = captureBackgroundMode(state.background);
  const wallpapersActive = activeSection === "wallpapers";
  const galleryAssets = options.galleryAssets ?? [];
  const cachedAssets = new Map(galleryAssets.filter(asset => isSystemWallpaperId(asset.id)).map(asset => [asset.id, asset]));
  const wallpaperEntries = new Map(systemWallpapers.entries
    .filter(entry => isSystemWallpaperId(entry.id) && entry.thumbnail && entry.loadStatus === 'ready')
    .map(entry => [entry.id, entry]));
  for (const [id, asset] of cachedAssets) {
    if (systemWallpapers.acquisition?.status === 'ready' && !systemWallpapers.entries.some(entry => entry.id === id)) continue;
    const existing = wallpaperEntries.get(id);
    wallpaperEntries.set(id, {
      id,
      name: existing?.name ?? asset.systemName ?? copy.systemWallpaperNames[id as keyof typeof copy.systemWallpaperNames] ?? copy.systemImages,
      available: true,
      downloadable: false,
      sourceType: asset.sourceType,
      thumbnail: asset.thumbnail,
      loadStatus: existing?.loadStatus === 'loading' ? 'loading' : 'ready',
    });
  }
  const visibleWallpapers = [...wallpaperEntries.values()].slice(0, WALLPAPER_LIMITS.maxCatalogEntries);
  const userAssets = galleryAssets.filter(asset => isUserWallpaperId(asset.id));
  const acquiring = systemWallpapers.acquisition?.status === 'loading';
  const canAcquire = systemWallpapers.status !== 'unavailable';
  const acquireLabel = visibleWallpapers.length > 0
    ? copy.refreshWallpapers
    : systemWallpapers.acquisition?.status === 'error' ? copy.retryWallpapers : copy.loadWallpapers;
  return `
    <div data-background-tabs></div>
    <div class="pdsh-capture-background-sections">
      <section class="pdsh-capture-background-section" data-background-section="none" data-active="${activeSection === 'none'}" ${captureBackgroundPanelAttributes(backgroundTabsId, 'none', activeSection === 'none')}>
      </section>
      ${presetSectionTemplate(gradients, state, activeSection, backgroundTabsId)}
      <section class="pdsh-capture-background-section" data-background-section="wallpapers" data-active="${wallpapersActive}" ${captureBackgroundPanelAttributes(backgroundTabsId, "wallpapers", wallpapersActive)}>
        <div class="pdsh-capture-background-grid">
          ${presetButtonsTemplate(wallpapers, state)}
        </div>
        ${canAcquire || visibleWallpapers.length ? `<section class="pdsh-capture-gallery" data-system-wallpaper-group aria-label="${copy.systemImages}">
          <div class="pdsh-capture-gallery-heading">
            <h3 class="pdsh-capture-section-description">${copy.systemImages}</h3>
            ${canAcquire ? `<button class="pdsh-capture-background-expand" data-action="acquire-system-wallpapers" type="button" aria-label="${escapeAttribute(acquireLabel)}" aria-busy="${acquiring}" data-pdsh-tooltip="${escapeAttribute(copy.wallpaperDownloadHint)}"${acquiring ? ' disabled' : ''}>${acquireLabel}</button>` : ''}
          </div>
          ${systemWallpaperStatusTemplate(systemWallpapers, copy)}
          <div class="pdsh-capture-gallery-grid">${visibleWallpapers.map((entry) => {
            const label = entry.name;
            const selected = state.background.kind === "wallpaper" && state.background.systemId === entry.id;
            const busy = options.galleryBusyId === entry.id;
            return `<button class="pdsh-capture-background-option pdsh-capture-wallpaper-label" data-system-wallpaper="${escapeAttribute(entry.id)}" data-gallery-wallpaper="${escapeAttribute(entry.id)}" data-load-status="ready" type="button" data-selected="${selected}" aria-pressed="${selected}" aria-busy="${busy}" aria-label="${escapeAttribute(label)}"${busy ? " disabled" : ""}>${busy ? '<span class="pdsh-capture-skeleton" aria-hidden="true"></span>' : `<img src="${escapeAttribute(entry.thumbnail ?? '')}" alt="">`}</button>`;
          }).join("")}${visibleWallpapers.length === 0 && canAcquire ? `<button class="pdsh-capture-background-option pdsh-capture-wallpaper-label" data-system-wallpaper-empty data-action="acquire-system-wallpapers" type="button" aria-label="${escapeAttribute(acquireLabel)}" aria-busy="${acquiring}" data-pdsh-tooltip="${escapeAttribute(copy.wallpaperDownloadHint)}"${acquiring ? ' disabled' : ''}><span data-wallpaper-placeholder aria-hidden="true">${captureIcon("plus")}</span></button>` : ''}</div>
        </section>` : ''}
        <section class="pdsh-capture-gallery" aria-label="${copy.myImages}" aria-busy="${options.galleryStatus === 'loading'}">
          <div class="pdsh-capture-gallery-heading">
            <h3 class="pdsh-capture-section-description" data-gallery-import-focus tabindex="-1">${copy.myImages}</h3>
          </div>
          <input class="pdsh-capture-wallpaper-input" data-input="wallpaper" type="file" accept="image/png,image/jpeg,image/webp">
          ${galleryStatusTemplate(options.galleryStatus ?? 'idle', copy)}
          <div class="pdsh-capture-gallery-grid">${userAssets.map((asset, index) => {
            const name = `${copy.myImage} ${index + 1}`;
            const selected = state.background.kind === 'wallpaper' && state.background.systemId === asset.id;
            const busy = options.galleryBusyId === asset.id;
            return `<div class="pdsh-capture-gallery-item"><button class="pdsh-capture-background-option pdsh-capture-wallpaper-label" data-gallery-user-image="${escapeAttribute(asset.id)}" data-selected="${selected}" aria-pressed="${selected}" aria-busy="${busy}" type="button" aria-label="${escapeAttribute(name)}" data-pdsh-tooltip="${escapeAttribute(name)}"${busy ? ' disabled' : ''}><img src="${escapeAttribute(asset.thumbnail)}" alt=""></button><button class="pdsh-capture-gallery-remove" data-gallery-remove="${escapeAttribute(asset.id)}" type="button" aria-label="${escapeAttribute(`${copy.removeImage} ${name}`)}"${options.galleryBusyId === asset.id ? ' disabled' : ''}>${copy.removeImage}</button></div>`;
          }).join('')}<button class="pdsh-capture-background-option pdsh-capture-wallpaper-label" data-background-wallpaper data-gallery-add-image type="button" aria-busy="${options.galleryBusyId === 'importing'}" aria-label="${escapeAttribute(copy.addImage)}" data-pdsh-tooltip="${escapeAttribute(copy.addImage)}"${options.galleryBusyId === 'importing' ? ' disabled' : ''}><span data-wallpaper-placeholder aria-hidden="true">${captureIcon("plus")}</span></button></div>
        </section>
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

function galleryStatusTemplate(status: NonNullable<CaptureWindowViewOptions['galleryStatus']>, copy: CaptureWindowCopy): string {
  if (status === 'error') return `<p class="pdsh-capture-section-description" data-gallery-status role="alert">${copy.galleryError}</p>`;
  return '';
}

function systemWallpaperStatusTemplate(
  state: SystemWallpaperState,
  copy: CaptureWindowCopy,
): string {
  if (state.acquisition?.status === 'loading') {
    return '';
  }
  if (state.acquisition?.status === 'error') {
    const code = state.acquisition.failureCode;
    const diagnostic = isSystemWallpaperClientErrorCode(code) ? ` (${code})` : '';
    return `<p class="pdsh-capture-section-description" data-system-wallpapers-status role="alert">${copy.systemWallpapersPartial}${diagnostic}</p>`;
  }
  if (state.status === "loading") {
    return '';
  }
  if (state.status === "error") {
    return `<p class="pdsh-capture-section-description" data-system-wallpapers-status role="alert">${copy.systemWallpapersError}</p>`;
  }
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
