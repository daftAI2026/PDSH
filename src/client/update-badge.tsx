/**
 * [INPUT]: 依赖官方 plugins.detail.badge 的 Bundle subject、更新控制器、宿主 Button/Tooltip/Modal 与实时原生图标样式探针。
 * [OUTPUT]: 仅当前 Client 匹配自身 Bundle 时探测；清单前移仍显示当前控制器的安装/重启/失败结果，已知安装失败与未知结果分开呈现，失败重试仅对运行版本开放，不承诺跨 Fiber 恢复。
 * [POS]: 更新交互的独立 detail slot；探测跟随详情挂载，不增设后台轮询或设置卡片。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { UpdateFailureReason } from './updater.ts';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Button, Tooltip, Modal } from '@deepseek-ai/dsh-client-ui-primitives';

const PACKAGE = '@daftai/pdsh';
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
  const ownBundle = subject.kind === 'bundle' && subject.pkg.name === PACKAGE
    && subject.pkg.installed;
  const runningBundle = ownBundle && subject.pkg.version === version;

  useEffect(() => {
    const current = updater.getSnapshot();
    if (runningBundle && !(current.phase === 'failed' && current.operation === 'install')) void updater.check();
  }, [runningBundle, updater]);
  useEffect(() => {
    setRestartPromptOpen(update.phase === 'restart');
  }, [update.phase, update.version]);

  const inProgress = ['installing', 'installed', 'restart'].includes(update.phase);
  const failedInstall = update.phase === 'failed' && update.operation === 'install';
  const retainedInstallFailure = failedInstall && ownBundle && !runningBundle && subject.pkg.version === update.version;
  if (!ownBundle || (!runningBundle && !inProgress && !retainedInstallFailure) || (update.phase !== 'available' && !inProgress && !failedInstall)) return null;

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
    {(expanded || inProgress || failedInstall) && <span className="pdsh-update-confirm" data-pdsh-update-confirm role="group" aria-label={t('updateTitle')}>
      {update.phase === 'available' && <>
        <span>v{update.version} · {t('installSourceHint')}</span>
        <Button size="sm" data-pdsh-update-install onClick={() => void updater.install()}>{t('installUpdate')}</Button>
        <Button size="sm" variant="ghost" onClick={() => setExpanded(false)}>{t('update.cancel')}</Button>
      </>}
      {['installing', 'installed', 'restart'].includes(update.phase) && <span role="status">{t(update.phase === 'installing' && update.attempt === 2 ? 'update.retrying' : `update.${update.phase}`)} {update.version}</span>}
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
