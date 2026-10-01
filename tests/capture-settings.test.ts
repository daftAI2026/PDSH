/**
 * [INPUT]: 依赖真实 CaptureSettingsCard、React/jsdom 与仅替代 Host Button 外观的桩。
 * [OUTPUT]: 验证拍照功能开关及导出设置的 revision、冲突、只读/失败/卸载围栏。
 * [POS]: 唯一 pdsh ConfigForm 的拍照设置合同；不读文件或像素，也不启动任何 Main 连接。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import React, { act } from 'react';
import { JSDOM } from 'jsdom';
import * as exportModel from '../src/shared/capture-export.ts';
import { dictionaries } from '../src/shared/locales.ts';
async function fixture({ chooseDirectory = null } = {}) {
  const dom=new JSDOM('<body><main/></body>'), descriptors=new Map(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
  const module={exports:{}};
  runInNewContext(transformSync(readFileSync(new URL('../src/client/capture-settings.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs'}).code,{module,exports:module.exports,require(id){
    if(id==='react')return React;if(id==='@deepseek-ai/dsh-client-ui-primitives')return {Button:({children,variant,...props})=>React.createElement('button',props,children),Switch:({checked,label,disabled,onChange})=>React.createElement('button',{type:'button',role:'switch','aria-label':label,'aria-checked':String(checked),disabled,onClick:onChange}),Input:props=>React.createElement('input',props),Tooltip:({children,label,...props})=>React.createElement('span',{'data-tooltip':label},children),IconEditOutlineRegular:()=>null,IconCheckOutlineRegular:()=>null};if(id==='../shared/capture-export.ts')return exportModel;throw new Error(id);
  }});
  const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.querySelector('main')),listeners=new Set(),writes=[];
  let state={status:'ready',writable:true,revision:7,value:{...exportModel.DEFAULT_CAPTURE_EXPORT,captureEnabled:true,saveDirectory:'/tmp/pdsh-default/Downloads',allowMainBridge:false}},accepted=true;
  const form={getSnapshot:()=>state,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},async mutate(ops,revision){writes.push({ops,revision});if(accepted){state={...state,revision:state.revision+1,value:{...state.value,[ops[0].path[0]]:ops[0].value}};for(const fn of listeners)fn();}return accepted;}};
  await act(async()=>root.render(React.createElement(module.exports.CaptureSettingsCard,{form,chooseDirectory,t:key=>dictionaries.zh[key]})));
  return {doc:dom.window.document,writes,accept(value){accepted=value;},async readonly(){await act(async()=>{state={...state,writable:false};for(const fn of listeners)fn();});},
    async click(label='JPEG'){await act(async()=>{const button=[...dom.window.document.querySelectorAll('button')].find(button=>button.textContent===label||button.getAttribute('aria-label')===label);assert.ok(button,`Missing button ${label}`);button.click();});},
    async draft(value){if(!dom.window.document.querySelector('input'))await this.click(dictionaries.zh.editFileName);await act(async()=>{const input=dom.window.document.querySelector('input');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});},
    async key(key,composing=false){await act(async()=>dom.window.document.querySelector('input').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,isComposing:composing,bubbles:true})));},
    async remoteTemplate(value){await act(async()=>{state={...state,revision:state.revision+1,value:{...state.value,fileNamePattern:value}};for(const fn of listeners)fn();});},
    async close(){await act(async()=>root.unmount());dom.window.close();for(const[key,descriptor]of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}assert.equal(listeners.size,0);}};
}
test('拍照设置只呈现导出选项，不再常驻风险警告和二次启用按钮',async()=>{
  const h=await fixture();try{
    assert.doesNotMatch(h.doc.body.textContent,/调试接口|极端启动失败|接受风险|停用取像桥/);
    for(const name of ['PNG','JPEG','WebP'])assert.ok([...h.doc.querySelectorAll('button')].some(button=>button.textContent===name));
    assert.ok(h.doc.querySelector('button[aria-label="'+dictionaries.zh.editFileName+'"]'));
    assert.equal(h.doc.querySelectorAll('.pdsh-detail-row').length,4);assert.equal(h.doc.querySelectorAll('.pdsh-hint').length,0);
    assert.equal(h.doc.querySelector('[role="switch"]').getAttribute('aria-checked'),'true');
    assert.equal(h.writes.length,0,'挂载不重写用户配置');
  }finally{await h.close();}
});
test('格式即时保存沿用 Host revision，旧授权值不影响组件设置',async()=>{
  const h=await fixture();try{
    await h.click();assert.deepEqual(JSON.parse(JSON.stringify(h.writes)),[{ops:[{op:'set',path:['saveFormat'],value:'jpeg'}],revision:7}]);
    assert.doesNotMatch(h.doc.body.textContent,/JPEG 不支持透明/);await h.click('WebP');assert.equal(h.writes[1].revision,8);assert.equal(h.writes[1].ops[0].value,'webp');
  }finally{await h.close();}
});
test('保存失败有反馈，只读不能写，不因正式宿主桥而隐藏导出选项',async()=>{
  const h=await fixture();try{h.accept(false);await h.click();assert.ok(h.doc.querySelector('[role="alert"]'));await h.readonly();await h.click();assert.equal(h.writes.length,1);}finally{await h.close();}
  const native=await fixture();try{assert.equal(native.doc.querySelectorAll('button').length,8);assert.doesNotMatch(native.doc.body.textContent,/调试接口/);}finally{await native.close();}
});

test('拍照总开关写入唯一 pdsh ConfigForm 并遵守 Host revision 围栏',async()=>{
  const h=await fixture();try{
    await h.click(dictionaries.zh.captureEnabled);
    assert.deepEqual(JSON.parse(JSON.stringify(h.writes)),[{ops:[{op:'set',path:['captureEnabled'],value:false}],revision:7}]);
    assert.equal(h.doc.querySelector('[role="switch"]').getAttribute('aria-checked'),'false');
    await h.click(dictionaries.zh.captureEnabled);
    assert.equal(h.writes.at(-1).revision,8);assert.equal(h.writes.at(-1).ops[0].value,true);
  }finally{await h.close();}
});

test('保存方式是独立即时选项；目录全路径可见，切换询问不删除已选目录',async()=>{
  const h=await fixture({chooseDirectory:async()=>'/tmp/pdsh-chosen/exports'});try{
    assert.ok(h.doc.body.textContent.includes('/tmp/pdsh-default/Downloads'));
    await h.click(dictionaries.zh.saveDirect);assert.equal(h.writes.at(-1).ops[0].path[0],'saveBehavior');assert.equal(h.writes.at(-1).ops[0].value,'direct');
    await h.click(dictionaries.zh.chooseDirectory);assert.ok(h.doc.body.textContent.includes('/tmp/pdsh-chosen/exports'));
    await h.click(dictionaries.zh.saveAsk);assert.equal(h.writes.at(-1).ops[0].value,'ask');assert.ok(h.doc.body.textContent.includes('/tmp/pdsh-chosen/exports'));
  }finally{await h.close();}
});

test('模板仅确认写入；IME Enter 不提交，Escape 取消，远端字段冲突不覆盖',async()=>{
  const h=await fixture();try{
    await h.draft('演示 {date}');assert.equal(h.writes.length,0);await h.key('Enter',true);assert.equal(h.writes.length,0);await h.key('Escape');assert.equal(h.doc.querySelector('input'),null);assert.ok(h.doc.body.textContent.includes(exportModel.DEFAULT_CAPTURE_EXPORT.fileNamePattern));
    await h.draft('演示 {date}');await h.key('Enter');assert.equal(h.writes.length,1);assert.equal(h.writes[0].ops[0].value,'演示 {date}');assert.equal(h.writes[0].revision,7);
    await h.draft('本地 {time}');await h.remoteTemplate('远端 {date}');await h.key('Enter');assert.equal(h.writes.length,1);assert.ok(h.doc.querySelector('[role="alert"]'));await h.key('Escape');assert.equal(h.doc.querySelector('input'),null);assert.ok(h.doc.body.textContent.includes('远端 {date}'));
  }finally{await h.close();}
});

 test('目录仅在原生选择和 Host 接受后写入；取消、卸载和只读不写',async()=>{
  for(const selected of [null,'/tmp/pdsh-fixture']){const h=await fixture({chooseDirectory:async()=>selected});try{await h.click(dictionaries.zh.chooseDirectory);assert.equal(h.writes.length,selected?1:0);if(selected){assert.equal(h.writes[0].ops[0].path[0],'saveDirectory');assert.equal(h.writes[0].revision,7);assert.equal(h.writes[0].ops[0].value,selected);assert.ok(h.doc.body.textContent.includes('pdsh-fixture'));}await h.readonly();await h.click(dictionaries.zh.chooseDirectory);assert.equal(h.writes.length,selected?1:0);}finally{await h.close();}}
  let finish;const h=await fixture({chooseDirectory:()=>new Promise(resolve=>{finish=resolve;})});await h.click(dictionaries.zh.chooseDirectory);await h.close();finish('/tmp/pdsh-fixture');await new Promise(resolve=>setImmediate(resolve));assert.equal(h.writes.length,0);
});
