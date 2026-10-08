/**
 * [INPUT]: 依赖真实 Main 保存控制器、原子文件提交器、EventEmitter 与原生面板窄桩。
 * [OUTPUT]: 验证保存回执、提交围栏、5K默认边距的独立导出预算及跨装配串行锁。
 * [POS]: 本机保存生命周期合同；不启动 Electron、不读用户文件，不作为实机保存验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNativePageSave } from '../src/host/page-save-main.ts';
import { writeConfirmedImage, writeUniqueImage } from '../src/host/page-save-file.ts';
const id='11111111-1111-4111-8111-111111111111',owner='22222222-2222-4222-8222-222222222222';
function fixture() {
  const directory=join(tmpdir(),'pdsh-fixture'),fileName=join(directory,'demo.png');
  const contents=new EventEmitter() as any,win=new EventEmitter() as any,writes=[],uniqueWrites=[],dialogs=[];
  let data={nonce:owner,mime:'image/png',fileName:'demo.png',directory,base64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDVYAAAAASUVORK5CYII='},answer={canceled:false,filePath:fileName},size={width:1,height:1};
  const frame={isDestroyed:()=>false,executeJavaScript:async(code)=>{assert.match(code,/exportData/);assert.doesNotMatch(code,/pdsh-fixture|demo\.png/);return data;}};
  Object.assign(contents,{mainFrame:frame,isDestroyed:()=>false,getURL:()=> 'dsh-app://app/index.html'});Object.assign(win,{webContents:contents,isDestroyed:()=>false});
  const dialog={async showSaveDialog(w,options){assert.equal(w,win);dialogs.push(options);return answer;}},image={createFromBuffer:()=>({isEmpty:()=>false,getSize:()=>size})};
  let writing=async(...args)=>{writes.push(args);},uniqueWriting=async(...args)=>{uniqueWrites.push(args);};
  const controller=createNativePageSave(win,dialog,image,(...args)=>writing(...args),(...args)=>uniqueWriting(...args));
  return{win,contents,dialog,image,writes,uniqueWrites,dialogs,controller,directory,fileName,setData(value){data={...data,...value};},setAnswer(value){answer=value;},setSize(value){size=value;},setWrite(value){writing=value;},setUniqueWrite(value){uniqueWriting=value;}};
}
test('原生保存面板初始目录生效，真实写入完成才返回 saved',async()=>{
  const h=fixture();try{let finish;h.setWrite(()=>new Promise(resolve=>{finish=resolve;}));let done=false;const work=h.controller.save(id,owner).then(result=>{done=true;return result;});await new Promise(resolve=>setImmediate(resolve));assert.equal(done,false);assert.equal(h.dialogs[0].defaultPath,h.fileName);finish();assert.deepEqual(await work,{outcome:'saved'});
    h.setAnswer({canceled:true});assert.deepEqual(await h.controller.save(id,owner),{outcome:'cancelled'});assert.equal(h.writes.length,0);
  }finally{h.controller.dispose();assert.equal(h.contents.listenerCount('did-start-navigation'),0);}
});

test('直接保存不打开面板，绑定目录和 basename 交给不覆盖写入边界',async()=>{
  const h=fixture();try{
    h.setData({saveBehavior:'direct'});assert.deepEqual(await h.controller.save(id,owner),{outcome:'saved'});
    assert.equal(h.dialogs.length,0);assert.equal(h.writes.length,0);assert.equal(h.uniqueWrites.length,1);assert.equal(h.uniqueWrites[0][0],h.fileName);assert.equal(typeof h.uniqueWrites[0][2],'function');
  }finally{h.controller.dispose();}
  for(const data of [{saveBehavior:'unknown'},{saveBehavior:'direct',directory:''}]){
    const bad=fixture();try{bad.setData(data);await assert.rejects(bad.controller.save(id,owner));assert.equal(bad.dialogs.length,0);assert.equal(bad.writes.length,0);assert.equal(bad.uniqueWrites.length,0);}finally{bad.controller.dispose();}
  }
});

test('直接保存从 Main 到真实独占提交，共用生命周期围栏且不覆盖旧文件',async()=>{
  for(const action of ['cancel','none']){
    const directory=await mkdtemp(join(tmpdir(),'pdsh-direct-main-')),target=join(directory,'demo.png'),h=fixture();
    try{
      await writeFile(target,'original image');h.setData({saveBehavior:'direct',directory});
      h.setUniqueWrite((path,bytes,beforeCommit)=>writeUniqueImage(path,bytes,()=>{if(action==='cancel')h.controller.cancel(id);beforeCommit();}));
      if(action==='cancel'){await assert.rejects(h.controller.save(id,owner),/save unavailable/);assert.deepEqual(await readdir(directory),['demo.png']);}
      else{assert.deepEqual(await h.controller.save(id,owner),{outcome:'saved'});assert.deepEqual((await readdir(directory)).sort(),['demo (1).png','demo.png']);}
      assert.equal(await readFile(target,'utf8'),'original image');assert.equal(h.dialogs.length,0);assert.equal(h.writes.length,0);
    }finally{h.controller.dispose();await rm(directory,{recursive:true,force:true});}
  }
});
test('面板期间导航、取消或停用不写，卸载后新控制器仍遵守旧原生面板锁',async()=>{
  for(const action of ['navigate','cancel','dispose']){const h=fixture();let finish;h.dialog.showSaveDialog=()=>new Promise(resolve=>{finish=resolve;});try{
    const work=h.controller.save(id,owner),rejected=assert.rejects(work);await new Promise(resolve=>setImmediate(resolve));
    if(action==='navigate')h.contents.emit('did-start-navigation');else if(action==='cancel')h.controller.cancel(id);else h.controller.dispose();
    const second=createNativePageSave(h.win,h.dialog,h.image,async()=>{});await assert.rejects(second.save(id,owner));second.dispose();
    finish({canceled:false,filePath:join(tmpdir(),'fixture.png')});await rejected;assert.equal(h.writes.length,0);await h.controller.settled();
  }finally{h.controller.dispose();}}
});
test('格式、nonce、basename、字节/像素与原页面校验失败从不打开面板或写文件',async()=>{
  for(const data of [{nonce:id},{fileName:'../x.png'},{fileName:'demo.webp'},{base64:'aGVsbG8='},{mime:'text/plain'},{directory:'relative'}]){const h=fixture();try{h.setData(data);await assert.rejects(h.controller.save(id,owner));assert.equal(h.dialogs.length,0);assert.equal(h.writes.length,0);}finally{h.controller.dispose();}}
  for(const size of [{width:NaN,height:10},{width:0,height:1},{width:50000,height:50000}]){const h=fixture();try{h.setSize(size);await assert.rejects(h.controller.save(id,owner));assert.equal(h.dialogs.length,0);}finally{h.controller.dispose();}}
  const h=fixture();try{h.contents.getURL=()=> 'https://example.com/';await assert.rejects(h.controller.save(id,owner));assert.equal(h.dialogs.length,0);}finally{h.controller.dispose();}
});
test('磁盘写入失败不产生成功回执，串行锁归还允许下一次重试',async()=>{
  const h=fixture();try{h.setWrite(async()=>{throw Error('fixture failure');});await assert.rejects(h.controller.save(id,owner));h.setWrite(async()=>{});assert.deepEqual(await h.controller.save(id,owner),{outcome:'saved'});}finally{h.controller.dispose();}
});

test('WebP 保存不调用 Electron 未承诺的 nativeImage WebP 解码',async()=>{
  const h=fixture(),webp=Buffer.from('524946461600000057454250565038200a0000000000009d012a0a001400','hex');
  try{h.setData({mime:'image/webp',fileName:'demo.webp',base64:webp.toString('base64')});h.image.createFromBuffer=()=>{throw Error('native WebP unsupported');};assert.deepEqual(await h.controller.save(id,owner),{outcome:'saved'});assert.equal(h.writes.length,1);assert.equal(h.dialogs[0].filters[0].extensions[0],'webp');}finally{h.controller.dispose();}
});

test('Main PNG/JPEG保存接受5K默认边距输出，不沿用16MP取像预算',async()=>{
  for(const mime of ['image/png','image/jpeg']) {
   const h=fixture();try {
    if(mime==='image/jpeg')h.setData({mime,fileName:'demo.jpg',base64:Buffer.from([255,216,255]).toString('base64')});
    h.setSize({width:5580,height:3340});
    assert.deepEqual(await h.controller.save(id,owner),{outcome:'saved'});
    h.setSize({width:8001,height:4000});
    await assert.rejects(h.controller.save(id,owner),/export budget/);
    assert.equal(h.writes.length,1);
   } finally {h.controller.dispose();}
  }
});

test('Main 生命周期在真实临时文件写完后仍阻止失效请求替换旧图',async()=>{
  for(const action of ['navigate','cancel','dispose','none']){
    const directory=await mkdtemp(join(tmpdir(),'pdsh-save-commit-')),target=join(directory,'existing.png'),h=fixture();
    try{
      await writeFile(target,'original image');h.setAnswer({canceled:false,filePath:target});
      h.setWrite((path,bytes,beforeCommit=()=>{})=>writeConfirmedImage(path,bytes,()=>{
        if(action==='navigate')h.contents.emit('did-start-navigation');
        else if(action==='cancel')h.controller.cancel(id);
        else if(action==='dispose')h.controller.dispose();
        beforeCommit();
      }));
      if(action==='none'){
        assert.deepEqual(await h.controller.save(id,owner),{outcome:'saved'});
        assert.deepEqual((await readFile(target)).subarray(0,8),Buffer.from([137,80,78,71,13,10,26,10]));
      }else{
        await assert.rejects(h.controller.save(id,owner),/save unavailable/);
        assert.equal(await readFile(target,'utf8'),'original image');
      }
      assert.deepEqual(await readdir(directory),['existing.png']);await h.controller.settled();
    }finally{h.controller.dispose();await rm(directory,{recursive:true,force:true});}
  }
});
