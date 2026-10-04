/**
 * [INPUT]: 依赖唯一 pdsh ConfigForm、locale/slot/PluginManager 服务和可选官方 macOS/Windows 平台 Remote 服务。
 * [OUTPUT]: 按身份、标题打码、截图顺序呈现设置，仅用完整有效的 Host accepted 截图配置装配相机；拍照每次初拍/重拍读取 Host accepted 身份遮挡值。
 * [POS]: 单 Bundle Client 组合根；常驻身份、标题预遮挡与截图身份遮挡独立，共享唯一 ConfigForm；截图配置尚未就绪时只撤回相机，不影响身份/标题，后续快照可恢复。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React, { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { BUNDLE_NAME } from '../shared/components.ts';
import { NS, dictionaries } from '../shared/locales.ts';
import { DEFAULTS, resolvePreferences } from '../shared/model.ts';
import { isCaptureConfigurationReady, resolveCaptureExportPreferences } from '../shared/capture-export.ts';
import { createCaptureTrace } from '../shared/capture-trace.ts';
import { NativeStyleProbe } from './native-style-view.tsx';
import { mountPresentation } from './presentation.ts';
import { mountSidebarRedaction } from './sidebar-redaction.ts';
import { mountTitleToggle } from './title-toggle.ts';
import { mountSearchEntry } from './search-entry.ts';
import { mountDomTooltips } from './dom-tooltip.ts';
import { mountCaptureBackgroundTabs } from './capture/background-tabs.tsx';
import { mountCaptureController } from './capture/controller.ts';
import { mountCaptureNotices } from './capture-notice.tsx';
import { readCaptureDirectoryPicker } from './capture/directory.ts';
import { captureOwnedWindow, capturedWindowScale } from './capture/window-capture.ts';
import { saveWindowImage, prepareWindowSaveDirectory } from './capture/window-save.ts';
import { SettingsCard } from './settings-card.tsx';
import { CaptureSettingsCard } from './capture-settings.tsx';
import { TitleSettingsCard } from './title-settings.tsx';
import { createUpdateController } from './updater.ts';
import { loadReleaseTags } from './update-source.ts';
import { UpdateBadge } from './update-badge.tsx';
import entryIcon from './entry-icon.svg';
import cameraIcon from './camera-icon.svg';
import { presetAssets } from './capture/assets.ts';
import css from './styles.css';
import tooltipCss from './dom-tooltip.css';
import captureCss from './capture/capture-window.css';
import pickerCss from './capture/background-picker.css';
import colorCss from './capture/color-popover.css';

const ROOT_ENTRY_ID = 'pdsh';

function disposeAll(disposers: Array<() => void>) {
  let failure;
  for (const off of disposers) try { off(); } catch (error) { failure ??= error; }
  if (failure) throw failure;
}

function BundleSettings({ view, form, t, presentation, titleControl, subscribe, snapshot, chooseDirectory }) {
  useSyncExternalStore(subscribe, snapshot);
  if (view === 'summary') return t('description');
  return <>
    <SettingsCard view={view} preferencesForm={form} presentation={presentation} t={t} showTitles={false} />
    <TitleSettingsCard view={view} form={form} control={titleControl} t={t} />
    <CaptureSettingsCard view={view} form={form} t={t} chooseDirectory={chooseDirectory} />
  </>;
}

/** 装配一个 Host Client Fiber；页面资源跟随唯一 root Bundle 释放。 */
export function mountComponent(ctx, doc: Document = document) {
  const form = ctx.configForms.get('pdsh');
  ctx.effect(() => ctx.locale.register(NS, dictionaries), 'pdsh dictionaries');
  ctx.effect(() => ctx.configForms.whileServed(['pdsh'], () => {
    const cleanup: Array<() => void> = [];
    let disposed = false;
    let captureRemote: any;
    let captureController: any;
    let captureNotices: any;
    let entry: any;
    let entryHasCamera = false;
    const listeners = new Set<() => void>();
    const t = ctx.locale.bind(NS);
    function disposeBundle() {
      if (disposed) return;
      disposed = true;
      let failure;
      try { disposeAll(cleanup.reverse()); } catch (error) { failure = error; }
      listeners.clear();
      if (failure) throw failure;
    }
    try {
      // +--- 唯一 Bundle 共用样式、探针、Tooltip 与更新生命周期 ---+
      const style = doc.createElement('style');
      style.dataset.plugin = BUNDLE_NAME;
      style.textContent = `${css}\n${tooltipCss}\n${captureCss}\n${pickerCss}\n${colorCss}`;
      doc.head.append(style);
      cleanup.push(() => style.remove());
      cleanup.push(() => {
        const oldEntry = entry;
        entry = undefined;
        oldEntry?.dispose();
      });
      const probe = doc.createElement('div');
      probe.setAttribute('aria-hidden', 'true');
      probe.setAttribute('inert', '');
      probe.setAttribute('data-pdsh-probe', '');
      doc.body.append(probe);
      cleanup.push(() => probe.remove());
      const root = createRoot(probe);
      cleanup.push(() => root.unmount());
      root.render(<NativeStyleProbe doc={doc} />);
      const offTooltips = mountDomTooltips(doc);
      cleanup.push(offTooltips);
      const updater = createUpdateController(ctx.remote.pluginManager, loadReleaseTags, __PDSH_VERSION__);
      cleanup.push(() => updater.dispose());

      const presentation = mountPresentation(doc);
      cleanup.push(() => presentation.dispose());
      const titles = mountSidebarRedaction(doc);
      cleanup.push(() => titles.dispose());

      function publish() {
        entry?.refresh();
        if (!disposed) for (const listener of listeners) listener();
      }
      const titleControl = mountTitleToggle(form, publish);
      cleanup.push(() => titleControl.dispose());

      function syncEntry() {
        if (disposed) return;
        const hasCamera = Boolean(captureController);
        if (entry && entryHasCamera === hasCamera) { entry.refresh(); return; }
        entry?.dispose();
        entryHasCamera = hasCamera;
        entry = mountSearchEntry(doc, {
          icon: entryIcon,
          state: titleControl.state,
          label: () => `${t(titleControl.state().pressed ? 'entryOn' : 'entry')}${titleControl.state().failed ? ` · ${t('toggleFailed')}` : ''}`,
          onActivate: () => void titleControl.activate(),
          capture: hasCamera ? { icon: cameraIcon, label: () => t('capture'), state: captureController.state, onActivate: captureController.activate } : null,
        });
      }

      function stopCapture() {
        const hadCapture = Boolean(captureController || captureNotices);
        const oldController = captureController; captureController = undefined;
        const oldNotices = captureNotices; captureNotices = undefined;
        try {
          disposeAll([oldController && (() => oldController.dispose()), oldNotices && (() => oldNotices.dispose())].filter(Boolean));
        } finally {
          if (hadCapture && !disposed) syncEntry();
        }
      }
      cleanup.push(stopCapture);

      function captureSettingEnabled() {
        const snapshot = form.getSnapshot();
        return snapshot.status === 'ready' && isCaptureConfigurationReady(snapshot.value) && snapshot.value?.captureEnabled === true;
      }

      function syncCapture() {
        if (disposed || !captureSettingEnabled()) { stopCapture(); return; }
        const navigatorPlatform = doc.defaultView.navigator.platform;
        const supportedPlatform = navigatorPlatform.startsWith('Mac') || navigatorPlatform.startsWith('Win');
        if (!supportedPlatform || !captureRemote) { stopCapture(); return; }
        if (captureController) return;
        stopCapture();

        const trace = createCaptureTrace(ctx.logger, 'renderer');
        try {
          const remote = captureRemote;
          captureNotices = mountCaptureNotices(doc);
          captureController = mountCaptureController(doc, {
            capture: (document, options) => captureOwnedWindow(document, signal => remote.capture(signal), options),
            captureScope: 'owned-window', sourceScale: capturedWindowScale,
            captureMaskIdentity: () => {
              const current = form.getSnapshot();
              return current.status !== 'ready' || !isCaptureConfigurationReady(current.value) || current.value.captureMaskIdentity !== false;
            },
            exportPreferences: () => resolveCaptureExportPreferences(form.getSnapshot().value),
            trace,
            onSave: async (blob, _name, directory, behavior, signal, metadata) => {
              const current = form.getSnapshot();
              const accepted = resolveCaptureExportPreferences(current.value);
              if (current.status !== 'ready' || !isCaptureConfigurationReady(current.value) || accepted.saveFormat !== metadata.format || (behavior === 'direct' && accepted.saveDirectory !== directory)) throw new Error('save-failed');
              const target = await prepareWindowSaveDirectory(form, readCaptureDirectoryPicker(doc), behavior, signal);
              if (target === null) return 'cancelled';
              return saveWindowImage(blob, {requestId: doc.defaultView.crypto.randomUUID(), ...metadata}, (request, abort) => remote.save(request, abort), {signal, crypto: doc.defaultView.crypto});
            },
            locale: () => ctx.locale.getSnapshot?.().active ?? doc.documentElement.lang ?? doc.defaultView.navigator.language,
            onState: publish,
            notify: captureNotices.show,
            presetAssets,
            mountBackgroundTabs: mountCaptureBackgroundTabs,
          });
          syncEntry();
      } catch (error) {
        try { stopCapture(); } catch (disposeError) { ctx.logger.warn('PDSH capture cleanup failed.', disposeError); }
        ctx.logger.warn('PDSH capture capability could not be mounted.', error);
      }
    }

    function syncPreferences() {
      const state = form.getSnapshot();
      const accepted = state.status === 'ready' ? state.value : { ...DEFAULTS, maskIdentity: false, maskTitles: false };
      try {
        presentation.update(resolvePreferences(accepted));
        titles.update(state.status === 'ready' && state.value?.maskTitles === true);
      } catch {
        presentation.update(resolvePreferences({ ...DEFAULTS, maskIdentity: false }));
        titles.update(false);
        ctx.logger.warn('PDSH configuration rejected; display features remain off.');
      }
      syncCapture();
      syncEntry();
      publish();
    }

    const unsubscribeForm = form.subscribe(syncPreferences);
    cleanup.push(unsubscribeForm);
    const unsubscribeLocale = ctx.locale.subscribe(publish);
    cleanup.push(unsubscribeLocale);
    syncPreferences();

    const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
    const snapshot = () => `${ctx.locale.getSnapshot?.().active ?? ''}:${form.getSnapshot().revision}:${captureController ? 1 : 0}`;
    const chooseDirectory = readCaptureDirectoryPicker(doc);
    const RowSettings = ({ view }) => <BundleSettings view={view} form={form} t={t} presentation={presentation} titleControl={titleControl} subscribe={subscribe} snapshot={snapshot} chooseDirectory={chooseDirectory} />;
    cleanup.push(ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
      name: 'plugins.row.config', key: `${BUNDLE_NAME}#${ROOT_ENTRY_ID}`, locale: NS,
    }, RowSettings)));
    cleanup.push(ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
      name: 'plugins.bundle.config', key: BUNDLE_NAME, locale: NS,
    }, RowSettings)));
    cleanup.push(ctx.slots.inject('plugins.detail.badge', () => ctx.slots.register({
      name: 'plugins.detail.badge', id: 'pdsh-update', locale: NS,
      inject: () => ({ updater, version: __PDSH_VERSION__ }),
    }, UpdateBadge)));

    // +--- 可选官方 namespace；缺少取像服务不阻塞身份与标题 ---+
    const captureFiber = ctx.inject(['remote.pdshNativeWindowCapture'], (captureCtx) => {
      const current = captureCtx.remote.pdshNativeWindowCapture;
      captureRemote = current;
      syncCapture();
      captureCtx.effect(() => () => {
        if (captureRemote === current) captureRemote = undefined;
        syncCapture();
      }, 'pdsh optional capture remote');
    });
    cleanup.push(() => { void captureFiber.dispose(); });

    return disposeBundle;
    } catch (error) {
      try { disposeBundle(); } catch { /* 保留触发回滚的原始错误。 */ }
      throw error;
    }
  }), 'pdsh bundle lifetime');
}
