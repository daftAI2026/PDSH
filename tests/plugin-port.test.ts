/**
 * [INPUT]: 依赖真实插件 Renderer port、jsdom 页面及官方 rpc 控制桩。
 * [OUTPUT]: 验证像素不经 RPC、nonce/ID 围栏、取消迟到、唯一接收器与停用回收。
 * [POS]: 插件自带桥 Renderer 合同，不冒充已安装 Main 集成验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountPluginCapturePort } from '../src/client/capture/plugin-port.ts';
import { CAPTURE_RECEIVER } from '../src/shared/capture-bridge.ts';
const id = '11111111-1111-4111-8111-111111111111';
function setup() {
  const dom = new JSDOM('<body/>'), calls = [];
  const connection = mountPluginCapturePort(dom.window.document, { async call(...args) { calls.push(args); return { ok: true, value: { protocolVersion: 1 } }; } });
  return { dom, calls, ...connection, receiver: dom.window[Symbol.for(CAPTURE_RECEIVER)] };
}
test('只通过 rpc 发关联 ID；Main nonce 对应才接收 PNG，接收后拒绝重放', async () => {
  const h = setup(); try {
    const work = h.port.capturePng(id), state = h.receiver.probe(id);
    assert.deepEqual(h.calls, [['/api', 'pdsh.capture', { op: 'capture', requestId: id, owner: state.nonce }]]);
    assert.equal(h.receiver.receive(id, 'old-document', 'aGVsbG8='), false);
    assert.equal(h.receiver.receive(id, state.nonce, 'aGVsbG8='), true);
    assert.equal(Buffer.from((await work).png).toString(), 'hello');
    assert.equal(h.receiver.probe(id), null); assert.equal(h.receiver.receive(id, state.nonce, 'aGVsbG8='), false);
  } finally { h.dispose(); h.dom.window.close(); }
});
test('取消/停用拒绝迟到；无法同时装配第二个 receiver，不写 preload/global screenshot', async () => {
  const h = setup(); try {
    assert.throws(() => mountPluginCapturePort(h.dom.window.document, {}), /already owned/);
    const work = h.port.capturePng(id), rejected = assert.rejects(work); await h.port.cancel(id); await rejected;
    assert.equal(h.receiver.probe(id), null);
    const next = h.port.capturePng(id), nextRejected = assert.rejects(next); h.dispose(); await nextRejected;
    assert.equal(h.dom.window[Symbol.for(CAPTURE_RECEIVER)], undefined);
    assert.equal(h.dom.window.dshDesktop, undefined);
    await assert.rejects(h.port.capturePng(id));
  } finally { h.dispose(); h.dom.window.close(); }
});

test('可见 iframe/webview 明确标为未证明覆盖，隐藏内容不影响普通页面',async()=>{
  const h=setup(), work=h.port.capturePng(id), rejected=assert.rejects(work);
  try{
    const embed=h.dom.window.document.createElement('iframe');embed.getBoundingClientRect=()=>({left:0,top:0,right:100,bottom:100,width:100,height:100} as DOMRect);h.dom.window.document.body.append(embed);
    assert.equal(h.receiver.probe(id).unsupportedEmbed,true);embed.style.visibility='hidden';assert.equal(h.receiver.probe(id).unsupportedEmbed,false);
    h.dispose();await rejected;
  }finally{h.dispose();h.dom.window.close();}
});

test('保存只发控制 UUID；导出内容由固定接收器交付，目录不进入 RPC',async()=>{
  const dom=new JSDOM('<body/>'),calls=[];
  let connection;
  const rpc={async call(...args){calls.push(args);const payload=args[2];if(payload.op==='save'){
    const receiver=dom.window[Symbol.for(CAPTURE_RECEIVER)];
    assert.equal(await receiver.exportData(payload.requestId,'old-owner'),null);
    const data=await receiver.exportData(payload.requestId,payload.owner);
    assert.equal(data.fileName,'demo.png');assert.equal(data.directory,'/tmp/pdsh-only-fixture');assert.equal(data.base64,'aGVsbG8=');assert.equal(data.saveBehavior,'direct');
    assert.equal(await receiver.exportData(payload.requestId,payload.owner),null,'只交付一次冻结导出');
    return {ok:true,value:{protocolVersion:1,outcome:'saved'}};
  }return {ok:true,value:{protocolVersion:1}};}};
  connection=mountPluginCapturePort(dom.window.document,rpc);
  try{assert.equal(await connection.save(new dom.window.Blob(['hello'],{type:'image/png'}),'demo.png','/tmp/pdsh-only-fixture','direct'),'saved');
    assert.equal(calls[0][2].op,'save');assert.deepEqual(Object.keys(calls[0][2]).sort(),['op','owner','requestId']);
    assert.doesNotMatch(JSON.stringify(calls.map(call=>call.slice(0,3))),/hello|demo\.png|pdsh-only-fixture/);
  }finally{connection.dispose();dom.window.close();}
});
test('保存取消或回执失效不能误报 saved；停用 abort 并撤回自有导出',async()=>{
  for(const outcome of ['cancelled','unknown']){
    const dom=new JSDOM('<body/>'),connection=mountPluginCapturePort(dom.window.document,{async call(){return{ok:true,value:{protocolVersion:1,outcome}};}});
    try{const work=connection.save(new dom.window.Blob(['x'],{type:'image/png'}),'demo.png','');if(outcome==='cancelled')assert.equal(await work,'cancelled');else await assert.rejects(work);}
    finally{connection.dispose();dom.window.close();}
  }
  const dom=new JSDOM('<body/>');let request,signal;
  const connection=mountPluginCapturePort(dom.window.document,{call(_channel,_endpoint,payload,s){if(payload.op!=='save')return Promise.resolve({ok:true,value:{protocolVersion:1}});request=payload;signal=s;return new Promise(()=>{});}});
  try{const work=connection.save(new dom.window.Blob(['x'],{type:'image/png'}),'demo.png',''),rejected=assert.rejects(work);
    const receiver=dom.window[Symbol.for(CAPTURE_RECEIVER)];connection.dispose();await rejected;assert.equal(signal.aborted,true);assert.equal(await receiver.exportData(request.requestId,request.owner),null);
  }finally{connection.dispose();dom.window.close();}
});

test('编辑器级取消只撤回对应保存请求，保持取像接收器并允许下次保存',async()=>{
  const dom=new JSDOM('<body/>'), calls=[];let signal, finish;
  const connection=mountPluginCapturePort(dom.window.document,{call(_channel,_endpoint,payload,s){calls.push(payload);if(payload.op==='save'){signal=s;return new Promise(resolve=>{finish=resolve;});}return Promise.resolve({ok:true,value:{protocolVersion:1}});}});
  try{const owner=new dom.window.AbortController(),work=connection.save(new dom.window.Blob(['x'],{type:'image/png'}),'demo.png','','ask',owner.signal),rejected=assert.rejects(work);
    const receiver=dom.window[Symbol.for(CAPTURE_RECEIVER)],request=calls[0];assert.ok(await receiver.exportData(request.requestId,request.owner));owner.abort();await rejected;
    assert.equal(signal.aborted,true);assert.equal(calls.filter(x=>x.op==='cancel'&&x.requestId===request.requestId).length,1);assert.equal(dom.window[Symbol.for(CAPTURE_RECEIVER)],receiver);assert.equal(await receiver.exportData(request.requestId,request.owner),null);
    const next=connection.save(new dom.window.Blob(['next'],{type:'image/png'}),'next.png');finish({ok:true,value:{protocolVersion:1,outcome:'saved'}});assert.equal(await next,'saved');
  }finally{connection.dispose();dom.window.close();}
});
