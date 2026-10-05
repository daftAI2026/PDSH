/**
 * [INPUT]: 依赖官方 remote.pluginManager 的 {ok,value} 调用封套、经校验的 GitHub tag 数据、官方 Git 安装与可选实现版本确认回调。
 * [OUTPUT]: 提供详情挂载自动探测、用户确认安装和可订阅状态；restart-required 仅在回调确认目标实现已加载时标记 installed，否则保留 restart。
 * [POS]: Client Fiber 内的更新决策状态；探测无副作用，固定提交安装需确认，只保留失败原因白名单、仅未安装的预检查超时重试一次且末次失败按实际阶段提示、不自行重启、不重装未知结果、不切设置，也不持久化跨 Fiber 结果。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
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
  installBundle(spec: string, options: { enabled: boolean }): Promise<RemoteReply<InstallResult>>;
}
type Phase = 'idle' | 'checking' | 'current' | 'available' | 'installing' | 'installed' | 'restart' | 'failed';
const INSTALL_FAILURE_REASONS = ['network', 'timeout', 'integrity', 'disk-full', 'permission', 'pnpm-missing', 'build-blocked', 'not-found', 'no-matching-version'] as const;
export type UpdateFailureReason = typeof INSTALL_FAILURE_REASONS[number];
export interface UpdateState { phase: Phase; version?: string; operation?: 'check' | 'install'; reason?: UpdateFailureReason; attempt?: 2 }
const PACKAGE = '@daftai/pdsh';
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
) {
  let state: UpdateState = { phase: 'idle' };
  let candidate: { version: string; sha: string } | null = null;
  let disposed = false;
  let busy = false;
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
  return {
    getSnapshot: () => state,
    subscribe(notify: () => void) { listeners.add(notify); return () => listeners.delete(notify); },
    async check() {
      if (disposed || busy || state.phase === 'restart' || state.phase === 'installed') return;
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
      if (disposed || busy || state.phase !== 'available' || !candidate) return;
      busy = true;
      const target = candidate;
      setState({ phase: 'installing', version: target.version });
      let failureReason: UpdateState['reason'];
      let retryAttempt: 2 | undefined;
      let finalGitTimeout = false;
      try {
        if (!await ownBundle()) throw new Error('installed bundle changed');
        if (disposed) return;
        const spec = `${REPOSITORY}${target.sha}`;
        let reply = await manager.installBundle(spec, { enabled: true });
        // +--- 只有 PNPM 之前明确未安装的 Git 预检查超时允许第二次尝试 ---+
        if (!disposed && isUnchangedGitTimeout(reply)) {
          if (!await ownBundle()) throw new Error('installed bundle changed before retry');
          if (disposed) return;
          retryAttempt = 2;
          setState({ phase: 'installing', version: target.version, attempt: 2 });
          if (disposed) return;
          reply = await manager.installBundle(spec, { enabled: true });
        }
        // +--- 官方明确未改变安装状态时才使用已知原因；异常/磁盘前移仍是未知结果 ---+
        finalGitTimeout = isUnchangedGitTimeout(reply);
        if (reply.ok && reply.value?.application === 'failed' && reply.value.changed === false) {
          const kind = reply.value.packageResult?.kind;
          if ((INSTALL_FAILURE_REASONS as readonly unknown[]).includes(kind)) failureReason = kind as UpdateFailureReason;
        }
        if (!reply.ok || !reply.value?.changed || !['restart-required', 'applied'].includes(reply.value.application ?? '')) throw new Error('installation not accepted');
        candidate = null;
        if (disposed) return;
        let active = reply.value.application === 'applied';
        if (!active && activateInstalled) {
          try { active = await activateInstalled(target.version) === true; }
          catch { /* 安装已被官方接受；无法确认运行实现时仍要求重启。 */ }
        }
        setState({ phase: active ? 'installed' : 'restart', version: target.version });
      } catch { setState({ phase: 'failed', operation: 'install', version: target.version, ...(failureReason ? { reason: failureReason } : {}), ...(retryAttempt && finalGitTimeout ? { attempt: retryAttempt } : {}) }); }
      finally { busy = false; }
    },
    dispose() { disposed = true; candidate = null; listeners.clear(); },
  };
}
