/**
 * [INPUT]: 依赖标题/拍照真实 Host 入口与官方合成配置、Loader、revision 接口桩。
 * [OUTPUT]: 验证旧值一次性继承、明确新值优先、owner 守卫、安装位置解析与启动中卸载不自等待。
 * [POS]: 三组件配置兼容门；不写用户 profile，也不启动 Main 调试接口。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Config, inheritLegacyTitles, apply } from '../src/host/titles.ts';
import { Config as CaptureConfig } from '../src/host/capture.ts';
function fixture({ raw = true, own = {}, module = new URL('../src/host/titles.ts', import.meta.url).href, revision = 7, wait = Promise.resolve() } = {}) {
  const mutations = [], disposers = [];
  const ctx = { root: { loader: { await: () => wait } }, fiber: {},
    inject(_keys, fn) { fn(ctx); }, effect(fn) { const off = fn(); disposers.push(off); return off; },
    configEditor: { configuration: () => [
      { entry: { options: { id: 'pdsh', name: '@daftai/pdsh', disabled: true, config: { maskTitles: raw, nickname: '别名' } } } },
      { entry: { options: { id: 'pdsh-titles', name: module, config: own } } },
    ] },
    settings: { configure: () => () => {}, describe: () => [{ ns: 'pdsh-titles', revision }], async mutate(...args) { mutations.push(args); return false; } }, logger: { warn() { assert.fail('正常迁移不得报错'); } },
  }; return { ctx, mutations, disposers };
}
test('三个独立 Config，标题只声明自己的布尔开关，拍照没有另一个 enabled 配置', () => {
  assert.equal(Config({}).maskTitles.get(), false); assert.throws(() => Config({ maskTitles: 'true' }));
  assert.equal(CaptureConfig({}).saveFormat.get(), 'png');
  assert.equal(CaptureConfig({}).saveDirectory.get(), join(homedir(), 'Downloads'));
  assert.equal(CaptureConfig({}).saveBehavior.get(), 'ask');
  assert.throws(()=>CaptureConfig({saveBehavior:'unknown'}));
  assert.equal(CaptureConfig({saveDirectory:'/tmp/fixture'}).saveDirectory.get(), '/tmp/fixture');
  assert.throws(()=>CaptureConfig({saveDirectory:'relative'}));
  assert.equal(CaptureConfig({ allowMainBridge: false }).fileNamePattern.get(), 'PDSH-screenshot-{date}-{time}');
  assert.throws(() => CaptureConfig({ saveFormat: 'gif' }));
  assert.throws(() => CaptureConfig({ fileNamePattern: '../escape' }));
});
for (const raw of [true, false]) test(`身份停用仍迁移旧标题值 ${raw}，使用官方 revision`, async () => {
  const h = fixture({ raw }); await inheritLegacyTitles(h.ctx);
  assert.deepEqual(h.mutations, [['pdsh-titles', [{ op: 'set', path: ['maskTitles'], value: raw }], 7]]);
});
test('明确新 false、未知模块/旧值不被迁移覆盖', async () => {
  for (const options of [{ own: { maskTitles: false } }, { module: 'other-plugin' }, { raw: 'true' }]) {
    const h = fixture(options); await inheritLegacyTitles(h.ctx); assert.equal(h.mutations.length, 0);
  }
});
test('Loader 未稳定时停用立即结束；迟到稳定不写配置', async () => {
  let settle; const wait = new Promise<void>(resolve => { settle = resolve; }), h = fixture({ wait }); apply(h.ctx);
  const result = h.disposers[1]();
  assert.equal(result, undefined, '卸载不能 await 仍等待 Loader/HMR 的迁移');
  settle(); await wait; await Promise.resolve(); assert.equal(h.mutations.length, 0);
});

test('拍照 Host exact route 随官方 register 的 owner.effect 卸载；再启用不占旧路径',async()=>{
  const { apply: mountCapture }=await import('../src/host/capture.ts'), routes=new Map(), events=new Set(),disposers=[];
  const ctx={fiber:{},logger:{warn(){}},inject(_keys,fn){fn(ctx);},
    effect(fn){const off=fn();if(typeof off==='function')disposers.push(off);return off;},
    settings:{configure(){return ()=>{};}},on(name,fn){events.add(fn);return ()=>events.delete(fn);},
    connection:{fetch:{register(route){return ctx.effect(()=>{assert.equal(routes.has(route.path),false);routes.set(route.path,route);return async()=>{routes.delete(route.path);};});}}}};
  for(let cycle=0;cycle<2;cycle++){
    mountCapture(ctx,CaptureConfig({}));assert.equal(routes.size,1);assert.equal(events.size,0);
    const response=await routes.get('/api/pdsh.capture').fetch(new Request('http://localhost/api/pdsh.capture',{method:'POST',body:JSON.stringify({type:'client-request',rpcId:'disabled',method:'pdsh.capture',payload:{op:'capture',owner:'11111111-1111-4111-8111-111111111111',requestId:'11111111-1111-4111-8111-111111111111'}})}));
    assert.equal((await response.json()).result.ok,false);
    for(const off of disposers.splice(0).reverse())await off();assert.equal(routes.size,0);assert.equal(events.size,0);
  }
});

test('Main 身份首次读取失败后出现关闭未知，重装读到身份也不能当新世代清除',async()=>{
  const {readFileSync}=await import('node:fs'),{transformSync}=await import('esbuild'),{runInNewContext}=await import('node:vm');
  const schema=(await import('@deepseek-ai/schemastery')).default,model=await import('../src/shared/capture-export.ts');
  let identity,guard;const context={module:{exports:{}},exports:null,process:{ppid:123},require(id){
    if(id==='node:url')return{fileURLToPath(){return '/fixture';}};
    if(id==='node:os')return{homedir:()=>'/fixture/home'};
    if(id==='node:path')return{join};
    if(id==='./capture-bootstrap.ts')return{readMainIdentity(){if(!identity)throw Error('fixture identity unavailable');return identity;}};
    if(id==='./capture-route.ts')return{createCaptureRoute(_active,_open,_logger,value){guard=value;return{route:{},dispose(){}};}};
    if(id==='@deepseek-ai/schemastery')return schema;
    if(id==='../shared/capture-export.ts')return model;
    if(id==='../shared/capture-trace.ts')return{createCaptureTrace:()=>()=>{}};throw Error(id);
  }};context.exports=context.module.exports;
  runInNewContext(transformSync(readFileSync(new URL('../src/host/capture.ts',import.meta.url),'utf8'),{loader:'ts',format:'cjs'}).code,context);
  const ctx={fiber:{},logger:{},inject(_keys,fn){fn(ctx);},effect(fn){fn();},settings:{configure(){}},connection:{fetch:{register(){}}}};
  context.module.exports.apply(ctx,{});const first=guard;first.error=new Error('PDSH_MAIN_INSPECTOR_CLOSE_UNCONFIRMED');identity='/app/Main first-start';context.module.exports.apply(ctx,{});assert.equal(guard,first);assert.ok(guard.error);
  // 已知旧世代与明确新世代才允许新的 guard。
  const knownContext={...context,module:{exports:{}},exports:null};knownContext.exports=knownContext.module.exports;
  runInNewContext(transformSync(readFileSync(new URL('../src/host/capture.ts',import.meta.url),'utf8'),{loader:'ts',format:'cjs'}).code,knownContext);knownContext.module.exports.apply(ctx,{});const known=guard;known.error=new Error('fixture');identity='/app/Main second-start';knownContext.module.exports.apply(ctx,{});assert.notEqual(guard,known);assert.equal(guard.error,null);
});

test('旧空目录和旧默认品牌经 Host revision 修正；自定义字段和迟到卸载不写',async()=>{
  const {normalizeLegacyCaptureExport}=await import('../src/host/capture.ts');
  const writes=[],ctx={root:{loader:{await:async()=>{}}},settings:{describe:()=>[{ns:'pdsh-capture',value:{saveDirectory:'',fileNamePattern:'DSH {date} at {time}'},revision:9}],mutate:async(...args)=>{writes.push(args);return true;}}};
  await normalizeLegacyCaptureExport(ctx);assert.deepEqual(writes,[['pdsh-capture',[{op:'set',path:['saveDirectory'],value:join(homedir(),'Downloads')},{op:'set',path:['fileNamePattern'],value:'PDSH-screenshot-{date}-{time}'}],9]]);
  writes.length=0;ctx.settings.describe=()=>[{ns:'pdsh-capture',value:{saveDirectory:'/tmp/chosen',fileNamePattern:'custom-{title}'},revision:9}];await normalizeLegacyCaptureExport(ctx);assert.equal(writes.length,0);
  ctx.settings.describe=()=>[{ns:'pdsh-capture',value:{saveDirectory:'',fileNamePattern:'DSH {date} at {time}'},revision:9}];await normalizeLegacyCaptureExport(ctx,()=>true);assert.equal(writes.length,0);
});

test('Main 模块相对实际 Host URL 解析，支持不同盘符、UNC、空格和中文，不依赖 cwd',async()=>{
  const {readFileSync}=await import('node:fs'),{transformSync}=await import('esbuild'),{runInNewContext}=await import('node:vm');
  const {fileURLToPath}=await import('node:url'),schema=(await import('@deepseek-ai/schemastery')).default,model=await import('../src/shared/capture-export.ts');
  const source=readFileSync(new URL('../src/host/capture.ts',import.meta.url),'utf8');
  const generated=readFileSync(new URL('../components/capture/index.js',import.meta.url),'utf8');
  assert.match(generated,/fileURLToPath\(new URL\("\.\/main\.cjs", import\.meta\.url\)\)/,'构建不能把安装地址固化为开发机路径');
  for(const [url,windows,expected] of [
    ['file:///opt/DSH%20Plugins/%E4%B8%AD%E6%96%87/components/capture/index.js',false,'/opt/DSH Plugins/中文/components/capture/main.cjs'],
    ['file:///D:/Apps/DSH%20Plugins/%E4%B8%AD%E6%96%87/components/capture/index.js',true,'D:\\Apps\\DSH Plugins\\中文\\components\\capture\\main.cjs'],
    ['file://server/share/PDSH%23test/components/capture/index.js',true,'\\\\server\\share\\PDSH#test\\components\\capture\\main.cjs'],
  ] as const){
    let open,path;
    const context={module:{exports:{} as any},exports:null,URL,process:{ppid:45},require(id){
      if(id==='node:url')return{fileURLToPath(value){return fileURLToPath(value,{windows});}};
      if(id==='node:os')return{homedir:()=>'/fixture/home'};
      if(id==='node:path')return{join};
      if(id==='./capture-bootstrap.ts')return{readMainIdentity:()=>'/fixture/main',openCaptureBridge(value){path=value;return Promise.resolve();}};
      if(id==='./capture-route.ts')return{createCaptureRoute(_active,opener){open=opener;return{route:{},dispose(){}};}};
      if(id==='@deepseek-ai/schemastery')return schema;
      if(id==='../shared/capture-export.ts')return model;
      if(id==='../shared/capture-trace.ts')return{createCaptureTrace:()=>()=>{}};throw Error(id);
    }};context.exports=context.module.exports;
    runInNewContext(transformSync(source,{loader:'ts',format:'cjs',define:{'import.meta.url':JSON.stringify(url)}}).code,context);
    const ctx={root:{loader:{await:async()=>{}}},fiber:{},logger:{},inject(_keys,fn){fn(ctx);},effect(fn){fn();},settings:{configure(){},describe:()=>[]},connection:{fetch:{register(){}}}};
    context.module.exports.apply(ctx,{});await open(new AbortController().signal,'11111111-1111-4111-8111-111111111111');
    assert.equal(path,expected);
  }
});
