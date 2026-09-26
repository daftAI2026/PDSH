/**
 * [INPUT]: 依赖宿主 slots/locale/configForms/pluginNavigation、共享 React/primitives 的控件几何与展示/入口适配器。
 * [OUTPUT]: 提供浏览器 apply/inject，设置页、样式探针、搜索邻接入口及可卸载显示增强。
 * [POS]: PDSH Client 装配层；设置/显示/入口共同跟随 Host 服务，搜索适配与身份控制器独立。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React, { useLayoutEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Input, Button, SettingsValueField } from '@deepseek-ai/dsh-client-ui-primitives';
import { mountPresentation } from './presentation.js';
import { mountSearchEntry } from './search-entry.js';
import entryIcon from './entry-icon.svg';
import { SettingsCard } from './settings-card.jsx';
import { resolvePreferences } from './model.js';
import css from './styles.css';
import { NS, dictionaries } from './locales.js';

export const inject = ['slots', 'locale', 'configForms', 'pluginNavigation'];

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
    const field = ref.current.querySelector('[data-pdsh-field-probe]')?.firstElementChild;
    if (field) {
      const fieldStyle = doc.defaultView.getComputedStyle(field);
      const headStyle = doc.defaultView.getComputedStyle(field.firstElementChild);
      for (const [key, value] of [['--pdsh-section-inset', fieldStyle.paddingTop], ['--pdsh-field-gap', fieldStyle.gap], ['--pdsh-action-gap', headStyle.gap]]) {
        if (Number.parseFloat(value) > 0) doc.body.style.setProperty(key, value);
      }
    }
  }, [doc]);
  return <span ref={ref}><Input tabIndex={-1} aria-hidden="true" /><Button data-pdsh-button-probe tabIndex={-1} aria-hidden="true" /><span data-pdsh-field-probe>
    <SettingsValueField id="pdsh-layout-probe" label="" text="" overridden={false} invalid={false} overriddenLabel="" resetLabel="" invalidLabel="" disabled onEdit={() => {}} onReset={() => {}} />
  </span></span>;
}

function mountDisplay(ctx, form) {
  const doc = document;
  const style = doc.createElement('style'); style.dataset.plugin = '@daftai/pdsh'; style.textContent = css; doc.head.append(style);
  const probe = doc.createElement('div'); probe.hidden = true; probe.setAttribute('data-pdsh-probe', ''); doc.body.append(probe);
  const root = createRoot(probe);
  const properties = ['--pdsh-outline-width', '--pdsh-control-size', '--pdsh-action-size', '--pdsh-section-inset', '--pdsh-field-gap', '--pdsh-action-gap'];
  const previous = properties.map(key => [key, doc.body.style.getPropertyValue(key)]);
  root.render(<NativeStyleProbe doc={doc} />);
  const presentation = mountPresentation(doc);
  const t = ctx.locale.bind(NS);
  const entry = mountSearchEntry(doc, {
    icon: entryIcon, label: () => t('entry'),
    open: () => ctx.pluginNavigation.openBundle('@daftai/pdsh'),
  });
  const unbindLocale = ctx.locale.subscribe(entry.refresh);
  function synchronize() {
    const snapshot = form.getSnapshot();
    try {
      presentation.update(resolvePreferences(snapshot.status === 'ready' ? snapshot.value : { frames: false, maskIdentity: false }));
    } catch {
      presentation.update(resolvePreferences({ frames: false, maskIdentity: false }));
      ctx.logger.warn('PDSH display configuration rejected; presentation disabled.');
    }
  }
  synchronize();
  const unsubscribe = form.subscribe(synchronize);
  return {
    presentation,
    dispose() {
      unsubscribe(); unbindLocale(); entry.dispose(); presentation.dispose(); root.unmount(); probe.remove(); style.remove();
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
    let unregister;
    try {
      unregister = ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
        name: 'plugins.bundle.config', key: '@daftai/pdsh', locale: NS,
        inject: () => ({ preferencesForm: form, presentation: display.presentation }),
      }, SettingsCard));
    } catch (error) { display.dispose(); throw error; }
    return () => { try { unregister(); } finally { display.dispose(); } };
  }), 'pdsh: served display and settings');
}
