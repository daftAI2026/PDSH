/**
 * [INPUT]: 依赖官方 ConfigForm 的已接受值、版本围栏与订阅。
 * [OUTPUT]: 提供单路径标题开关状态/切换/释放，不创建第二份持久化。
 * [POS]: PDSH 帽子入口的操作边界；请求中拒绝重复点击，显示态只认Host接受值。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function mountTitleToggle(form, notify) {
  let busy = false, failed = false, disposed = false;
  const unsubscribe = form.subscribe(() => { if (!disposed) notify(); });
  function state() {
    const snapshot = form.getSnapshot();
    const valid = snapshot.status === 'ready' && typeof snapshot.value?.maskTitles === 'boolean';
    return { pressed: valid && snapshot.value.maskTitles, busy, failed,
      disabled: disposed || busy || !valid || !snapshot.writable };
  }
  return {
    state,
    async activate() {
      if (state().disabled) return;
      const snapshot = form.getSnapshot();
      busy = true; failed = false; notify();
      try {
        failed = !await form.mutate([{ op: 'set', path: ['maskTitles'], value: !snapshot.value.maskTitles }], snapshot.revision);
      } catch { failed = true; }
      finally { busy = false; if (!disposed) notify(); }
    },
    dispose() { disposed = true; unsubscribe(); },
  };
}
