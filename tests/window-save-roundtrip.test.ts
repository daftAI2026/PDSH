/**
 * [INPUT]: 依赖真实 Client 保存状态机、Host backend、共享协议和仅本测试创建的目录。
 * [OUTPUT]: 验证双向分块 ACK/half-close、Host 文件名和独占提交的完整字节回环；不伪造保存回执。
 * [POS]: 跨运行时逻辑的内存载体验收；不替代 DSH Gateway 网络、原生 picker 或实机工作台。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomFillSync, webcrypto } from 'node:crypto';
import { crc32, deflateSync } from 'node:zlib';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveWindowImage } from '../src/client/capture/window-save.ts';
import { createWindowSaveBackend } from '../src/host/window-save-backend.ts';

function chunk(kind:string,body:Buffer){
 const type=Buffer.from(kind),head=Buffer.alloc(4),sum=Buffer.alloc(4);
 head.writeUInt32BE(body.length);sum.writeUInt32BE(crc32(Buffer.concat([type,body])));
 return Buffer.concat([head,type,body,sum]);
}
function png(){
 const width=128,height=64,header=Buffer.alloc(13),pixels=randomFillSync(Buffer.alloc(height*(width*4+1)));
 header.writeUInt32BE(width);header.writeUInt32BE(height,4);header.set([8,6,0,0,0],8);
 for(let row=0;row<height;row++)pixels[row*(width*4+1)]=0;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
function uplink(){
 const pending=[],waiting=[];let closed=false;
 const read=()=>pending.length?Promise.resolve({done:false,value:pending.shift()}):closed?Promise.resolve({done:true}):new Promise(resolve=>waiting.push(resolve));
 const push=value=>waiting.length?waiting.shift()({done:false,value}):pending.push(value);
 const end=()=>{closed=true;for(const resolve of waiting.splice(0))resolve({done:true});};
 return {push,end,[Symbol.asyncIterator](){return {next:read,return:async()=>{end();return {done:true};}};}};
}
test('Client↔Host 两块真实PNG回环落盘，重复basename独占编号且不覆盖',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pdsh-save-roundtrip-'));
 const backend=createWindowSaveBackend({preferences:()=>({captureEnabled:true,saveDirectory:directory,saveFormat:'png',fileNamePattern:'roundtrip-{width}x{height}'})});
 const bytes=png(),blob=new Blob([bytes],{type:'image/png'});
 try{
  assert.ok(bytes.length>32768);
  for(let index=0;index<2;index++){
   const request={requestId:webcrypto.randomUUID(),format:'png' as const,width:128,height:64,title:'fixture',capturedAt:'2026-10-03T00:00:00.000Z'};
   const input=uplink(),owner=new AbortController();
   const frames=backend.save(request,{signal:owner.signal,lifetimeSignal:new AbortController().signal,uplink:input}) as AsyncGenerator;
   let chunks=0;
   const handle={send(frame){if(frame.type==='chunk')chunks++;input.push(frame);},end:input.end,async dispose(){owner.abort();input.end();await frames.return(undefined);},[Symbol.asyncIterator](){return frames;}};
   assert.equal(await saveWindowImage(blob,request,()=>handle,{crypto:webcrypto}),'saved');
   assert.equal(chunks,2);
  }
  const names=(await readdir(directory)).sort();assert.deepEqual(names,['roundtrip-128x64 (1).png','roundtrip-128x64.png']);
  for(const name of names)assert.deepEqual(await readFile(join(directory,name)),bytes);
 }finally{await backend.dispose();await rm(directory,{recursive:true,force:true});}
});
