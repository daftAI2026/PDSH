/**
 * [INPUT]: 依赖 shared 包身份与官方 plugins.detail.badge 的 Bundle subject、更新控制器、宿主 Button/Tooltip 与实时原生图标样式探针。
 * [OUTPUT]: 仅自身有稳定新版本时显示版本旁细线绿色上箭头；展开来源提示后才允许确认安装。
 * [POS]: 更新交互的独立 detail slot；探测跟随详情挂载，不增设后台轮询或设置卡片。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { BUNDLE_NAME, IS_RC_BUNDLE } from '../shared/components.ts';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Button, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';

const PACKAGE = BUNDLE_NAME;

export function UpdateBadge({ subject, updater, version, t }) {
  const update = useSyncExternalStore(fn => updater.subscribe(fn), () => updater.getSnapshot());
  const [expanded, setExpanded] = useState(false);
  const ownBundle = !IS_RC_BUNDLE && subject.kind === 'bundle' && subject.pkg.name === PACKAGE
    && subject.pkg.installed && subject.pkg.version === version;

  useEffect(() => {
    if (ownBundle) void updater.check();
  }, [ownBundle, updater]);

  const inProgress = ['installing', 'installed', 'restart'].includes(update.phase);
  const installFailed = expanded && update.phase === 'failed' && update.operation === 'install';
  if (!ownBundle || (update.phase !== 'available' && !inProgress && !installFailed)) return null;

  return <span className="pdsh-update-badge" data-pdsh-update-badge>
    {update.phase === 'available' && <Tooltip label={`${t('update.available')} v${update.version}`} side="bottom" delayMs={500} focusDelayMs={0} portal><Button variant="ghost" size="sm" className="pdsh-update-trigger"
      data-pdsh-update-trigger aria-label={`${t('update.available')} v${update.version}`}
      aria-expanded={expanded}
      onClick={() => setExpanded(value => !value)}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/>
      </svg>
    </Button></Tooltip>}
    {(expanded || inProgress) && <span className="pdsh-update-confirm" data-pdsh-update-confirm role="group" aria-label={t('updateTitle')}>
      {update.phase === 'available' && <>
        <span>v{update.version} · {t('installSourceHint')}</span>
        <Button size="sm" data-pdsh-update-install onClick={() => void updater.install()}>{t('installUpdate')}</Button>
        <Button size="sm" variant="ghost" onClick={() => setExpanded(false)}>{t('update.cancel')}</Button>
      </>}
      {['installing', 'installed', 'restart'].includes(update.phase) && <span role="status">{t(`update.${update.phase}`)} {update.version}</span>}
      {update.phase === 'failed' && <>
        <span role="alert" className="pdsh-error">{t('update.installFailed')}</span>
        <Button size="sm" variant="ghost" onClick={() => void updater.check()}>{t('update.retry')}</Button>
      </>}
    </span>}
  </span>;
}
