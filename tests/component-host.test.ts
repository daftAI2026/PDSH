/**
 * [INPUT]: 依赖生成 Host Config、root owner 的 captureEnabled observer、平台 helper 路径解析与纯 Settings 默认迁移。
 * [OUTPUT]: 验证唯一配置地址、仅所属事件刷新官方取像服务以及无 Main/Fetch 控制回退。
 * [POS]: 新 RC Host 组合合同；不执行原生 helper、不申请权限或写用户 profile，旧桥独立测试不证明此路径。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Config } from '../index.js';
import { observeCaptureEnabled, apply } from '../src/host/capture.ts';
import { resolveNativeCaptureHelperPath } from '../src/host/native-window-capture.ts';
import { fileURLToPath } from 'node:url';

test('唯一 Host Config 保留 pdsh 地址和既有偏好，拍照与导出字段不拆 namespace',()=>{
 const preferences=Config({nickname:'保留偏好',maskIdentity:false,useAccountAvatar:true});
 assert.equal(preferences.nickname.get(),'保留偏好');assert.equal(preferences.captureEnabled.get(),true);
 assert.equal(preferences.useAccountAvatar.get(),true);assert.equal(preferences.maskTitles.get(),false);
 assert.equal(Config({maskTitles:true}).maskTitles.get(),true);
});
test('Loader owner 才刷新 captureEnabled；其它路径/其它Fiber不能改取像世代',()=>{
 const owner={},listeners=[];let calls=0;
 const context={on(name,listener){assert.equal(name,'loader/volatile-update');listeners.push({owner,listener});return ()=>true;},get(name){assert.equal(name,'pdshWindowCapture');return {refreshCaptureEnabled(){calls++;}};}};
 observeCaptureEnabled(context);
 const emit=(fiber,paths)=>{for(const item of listeners)if(item.owner===fiber)item.listener(paths);};
 emit({},[['captureEnabled']]);emit(owner,[['maskIdentity']]);emit(owner,[['captureEnabled','unexpected']]);assert.equal(calls,0);
 emit(owner,[['captureEnabled']]);assert.equal(calls,1);
});
test('capture 配置 apply 只处理默认迁移，不碰 connection/Main/bootstrap 或取像',async()=>{
 const cleaned=[];
 const context={root:{loader:{await:async()=>{}}},settings:{describe:()=>[{ns:'pdsh',value:{saveDirectory:'/chosen',fileNamePattern:'chosen'}}]},
  inject(keys,callback){assert.deepEqual(keys,['settings']);callback(context);},effect(callback){cleaned.push(callback());},
  get connection(){assert.fail('新路径不使用旧连接');}};
 apply(context);await new Promise(resolve=>setImmediate(resolve));for(const cleanup of cleaned)cleanup();
 const source=readFileSync(new URL('../src/host/capture.ts',import.meta.url),'utf8');
 assert.doesNotMatch(source,/capture-bootstrap|createCaptureRoute|main\.cjs|fetch\.register|openCaptureBridge/);
});
test('原生 helper 是生成 Host 的包内相对资源，scope如实声明owned-window',()=>{
 const source=readFileSync(new URL('../src/host/window-capture-service.ts',import.meta.url),'utf8');
 assert.match(source,/helperPath: resolveNativeCaptureHelperPath\(process\.platform, process\.arch, import\.meta\.url\)/);
 const bundle = new URL('../index.js', import.meta.url);
 for (const arch of ['arm64', 'x64']) assert.equal(resolveNativeCaptureHelperPath('darwin', arch, bundle), fileURLToPath(new URL('./native/window-capture', bundle)));
 assert.equal(resolveNativeCaptureHelperPath('win32', 'x64', bundle), fileURLToPath(new URL('./native/windows/window-capture-x64.exe', bundle)));
 assert.equal(resolveNativeCaptureHelperPath('win32', 'arm64', bundle), undefined);
 assert.match(source,/pdshNativeWindowCapture/);assert.doesNotMatch(source,/capture-bootstrap|page-save-main|inspector/);
});
