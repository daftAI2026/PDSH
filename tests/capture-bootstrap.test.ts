/**
 * [INPUT]: 依赖真实 bootstrap 编排、隔离副作用适配与系统临时根内私有目录；不发真实信号或打开调试端口。
 * [OUTPUT]: 验证身份/端口拒绝、启动 ACK 失败、关闭 unknown、取消、系统临时根选择和独占资源清理。
 * [POS]: Main 启动失败路径合同；覆盖编排而不把模拟 transport 认作原 DSH 验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { lstat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createCaptureBootstrap, readMainIdentity } from '../src/host/capture-bootstrap.ts';
function fixture() {
  const executable='/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness';
  const facts={pid:45,electron:'44.0.0'}, calls=[], paths=[]; let state='closed', failAck=false, failConnect=false, closed=0, destroyed=0;
  const io={platform:'darwin',argv:['host','/node_modules/@deepseek-ai/dsh-desktop-host/lib/index.js'],electron:'44.0.0',pid:45,execPath:executable,
    identity(){return `${executable} Tue Oct 1`;}, listeners(pid?) {if(state==='unknown') throw new Error('lsof failed');return state==='open'?'127.0.0.1:9229':'';},
    signalMain(pid){calls.push(['signal',pid]);state='open';},async target(){calls.push(['target']);return 'ws://127.0.0.1:9229/owned';},async sleep(){},
    async inspectorClient(url){calls.push(['inspector',url]);if(failConnect)throw new Error('connect failed');return {close(){++closed;},async evaluate(expression){
      calls.push(['evaluate',expression]);
      if(expression.includes('startMainBridge'))return {pid:45,protocolVersion:1};
      if(expression.includes('clearTimeout')){if(state!=='unknown')state='closed';return true;}
      return facts;
    }};},
    async socketClient(path,secret,signal){paths.push(path);calls.push(['socket',secret.length,signal.aborted]);if(failAck)throw new Error('no ACK');return {capture:async()=>{},cancel(){},async dispose(){++destroyed;}};},
  };
  return {io,calls,paths,open:createCaptureBootstrap(io),get closed(){return closed;},get destroyed(){return destroyed;},state(value){state=value;},ackFail(){failAck=true;},connectFail(){failConnect=true;}};
}
async function directoryAbsent(h){for(const path of h.paths)await assert.rejects(lstat(dirname(path)),{code:'ENOENT'});}
test('平台/父 Main 身份/已有 inspector 不符时零信号、零连接',async()=>{
  for(const alter of [h=>{h.io.platform='linux';},h=>{h.io.identity=()=>'/other/app';},h=>{h.io.electron='43.0';},h=>h.state('open')]){
    const h=fixture();alter(h);await assert.rejects(h.open('/package/main.cjs',new AbortController().signal));assert.deepEqual(h.calls,[]);
  }
});
test('成功须 ACK 加关闭证明；连接正常释放时归还临时目录',async()=>{
  const h=fixture(), bridge=await h.open('/package/main.cjs',new AbortController().signal);
  assert.equal(h.calls.filter(call=>call[0]==='signal').length,1);assert.equal(h.paths.length,1);assert.equal((await lstat(dirname(h.paths[0]))).mode&0o777,0o700);
  assert.ok(h.closed>0);await bridge.dispose();assert.equal(h.destroyed,1);await directoryAbsent(h);
});
test('socket ACK 失败仍关闭 inspector 并清理私有目录',async()=>{
  const h=fixture();h.ackFail();await assert.rejects(h.open('/package/main.cjs',new AbortController().signal),/no ACK/);
  assert.equal(h.paths.length,1);assert.ok(h.closed>0);await directoryAbsent(h);
});
test('关闭状态 unknown 不能冒充成功，即使 socket 已就绪也释放',async()=>{
  const h=fixture(), socket=h.io.socketClient;h.io.socketClient=async(...args)=>{const value=await socket(...args);h.state('unknown');return value;};
  await assert.rejects(h.open('/package/main.cjs',new AbortController().signal),/PDSH_MAIN_INSPECTOR_CLOSE_UNCONFIRMED/);
  assert.equal(h.destroyed,1);await directoryAbsent(h);
});
test('已发信号却连不上 inspector 必须报关闭未知，不继续加载模块',async()=>{
  const h=fixture();h.connectFail();await assert.rejects(h.open('/package/main.cjs',new AbortController().signal),/PDSH_MAIN_INSPECTOR_CLOSE_UNCONFIRMED/);
  assert.equal(h.calls.some(call=>call[0]==='socket'),false);
});
test('启动前和 ACK 后取消均不得留下可用桥',async()=>{
  const before=fixture(), already=new AbortController();already.abort();await assert.rejects(before.open('/package/main.cjs',already.signal));assert.deepEqual(before.calls,[]);
  const h=fixture(), abort=new AbortController(), socket=h.io.socketClient;h.io.socketClient=async(...args)=>{const value=await socket(...args);abort.abort();return value;};
  await assert.rejects(h.open('/package/main.cjs',abort.signal));assert.equal(h.destroyed,1);await directoryAbsent(h);
});

test('SIGUSR1 后无法归属端点即报关闭未知，取消不接管未知会话',async()=>{
  const h=fixture(), abort=new AbortController();h.io.target=async()=>{abort.abort();throw new Error('target unavailable');};
  await assert.rejects(h.open('/package/main.cjs',abort.signal),/PDSH_MAIN_INSPECTOR_CLOSE_UNCONFIRMED/);
  assert.equal(h.calls.filter(call=>call[0]==='signal').length,1);assert.equal(h.calls.some(call=>call[0]==='inspector'),false);
});


test('macOS ps 的 comm 必须位于末列，完整路径加启动时间才是身份',()=>{
  const executable='/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness',started='Thu Oct  1 13:12:32 2026';
  const run=(_command,args)=>args.at(-1)==='comm=,lstart=' ? `/Applications/De ${started}    \n` : `${started}     ${executable}\n`;
  assert.equal(readMainIdentity(45,run),`${executable} ${started}`);
});

test('真实 macOS ps 不得截断当前进程路径',{skip:process.platform!=='darwin'},()=>{
  assert.ok(readMainIdentity(process.pid).startsWith(`${process.execPath} `),'只读进程身份应保留完整路径');
});

test('关键诊断阶段能区分已有端口，且拒绝路径/错误原文/像素日志',async()=>{
  const h=fixture(),phases=[];h.state('open');
  await assert.rejects(h.open('/private/pixel-secret/main.cjs',new AbortController().signal,phase=>phases.push(phase)),error=>error.code==='bridge-port-busy');
  assert.deepEqual(phases,['bootstrap-start','bootstrap-port-busy']);
  assert.deepEqual(h.calls,[],'忙端口不能发送信号或连接');
  assert.doesNotMatch(JSON.stringify(phases),/private|pixel-secret|main\.cjs/);
});

test('私有桥目录来自系统临时根，每次启动独占且只清理本次目录',async()=>{
  const first=fixture(),second=fixture();
  const one=await first.open('/package with spaces/main.cjs',new AbortController().signal);
  const two=await second.open('/package with spaces/main.cjs',new AbortController().signal);
  try {
    assert.equal(dirname(dirname(first.paths[0])),tmpdir());
    assert.equal(dirname(dirname(second.paths[0])),tmpdir());
    assert.notEqual(dirname(first.paths[0]),dirname(second.paths[0]));
    assert.ok(first.calls.some(call=>call[0]==='evaluate'&&call[1].includes(JSON.stringify('/package with spaces/main.cjs'))));
    await one.dispose();
    await directoryAbsent(first);
    assert.ok((await lstat(dirname(second.paths[0]))).isDirectory(),'归还一个桥不能删除另一个桥目录');
  } finally { await one.dispose(); await two.dispose(); }
  await directoryAbsent(second);
});
