/**
 * [INPUT]: 依赖 ConfigForm、两 Remote、只读侧栏状态及插件详情字形适配器。
 * [OUTPUT]: 装配身份、标题、两相机入口、详情字形对齐及设置页脚；macOS/Windows入口仍经独立 capability 握手。
 * [POS]: 单 Bundle 组合根。迟到扩展不重建工作台，不阻断基础截图。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React, { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { BUNDLE_NAME, ROOT_ENTRY_ID, IS_RC_BUNDLE } from '../shared/components.ts';
import { NS, dictionaries } from '../shared/locales.ts';
import { DEFAULTS, resolvePreferences } from '../shared/model.ts';
import { isCaptureConfigurationReady, resolveCaptureExportPreferences } from '../shared/capture-export.ts';
import { createCaptureTrace } from '../shared/capture-trace.ts';
import { NativeStyleProbe } from './native-style-view.tsx';
import { mountPresentation } from './presentation.ts';
import { mountPluginDetailTypography } from './plugin-detail-typography.ts';
import { mountSidebarRedaction } from './sidebar-redaction.ts';
import { mountTitleToggle } from './title-toggle.ts';
import { mountSearchEntry } from './search-entry.ts';
import { createSidebarState } from './sidebar-state.ts';
import { HeaderCamera } from './header-camera.tsx';
import { mountDomTooltips } from './dom-tooltip.ts';
import { mountCaptureBackgroundTabs } from './capture/background-tabs.tsx';
import { mountCaptureController } from './capture/controller.ts';
import { mountCaptureNotices } from './capture-notice.tsx';
import { readCaptureDirectoryPicker } from './capture/directory.ts';
import { isCaptureRuntimeCurrent, isWallpaperCapabilityReady, requireCaptureRuntimeCurrent, requireWallpaperCapabilityCurrent } from './capture/runtime-readiness.ts';
import { captureOwnedWindow, capturedWindowScale } from './capture/window-capture.ts';
import { createSystemWallpaperRemoteAdapter } from './capture/system-wallpaper-remote.ts';
import { saveWindowImage, prepareWindowSaveDirectory } from './capture/window-save.ts';
import { SettingsCard } from './settings-card.tsx';
import { CaptureSettingsCard } from './capture-settings.tsx';
import { TitleSettingsCard } from './title-settings.tsx';
import { ProjectFooter } from './project-footer.tsx';
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
    <ProjectFooter t={t} />
  </>;
}

/** 装配一个 Host Client Fiber；页面资源跟随唯一 root Bundle 释放。 */
export function mountComponent(ctx, doc: Document = document) {
  const form = ctx.configForms.get(ROOT_ENTRY_ID);
  ctx.effect(() => ctx.locale.register(NS, dictionaries), 'pdsh dictionaries');
  ctx.effect(() => ctx.configForms.whileServed([ROOT_ENTRY_ID], () => {
    const cleanup: Array<() => void> = [];
    let disposed = false;
    let captureRemote: any;
    let captureRemoteGeneration = 0;
    let captureRuntimeReadiness: { remote: any; generation: number; promise: Promise<boolean> } | undefined;
    let runtimeCapabilitiesRemote: any;
    let runtimeCapabilitiesReady = false;
    let runtimeWallpaperAdapter: any;
    let runtimeCapabilitiesGeneration = 0;
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
      const offPluginDetailTypography = mountPluginDetailTypography(doc);
      cleanup.push(() => offPluginDetailTypography.dispose());
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
      const updater = createUpdateController(ctx.remote.pluginManager, loadReleaseTags, __PDSH_VERSION__, async version => {
        const capture = captureRemote;
        const captureGeneration = captureRemoteGeneration;
        if (!capture || !await isCaptureRuntimeCurrent(capture, version) || captureRemote !== capture || captureRemoteGeneration !== captureGeneration) return false;
        const capabilities = runtimeCapabilitiesRemote;
        if (!capabilities) return false;
        const capabilitiesGeneration = runtimeCapabilitiesGeneration;
        const ready = await isWallpaperCapabilityReady(capabilities, version);
        return ready && captureRemote === capture && captureRemoteGeneration === captureGeneration
          && runtimeCapabilitiesGeneration === capabilitiesGeneration && runtimeCapabilitiesRemote === capabilities;
      });
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
      const sidebar = createSidebarState(doc);
      cleanup.push(() => sidebar.dispose());

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
          if (hadCapture && !disposed) { syncEntry(); publish(); }
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
            capture: async (document, options) => {
              await requireCaptureRuntimeCurrent(remote, __PDSH_VERSION__, options.signal);
              return captureOwnedWindow(document, signal => remote.capture(signal), options);
            },
            captureScope: 'owned-window', sourceScale: capturedWindowScale,
            captureMaskIdentity: () => {
              const current = form.getSnapshot();
              return current.status !== 'ready' || !isCaptureConfigurationReady(current.value) || current.value.captureMaskIdentity !== false;
            },
            exportPreferences: () => resolveCaptureExportPreferences(form.getSnapshot().value),
            trace,
            onSave: async (blob, _name, directory, behavior, signal, metadata) => {
              await requireCaptureRuntimeCurrent(remote, __PDSH_VERSION__, signal);
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
            readSystemWallpapers: () => captureRemote === remote && runtimeCapabilitiesRemote && runtimeCapabilitiesReady ? runtimeWallpaperAdapter : undefined,
          });
          syncEntry();
          publish();
      } catch (error) {
        try { stopCapture(); } catch (disposeError) { ctx.logger.warn('PDSH capture cleanup failed.', disposeError); }
        ctx.logger.warn('PDSH capture capability could not be mounted.', error);
      }
    }

    function probeRuntimeCapabilities() {
      const capture = captureRemote;
      const captureGeneration = captureRemoteGeneration;
      const captureReadiness = captureRuntimeReadiness;
      const capabilities = runtimeCapabilitiesRemote;
      const capabilitiesGeneration = runtimeCapabilitiesGeneration;
      if (!capture || !capabilities || !captureReadiness || captureReadiness.remote !== capture ||
          captureReadiness.generation !== captureGeneration) {
        runtimeCapabilitiesReady = false;
        return;
      }
      void (async () => {
        if (!await captureReadiness.promise) return false;
        if (disposed || captureRemote !== capture || captureRemoteGeneration !== captureGeneration ||
            runtimeCapabilitiesRemote !== capabilities || runtimeCapabilitiesGeneration !== capabilitiesGeneration) return false;
        return await isWallpaperCapabilityReady(capabilities, __PDSH_VERSION__);
      })().then(ready => {
        if (!disposed && captureRemote === capture && captureRemoteGeneration === captureGeneration &&
            runtimeCapabilitiesRemote === capabilities && runtimeCapabilitiesGeneration === capabilitiesGeneration) {
          runtimeCapabilitiesReady = ready;
        }
      });
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
    const snapshot = () => `${ctx.locale.getSnapshot?.().active ?? ''}:${form.getSnapshot().revision}:${captureController ? 1 : 0}:${captureController?.state().busy ?? false}:${captureController?.state().disabled ?? true}`;
    const SessionCamera = () => <HeaderCamera sidebar={sidebar} readCapture={() => disposed ? undefined : captureController} subscribe={subscribe} snapshot={snapshot} t={t} />;
    cleanup.push(ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
      name: 'conversation.session.header.utilities', id: `${ROOT_ENTRY_ID}-capture`, order: -20, locale: NS,
    }, SessionCamera)));
    const chooseDirectory = readCaptureDirectoryPicker(doc);
    const RowSettings = ({ view }) => <BundleSettings view={view} form={form} t={t} presentation={presentation} titleControl={titleControl} subscribe={subscribe} snapshot={snapshot} chooseDirectory={chooseDirectory} />;
    cleanup.push(ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
      name: 'plugins.row.config', key: `${BUNDLE_NAME}#${ROOT_ENTRY_ID}`, locale: NS,
    }, RowSettings)));
    cleanup.push(ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
      name: 'plugins.bundle.config', key: BUNDLE_NAME, locale: NS,
    }, RowSettings)));
    if (!IS_RC_BUNDLE) cleanup.push(ctx.slots.inject('plugins.detail.badge', () => ctx.slots.register({
      name: 'plugins.detail.badge', id: 'pdsh-update', locale: NS,
      inject: () => ({ updater, version: __PDSH_VERSION__ }),
    }, UpdateBadge)));

    // +--- 基础 Capture 触发版本化业务载入；缺少该服务不阻塞身份与标题 ---+
    const captureFiber = ctx.inject(['remote.pdshNativeWindowCapture'], (captureCtx) => {
      const current = captureCtx.remote.pdshNativeWindowCapture;
      const generation = ++captureRemoteGeneration;
      captureRemote = current;
      runtimeCapabilitiesReady = false;
      // +--- Client 热装配后只读激活当前后台；权限与像素仍只由明确拍照动作触发 ---+
      captureRuntimeReadiness = {
        remote: current,
        generation,
        promise: isCaptureRuntimeCurrent(current, __PDSH_VERSION__),
      };
      syncCapture();
      probeRuntimeCapabilities();
      captureCtx.effect(() => () => {
        if (captureRemoteGeneration === generation && captureRemote === current) {
          captureRemote = undefined;
          captureRuntimeReadiness = undefined;
          captureRemoteGeneration++;
          runtimeCapabilitiesReady = false;
          probeRuntimeCapabilities();
        }
        syncCapture();
      }, 'pdsh optional capture remote');
    });
    cleanup.push(() => { void captureFiber.dispose(); });

    // +--- 独立 capability 只在真实版本与纯注册握手通过后开放 ---+
    const capabilitiesFiber = ctx.inject(['remote.pdshRuntimeCapabilities'], (capabilitiesCtx) => {
      const current = capabilitiesCtx.remote.pdshRuntimeCapabilities;
      const generation = ++runtimeCapabilitiesGeneration;
      let currentActive = true;
      runtimeCapabilitiesRemote = current;
      runtimeCapabilitiesReady = false;
      const platform = doc.defaultView.navigator.platform;
      const supportsSystemWallpaper = platform.startsWith('Mac') || platform.startsWith('Win');
      runtimeWallpaperAdapter = supportsSystemWallpaper
        ? createSystemWallpaperRemoteAdapter(current, {
          beforeRequest: async signal => {
            const capture = captureRemote;
            const captureGeneration = captureRemoteGeneration;
            const isCurrent = () => currentActive && !disposed && runtimeCapabilitiesGeneration === generation &&
              runtimeCapabilitiesRemote === current && runtimeCapabilitiesReady && Boolean(capture) &&
              captureRemote === capture && captureRemoteGeneration === captureGeneration;
            if (!isCurrent()) throw new Error('runtime-not-current');
            await requireCaptureRuntimeCurrent(capture, __PDSH_VERSION__, signal);
            if (!isCurrent()) throw new Error('runtime-not-current');
            await requireWallpaperCapabilityCurrent(current, __PDSH_VERSION__, signal);
            if (!isCurrent()) throw new Error('runtime-not-current');
          },
          locale: () => ctx.locale.getSnapshot?.().active ?? doc.documentElement.lang ?? doc.defaultView.navigator.language,
        })
        : undefined;
      probeRuntimeCapabilities();
      capabilitiesCtx.effect(() => () => {
        currentActive = false;
        if (runtimeCapabilitiesGeneration === generation && runtimeCapabilitiesRemote === current) {
          runtimeCapabilitiesRemote = undefined;
          runtimeCapabilitiesReady = false;
          runtimeWallpaperAdapter = undefined;
          probeRuntimeCapabilities();
        }
      }, 'pdsh optional runtime capabilities remote');
    });
    cleanup.push(() => { void capabilitiesFiber.dispose(); });

    return disposeBundle;
    } catch (error) {
      try { disposeBundle(); } catch { /* 保留触发回滚的原始错误。 */ }
      throw error;
    }
  }), 'pdsh bundle lifetime');
}
