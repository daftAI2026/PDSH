/**
 * [INPUT]: 依赖三个 Host namespace 的 ConfigForm、Connection 服务及其 rpc 能力、共享原生样式/入口与独立功能控制器。
 * [OUTPUT]: 提供 mountComponent；共享资源按页面引用计数，功能副作用各自卸载，Bundle 设置/徽标只有一份。
 * [POS]: 三个 Cordis Client 入口的装配边界；关闭身份不阻塞标题，关闭日常灰条不阻塞临时拍照遮挡。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React, { useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { COMPONENTS, BUNDLE_NAME, type ComponentKind } from '../shared/components.ts';
import { dictionaries } from '../shared/locales.ts';
import { resolvePreferences } from '../shared/model.ts';
import { resolveCaptureExportPreferences } from '../shared/capture-export.ts';
import { createCaptureTrace } from '../shared/capture-trace.ts';
import { NativeStyleProbe } from './native-style-view.tsx';
import { mountPresentation } from './presentation.ts';
import { mountSidebarRedaction } from './sidebar-redaction.ts';
import { mountTitleToggle } from './title-toggle.ts';
import { mountSearchEntry } from './search-entry.ts';
import { mountDomTooltips } from './dom-tooltip.ts';
import { mountCaptureController } from './capture/controller.ts';
import { mountCaptureNotices } from './capture-notice.tsx';
import { readPageCapturePort } from './capture/page-capture-port.ts';
import { readCaptureDirectoryPicker } from './capture/directory.ts';
import { captureViewport } from './capture/viewport.ts';
import { SettingsCard } from './settings-card.tsx';
import { CaptureSettingsCard } from './capture-settings.tsx';
import { mountPluginCapturePort } from './capture/plugin-port.ts';
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

const HUB = Symbol.for('@daftai/pdsh.component-resources.v1');
const sharedInject = ['slots', 'locale', 'configForms', 'remote', 'remote.pluginManager'];
export const inject = __PDSH_COMPONENT__ === 'capture' ? [...sharedInject, 'connection'] : sharedInject;

type Member = { kind: ComponentKind; ctx: any; form: any; t: any; presentation?: any; title?: any; capture?: any; port?: any; nativeSupported?: boolean; render?: (view: string) => React.ReactNode };
function disposeAll(disposers: Array<() => void>) {
  let failure;
  for (const off of disposers) try { off(); } catch (error) { failure ??= error; }
  if (failure) throw failure;
}
function createHub(doc: Document) {
  const members = new Map<ComponentKind, Member>(), listeners = new Set<() => void>();
  let released = false;
  let snapshot: readonly Member[] = [], entry = null, slotOwner = null, slots: Array<() => void> = [];
  const style = doc.createElement('style'); style.dataset.plugin = BUNDLE_NAME;
  style.textContent = `${css}\n${tooltipCss}\n${captureCss}\n${pickerCss}\n${colorCss}`; doc.head.append(style);
  const probe = doc.createElement('div'); probe.setAttribute('aria-hidden', 'true'); probe.setAttribute('inert', ''); probe.setAttribute('data-pdsh-probe', ''); doc.body.append(probe);
  const root = createRoot(probe); root.render(<NativeStyleProbe doc={doc} />);
  const offTooltips = mountDomTooltips(doc);
  // +--- 徽标请求始终由仍活跃的组件代理，不保留已关闭 Fiber 的服务上下文 ---+
  const manager: any = new Proxy({}, { get: (_target, key) => (...args) => {
    const owner = members.values().next().value;
    if (!owner) throw new Error('PDSH bundle inactive');
    const remote = owner.ctx.remote.pluginManager; return remote[key](...args);
  } });
  const updater = createUpdateController(manager, loadReleaseTags, __PDSH_VERSION__);
  const hub = {
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => snapshot,
    structureChanged() { rebuildEntry(); hub.refresh(); },
    refresh() { entry?.refresh(); snapshot = [...members.values()]; for (const listener of listeners) listener(); },
    releaseUnused() {
      if (members.size || released) return;
      released = true;
      disposeAll([() => updater.dispose(), offTooltips, () => root.unmount(), () => probe.remove(), () => style.remove(), () => listeners.clear()]);
      if ((doc as any)[HUB] === hub) delete (doc as any)[HUB];
    },
    join(member: Member) {
      if (members.has(member.kind)) throw new Error('PDSH duplicate component owner');
      members.set(member.kind, member);
      try { refreshSlots(); rebuildEntry(); hub.refresh(); }
      catch (error) {
        members.delete(member.kind);
        try { refreshSlots(); rebuildEntry(); hub.refresh(); } finally { hub.releaseUnused(); }
        throw error;
      }
      return () => {
        if (members.get(member.kind) !== member) return;
        members.delete(member.kind);
        try { refreshSlots(); rebuildEntry(); hub.refresh(); } finally { hub.releaseUnused(); }
      };
    },
  };
  function rebuildEntry() {
    entry?.dispose(); entry = null;
    const title = members.get('titles'), photo = members.get('capture');
    if (!title && !photo?.capture) return;
    entry = mountSearchEntry(doc, {
      icon: title ? entryIcon : null,
      state: title?.title.state,
      label: (): string => title ? `${title.t(title.title.state().pressed ? 'entryOn' : 'entry')}${title.title.state().failed ? ` · ${title.t('toggleFailed')}` : ''}` : '',
      onActivate: () => void title?.title.activate(),
      capture: photo?.capture ? { icon: cameraIcon, label: () => photo.t('capture'), state: photo.capture.state, onActivate: photo.capture.activate } : null,
    });
  }
  function BundleSettings({ view }) {
    const active = useSyncExternalStore(hub.subscribe, hub.getSnapshot);
    if (view === 'summary') return active[0]?.t('description') ?? '';
    return <>{active.find(member => member.kind === 'titles') && active.find(member => member.kind === 'titles').render(view)}
      {active.find(member => member.kind === 'identity') && active.find(member => member.kind === 'identity').render(view)}
      {active.find(member => member.kind === 'capture') && active.find(member => member.kind === 'capture').render(view)}</>;
  }
  function refreshSlots() {
    const candidates = [...members.values()];
    if (slotOwner === candidates[0]?.ctx) return;
    disposeAll(slots.splice(0).reverse()); slotOwner = null;
    for (const owner of candidates) {
      const ctx = owner.ctx, locale = COMPONENTS[owner.kind].locale;
      try {
        slots.push(ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({ name: 'plugins.bundle.config', key: BUNDLE_NAME, locale }, BundleSettings)));
        slots.push(ctx.slots.inject('plugins.detail.badge', () => ctx.slots.register({ name: 'plugins.detail.badge', id: 'pdsh-update', locale,
          inject: () => ({ updater, version: __PDSH_VERSION__ }) }, UpdateBadge)));
        slotOwner = ctx; return;
      } catch (error) {
        disposeAll(slots.splice(0).reverse());
        // +--- 同时卸载的 Fiber 不能承接新 effect；跳过，不中断其余控制器归还 ---+
        if (error?.code !== 'INACTIVE_EFFECT') throw error;
      }
    }
  }

  return hub;
}

export function mountComponent(ctx, doc = document) {
  const kind = __PDSH_COMPONENT__;
  const definition = COMPONENTS[kind], form = ctx.configForms.get(definition.id);
  ctx.effect(() => ctx.locale.register(definition.locale, dictionaries), `pdsh: ${kind} dictionaries`);
  ctx.effect(() => ctx.configForms.whileServed([definition.id], () => {
    const hub = (doc as any)[HUB] ?? ((doc as any)[HUB] = createHub(doc));
    const member: Member = { kind, ctx, form, t: ctx.locale.bind(definition.locale) };
    const cleanup: Array<() => void> = [];
    let leave: (() => void) | undefined;
    try {
      if (__PDSH_COMPONENT__ === 'identity') {
        member.presentation = mountPresentation(doc); cleanup.push(() => member.presentation.dispose());
        const sync = () => {
          const state = form.getSnapshot();
          try { member.presentation.update(resolvePreferences(state.status === 'ready' ? state.value : { maskIdentity: false })); }
          catch { member.presentation.update(resolvePreferences({ maskIdentity: false })); ctx.logger.warn('PDSH identity configuration rejected.'); }
        };
        sync(); cleanup.push(form.subscribe(sync));
        member.render = view => <SettingsCard view={view} preferencesForm={form} presentation={member.presentation} t={member.t} showTitles={false} />;
      } else if (__PDSH_COMPONENT__ === 'titles') {
        const titles = mountSidebarRedaction(doc); cleanup.push(() => titles.dispose());
        member.title = mountTitleToggle(form, hub.refresh); cleanup.push(() => member.title.dispose());
        const sync = () => { const state = form.getSnapshot(); titles.update(state.status === 'ready' && state.value?.maskTitles === true); hub.refresh(); };
        sync(); cleanup.push(form.subscribe(sync));
        member.render = view => <TitleSettingsCard view={view} form={form} control={member.title} subscribe={hub.subscribe} snapshot={hub.getSnapshot} t={member.t} />;
      } else {
        const notices = mountCaptureNotices(doc); cleanup.push(() => notices.dispose());
        const trace = createCaptureTrace(ctx.logger, 'renderer');
        let portConnection;
        function stopCapture() {
          const old = member.capture; member.capture = undefined; old?.dispose();
          portConnection?.dispose(); portConnection = null; member.port = null;
        }
        cleanup.push(stopCapture);
        function syncCapture() {
          const native = readPageCapturePort(doc);
          member.nativeSupported = Boolean(native);
          const available = doc.defaultView.navigator.platform.startsWith('Mac') && (native ||
            (doc.location.protocol === 'dsh-app:' && typeof ctx.connection?.rpc?.call === 'function'));
          if (!available) { stopCapture(); hub.structureChanged(); return; }
          if (!member.capture) {
            if (!native) portConnection = mountPluginCapturePort(doc, ctx.connection.rpc, trace);
            member.port = native ?? portConnection.port;
            member.capture = mountCaptureController(doc, {
              capture: (document, options) => captureViewport(document, { ...options, port: member.port, trace }),
              exportPreferences: () => resolveCaptureExportPreferences(form.getSnapshot().value), trace,
              onSave: portConnection ? (blob, name, directory, behavior, signal) => portConnection.save(blob, name, directory, behavior, signal) : undefined,
              locale: () => ctx.locale.getSnapshot?.().active ?? (doc.documentElement.lang || doc.defaultView.navigator.language),
              onState: hub.refresh, notify: notices.show, presetAssets,
            });
          }
          hub.structureChanged();
        }
        syncCapture(); cleanup.push(form.subscribe(syncCapture));
        member.render = view => <CaptureSettingsCard chooseDirectory={portConnection ? readCaptureDirectoryPicker(doc) : null} form={form} t={member.t} view={view} />;
      }

      leave = hub.join(member);
      cleanup.push(ctx.locale.subscribe(hub.refresh));
      const RowSettings = ({ view }) => member.render(view);
      cleanup.push(ctx.slots.inject('plugins.row.config', () => ctx.slots.register({ name: 'plugins.row.config', key: `${BUNDLE_NAME}#${definition.id}`, locale: definition.locale }, RowSettings)));
    } catch (error) {
      try { disposeAll(cleanup.reverse()); } finally { leave?.(); hub.releaseUnused(); }
      throw error;
    }
    return () => {
      // +--- 先取消取像/编辑器并恢复身份/灰条，再归还最后一份公共样式 ---+
      try { disposeAll(cleanup.reverse()); } finally { leave?.(); hub.releaseUnused(); }
    };
  }), `pdsh: ${kind} lifetime`);
}
