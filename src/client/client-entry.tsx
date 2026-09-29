/**
 * [INPUT]: 依赖slots/locale/configForms/官方remote.pluginManager、共享原生控件几何与截图工作台控制器。
 * [OUTPUT]: 提供设置、更新徽标、帽子右侧相机、非 React 提示层与可卸载的显示/截图增强。
 * [POS]: PDSH Client 装配层；相机通过认证 Host route 截图，所有资源跟随 Host namespace。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React, { useLayoutEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Input, Button, Switch, SettingsValueField } from '@deepseek-ai/dsh-client-ui-primitives';
import { mountPresentation } from './presentation.ts';
import { mountSearchEntry } from './search-entry.ts';
import { mountSidebarRedaction } from './sidebar-redaction.ts';
import { mountTitleToggle } from './title-toggle.ts';
import entryIcon from './entry-icon.svg';
import cameraIcon from './camera-icon.svg';
import { mountCaptureController } from './capture/controller.ts';
import { mountDomTooltips } from './dom-tooltip.ts';
import tooltipCss from './dom-tooltip.css';
import { presetAssets } from './capture/assets.ts';
import captureCss from './capture/capture-window.css';
import capturePickerCss from './capture/background-picker.css';
import captureColorCss from './capture/color-popover.css';
import { SettingsCard } from './settings-card.tsx';
import { resolvePreferences } from '../shared/model.ts';
import css from './styles.css';
import { NS, dictionaries } from '../shared/locales.ts';
import { createUpdateController } from './updater.ts';
import { loadReleaseTags } from './update-source.ts';
import { UpdateBadge } from './update-badge.tsx';

export const inject = ['slots', 'locale', 'configForms', 'remote', 'remote.pluginManager'];

function NativeStyleProbe({ doc }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const nativeInput = ref.current?.querySelector('input');
    if (!nativeInput) return;
    const style = doc.defaultView.getComputedStyle(nativeInput.parentElement);
    // +--- Input.module.css .wrap 没有公开边线 token：读原生规则，不造数值 ---+
    if (Number.parseFloat(style.borderTopWidth) > 0) {
      doc.body.style.setProperty('--pdsh-outline-width', style.borderTopWidth);
      doc.body.style.setProperty('--pdsh-control-size', style.height);
    }
    const nativeButton = ref.current.querySelector('[data-pdsh-button-probe]');
    if (nativeButton) {
      const height = doc.defaultView.getComputedStyle(nativeButton).height;
      if (Number.parseFloat(height) > 0) doc.body.style.setProperty('--pdsh-action-size', height);
    }
    const nativeSwitch = ref.current.querySelector('[role="switch"]');
    if (nativeSwitch) {
      const track = doc.defaultView.getComputedStyle(nativeSwitch);
      const thumb = doc.defaultView.getComputedStyle(nativeSwitch.firstElementChild);
      for (const [key, value] of [['--pdsh-switch-width', track.width], ['--pdsh-switch-height', track.height], ['--pdsh-switch-thumb-size', thumb.width]]) {
        if (Number.parseFloat(value) > 0) doc.body.style.setProperty(key, value);
      }
    }
    const field = ref.current.querySelector('[data-pdsh-field-probe]')?.firstElementChild;
    if (field) {
      const fieldStyle = doc.defaultView.getComputedStyle(field);
      const headStyle = doc.defaultView.getComputedStyle(field.firstElementChild);
      for (const [key, value] of [['--pdsh-section-inset', fieldStyle.paddingTop], ['--pdsh-field-gap', fieldStyle.gap], ['--pdsh-action-gap', headStyle.gap]]) {
        if (Number.parseFloat(value) > 0) doc.body.style.setProperty(key, value);
      }
    }
  }, [doc]);
  return <span ref={ref}><Input tabIndex={-1} aria-hidden="true" /><Button data-pdsh-button-probe tabIndex={-1} aria-hidden="true" /><Switch checked={false} onChange={() => {}} label="" disabled /><span data-pdsh-field-probe>
    <SettingsValueField id="pdsh-layout-probe" label="" text="" overridden={false} invalid={false} overriddenLabel="" resetLabel="" invalidLabel="" disabled onEdit={() => {}} onReset={() => {}} />
  </span></span>;
}

function mountDisplay(ctx, form) {
  const doc = document;
  const style = doc.createElement('style'); style.dataset.plugin = '@daftai/pdsh'; style.textContent = `${css}\n${tooltipCss}\n${captureCss}\n${capturePickerCss}\n${captureColorCss}`; doc.head.append(style);
  const probe = doc.createElement('div'); probe.hidden = true; probe.setAttribute('data-pdsh-probe', ''); doc.body.append(probe);
  const root = createRoot(probe);
  const properties = ['--pdsh-outline-width', '--pdsh-control-size', '--pdsh-action-size', '--pdsh-section-inset', '--pdsh-field-gap', '--pdsh-action-gap', '--pdsh-switch-width', '--pdsh-switch-height', '--pdsh-switch-thumb-size'];
  const previous = properties.map(key => [key, doc.body.style.getPropertyValue(key)]);
  root.render(<NativeStyleProbe doc={doc} />);
  const presentation = mountPresentation(doc);
  const titles = mountSidebarRedaction(doc);
  const updater = createUpdateController(ctx.remote.pluginManager, loadReleaseTags, __PDSH_VERSION__);
  const t = ctx.locale.bind(NS);
  let entry;
  const toggle = mountTitleToggle(form, () => entry?.refresh());
  const canCapture = (doc.defaultView as any).dshDesktop?.protocolVersion === 1 && doc.defaultView.navigator.platform.startsWith('Mac');
  const capture = canCapture ? mountCaptureController(doc, { onState: () => entry?.refresh(), presetAssets }) : null;
  const disposeTooltips = mountDomTooltips(doc);
  entry = mountSearchEntry(doc, {
    icon: entryIcon, state: toggle.state,
    label: () => `${t(toggle.state().pressed ? 'entryOn' : 'entry')}${toggle.state().failed ? ` · ${t('toggleFailed')}` : ''}`,
    onActivate: toggle.activate,
    capture: capture ? { icon: cameraIcon, label: () => t('capture'), state: capture.state, onActivate: capture.activate } : null,
  });
  const unbindLocale = ctx.locale.subscribe(entry.refresh);
  function synchronize() {
    const snapshot = form.getSnapshot();
    try {
      const value = resolvePreferences(snapshot.status === 'ready' ? snapshot.value : { maskTitles: false, maskIdentity: false });
      presentation.update(value); titles.update(value.maskTitles);
    } catch {
      presentation.update(resolvePreferences({ maskTitles: false, maskIdentity: false })); titles.update(false);
      ctx.logger.warn('PDSH display configuration rejected; presentation disabled.');
    }
  }
  synchronize();
  const unsubscribe = form.subscribe(synchronize);
  return {
    presentation, updater,
    dispose() {
      updater.dispose(); unsubscribe(); unbindLocale(); toggle.dispose(); capture?.dispose(); disposeTooltips(); entry.dispose(); titles.dispose(); presentation.dispose(); root.unmount(); probe.remove(); style.remove();
      for (const [key, value] of previous) {
        if (value) doc.body.style.setProperty(key, value); else doc.body.style.removeProperty(key);
      }
      if (!doc.body.getAttribute('style')) doc.body.removeAttribute('style');
    },
  };
}

export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, dictionaries), 'pdsh: dictionaries');
  // Host 的固定 patch id；Client Loader entry id 是另一命名空间。
  const form = ctx.configForms.get('pdsh');
  // +--- Bundle 停用未必卸载 Client：显示资源也必须跟随 Host namespace ---+
  ctx.effect(() => ctx.configForms.whileServed(['pdsh'], () => {
    const display = mountDisplay(ctx, form);
    const unregister = [];
    try {
      unregister.push(ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
        name: 'plugins.bundle.config', key: '@daftai/pdsh', locale: NS,
        inject: () => ({ preferencesForm: form, presentation: display.presentation }),
      }, SettingsCard)));
      unregister.push(ctx.slots.inject('plugins.detail.badge', () => ctx.slots.register({
        name: 'plugins.detail.badge', id: 'pdsh-update', locale: NS,
        inject: () => ({ updater: display.updater, version: __PDSH_VERSION__ }),
      }, UpdateBadge)));
    } catch (error) { for (const off of unregister.reverse()) off(); display.dispose(); throw error; }
    return () => { try { for (const off of unregister.reverse()) off(); } finally { display.dispose(); } };
  }), 'pdsh: served display and settings');
}
