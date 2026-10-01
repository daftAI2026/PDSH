/**
 * [INPUT]: 依赖真实相机控制器、viewport、Renderer port、Host route 和 bootstrap；只有父 Main 副作用由拒绝桩代替。
 * [OUTPUT]: 验证点击到桥端口拒绝的完整错误传播、共同 request UUID 与关键阶段，无编辑器假成功。
 * [POS]: 跨运行时失败归因回归；不打开真实调试接口，不冒充 Desktop 成功取像证据。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createCaptureBootstrap } from '../src/host/capture-bootstrap.ts';
import { createCaptureRoute } from '../src/host/capture-route.ts';
import { mountPluginCapturePort } from '../src/client/capture/plugin-port.ts';
import { captureViewport } from '../src/client/capture/viewport.ts';
import { mountCaptureController } from '../src/client/capture/controller.ts';
import { createCaptureTrace } from '../src/shared/capture-trace.ts';
test('点击确实触发但 Main 端口占用：跨端统一 UUID，失败落在 bootstrap 而非解码或编辑器',async()=>{
  const dom=new JSDOM('<html lang="zh"><body/></html>',{url:'https://dsh.test/'}),logs=[],notices=[],sideEffects=[];
  const logger={info(...args){logs.push(args);},warn(){assert.fail('端口占用不应归因为关闭未知');}};
  const hostTrace=createCaptureTrace(logger,'host'),rendererTrace=createCaptureTrace(logger,'renderer');
  const executable='/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness';
  const open=createCaptureBootstrap({platform:'darwin',electron:'44.0.0',argv:['/node_modules/@deepseek-ai/dsh-desktop-host/lib/index.js'],pid:45,execPath:executable,identity:()=>`${executable} Tue Oct 1`,listeners:()=> '127.0.0.1:9229',signalMain(){sideEffects.push('signal');},inspectorClient(){sideEffects.push('connect');}});
  const host=createCaptureRoute(()=>true,(signal,id)=>open('/private/secret/main.cjs',signal,phase=>hostTrace(phase,id)),logger);
  const receiver=mountPluginCapturePort(dom.window.document,{async call(_path,method,payload){const response=await host.route.fetch(new Request('http://localhost/api/pdsh.capture',{method:'POST',body:JSON.stringify({type:'client-request',rpcId:'trace-only',method,payload})}));return (await response.json()).result;}},rendererTrace);
  const controller=mountCaptureController(dom.window.document,{trace:rendererTrace,notify:message=>notices.push(message),waitFrame:async()=>{},capture:(doc,options)=>captureViewport(doc,{...options,port:receiver.port,trace:rendererTrace}),openEditor(){assert.fail('桥失败不能开编辑器');return null;}});
  try{
    await controller.activate();assert.match(notices.at(-1),/预设调试端口被占用/);assert.equal(controller.state().disabled,false);
    const phases=logs.map(row=>row[2]);assert.deepEqual(phases,['capture-click','pixels-start','renderer-requested','request-received','bootstrap-start','bootstrap-port-busy','renderer-failed','capture-failed']);
    assert.equal(new Set(logs.map(row=>row[3])).size,1,'点击、Host 与 Renderer 必须使用同一 request UUID');assert.deepEqual(sideEffects,[]);
    assert.doesNotMatch(JSON.stringify(logs),/private|secret|main\.cjs|owner|nonce|base64/);
  }finally{controller.dispose();receiver.dispose();await host.dispose();dom.window.close();}
});
