/**
 * [INPUT]: 依赖真实 CaptureSettingsCard、唯一 Host ConfigForm、React/jsdom 与仅替代原生控件外观的桩。
 * [OUTPUT]: 验证身份/标题/截图展示顺序、旧 Host 截图配置就绪围栏与后续恢复，以及截图偏好的 revision、冲突、只读/失败/卸载合同。
 * [POS]: 唯一 pdsh ConfigForm 的拍照设置合同；旧 ready schema 不可误写 fallback 值，不读文件或像素，也不启动 Main 连接。
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
import { readCaptureDirectoryPicker } from '../src/client/capture/directory.ts';
import { dictionaries } from '../src/shared/locales.ts';
async function fixture({ chooseDirectory = null, value = { ...exportModel.DEFAULT_CAPTURE_EXPORT, captureEnabled: true, captureMaskIdentity: true, saveDirectory: '/tmp/pdsh-default/Downloads', allowMainBridge: false }, status = 'ready', writable = true } = {}) {
  const dom=new JSDOM('<body><main/></body>'), descriptors=new Map(['window','document','IS_REACT_ACT_ENVIRONMENT'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
  const module={exports:{}};
  runInNewContext(transformSync(readFileSync(new URL('../src/client/capture-settings.tsx',import.meta.url),'utf8'),{loader:'tsx',format:'cjs'}).code,{module,exports:module.exports,require(id){
    if(id==='react')return React;if(id==='@deepseek-ai/dsh-client-ui-primitives')return {Button:({children,variant,...props})=>React.createElement('button',props,children),Switch:({checked,label,disabled,onChange})=>React.createElement('button',{type:'button',role:'switch','aria-label':label,'aria-checked':String(checked),disabled,onClick:onChange}),Input:props=>React.createElement('input',props),Tooltip:({children,label,...props})=>React.createElement('span',{'data-tooltip':label},children),IconEditOutlineRegular:()=>null,IconCheckOutlineRegular:()=>null};if(id==='../shared/capture-export.ts')return exportModel;throw new Error(id);
  }});
  const {createRoot}=await import('react-dom/client'),root=createRoot(dom.window.document.querySelector('main')),listeners=new Set(),writes=[];
  let state={status,writable,revision:7,value},accepted=true;
  const form={getSnapshot:()=>state,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},async mutate(ops,revision){writes.push({ops,revision});if(accepted){state={...state,revision:state.revision+1,value:{...state.value,[ops[0].path[0]]:ops[0].value}};for(const fn of listeners)fn();}return accepted;}};
  await act(async()=>root.render(React.createElement(module.exports.CaptureSettingsCard,{form,chooseDirectory,t:key=>dictionaries.zh[key]})));
  return {doc:dom.window.document,writes,accept(value){accepted=value;},async snapshot(next){await act(async()=>{state={...state,...next};for(const fn of listeners)fn();});},async readonly(){await act(async()=>{state={...state,writable:false};for(const fn of listeners)fn();});},
    async click(label='JPEG'){await act(async()=>{const button=[...dom.window.document.querySelectorAll('button')].find(button=>button.textContent===label||button.getAttribute('aria-label')===label);assert.ok(button,`Missing button ${label}`);button.click();});},
    async draft(value){if(!dom.window.document.querySelector('input'))await this.click(dictionaries.zh.editFileName);await act(async()=>{const input=dom.window.document.querySelector('input');Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});},
    async key(key,composing=false){await act(async()=>dom.window.document.querySelector('input').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,isComposing:composing,bubbles:true})));},
    async remoteTemplate(value){await act(async()=>{state={...state,revision:state.revision+1,value:{...state.value,fileNamePattern:value}};for(const fn of listeners)fn();});},
    async close(){await act(async()=>root.unmount());dom.window.close();for(const[key,descriptor]of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}assert.equal(listeners.size,0);}};
}
test('拍照设置呈现独立身份遮挡和导出选项，不再常驻风险警告和二次启用按钮',async()=>{
  const h=await fixture();try{
    assert.doesNotMatch(h.doc.body.textContent,/调试接口|极端启动失败|接受风险|停用取像桥/);
    for(const name of ['PNG','JPEG','WebP'])assert.ok([...h.doc.querySelectorAll('button')].some(button=>button.textContent===name));
    assert.ok(h.doc.querySelector('button[aria-label="'+dictionaries.zh.editFileName+'"]'));
    assert.equal(h.doc.querySelectorAll('.pdsh-detail-row').length,5);assert.equal(h.doc.querySelectorAll('.pdsh-hint').length,0);
    assert.equal(h.doc.querySelector('[role="switch"]').getAttribute('aria-checked'),'true');
    assert.equal(h.writes.length,0,'挂载不重写用户配置');
  }finally{await h.close();}
});
test('旧 Host ready Config 不把导出 fallback 当作可写配置，恢复完整快照后继续工作',async()=>{
  const oldConfig={maskIdentity:false,maskTitles:true};let pickerCalls=0;
  const h=await fixture({value:oldConfig,chooseDirectory:async()=>{pickerCalls++;return '/tmp/pdsh-recovered';}});try{
    assert.ok(h.doc.body.textContent.includes(dictionaries.zh.captureConfigurationUnavailable),'只在旧 Host ready schema 上提示保留工作并重启');
    assert.doesNotMatch(dictionaries.zh.captureConfigurationUnavailable,/目录|权限|folder|permission/i,'升级边界不应误归因路径或操作系统权限');
    assert.ok(!h.doc.body.textContent.includes(dictionaries.zh.directoryUnavailable),'旧 schema 的空 fallback 目录不能另行提示“目录尚未就绪”');
    assert.ok(h.doc.body.textContent.includes('—'),'旧 schema 不展示 resolve fallback 目录值或目录错误归因');
    assert.equal(h.doc.querySelector('[role="switch"][aria-label="'+dictionaries.zh.captureEnabled+'"]').getAttribute('aria-checked'),'false','缺失的 captureEnabled 必须关闸');
    assert.ok([...h.doc.querySelectorAll('.pdsh-fields-group button')].every(button=>button.disabled),'旧 Host 下所有截图字段都不可写');
    for(const action of [dictionaries.zh.captureEnabled,dictionaries.zh.captureMaskIdentity,'JPEG','WebP',dictionaries.zh.saveDirect,dictionaries.zh.chooseDirectory,dictionaries.zh.editFileName]) await h.click(action);
    assert.equal(h.writes.length,0,'旧 schema 的所有截图字段写入均被阻止');assert.equal(pickerCalls,0,'旧 schema 不得打开目录选择器');

    await h.snapshot({status:'loading'});assert.doesNotMatch(h.doc.body.textContent,new RegExp(dictionaries.zh.captureConfigurationUnavailable));
    await h.snapshot({status:'ready',value:{...exportModel.DEFAULT_CAPTURE_EXPORT,captureEnabled:true,captureMaskIdentity:false,saveDirectory:''}});
    assert.doesNotMatch(h.doc.body.textContent,new RegExp(dictionaries.zh.captureConfigurationUnavailable),'后续完整 accepted snapshot 恢复时清除提示');
    assert.ok(h.doc.body.textContent.includes(dictionaries.zh.directoryUnavailable),'完整但显式空目录继续使用原有目录状态文案');
    assert.equal(h.doc.querySelector('[role="switch"][aria-label="'+dictionaries.zh.captureEnabled+'"]').getAttribute('aria-checked'),'true');
    await h.click('JPEG');assert.equal(h.writes[0].ops[0].path[0],'saveFormat','完整配置含 legacy empty directory 仍允许原有设置功能');
    await h.click(dictionaries.zh.chooseDirectory);assert.equal(pickerCalls,1);assert.equal(h.writes[1].ops[0].path[0],'saveDirectory');
  }finally{await h.close();}
});

test('capture readiness 要求完整 accepted 字段，但接受明确为空的 legacy 目录',()=>{
  assert.equal(dictionaries.zh.captureConfigurationUnavailable,'截图组件尚未加载此版本配置，保留工作后重新启动DSH。');
  assert.equal(dictionaries.en.captureConfigurationUnavailable,'Capture settings have not loaded for this version. Save your work, then restart DSH.');
  const complete={...exportModel.DEFAULT_CAPTURE_EXPORT,captureEnabled:true,captureMaskIdentity:false,saveDirectory:''};
  assert.equal(exportModel.isCaptureConfigurationReady({maskIdentity:false,maskTitles:true}),false);
  for(const field of ['captureEnabled','captureMaskIdentity','saveBehavior','saveDirectory','saveFormat','fileNamePattern']){
    const partial:Record<string,unknown>={...complete};delete partial[field];assert.equal(exportModel.isCaptureConfigurationReady(partial),false,`missing ${field} is not a writable capture config`);
  }
  assert.equal(exportModel.isCaptureConfigurationReady({...complete,saveFormat:undefined}),false,'invalid accepted values cannot make export fallbacks writable');
  assert.equal(exportModel.isCaptureConfigurationReady(complete),true,'an explicit empty legacy directory is still a complete setting');
});
test('格式即时保存沿用 Host revision，旧授权值不影响组件设置',async()=>{
  const h=await fixture();try{
    await h.click();assert.deepEqual(JSON.parse(JSON.stringify(h.writes)),[{ops:[{op:'set',path:['saveFormat'],value:'jpeg'}],revision:7}]);
    assert.doesNotMatch(h.doc.body.textContent,/JPEG 不支持透明/);await h.click('WebP');assert.equal(h.writes[1].revision,8);assert.equal(h.writes[1].ops[0].value,'webp');
  }finally{await h.close();}
});
test('保存失败有反馈，只读不能写，不因正式宿主桥而隐藏导出选项',async()=>{
  const h=await fixture();try{h.accept(false);await h.click();assert.ok(h.doc.querySelector('[role="alert"]'));await h.readonly();await h.click();assert.equal(h.writes.length,1);}finally{await h.close();}
  const native=await fixture();try{assert.equal(native.doc.querySelectorAll('button').length,9);assert.doesNotMatch(native.doc.body.textContent,/调试接口/);}finally{await native.close();}
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

test('截图身份遮挡开关默认开启并独立写入 Host revision，不改常驻身份覆盖',async()=>{
  const h=await fixture();try{
    const toggle=()=>h.doc.querySelector('[role="switch"][aria-label="'+dictionaries.zh.captureMaskIdentity+'"]');
    assert.ok(h.doc.body.textContent.includes(dictionaries.zh.captureMaskIdentity),'Plugins 设置行显示明确身份遮挡标签');
    assert.equal(toggle()?.getAttribute('aria-checked'),'true');
    assert.equal(h.writes.length,0,'挂载不改写 Host 配置');
    await h.click(dictionaries.zh.captureMaskIdentity);
    assert.deepEqual(JSON.parse(JSON.stringify(h.writes)),[{ops:[{op:'set',path:['captureMaskIdentity'],value:false}],revision:7}]);
    assert.equal(toggle()?.getAttribute('aria-checked'),'false');
    assert.equal(h.writes.some(write=>write.ops[0].path[0]==='maskIdentity'),false,'拍照偏好不能改变常驻身份显示');
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

test('目录校验往返接受 POSIX、Windows drive-root 与 UNC 路径并拒绝相对/控制字符路径', async () => {
  const accepted = ['/Users/alice/Downloads', 'C:\\', 'C:\\Users\\alice\\Downloads', '\\\\server\\share', '\\\\server\\share\\exports'];
  for (const path of accepted) {
    assert.equal(exportModel.resolveCaptureExportPreferences({ saveDirectory: path }).saveDirectory, path);
    const picker = readCaptureDirectoryPicker({ defaultView: { __DSH_DIRECTORY_PICKER__: { pick: async () => path } } } as unknown as Document);
    assert.ok(picker);
    assert.equal(await picker(), path);
  }
  for (const path of ['relative', 'C:relative', 'C:', '\\Users\\alice', 'C:/Users/alice', 'C:\\bad?folder', 'C:\\bad\nfolder', '/tmp/bad\u0085folder', '//?/C:/Users/alice', '//./pipe/endpoint', '\\\\.\\pipe\\endpoint', '\\\\.\\GLOBALROOT\\Device\\HarddiskVolume1\\dir']) {
    assert.equal(exportModel.isCaptureSaveDirectory(path), false, `unsafe/non-native directory syntax: ${path}`);
    assert.equal(exportModel.resolveCaptureExportPreferences({ saveDirectory: path }).saveDirectory, '');
    const picker = readCaptureDirectoryPicker({ defaultView: { __DSH_DIRECTORY_PICKER__: { pick: async () => path } } } as unknown as Document);
    assert.ok(picker);
    await assert.rejects(picker(), /Directory selection unavailable/);
  }
});


test('插件详情依次显示身份、标题打码和截图设置，不改字段所属表单', () => {
  const source = readFileSync(new URL('../src/client/component-runtime.tsx', import.meta.url), 'utf8');
  const render = source.slice(source.indexOf("if (view === 'summary')"), source.indexOf('export function apply'));
  const identity = render.indexOf('<SettingsCard ');
  const titles = render.indexOf('<TitleSettingsCard ');
  const capture = render.indexOf('<CaptureSettingsCard ');
  assert.ok(identity >= 0 && identity < titles && titles < capture, '身份必须先于标题打码和截图设置');
  assert.match(render, /<SettingsCard[^>]*preferencesForm=\{form\}[^>]*showTitles=\{false\}/);
  const runtime=readFileSync(new URL('../src/client/component-runtime.tsx',import.meta.url),'utf8');
  assert.match(runtime,/isCaptureConfigurationReady/,'Camera assembly must require the accepted capture-settings contract');
  assert.match(runtime,/snapshot\.status === 'ready' && isCaptureConfigurationReady\(snapshot\.value\) && snapshot\.value\?\.captureEnabled === true/,'legacy Host settings cannot default captureEnabled to on');
});
