/**
 * [INPUT]: 依赖官方 remote.pluginManager 的 {ok,value} 调用封套与经校验的 GitHub tag 数据。
 * [OUTPUT]: 提供只由用户触发检查、确认安装和可订阅状态的更新控制器。
 * [POS]: Client 更新决策层；固定提交安装、保留配置，不自行重启或推断安装来源。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export interface ReleaseTag { name: string; commit: { sha: string } }
interface Bundle { name: string; version: string; installed: boolean; enabled: boolean }
type RemoteReply<T> = { ok: true; value: T } | { ok: false; error?: { message?: string } };
interface Manager {
  listBundles(): Promise<RemoteReply<Bundle[]>>;
  installBundle(spec: string, options: { enabled: boolean }): Promise<RemoteReply<{ changed: boolean; application?: string }>>;
}
type Phase = 'idle' | 'checking' | 'current' | 'available' | 'installing' | 'installed' | 'restart' | 'failed';
export interface UpdateState { phase: Phase; version?: string; operation?: 'check' | 'install' }
const PACKAGE = '@daftai/pdsh';
const REPOSITORY = 'github:daftAI2026/PDSH#';

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

export function createUpdateController(manager: Manager, loadTags: () => Promise<ReleaseTag[]>, version: string) {
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
      try {
        if (!await ownBundle()) throw new Error('installed bundle changed');
        const reply = await manager.installBundle(`${REPOSITORY}${target.sha}`, { enabled: true });
        if (!reply.ok || !reply.value?.changed || !['restart-required', 'applied'].includes(reply.value.application ?? '')) throw new Error('installation not accepted');
        candidate = null;
        setState({ phase: reply.value.application === 'applied' ? 'installed' : 'restart', version: target.version });
      } catch { setState({ phase: 'failed', operation: 'install' }); }
      finally { busy = false; }
    },
    dispose() { disposed = true; candidate = null; listeners.clear(); },
  };
}
