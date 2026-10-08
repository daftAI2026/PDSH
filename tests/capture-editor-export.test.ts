/**
 * [INPUT]: 依赖真实编辑器、jsdom、Canvas 编码/绘制窄桩、可控保存回执与延迟 Node File.arrayBuffer。
 * [OUTPUT]: 验证导出回执/取消/迟到编码围栏、头像重拍提交与预览/导出共用新源，以及Tabs和选图取消结算。
 * [POS]: 编辑器导出、背景 Tabs 与本地导入取消合同；像素与原生保存均为窄桩，不证明图像视觉或 Electron 面板实机行为。
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
  const drawnSources=[];
  const context=new Proxy({canvas:null},{get(target,key){if(key in target)return target[key];if(key==='drawImage')return source=>drawnSources.push(source);if(String(key).startsWith('create'))return()=>({addColorStop(){}});return()=>{};},set(target,key,value){target[key]=value;return true;}});
  dom.window.HTMLCanvasElement.prototype.getContext=function(){context.canvas=this;return context;};
  const encoded=[];let delay=false;
  dom.window.HTMLCanvasElement.prototype.toBlob=function(fn,mime){const complete=()=>fn(new dom.window.Blob(['fixture'],{type:mime}));if(delay)encoded.push(complete);else complete();};
  const source=dom.window.document.createElement('canvas');source.width=120;source.height=80;
  const notices=[],saved=[],closed=[];
  const editor=mountCaptureWindowEditor(dom.window.document.querySelector('main'),{source,initialState:{...createCaptureWindowState({width:120,height:80}),background:{kind:'color',color:'#ffffff'}},preferenceStorage:null,locale:'zh',
    fileMetadata:{title:'snapshot-title',capturedAt:new Date(2026,9,1,13,2,3)},exportPreferences:{saveBehavior:'direct',saveDirectory:'/tmp/pdsh-fixture',saveFormat:'webp',fileNamePattern:'{title}-{width}x{height}-{time}'},
    onNotify:message=>notices.push(message),onClose:()=>closed.push(true),onSave:async(...args)=>{saved.push(args);return 'cancelled';},...options});
  return{dom,editor,notices,saved,closed,encoded,source,drawnSources,delay(){delay=true;},click(){dom.window.document.querySelector('[data-action="save"]').click();},
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

test('提交后断流保留编辑并提示检查目录，不伪称文件一定未保存',async()=>{
  const h=fixture({onSave:async()=>{throw new Error('save-unconfirmed');}});
  try{h.click();await h.flush();assert.equal(h.closed.length,0);assert.match(h.notices.at(-1),/无法确认.*检查.*目录/);}
  finally{h.close();}
});

test('原生Tabs端口按背景选中、切类立即应用并记住素材，卸载和忙碌不能继续修改', async () => {
  let props, latest, destroyed = 0;
  const h = fixture({ mountBackgroundTabs: (_container, input) => {
    props = input; latest = { value: input.value, disabled: input.disabled };
    return { update(value, disabled) { latest = { value, disabled }; }, destroy() { destroyed++; } };
  } });
  try {
    assert.equal(props.value, 'plain-color');
    const root = h.dom.window.document.querySelector('[data-pdsh-capture]');
    props.onChange('gradients');
    assert.deepEqual(h.editor.getState().background, { kind: 'preset', id: 'rose' });
    root.querySelector('[data-background="lagoon"]').click();
    props.onChange('none');
    assert.equal(h.editor.getState().background.kind, 'transparent');
    assert.equal(root.querySelectorAll('[role=tabpanel]:not([hidden])').length, 1);
    props.onChange('gradients');
    assert.equal(h.editor.getState().background.id, 'lagoon');
    assert.equal(latest.value, 'gradients');
    props.onChange('plain-color');
    assert.equal(h.editor.getState().background.color, '#ffffff');
    root.querySelector('[data-color-trigger=background]').click();
    assert.ok(root.querySelector('[data-color-popover]'));
    props.onChange('wallpapers');
    assert.equal(root.querySelector('[data-color-popover]'), null);
    assert.equal(h.editor.getState().background.id, 'sea');
    h.delay(); h.click();
    assert.equal(latest.disabled, true);
    props.onChange('none');
    assert.equal(h.editor.getState().background.id, 'sea');
    const destroyedBeforeClose = destroyed;
    h.editor.destroy();
    assert.equal(destroyed, destroyedBeforeClose + 1, 'close 只额外销毁仍挂载的 Tabs 实例一次');
    const stateAfterClose = h.editor.getState();
    const destroyedAfterClose = destroyed;
    props.onChange('none');
    assert.deepEqual(h.editor.getState(), stateAfterClose, '卸载后的回调不得修改编辑状态');
    assert.equal(destroyed, destroyedAfterClose, '卸载后的回调不得再销毁 Tabs 实例');
    h.encoded[0]?.(); await h.flush();
  } finally { h.close(); }
});

test('选图读取迟到不能覆盖后选的Tab或在卸载后改变状态/通知', async () => {
  for (const action of ['switch', 'close']) {
    let props;
    let releaseArrayBuffer;
    let readCalls = 0;
    let putCalls = 0;
    const decodeAttempts = [];
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/WQAAAABJRU5ErkJggg==', 'base64');
    const file = new File([png], 'fixture.png', { type: 'image/png' });
    Object.defineProperty(file, 'arrayBuffer', { configurable: true, value: () => {
      readCalls++;
      return new Promise(resolve => { releaseArrayBuffer = () => resolve(Uint8Array.from(png).buffer); });
    } });
    const oldCreateObjectURL = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => {
      decodeAttempts.push('decode');
      throw new Error('test must abort before image decode');
    } });
    const h = fixture({ mountBackgroundTabs: (_container, input) => { props = input; return {update(){},destroy(){}}; },
      galleryStore: {
        async list() { return []; }, async get() { return undefined; },
        async put() { putCalls++; }, async remove() {}, close() {},
      },
    });
    try {
      props.onChange('wallpapers');
      const input = h.dom.window.document.querySelector('[data-input=wallpaper]');
      Object.defineProperty(input, 'files', { value: [file] });
      input.dispatchEvent(new h.dom.window.Event('change', {bubbles:true}));
      await h.flush();
      assert.equal(readCalls, 1, 'the selected File read is deliberately held before header preflight');
      assert.equal(typeof releaseArrayBuffer, 'function');
      if (action === 'switch') props.onChange('none'); else h.editor.destroy();
      const before = h.editor.getState();
      const noticesBeforeRelease = h.notices.length;
      releaseArrayBuffer(); await h.flush(); await h.flush();
      assert.equal(h.editor.getState(), before);
      assert.equal(h.notices.length, noticesBeforeRelease, 'canceled import must not surface a late decode/storage notice');
      assert.deepEqual(decodeAttempts, [], 'abort after arrayBuffer read but before header/decode must not create an image URL');
      assert.equal(putCalls, 0, 'canceled import must not persist any media');
    } finally {
      h.close();
      if (oldCreateObjectURL) Object.defineProperty(URL, 'createObjectURL', oldCreateObjectURL);
      else delete (URL as unknown as Record<string, unknown>).createObjectURL;
    }
  }
});


test('旧后台阻止保存时保留编辑，提示正常加载而不误报目录', async () => {
  const h = fixture({onSave: async () => { throw new Error('runtime-not-current') }})
  try {
    h.click(); await h.flush()
    assert.equal(h.closed.length, 0)
    assert.match(h.notices.at(-1), /后台.*插件版本.*保留工作.*重新打开 DSH/)
    assert.doesNotMatch(h.notices.at(-1), /目录|权限/)
  } finally { h.close() }
})

test('头像开关失败时恢复原状态；成功重拍后预览和导出都使用新原生像素且不持久化头像覆盖', async () => {
  const writes=[];
  const initialState={...createCaptureWindowState({width:120,height:80}),avatarMaskEnabled:true,background:{kind:'color',color:'#ffffff'}};
  let replacementSource:HTMLCanvasElement|null=null;let fail=true;const retakes=[];
  const storage={getItem:()=>null,setItem:(key,value)=>writes.push([key,JSON.parse(value)])};
  const h=fixture({initialState,initialAvatarMaskEnabled:true,preferenceStorage:storage,
    onRetake:async(revision,privacyEnabled,avatarMaskEnabled)=>{retakes.push({revision,privacyEnabled,avatarMaskEnabled});if(fail)throw Error('capture failed');if(!replacementSource)throw Error('missing replacement');return{source:replacementSource,automaticRegions:[],avatarMaskEnabled};}});
  replacementSource=h.dom.window.document.createElement('canvas');replacementSource.width=140;replacementSource.height=90;
  const editor=h.editor;
  try{
    const root=h.dom.window.document.querySelector('[data-pdsh-capture]');
    const avatar=root.querySelector('[data-input="avatar-mask"]');
    assert.ok(avatar);
    assert.equal(avatar.checked,true);
    avatar.checked=false;avatar.dispatchEvent(new h.dom.window.Event('change',{bubbles:true}));await h.flush();
    assert.deepEqual(retakes,[{revision:1,privacyEnabled:true,avatarMaskEnabled:false}]);
    assert.equal(editor.getState().avatarMaskEnabled,true);
    assert.equal(editor.getState().sourceRevision,0);
    assert.equal(h.dom.window.document.querySelector('[data-input="avatar-mask"]').checked,true,'失败后复原稳定 checkbox');
    assert.equal(editor.getState().source.width,120,'失败不替换原 source');
    fail=false;
    const retryAvatar=h.dom.window.document.querySelector('[data-input="avatar-mask"]');
    retryAvatar.checked=false;retryAvatar.dispatchEvent(new h.dom.window.Event('change',{bubbles:true}));await h.flush();
    assert.deepEqual(retakes[1],{revision:1,privacyEnabled:true,avatarMaskEnabled:false});
    assert.equal(editor.getState().avatarMaskEnabled,false);
    assert.equal(editor.getState().sourceRevision,1);
    assert.equal(editor.getState().source.width,140);
    assert.equal(h.dom.window.document.querySelector('[data-input="avatar-mask"]').checked,false);
    assert.equal(writes.length,0,'会话头像覆盖不写入编辑器偏好或 Host 配置');
    const titleMask=h.dom.window.document.querySelector('[data-input="privacy"]');titleMask.checked=false;titleMask.dispatchEvent(new h.dom.window.Event('change',{bubbles:true}));await h.flush();
    assert.deepEqual(retakes[2],{revision:2,privacyEnabled:false,avatarMaskEnabled:false},'标题重拍保留已明确选择的会话头像值');
    assert.equal(editor.getState().privacyEnabled,false);
    assert.equal(editor.getState().avatarMaskEnabled,false);
    assert.equal(writes.length,1);
    assert.equal(Object.hasOwn(writes[0][1],'avatarMaskEnabled'),false,'标题偏好保存不携带头像覆盖');
    assert.equal(Object.hasOwn(writes[0][1],'avatarMaskOverride'),false,'头像覆盖来源也不持久化');
    const previewDraws=h.drawnSources.filter(source=>source===replacementSource).length;
    assert.ok(previewDraws>=1,'重拍后的工作台预览绘制新原生 canvas');
    h.dom.window.document.querySelector('[data-action="save"]').click();await h.flush();
    assert.ok(h.drawnSources.filter(source=>source===replacementSource).length>previewDraws,'导出再次使用同一新原生 canvas');
  }finally{h.close();}
});

test('没有本地头像覆盖时，普通重拍跟随返回的 accepted 头像状态', async () => {
  let replacementSource:HTMLCanvasElement|null=null;const requested=[];
  const initialState={...createCaptureWindowState({width:120,height:80}),avatarMaskEnabled:true,background:{kind:'color',color:'#ffffff'}};
  const h=fixture({initialState,initialAvatarMaskEnabled:true,onRetake:async(_revision,_privacyEnabled,avatarMaskOverride)=>{
    requested.push(avatarMaskOverride);
    if(!replacementSource)throw Error('missing replacement');
    return{source:replacementSource,automaticRegions:[],avatarMaskEnabled:false};
  }});
  replacementSource=h.dom.window.document.createElement('canvas');replacementSource.width=130;replacementSource.height=85;
  try{
    h.dom.window.document.querySelector('[data-action="retake"]').click();await h.flush();
    assert.deepEqual(requested,[undefined],'未显式切换时不把首拍默认值伪装成本地覆盖');
    assert.equal(h.editor.getState().avatarMaskEnabled,false);
    assert.equal(h.editor.getState().avatarMaskOverride,null);
    assert.equal(h.dom.window.document.querySelector('[data-input="avatar-mask"]').checked,false);
  }finally{h.close();}
});
