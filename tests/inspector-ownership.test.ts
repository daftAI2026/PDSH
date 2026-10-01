/**
 * [INPUT]: 依赖固定 Main watchdog/close 表达式与隔离 VM 中的 inspector/计时器桩。
 * [OUTPUT]: 验证正常关闭撤销旧 watchdog、后开调试会话不受影响、错 PID/nonce 不接管。
 * [POS]: bootstrap 调试权限归还合同；不向真实 Main 发信号或打开调试端口。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';
import { inspectorWatchdog, inspectorClose } from '../src/host/inspector-ownership.ts';
function fixture() {
  let address='ws://127.0.0.1:9229/old',closes=0; const timers=new Map();let sequence=0;
  const inspector={url:()=>address,close(){++closes;address=undefined;}};
  const context=createContext({process:{pid:12,type:'browser',versions:{electron:'44.0.0'},getBuiltinModule:()=>inspector},
    setTimeout(fn,ms){const timer={id:++sequence,unref(){}};timers.set(timer,fn);return timer;},clearTimeout(timer){timers.delete(timer);}});
  return { context,timers,get closes(){return closes;},open(value){address=value;},run(source){return runInContext(source,context);},tick(){for(const [timer,fn] of [...timers]){timers.delete(timer);fn();}} };
}
test('正常关闭撤销 watchdog；旧延迟关闭也不碰随后开的调试会话',()=>{
  const h=fixture();h.run(inspectorWatchdog(12,'own','ws://127.0.0.1:9229/old'));
  assert.equal(h.timers.size,1);h.run(inspectorClose(12,'own','ws://127.0.0.1:9229/old'));assert.equal(h.timers.size,1);
  h.open('ws://127.0.0.1:9229/new');h.tick();assert.equal(h.closes,0);
});
test('watchdog 只关自己的原地址，错 PID/nonce 不接管',()=>{
  const h=fixture();h.run(inspectorWatchdog(12,'own','ws://127.0.0.1:9229/old'));
  assert.throws(()=>h.run(inspectorClose(13,'own','ws://127.0.0.1:9229/old')));
  assert.throws(()=>h.run(inspectorClose(12,'other','ws://127.0.0.1:9229/old')));
  h.tick();assert.equal(h.closes,1);
  const next=fixture();next.run(inspectorWatchdog(12,'own','ws://127.0.0.1:9229/old'));next.open('ws://127.0.0.1:9229/new');next.tick();assert.equal(next.closes,0);
});
