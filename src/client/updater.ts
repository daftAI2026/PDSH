/**
 * [INPUT]: 依赖官方 Manager 回包、requestId 取消、install-state 事件及固定 GitHub tag。
 * [OUTPUT]: 提供更新与显式取消状态；确认停止才报取消，应用阶段撤回取消。迟到回包不能覆盖新操作。
 * [POS]: Client Fiber 内的更新决策状态；临时 RC 禁止更新，探测无副作用，固定提交安装需确认，只保留失败原因白名单、仅未安装的预检查超时重试一次且末次失败按实际阶段提示、不自行重启、不重装未知结果、不切设置，也不持久化跨 Fiber 结果。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { BUNDLE_NAME, IS_RC_BUNDLE } from '../shared/components.ts';
export interface ReleaseTag { name: string; commit: { sha: string } }
interface Bundle { name: string; version: string; installed: boolean; enabled: boolean }
type RemoteReply<T> = { ok: true; value: T } | { ok: false; error?: { message?: string } };
interface InstallResult {
  changed: boolean;
  application?: string;
  failedAt?: string;
  packageResult?: { kind?: string };
}
interface Manager {
  listBundles(): Promise<RemoteReply<Bundle[]>>;
  installBundle(spec: string, options: { enabled: boolean; requestId?: string }): Promise<RemoteReply<InstallResult>>;
  cancelInstall?(requestId: string): Promise<RemoteReply<{ status: 'cancelled' | 'not-running' | 'too-late' }>>;
}
type Phase = 'idle' | 'checking' | 'current' | 'available' | 'installing' | 'cancelling' | 'applying' | 'cancelled' | 'installed' | 'restart' | 'failed';
const INSTALL_FAILURE_REASONS = ['network', 'timeout', 'integrity', 'disk-full', 'permission', 'pnpm-missing', 'build-blocked', 'not-found', 'no-matching-version'] as const;
export type UpdateFailureReason = typeof INSTALL_FAILURE_REASONS[number];
export interface UpdateState { phase: Phase; version?: string; operation?: 'check' | 'install'; reason?: UpdateFailureReason; attempt?: 2; canCancel?: boolean; cancelUnconfirmed?: boolean }
interface InstallRequest {
  requestId: string; version: string; sent: boolean; acknowledged: boolean;
  cancelRequested: boolean; cancelCalls: number; cancelPending: boolean;
  waitingForStart: boolean; applying: boolean; attempt?: 2;
}
const PACKAGE = BUNDLE_NAME;
const REPOSITORY = 'github:daftAI2026/PDSH#';

function isUnchangedGitTimeout(reply: RemoteReply<InstallResult>): boolean {
  return reply.ok && reply.value?.changed === false && reply.value.application === 'failed'
    && reply.value.failedAt === 'spec-host' && reply.value.packageResult?.kind === 'timeout';
}

function parts(value: string): number[] | null {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) return null;
  const parsed = value.split('.').map(Number);
  return parsed.every(Number.isSafeInteger) ? parsed : null;
}
function compare(left: number[], right: number[]): number {
  for (let index = 0; index < 3; index++) if (left[index] !== right[index]) return left[index] - right[index];
  return 0;
}
export function selectLatestTag(tags: ReleaseTag[], current: string): { version: string; sha: string } | null {
  const baseline = parts(current);
  if (!baseline || !Array.isArray(tags)) return null;
  let best: { version: string; sha: string; parts: number[] } | null = null;
  for (const tag of tags) {
    const version = /^v(.*)$/.exec(tag?.name)?.[1];
    const parsed = version && parts(version);
    const sha = tag?.commit?.sha;
    if (!parsed || typeof sha !== 'string' || !/^[a-f0-9]{40}$/i.test(sha) || compare(parsed, baseline) <= 0) continue;
    if (!best || compare(parsed, best.parts) > 0) best = { version, sha: sha.toLowerCase(), parts: parsed };
  }
  return best && { version: best.version, sha: best.sha };
}

export function createUpdateController(
  manager: Manager,
  loadTags: () => Promise<ReleaseTag[]>,
  version: string,
  activateInstalled?: (version: string) => Promise<boolean>,
  subscribeInstallState?: (listener: (progress: unknown) => void) => () => void,
) {
  let state: UpdateState = { phase: 'idle' };
  let candidate: { version: string; sha: string } | null = null;
  let disposed = false;
  let busy = false;
  let request: InstallRequest | undefined;
  const cancellationSupported = !IS_RC_BUNDLE && typeof manager.cancelInstall === 'function' && typeof subscribeInstallState === 'function';
  const listeners = new Set<() => void>();
  function setState(next: UpdateState) {
    if (disposed) return;
    state = next;
    for (const notify of listeners) notify();
  }
  async function ownBundle() {
    const reply = await manager.listBundles();
    if (!reply.ok || !Array.isArray(reply.value)) throw new Error('bundle inventory unavailable');
    const bundles = reply.value;
    const matches = bundles.filter(bundle => bundle.name === PACKAGE && bundle.installed);
    return matches.length === 1 && matches[0].version === version ? matches[0] : null;
  }
  const owns = (run: InstallRequest) => !disposed && request === run;
  function pending(run: InstallRequest, phase: 'installing' | 'cancelling' | 'applying', cancelUnconfirmed = false) {
    if (!owns(run)) return;
    setState({ phase, version: run.version, ...(run.attempt ? { attempt: run.attempt } : {}),
      ...(cancellationSupported && phase === 'installing' && !run.cancelRequested ? { canCancel: true } : {}),
      ...(cancelUnconfirmed ? { cancelUnconfirmed: true } : {}) });
  }
  function finish(run: InstallRequest, next: UpdateState) {
    if (!owns(run)) return;
    request = undefined; busy = false;
    setState(next);
  }
  // +--- not-running 不证明停止；仅匹配的首次 installing 确认允许补发一次 ---+
  async function sendCancellation(run: InstallRequest): Promise<void> {
    if (!owns(run) || run.cancelPending || run.applying || run.cancelCalls >= 2) return;
    const acknowledgedBeforeCall = run.acknowledged;
    run.cancelPending = true; run.waitingForStart = false; ++run.cancelCalls;
    try {
      const reply = await manager.cancelInstall!(run.requestId);
      if (!owns(run)) return;
      if (!reply.ok) { pending(run, run.applying ? 'applying' : 'installing', !run.applying); return; }
      if (reply.value.status === 'cancelled') {
        finish(run, { phase: 'cancelled', version: run.version });
      } else if (reply.value.status === 'too-late' || run.applying) {
        run.applying = true; pending(run, 'applying');
      } else if (reply.value.status === 'not-running' && run.cancelCalls === 1 && !acknowledgedBeforeCall) {
        run.waitingForStart = true;
      } else pending(run, 'installing', true);
    } catch { if (owns(run)) pending(run, run.applying ? 'applying' : 'installing', !run.applying); }
    finally {
      run.cancelPending = false;
      if (owns(run) && run.waitingForStart && run.acknowledged && !run.applying) void sendCancellation(run);
    }
  }
  function installProgress(progress: unknown) {
    if (!request || !progress || typeof progress !== 'object') return;
    const event = progress as { requestId?: unknown; phase?: unknown };
    const run = request;
    if (!owns(run) || event.requestId !== run.requestId) return;
    if (event.phase === 'applying') {
      run.acknowledged = true; run.applying = true; run.waitingForStart = false;
      pending(run, 'applying');
    } else if (event.phase === 'installing') {
      run.acknowledged = true;
      if (run.waitingForStart && !run.applying) void sendCancellation(run);
    }
  }
  const offInstallState = cancellationSupported ? subscribeInstallState!(installProgress) : undefined;
  return {
    getSnapshot: () => state,
    subscribe(notify: () => void) { listeners.add(notify); return () => listeners.delete(notify); },
    installProgress,
    async cancel() {
      const run = request;
      if (!cancellationSupported || !run || !owns(run) || run.cancelRequested || run.applying) return;
      run.cancelRequested = true; pending(run, 'cancelling');
      if (run.sent) await sendCancellation(run);
      else finish(run, { phase: 'cancelled', version: run.version });
    },
    async check() {
      if (IS_RC_BUNDLE || disposed || busy || state.phase === 'restart' || state.phase === 'installed') return;
      busy = true; candidate = null; setState({ phase: 'checking' });
      try {
        if (!await ownBundle()) throw new Error('installed bundle differs from running code');
        const next = selectLatestTag(await loadTags(), version);
        if (disposed) return;
        candidate = next;
        setState(next ? { phase: 'available', version: next.version } : { phase: 'current' });
      } catch { setState({ phase: 'failed', operation: 'check' }); }
      finally { busy = false; }
    },
    async install() {
      if (IS_RC_BUNDLE || disposed || busy || state.phase !== 'available' || !candidate) return;
      busy = true;
      const target = candidate;
      const run: InstallRequest = { requestId: cancellationSupported ? crypto.randomUUID() : '', version: target.version,
        sent: false, acknowledged: false, cancelRequested: false, cancelCalls: 0, cancelPending: false, waitingForStart: false, applying: false };
      request = run;
      pending(run, 'installing');
      let failureReason: UpdateState['reason'];
      let retryAttempt: 2 | undefined;
      let finalGitTimeout = false;
      try {
        if (!owns(run)) return;
        if (!await ownBundle()) throw new Error('installed bundle changed');
        if (!owns(run)) return;
        if (run.cancelRequested) { finish(run, { phase: 'cancelled', version: target.version }); return; }
        const spec = `${REPOSITORY}${target.sha}`;
        const install = async () => {
          run.sent = true;
          try { return await manager.installBundle(spec, { enabled: true, ...(cancellationSupported ? { requestId: run.requestId } : {}) }); }
          finally { run.sent = false; }
        };
        let reply = await install();
        if (!owns(run)) return;
        // +--- 只有 PNPM 之前明确未安装的 Git 预检查超时允许第二次尝试 ---+
        if (!run.cancelRequested && isUnchangedGitTimeout(reply)) {
          if (!await ownBundle()) throw new Error('installed bundle changed before retry');
          if (!owns(run)) return;
          if (run.cancelRequested) { finish(run, { phase: 'cancelled', version: target.version }); return; }
          retryAttempt = 2;
          run.requestId = cancellationSupported ? crypto.randomUUID() : '';
          run.sent = false; run.acknowledged = false; run.attempt = 2;
          pending(run, 'installing');
          if (!owns(run)) return;
          if (run.cancelRequested) { finish(run, { phase: 'cancelled', version: target.version }); return; }
          reply = await install();
          if (!owns(run)) return;
        }
        if (reply.ok && reply.value?.application === 'cancelled') {
          finish(run, { phase: 'cancelled', version: target.version }); return;
        }
        // +--- 官方明确未改变安装状态时才使用已知原因；异常/磁盘前移仍是未知结果 ---+
        finalGitTimeout = isUnchangedGitTimeout(reply);
        if (reply.ok && reply.value?.application === 'failed' && reply.value.changed === false) {
          const kind = reply.value.packageResult?.kind;
          if ((INSTALL_FAILURE_REASONS as readonly unknown[]).includes(kind)) failureReason = kind as UpdateFailureReason;
        }
        if (!reply.ok || !reply.value?.changed || !['restart-required', 'applied'].includes(reply.value.application ?? '')) throw new Error('installation not accepted');
        candidate = null;
        if (!owns(run)) return;
        let active = reply.value.application === 'applied';
        if (!active && activateInstalled) {
          try { active = await activateInstalled(target.version) === true; }
          catch { /* 安装已被官方接受；无法确认运行实现时仍要求重启。 */ }
        }
        finish(run, { phase: active ? 'installed' : 'restart', version: target.version });
      } catch { finish(run, { phase: 'failed', operation: 'install', version: target.version, ...(failureReason ? { reason: failureReason } : {}), ...(retryAttempt && finalGitTimeout ? { attempt: retryAttempt } : {}) }); }
      finally { if (request === run) { request = undefined; busy = false; } }
    },
    dispose() { if (disposed) return; disposed = true; candidate = null; request = undefined; offInstallState?.(); listeners.clear(); },
  };
}
