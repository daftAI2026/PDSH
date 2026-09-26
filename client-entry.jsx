/**
 * [INPUT]: 依赖宿主 slots/locale/configForms、共享 React/primitives 与展示控制器。
 * [OUTPUT]: 提供浏览器插件 apply/inject，设置页、样式探针及可卸载显示增强。
 * [POS]: PDSH Client 装配层；设置/显示资源共同跟随 Host 服务，DOM adapter 仅处理身份视觉。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React, { useLayoutEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Input } from '@deepseek-ai/dsh-client-ui-primitives';
import { mountPresentation } from './presentation.js';
import { SettingsCard } from './settings-card.jsx';
import { resolvePreferences } from './model.js';
import css from './styles.css';

export const inject = ['slots', 'locale', 'configForms'];
const NS = 'pdsh';
const dictionaries = {
  zh: {
    title: 'PDSH 显示设置', description: '给每条用户/助手消息加灰框，并可替换侧栏昵称和头像。仅改变本地显示：不隔离、不删除历史，也不修改真实账户。',
    frames: '对话灰框', maskIdentity: '替换侧栏显示身份', nickname: '显示昵称', avatar: '选择本地头像',
    avatarHint: '默认按昵称离线生成头像。也可选 PNG / JPEG / WebP；不会上传图片或请求头像服务。',
    generated: '恢复生成头像', preview: '显示头像预览', save: '保存', saving: '保存中…', discard: '放弃修改',
    loading: '正在读取插件设置…', readOnly: '当前设置只读。', saveFailed: '保存失败或设置已被其他编辑更新；草稿保留，请重新读取后重试。',
    avatarFailed: '头像格式、内容或大小不合法，请选择较小的 PNG / JPEG / WebP 图片。', invalid: '昵称不能空白、过长或包含控制字符；头像必须是本地光栅图片。',
    'status.disabled': '显示身份替换未启用。', 'status.masked': '当前侧栏身份已替换显示。',
    'status.signed-out': '当前未登录，保留原生“更多”入口；登录后才替换显示身份。',
    'status.unsupported': '未识别唯一的原生侧栏身份，本次不替换。',
  },
  en: {
    title: 'PDSH display settings', description: 'Outline user/assistant messages and optionally replace the sidebar nickname and avatar. Local display only: no isolation, history deletion or account changes.',
    frames: 'Message outlines', maskIdentity: 'Replace sidebar display identity', nickname: 'Display nickname', avatar: 'Choose a local avatar',
    avatarHint: 'An offline avatar is generated from the nickname. Or choose PNG / JPEG / WebP. No uploads or avatar-service requests.',
    generated: 'Use generated avatar', preview: 'Display avatar preview', save: 'Save', saving: 'Saving…', discard: 'Discard changes',
    loading: 'Loading plugin settings…', readOnly: 'Settings are read-only.', saveFailed: 'Save failed or another editor changed the revision. Draft retained; reload before retrying.',
    avatarFailed: 'Invalid or oversized avatar. Choose a smaller PNG / JPEG / WebP image.', invalid: 'Nickname must be non-empty, bounded and control-free. Avatar must be a local raster image.',
    'status.disabled': 'Display identity replacement is disabled.', 'status.masked': 'Sidebar identity display is replaced.',
    'status.signed-out': 'Signed out: the native More control stays unchanged. Identity replacement applies after sign-in.',
    'status.unsupported': 'No unique native sidebar identity recognized; replacement skipped.',
  },
};

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
  }, [doc]);
  return <span ref={ref}><Input tabIndex={-1} aria-hidden="true" /></span>;
}

function mountDisplay(ctx, form) {
  const doc = document;
  const style = doc.createElement('style'); style.dataset.plugin = '@daftai/pdsh'; style.textContent = css; doc.head.append(style);
  const probe = doc.createElement('div'); probe.hidden = true; probe.setAttribute('data-pdsh-probe', ''); doc.body.append(probe);
  const root = createRoot(probe);
  const properties = ['--pdsh-outline-width', '--pdsh-control-size'];
  const previous = properties.map(key => [key, doc.body.style.getPropertyValue(key)]);
  root.render(<NativeStyleProbe doc={doc} />);
  const presentation = mountPresentation(doc);
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
      unsubscribe(); presentation.dispose(); root.unmount(); probe.remove(); style.remove();
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
