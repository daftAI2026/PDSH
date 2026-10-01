/**
 * [INPUT]: 依赖真实编辑器、jsdom、Canvas 编码/绘制窄桩与可控保存回执。
 * [OUTPUT]: 验证模板冻结元数据和实际合成尺寸、目录/格式传递、取消/失败留在编辑、迟到编码不导出或通知。
 * [POS]: 编辑器导出状态机合同；绘制桩不证明图像视觉或 Electron 保存面板实机行为。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountCaptureWindowEditor } from '../src/client/capture/editor.ts';
import { createCaptureWindowState } from '../src/client/capture/model.ts';
import { captureOutputSize } from '../src/client/capture/compositor.ts';
function fixture(options={}) {
  const dom=new JSDOM('<html lang="zh"><title>live-title</title><body><main/></body></html>',{url:'https://fixture.invalid/',pretendToBeVisual:true});
  const values={window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,HTMLCanvasElement:dom.window.HTMLCanvasElement,HTMLImageElement:dom.window.HTMLImageElement,ResizeObserver:class{observe(){}disconnect(){}},Image:dom.window.Image};
  const previous=new Map(Object.keys(values).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const[key,value]of Object.entries(values))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  const context=new Proxy({canvas:null},{get(target,key){if(key in target)return target[key];if(String(key).startsWith('create'))return()=>({addColorStop(){}});return()=>{};},set(target,key,value){target[key]=value;return true;}});
  dom.window.HTMLCanvasElement.prototype.getContext=function(){context.canvas=this;return context;};
  const encoded=[];let delay=false;
  dom.window.HTMLCanvasElement.prototype.toBlob=function(fn,mime){const complete=()=>fn(new dom.window.Blob(['fixture'],{type:mime}));if(delay)encoded.push(complete);else complete();};
  const source=dom.window.document.createElement('canvas');source.width=120;source.height=80;
  const notices=[],saved=[],closed=[];
  const editor=mountCaptureWindowEditor(dom.window.document.querySelector('main'),{source,initialState:{...createCaptureWindowState({width:120,height:80}),background:{kind:'color',color:'#ffffff'}},preferenceStorage:null,locale:'zh',
    fileMetadata:{title:'snapshot-title',capturedAt:new Date(2026,9,1,13,2,3)},exportPreferences:{saveBehavior:'direct',saveDirectory:'/tmp/pdsh-fixture',saveFormat:'webp',fileNamePattern:'{title}-{width}x{height}-{time}'},
    onNotify:message=>notices.push(message),onClose:()=>closed.push(true),onSave:async(...args)=>{saved.push(args);return 'cancelled';},...options});
  return{dom,editor,notices,saved,closed,encoded,delay(){delay=true;},click(){dom.window.document.querySelector('[data-action="save"]').click();},
    async flush(){await new Promise(resolve=>setImmediate(resolve));},close(){editor.destroy();dom.window.close();for(const[key,descriptor]of previous){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}};
}
test('取消原生保存保持编辑，模板用冻结标题/时间和合成尺寸，目录与格式传给同一保存边界',async()=>{
  const h=fixture();try{const state=h.editor.getState(),size=captureOutputSize(state.source,state.padding);h.dom.window.document.title='changed-title';h.click();await h.flush();
    assert.equal(h.saved[0][0].type,'image/webp');assert.equal(h.saved[0][1],`snapshot-title-${size.width}x${size.height}-13-02-03.webp`);assert.equal(h.saved[0][2],'/tmp/pdsh-fixture');assert.equal(h.saved[0][3],'direct');assert.equal(h.dom.window.document.querySelector('[data-pdsh-capture]').getAttribute('data-state'),'editing');assert.equal(h.closed.length,0);assert.equal(h.notices.length,0);
  }finally{h.close();}
});
test('saved 才通知并关闭；未知回执或写入失败不误报成功',async()=>{
  for(const outcome of ['saved','unknown','throw']){const h=fixture({onSave:async()=>{if(outcome==='throw')throw Error('fixture write failure');return outcome;}});try{h.click();await h.flush();if(outcome==='saved'){assert.equal(h.closed.length,1);assert.match(h.notices.at(-1),/已保存/);}else{assert.equal(h.closed.length,0);assert.match(h.notices.at(-1),/无法导出图片/);assert.equal(h.dom.window.document.querySelector('[data-pdsh-capture]').getAttribute('data-state'),'editing');}}finally{h.close();}}
});
test('编辑器关闭后迟到的编码不能启动原生保存或污染新通知',async()=>{
  const h=fixture();try{h.delay();h.click();await h.flush();assert.equal(h.encoded.length,1);h.editor.destroy();h.encoded[0]();await h.flush();assert.equal(h.saved.length,0);assert.equal(h.notices.length,0);assert.equal(h.closed.length,1);}finally{h.close();}
});

test('缺本机保存 provider 时不能把浏览器下载冒充直接目录保存',async()=>{
  const h=fixture({onSave:undefined});try{h.click();await h.flush();assert.equal(h.closed.length,0);assert.match(h.notices.at(-1),/无法导出图片/);assert.equal(h.dom.window.document.querySelector('[data-pdsh-capture]').getAttribute('data-state'),'editing');}finally{h.close();}
});

test('关闭工作台取消已经启动的保存，快捷键不并发复制或重复导出',async()=>{
  let signal, finish, copied=0, saves=0;
  const h=fixture({onSave:(_blob,_name,_directory,_behavior,ownerSignal)=>{signal=ownerSignal;saves++;return new Promise(resolve=>{finish=resolve;});},onCopy:async()=>{copied++;}});
  try{h.click();await h.flush();assert.equal(saves,1);const root=h.dom.window.document.querySelector('[data-pdsh-capture]');
    root.dispatchEvent(new h.dom.window.KeyboardEvent('keydown',{key:'c',metaKey:true,bubbles:true}));await h.flush();assert.equal(copied,0);assert.equal(h.closed.length,0);
    root.dispatchEvent(new h.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(signal.aborted,true);assert.equal(h.closed.length,1);
    finish('saved');await h.flush();assert.equal(h.notices.length,0);
  }finally{h.close();}
});

test('5K 默认边距可编辑；超预算边距不分配输出、不改变有效状态并提示减小边距',()=>{
  const h=fixture({initialState:{...createCaptureWindowState({width:5120,height:2880}),background:{kind:'color',color:'#ffffff'}}});
  try{const padding=h.dom.window.document.querySelector('[data-input="padding"]');padding.value='45';padding.dispatchEvent(new h.dom.window.Event('input',{bubbles:true}));
    assert.equal(h.editor.getState().padding,8);assert.equal(padding.value,'8');assert.match(h.notices.at(-1),/减小边距/);
  }finally{h.close();}
});
