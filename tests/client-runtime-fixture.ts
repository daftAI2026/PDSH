/**
 * [INPUT]: 依赖生产组合根源码、esbuild 与显式功能边界桩。
 * [OUTPUT]: 提供组合根内存加载器，复用于能力与更新事件装配合同。
 * [POS]: tests 的共享夹具；不启动 Host，不证明真实安装或像素。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { build as esbuild } from 'esbuild';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { DEFAULTS } from '../src/shared/model.ts';
import { DEFAULT_CAPTURE_EXPORT } from '../src/shared/capture-export.ts';
import { dictionaries, NS } from '../src/shared/locales.ts';
import { isCaptureRuntimeCurrent, isWallpaperCapabilityReady, isCaptureGeometryCapabilityReady,
 requireCaptureRuntimeCurrent, requireWallpaperCapabilityCurrent } from '../src/client/capture/runtime-readiness.ts';

export async function loadComponentRuntime(assemblies, mutateSource = source => source) {
  const source = fileURLToPath(new URL('../src/client/component-runtime.tsx', import.meta.url));
  const built = await esbuild({
    entryPoints: [source], bundle: true, write: false, format: 'cjs', platform: 'node', logLevel: 'silent',
    plugins: [
      { name: 'in-memory-component-source', setup(build) {
        build.onLoad({ filter: /component-runtime\.tsx$/ }, () => ({
          contents: mutateSource(readFileSync(source, 'utf8').replace(/\r\n/gu, '\n')), loader: 'tsx',
        }));
      } },
      { name: 'externalize-runtime-dependencies', setup(build) {
        build.onResolve({ filter: /.*/ }, args => args.kind === 'entry-point' ? undefined : { path: args.path, external: true });
      } },
    ],
  });
  const component = () => null;
  const lifecycle = () => ({ update() {}, dispose() {} });
  const external = new Map([
    ['react', React], ['react/jsx-runtime', jsxRuntime],
    ['react-dom/client', { createRoot: () => ({ render() {}, unmount() {} }) }],
    ['/shared/components.ts', { BUNDLE_NAME: '@daftai/pdsh', ROOT_ENTRY_ID: 'pdsh', IS_RC_BUNDLE: false }],
    ['/shared/locales.ts', { NS, dictionaries }],
    ['/shared/model.ts', { DEFAULTS, resolvePreferences: value => value }],
    ['/shared/capture-export.ts', { isCaptureConfigurationReady: () => true, resolveCaptureExportPreferences: () => DEFAULT_CAPTURE_EXPORT }],
    ['/capture-trace.ts', { createCaptureTrace: () => () => {} }],
    ['/native-style-view.tsx', { NativeStyleProbe: component }],
    ['/presentation.ts', { mountPresentation: () => lifecycle() }],
    ['/plugin-detail-typography.ts', { mountPluginDetailTypography: () => {
      const typography = { disposed: false, dispose() { this.disposed = true; } };
      assemblies.typography.push(typography);
      return typography;
    } }],
    ['/sidebar-redaction.ts', { mountSidebarRedaction: () => ({ ...lifecycle(), update() {} }) }],
    ['/title-toggle.ts', { mountTitleToggle: () => ({ state: () => ({ pressed: false, failed: false }), activate: async () => {}, dispose() {} }) }],
    ['/search-entry.ts', { mountSearchEntry: (_doc, options) => {
      const entry = { options, refresh() {}, dispose() { this.disposed = true; } };
      assemblies.entries.push(entry); return entry;
    } }],
    ['/sidebar-state.ts', { createSidebarState: () => ({ getSnapshot: () => undefined, subscribe: () => () => {}, dispose() {} }) }],
    ['/header-camera.tsx', { HeaderCamera: component }],
    ['/dom-tooltip.ts', { mountDomTooltips: () => () => {} }],
    ['/capture/background-tabs.tsx', { mountCaptureBackgroundTabs: () => lifecycle() }],
    ['/capture/controller.ts', { mountCaptureController: (_doc, options) => {
      const controller = { options, state: () => ({ busy: false, disabled: false }), activate() {}, dispose() { this.disposed = true; } };
      assemblies.controllers.push(controller); return controller;
    } }],
    ['/capture-notice.tsx', { mountCaptureNotices: () => ({ show() {}, dispose() {} }) }],
    ['/capture/directory.ts', { readCaptureDirectoryPicker: () => () => null }],
    ['/capture/runtime-readiness.ts', {
      isCaptureRuntimeCurrent,
      isWallpaperCapabilityReady,
      isCaptureGeometryCapabilityReady,
      requireCaptureRuntimeCurrent,
      requireWallpaperCapabilityCurrent,
    }],
    ['/capture/window-capture.ts', { captureOwnedWindow: async (_doc, open, options) => { open(options?.signal); (assemblies.captures ??= []).push(options); return null; }, capturedWindowScale: () => 1, capturedWindowGeometry: () => undefined }],
    ['/capture/system-wallpaper-remote.ts', { createSystemWallpaperRemoteAdapter: (remote, options) => {
      const adapter = { remote, options, index: assemblies.adapters.length };
      assemblies.adapters.push(adapter); return adapter;
    } }],
    ['/capture/window-save.ts', { saveWindowImage: async () => {}, prepareWindowSaveDirectory: async () => null }],
    ['/settings-card.tsx', { SettingsCard: component }], ['/capture-settings.tsx', { CaptureSettingsCard: component }],
    ['/title-settings.tsx', { TitleSettingsCard: component }], ['/project-footer.tsx', { ProjectFooter: component }],
    ['/updater.ts', { createUpdateController: (_manager, _load, _version, activateInstalled, subscribeInstallState) => {
      assemblies.activateInstalled = activateInstalled;
      const off = subscribeInstallState?.(progress => { assemblies.updateProgress = progress; });
      return { dispose() { off?.(); } };
    } }],
    ['/update-source.ts', { loadReleaseTags: async () => [] }], ['/update-badge.tsx', { UpdateBadge: component }],
    ['/capture/assets.ts', { presetAssets: [] }],
    ['.svg', ''], ['.css', ''],
  ]);
  const module = { exports: {} };
  runInNewContext(built.outputFiles[0].text, {
    module, exports: module.exports, __PDSH_VERSION__: '0.5.1',
    require(id) {
      const found = [...external].find(([suffix]) => id === suffix || id.endsWith(suffix));
      assert.ok(found, `unexpected component-runtime import: ${id}`);
      return found[1];
    },
  });
  return module.exports.mountComponent;
}
