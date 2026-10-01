/**
 * [INPUT]: 依赖已确认 Main PID、仅本次 bootstrap 的随机 nonce 和原 inspector URL。
 * [OUTPUT]: 提供固定 watchdog/close 表达式；关闭前同时验证进程、nonce、原地址，绝不关闭后开的调试会话。
 * [POS]: 启动桥的最小权限归还边界；表达式无截图、账号、用户代码或任意调用参数。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const OWNER = '@daftai/pdsh.inspector-bootstrap.v1';
function prelude(pid: number, nonce: string, url: string) {
  return `if(process.pid!==${JSON.stringify(pid)}||process.type!=='browser')throw Error('wrong Main');const i=process.getBuiltinModule('node:inspector'),key=Symbol.for(${JSON.stringify(OWNER)}),nonce=${JSON.stringify(nonce)},url=${JSON.stringify(url)};`;
}
export function inspectorWatchdog(pid: number, nonce: string, url: string) {
  return `(()=>{${prelude(pid, nonce, url)}if(globalThis[key]||i.url()!==url)throw Error('inspector ownership changed');const record={nonce,url,timer:null};globalThis[key]=record;record.timer=setTimeout(()=>{if(globalThis[key]!==record)return;delete globalThis[key];if(i.url()===record.url)i.close();},5000);record.timer.unref();return {pid:process.pid,electron:process.versions.electron};})()`;
}
export function inspectorClose(pid: number, nonce: string, url: string) {
  return `(()=>{${prelude(pid, nonce, url)}const record=globalThis[key];if(record&&record.nonce!==nonce)throw Error('inspector ownership changed');if(record){clearTimeout(record.timer);delete globalThis[key];}if(i.url()!==url)return false;setTimeout(()=>{if(i.url()===url)i.close();},50).unref();return true;})()`;
}
