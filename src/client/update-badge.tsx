/**
 * [INPUT]: 依赖稳定/RC 身份、官方 detail.badge、更新控制器与 Host Button/Tooltip/Modal/StateDot。
 * [OUTPUT]: 更新与取消等待显示 Host loading；应用阶段不可取消。取消未知独立告警，确认终态移除 loading。
 * [POS]: 更新交互的独立 detail slot；探测跟随详情挂载，不增设后台轮询或设置卡片。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { BUNDLE_NAME, IS_RC_BUNDLE } from '../shared/components.ts';
import type { UpdateFailureReason } from './updater.ts';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Button, Tooltip, Modal, StateDot } from '@deepseek-ai/dsh-client-ui-primitives';

const PACKAGE = BUNDLE_NAME;
const FAILURE_MESSAGES: Record<UpdateFailureReason, string> = {
  timeout: 'update.installTimeout', network: 'update.installNetworkFailed',
  integrity: 'update.installIntegrityFailed', 'disk-full': 'update.installDiskFull',
  permission: 'update.installPermissionFailed', 'pnpm-missing': 'update.installManagerMissing',
  'build-blocked': 'update.installBuildBlocked', 'not-found': 'update.installNotFound',
  'no-matching-version': 'update.installVersionMissing',
};

export function UpdateBadge({ subject, updater, version, t }) {
  const update = useSyncExternalStore(fn => updater.subscribe(fn), () => updater.getSnapshot());
  const [expanded, setExpanded] = useState(false);
  const [restartPromptOpen, setRestartPromptOpen] = useState(false);
  const ownBundle = !IS_RC_BUNDLE && subject.kind === 'bundle' && subject.pkg.name === PACKAGE
    && subject.pkg.installed;
  const runningBundle = ownBundle && subject.pkg.version === version;

  useEffect(() => {
    const current = updater.getSnapshot();
    if (runningBundle && !(current.phase === 'failed' && current.operation === 'install')) void updater.check();
  }, [runningBundle, updater]);
  useEffect(() => {
    setRestartPromptOpen(update.phase === 'restart');
  }, [update.phase, update.version]);

  const pending = ['installing', 'cancelling', 'applying'].includes(update.phase);
  const inProgress = pending || ['installed', 'restart', 'cancelled'].includes(update.phase);
  const failedInstall = update.phase === 'failed' && update.operation === 'install';
  const retainedInstallFailure = failedInstall && ownBundle && !runningBundle && subject.pkg.version === update.version;
  if (!ownBundle || (!runningBundle && !inProgress && !retainedInstallFailure) || (update.phase !== 'available' && !inProgress && !failedInstall)) return null;

  return <span className="pdsh-update-badge" data-pdsh-update-badge>
    {update.phase === 'available' && <Tooltip label={t('update.available')} side="bottom" delayMs={500} focusDelayMs={0} portal><Button variant="ghost" size="sm" className="pdsh-update-trigger"
      data-pdsh-update-trigger aria-label={t('update.available')}
      aria-expanded={expanded}
      onClick={() => setExpanded(value => !value)}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/><path d="m16 12-4-4-4 4"/><path d="M12 16V8"/>
      </svg>
    </Button></Tooltip>}
    {(expanded || inProgress || failedInstall) && <span className="pdsh-update-confirm" data-pdsh-update-confirm role="group" aria-label={t('updateTitle')}>
      {update.phase === 'available' && <>
        <span>v{update.version} · {t('installSourceHint')}</span>
        <Button size="sm" data-pdsh-update-install onClick={() => void updater.install()}>{t('installUpdate')}</Button>
        <Button size="sm" variant="ghost" onClick={() => setExpanded(false)}>{t('update.cancel')}</Button>
      </>}
      {inProgress && <span role="status" className="pdsh-update-status" aria-busy={pending || undefined}>
        {pending && <StateDot state="ongoing" />}
        <span>{t(update.phase === 'installing' && update.attempt === 2 ? 'update.retrying' : `update.${update.phase}`)}{['installed', 'restart'].includes(update.phase) ? ` ${update.version}` : ''}</span>
      </span>}
      {update.phase === 'installing' && update.canCancel && <Button size="sm" variant="ghost" data-pdsh-update-cancel onClick={() => void updater.cancel()}>{t('update.cancel')}</Button>}
      {update.cancelUnconfirmed && <span role="alert" className="pdsh-error">{t('update.cancelUnconfirmed')}</span>}
      {update.phase === 'cancelled' && runningBundle && <Button size="sm" variant="ghost" data-pdsh-update-recheck onClick={() => void updater.check()}>{t('update.retry')}</Button>}
      {failedInstall && <>
        <span role="alert" className="pdsh-error">{t(update.reason === 'timeout' && update.attempt === 2 ? 'update.installRetryTimeout' : FAILURE_MESSAGES[update.reason] ?? 'update.installFailed')}</span>
        {runningBundle && <Button size="sm" variant="ghost" onClick={() => void updater.check()}>{t('update.retry')}</Button>}
      </>}
    </span>}
    <Modal open={restartPromptOpen && update.phase === 'restart'} onClose={() => setRestartPromptOpen(false)}
      title={t('update.restartTitle')} closeLabel={t('update.later')} description={t('update.restartDescription')}
      footer={<Button variant="outline" data-modal-autofocus onClick={() => setRestartPromptOpen(false)}>{t('update.later')}</Button>} />
  </span>;
}
