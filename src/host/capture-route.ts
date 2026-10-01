/**
 * [INPUT]: 依赖官方 exact Fetch 路由的认证/安装围栏、组件活跃围栏、固定阶段诊断与独立连接 opener。
 * [OUTPUT]: 提供 createCaptureRoute；owner 世代绑定 capture/save/cancel/release，确认关闭才允许重建；Main 关闭未知隔离态不随页面 owner 清除，停用 abort 并释放仅自有连接。
 * [POS]: Host 控制面边界；HTTP 只传 UUID 与成功/失败，像素、路径与执行代码不进入请求响应。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { CAPTURE_ROUTE, CAPTURE_ENDPOINT, MAX_CONTROL_BYTES, isCaptureId } from '../shared/capture-bridge.ts';
import { createCaptureTrace } from '../shared/capture-trace.ts';
export function createCaptureRoute(consented: () => boolean, open, logger, guard = { error: null }) {
  const trace = createCaptureTrace(logger, 'host');
  let disposed = false, current = null, retiring: Promise<void> = Promise.resolve();
  const warn = message => { try { logger?.warn?.(message); } catch {} };
  function isolate(error) {
    if (error?.message === 'PDSH_MAIN_INSPECTOR_CLOSE_UNCONFIRMED') {
      guard.error = error;
      warn('PDSH Main inspector close is unconfirmed. Preserve work and restart DSH before capture resumes.');
    } else if (!guard.error) {
      guard.error = Object.assign(new Error('PDSH control close unconfirmed'), { code: 'control-cleanup-unconfirmed' });
      warn('PDSH capture control release is unconfirmed. Automatic reconnect is paused.');
    }
  }
  async function retire(session) {
    session.abort.abort();
    let connection;
    try { connection = await session.work; }
    catch (error) { if (error?.message === 'PDSH_MAIN_INSPECTOR_CLOSE_UNCONFIRMED') isolate(error); return; }
    try { await connection.dispose(); } catch (error) { isolate(error); }
  }
  function sessionFor(owner, requestId) {
    if (guard.error) throw guard.error;
    if (current?.owner === owner) return current;
    if (current) retiring = retire(current);
    const abort = new AbortController(), previous = retiring;
    const session = { owner, abort, work: previous.then(() => {
      if (guard.error) throw guard.error;
      if (disposed || abort.signal.aborted || !consented()) throw new Error('capture disabled');
      return open(abort.signal, requestId);
    }) };
    current = session;
    // 独立观察启动失败，错误文案不包含内部表达式、秘密或像素。
    void session.work.catch(error => {
      if (error?.message === 'PDSH_MAIN_INSPECTOR_CLOSE_UNCONFIRMED') isolate(error);
      else if (current === session) current = null;
    });
    return session;
  }
  async function command(payload) {
    if (disposed || !payload || !isCaptureId(payload.owner)) throw new Error('invalid capture owner');
    const { op, owner, requestId } = payload;
    if (op === 'release') {
      if (current?.owner === owner) { const own = current; current = null; retiring = retire(own); await retiring; }
      return;
    }
    if (!isCaptureId(requestId) || !['capture', 'save', 'cancel'].includes(op)) throw new Error('invalid capture command');
    if (op === 'cancel') {
      const own = current?.owner === owner ? current : null;
      if (own) { const connection = await own.work; if (!own.abort.signal.aborted) connection.cancel(requestId); }
      return;
    }
    if (!consented()) throw new Error('capture consent required');
    trace('request-received', requestId);
    const own = sessionFor(owner, requestId), connection = await own.work;
    if (disposed || own.abort.signal.aborted || !consented() || current !== own) throw new Error('capture disabled');
    let saved;
    try { trace('native-requested', requestId); saved = await (op === 'save' ? connection.save(requestId, owner) : connection.capture(requestId, owner)); trace('native-ready', requestId); }
    catch (error) {
      trace('native-failed', requestId);
      // +--- 断连不缓存 dead socket；只归还仍自有的世代，下次点击再启动 ---+
      if (current === own) { current = null; retiring = retire(own); void retiring.catch(() => {}); }
      throw error;
    }
    if (disposed || own.abort.signal.aborted || !consented() || current !== own) throw new Error('capture disabled');
    if (op === 'save') { if (!['saved', 'cancelled'].includes(saved?.outcome)) throw new Error('save unavailable'); return { outcome: saved.outcome }; }
  }
  return { refreshConsent() {
    if (!consented() && current) { const own = current; current = null; retiring = retire(own); void retiring.catch(() => {}); }
  }, route: { path: CAPTURE_ROUTE, methods: ['POST'], requestBody: 'buffered',
    async fetch(request: Request) {
      let envelope;
      try {
        const text = await request.text(); if (Buffer.byteLength(text) > MAX_CONTROL_BYTES) throw new Error('oversize command');
        envelope = JSON.parse(text);
        if (envelope.type !== 'client-request' || typeof envelope.rpcId !== 'string' || envelope.rpcId.length > 128 || envelope.method !== CAPTURE_ENDPOINT) throw new Error('invalid envelope');
      } catch { return new Response('invalid capture command', { status: 400 }); }
      let result;
      try { const value = await command(envelope.payload); result = { ok: true, value: { protocolVersion: 1, ...value } }; }
      catch (error) { result = { ok: false, error: { code: error?.message === 'PDSH_MAIN_INSPECTOR_CLOSE_UNCONFIRMED' ? 'pdsh/inspector-cleanup-unconfirmed' : error?.code === 'bridge-port-busy' ? 'pdsh/inspector-port-busy' : error?.code === 'control-cleanup-unconfirmed' ? 'pdsh/control-cleanup-unconfirmed' : 'pdsh/capture-unavailable', message: 'Current-page capture unavailable', details: {} } }; }
      return Response.json({ type: 'server-response', rpcId: envelope.rpcId, result });
    },
  }, async dispose() { if (disposed) return; disposed = true; if (current) { const own = current; current = null; retiring = retire(own); } await retiring; trace('cleanup-finished'); } };
}
