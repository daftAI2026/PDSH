/**
 * [INPUT]: 依赖独立标题 ConfigForm、title-toggle 控制器和 Host Switch/Tooltip。
 * [OUTPUT]: 提供 TitleSettingsCard，即时保存与失败反馈只消费该组件的 namespace。
 * [POS]: 标题组件设置边界；身份停用不影响读写，拍照临时遮挡不改这个开关。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React, { useSyncExternalStore } from 'react';
import { Switch, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';
export function TitleSettingsCard({ form, control, subscribe, snapshot, t, view }) {
  const accepted = useSyncExternalStore(fn => form.subscribe(fn), () => form.getSnapshot());
  useSyncExternalStore(subscribe, snapshot);
  if (view === 'summary') return t('titlesHint');
  const state = control.state();
  return <section className="pdsh-settings"><section className="pdsh-group">
    <div className="pdsh-row pdsh-group-header" aria-busy={state.busy || undefined}><h4>{t('maskTitles')}</h4>
      <Tooltip label={t('titlesHint')} side="bottom" delayMs={500} focusDelayMs={0} portal><span className="pdsh-switch-tooltip"><Switch checked={state.pressed} disabled={state.disabled} label={t('maskTitles')} onChange={() => void control.activate()} /></span></Tooltip>
    </div>
    {accepted.status !== 'ready' && <p role="status">{t(accepted.status === 'loading' ? 'loading' : 'unavailable')}</p>}
    {state.failed && <p className="pdsh-error" role="alert">{t('toggleFailed')}</p>}
  </section></section>;
}
