/**
 * [INPUT]: 依赖生成 Main 桥和隔离 VM 的 socket/fs/Electron 桩及系统临时根内真实 Unix socket，不连接真实应用。
 * [OUTPUT]: 验证未经认证的畸形 JSON 只销毁连接，不抛进程异常；两端动态目录握手、目录边界拒绝与关闭归还资源。
 * [POS]: 非标准内部桥控制帧的攻击面回归，生成文件同样接受合同审判。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import * as fs from 'node:fs';
import { mkdtemp, chmod, rm, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import * as path from 'node:path';
import { connectCaptureControl } from '../src/host/capture-bootstrap.ts';
async function fixture({socketPath='/tmp/pdsh-main-fixture/bridge.sock',realIo=false}={}) {
  let accept;const writes=[],timers=new Set(),secret='a'.repeat(64);
  const server=Object.assign(new EventEmitter(),{listen(_path,ready){ready();},close(){}});
  const contents=Object.assign(new EventEmitter(),{getURL:()=> 'dsh-app://app/'});
  const win=Object.assign(new EventEmitter(),{webContents:contents,isDestroyed:()=>false,isVisible:()=>true});
  const context={URL,module:{exports:{} as any},Buffer,process:{pid:45,type:'browser',execPath:'/not-real-app',getuid:()=>realIo?process.getuid!():501},
    require(name){if(name==='node:module')return {createRequire:()=>()=>{throw Error('unexpected load');}};
      if(name==='node:net')return realIo?createRequire(import.meta.url)(name):{createServer(fn){accept=fn;return server;}};
      if(name==='node:fs')return realIo?fs:{lstatSync:()=>({isDirectory:()=>true,uid:501,mode:0o700}),realpathSync:value=>value,statSync:()=>({isDirectory:()=>true,uid:501,mode:0o700}),chmodSync(){}};
      if(name==='node:os')return{tmpdir:()=>realIo?tmpdir():'/tmp'};
      if(name==='node:crypto')return {randomBytes(){throw Error('unexpected randomness');}};
      if(name==='node:fs/promises')return {open(){throw Error('unexpected write');},rename(){throw Error('unexpected rename');},unlink(){throw Error('unexpected unlink');}};
      if(name==='node:path')return path;throw Error(`unexpected module ${name}`);},
    setTimeout:realIo?setTimeout:function(fn){const timer={fn,unref(){}};timers.add(timer);return timer;},clearTimeout:realIo?clearTimeout:function(timer){timers.delete(timer);}};
  runInNewContext(readFileSync(new URL('../main.cjs',import.meta.url),'utf8'),context);
  await context.module.exports.startMainBridge({expectedPid:45,socketPath,secret},{app:{getVersion:()=> '0.2.0-rc.2'},BrowserWindow:{getAllWindows:()=>[win]}});
  function socket(){const value=Object.assign(new EventEmitter(),{destroyed:false,destroy(){this.destroyed=true;this.emit('close');},write(line){writes.push(line);},end(){}});accept(value);return value;}
  return {socket,writes,secret,dispose(){win.emit('closed');},context};
}
test('未认证 null/数组/字符串/数字 JSON 不能使 Main 抛异常',async()=>{
  const h=await fixture();try{
    for(const frame of ['null','[]','"text"','42','{']){
      const peer=h.socket();assert.doesNotThrow(()=>peer.emit('data',Buffer.from(`${frame}\n`)),frame);assert.equal(peer.destroyed,true);
    }
    const peer=h.socket();peer.emit('data',Buffer.from(JSON.stringify({op:'hello',secret:h.secret})+'\n'));
    assert.equal(JSON.parse(h.writes.at(-1)).op,'ready');peer.destroy();
  }finally{h.dispose();}
});

test('Host 真实 socket transport 拒绝畸形 ACK 和结果，不抛异步进程异常',async()=>{
  for(const frame of ['null','[]','"text"','42','{','{}',JSON.stringify({protocolVersion:1,ok:true})]){
    const socket=Object.assign(new EventEmitter(),{destroyed:false,destroy(){this.destroyed=true;this.emit('close');},write(){},end(){}});
    const work=connectCaptureControl('/unused/socket','secret',new AbortController().signal,()=>socket), rejected=assert.rejects(work);
    socket.emit('connect');assert.doesNotThrow(()=>socket.emit('data',Buffer.from(`${frame}\n`)),frame);await rejected;assert.equal(socket.destroyed,true);
  }
});
test('Host 真实 transport 在 ACK 后只收控制结果；abort 拒绝挂起且不泄漏计时器',async()=>{
  const writes=[],abort=new AbortController();
  const socket=Object.assign(new EventEmitter(),{destroyed:false,destroy(){this.destroyed=true;this.emit('close');},write(line){writes.push(JSON.parse(line));},end(){}});
  const opening=connectCaptureControl('/unused/socket','secret',abort.signal,()=>socket);socket.emit('connect');socket.emit('data',Buffer.from('{"op":"ready","protocolVersion":1}\n'));
  const bridge=await opening,id='11111111-1111-4111-8111-111111111111';
  const first=bridge.capture(id,id);socket.emit('data',Buffer.from(JSON.stringify({requestId:id,ok:true,protocolVersion:1})+'\n'));assert.deepEqual(await first,{protocolVersion:1});
  const timers=[],originalTimer=globalThis.setTimeout;let saved;
  try{globalThis.setTimeout=((fn,ms,...args)=>{timers.push(ms);return originalTimer(fn,ms,...args);}) as any;saved=bridge.save(id,id);}finally{globalThis.setTimeout=originalTimer;}
  assert.deepEqual(timers,[],'保存面板不使用人类决策超时');
  socket.emit('data',Buffer.from(JSON.stringify({requestId:id,ok:true,protocolVersion:1,outcome:'saved'})+'\n'));assert.deepEqual(await saved,{protocolVersion:1,outcome:'saved'});
  const second=bridge.capture(id,id), rejected=assert.rejects(second);abort.abort();await rejected;await bridge.dispose();assert.equal(socket.destroyed,true);
  assert.ok(writes.every(value=>!('png' in value)));
});

test('生成 Main 桥与真实 Host 在系统临时根内握手，不要求 /tmp 固定地址',{skip:process.platform==='win32'},async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'pdsh-main-')),socketPath=path.join(directory,'bridge.sock');
  await chmod(directory,0o700);let h,bridge;
  try {
    h=await fixture({socketPath,realIo:true});
    assert.equal((await lstat(socketPath)).mode&0o777,0o600);
    bridge=await connectCaptureControl(socketPath,h.secret,new AbortController().signal);
    await bridge.dispose();
  } finally {await bridge?.dispose();h?.dispose();await rm(directory,{recursive:true,force:true});}
});
test('Main 在监听前拒绝相对路径、逃逸目录、不同根和错误 socket 文件名',async()=>{
  for(const socketPath of ['relative/pdsh-main-fixture/bridge.sock','/tmp/pdsh-main-fixture/../bridge.sock','/elsewhere/pdsh-main-fixture/bridge.sock','/tmp/pdsh-main-fixture/other.sock'])
    await assert.rejects(fixture({socketPath}),/bridge ownership rejected|private directory rejected/);
});

test('Main 拒绝非私有权限和目录符号链接，系统临时根别名可握手',{skip:process.platform==='win32'},async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'pdsh-main-')),link=directory+'Link';let h,bridge;
  try {
    await chmod(directory,0o755);
    await assert.rejects(fixture({socketPath:path.join(directory,'bridge.sock'),realIo:true}),/private directory rejected/);
    await chmod(directory,0o700);fs.symlinkSync(directory,link,'dir');
    await assert.rejects(fixture({socketPath:path.join(link,'bridge.sock'),realIo:true}),/private directory rejected/);
    const canonicalSocket=path.join(fs.realpathSync(tmpdir()),path.basename(directory),'bridge.sock');
    h=await fixture({socketPath:canonicalSocket,realIo:true});
    bridge=await connectCaptureControl(canonicalSocket,h.secret,new AbortController().signal);
    await bridge.dispose();
  } finally {await bridge?.dispose();h?.dispose();await rm(link,{force:true});await rm(directory,{recursive:true,force:true});}
});
