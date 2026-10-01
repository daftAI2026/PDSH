/**
 * [INPUT]: 依赖真实 Host exact route 与可控连接 opener，不触发 SIGUSR1 或实际 socket。
 * [OUTPUT]: 验证 consent、控制响应封套、连接 owner 世代、旧 release 退让与停止取消。
 * [POS]: 官方认证路由之内的插件控制合同；不冒充 Desktop 认证/安装锁集成证据。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCaptureRoute } from '../src/host/capture-route.ts';
const owner='11111111-1111-4111-8111-111111111111', next='22222222-2222-4222-8222-222222222222';
function fixture() {
  let consent=false; const connections=[], warnings=[];
  const control=createCaptureRoute(()=>consent, async signal=>{
    const item={calls:[],disposed:false,signal,async capture(...args){this.calls.push(args);},cancel(id){this.calls.push(['cancel',id]);},async dispose(){this.disposed=true;}}; connections.push(item);return item;
  },{warn:value=>warnings.push(value)});
  async function post(payload,extra={}) {
    const response=await control.route.fetch(new Request('http://127.0.0.1/api/pdsh.capture',{method:'POST',body:JSON.stringify({type:'client-request',rpcId:'control-only',method:'pdsh.capture',payload,...extra})}));
    return {status:response.status,...await response.json()};
  }
  return {...control,connections,warnings,post,allow(value=true){consent=value;}};
}
test('同意前不创建调试连接；只返回控制封套，不暴露内部错误或像素',async()=>{
  const h=fixture();try{
    const before=await h.post({op:'capture',requestId:owner,owner});assert.equal(before.result.ok,false);assert.equal(h.connections.length,0);
    h.allow();const captured=await h.post({op:'capture',requestId:next,owner});assert.equal(captured.result.ok,true);assert.deepEqual(h.connections[0].calls,[[next,owner]]);
    assert.equal(captured.rpcId,'control-only');assert.deepEqual(captured.result.value,{protocolVersion:1});
  }finally{await h.dispose();}
});
test('新 owner 接管后迟到的旧 release 不能释放新连接，cancel 也不跨世代',async()=>{
  const h=fixture();h.allow();try{
    await h.post({op:'capture',requestId:owner,owner});await h.post({op:'capture',requestId:next,owner:next});
    assert.equal(h.connections[0].disposed,true);assert.equal(h.connections[1].disposed,false);
    await h.post({op:'release',owner});await h.post({op:'cancel',requestId:owner,owner});
    assert.equal(h.connections[1].disposed,false);assert.equal(h.connections[1].calls.length,1);
    await h.post({op:'release',owner:next});assert.equal(h.connections[1].disposed,true);
  }finally{await h.dispose();}
});
test('停止后不创建连接，重新拒绝缺少/错误 owner 或任意 URL/代码操作',async()=>{
  const h=fixture();h.allow();await h.dispose();
  for(const payload of [{op:'capture',requestId:owner,owner},{op:'capture',requestId:owner},{op:'execute',owner,code:'arbitrary'},null]) {
    const response=await h.post(payload);assert.equal(response.result.ok,false);
  }assert.equal(h.connections.length,0);
});
test('已接受 consent 撤回直接在 Host abort 在途拍摄，不等待 Renderer release',async()=>{
  let allowed=true,started;const running=new Promise(resolve=>{started=resolve;});let signal;
  const h=createCaptureRoute(()=>allowed,async abort=>{signal=abort;return {capture:async()=>{started();await new Promise<void>(resolve=>abort.addEventListener('abort',()=>resolve(),{once:true}));},cancel(){},async dispose(){}};},{warn(){}});
  const work=h.route.fetch(new Request('http://127.0.0.1/api/pdsh.capture',{method:'POST',body:JSON.stringify({type:'client-request',rpcId:'pending',method:'pdsh.capture',payload:{op:'capture',owner,requestId:owner}})}));
  await running;allowed=false;h.refreshConsent();assert.equal(signal.aborted,true);await work;await h.dispose();
});

test('桥断连后一次失败会失效化旧连接，同一 Renderer 下一次重试重新建立',async()=>{
  const h=fixture();h.allow();try{
    assert.equal((await h.post({op:'capture',requestId:owner,owner})).result.ok,true);
    h.connections[0].capture=async()=>{throw new Error('transport closed');};
    assert.equal((await h.post({op:'capture',requestId:next,owner})).result.ok,false);
    assert.equal(h.connections[0].disposed,true,'失败连接须归还，不能永久缓存 dead socket');
    assert.equal((await h.post({op:'capture',requestId:next,owner})).result.ok,true);assert.equal(h.connections.length,2);
  }finally{await h.dispose();}
});

test('Main 调试关闭未知是连接隔离态，换 document owner 不能重新启动',async()=>{
  let opens=0;const h=createCaptureRoute(()=>true,async()=>{++opens;throw new Error('PDSH_MAIN_INSPECTOR_CLOSE_UNCONFIRMED');},{warn(){}});
  async function post(owner){const response=await h.route.fetch(new Request('http://localhost/api/pdsh.capture',{method:'POST',body:JSON.stringify({type:'client-request',rpcId:'state-fixture',method:'pdsh.capture',payload:{op:'capture',owner,requestId:owner}})}));return(await response.json()).result;}
  try{for(const identity of [owner,owner,next])assert.equal((await post(identity)).error.code,'pdsh/inspector-cleanup-unconfirmed');assert.equal(opens,1,'未知关闭不能随新页面 owner 清除');}finally{await h.dispose();}
});

test('旧连接归还失败变成明确控制隔离态，不把 rejected barrier 当永久泛化失败',async()=>{
  let opens=0;const guard={error:null};
  const h=createCaptureRoute(()=>true,async()=>{++opens;return{capture:async()=>{},cancel(){},dispose:async()=>{throw Error('fixture close unknown');}};},{warn(){}},guard);
  async function post(op,identity){const response=await h.route.fetch(new Request('http://localhost/api/pdsh.capture',{method:'POST',body:JSON.stringify({type:'client-request',rpcId:'state',method:'pdsh.capture',payload:{op,owner:identity,requestId:identity}})}));return(await response.json()).result;}
  assert.equal((await post('capture',owner)).ok,true);await post('release',owner);
  assert.equal((await post('capture',next)).error.code,'pdsh/control-cleanup-unconfirmed');assert.equal(opens,1);await h.dispose();
  const reloaded=createCaptureRoute(()=>true,async()=>{++opens;throw Error('must not open');},{warn(){}},guard);
  const reply=await reloaded.route.fetch(new Request('http://localhost/api/pdsh.capture',{method:'POST',body:JSON.stringify({type:'client-request',rpcId:'reload',method:'pdsh.capture',payload:{op:'capture',owner:next,requestId:next}})}));assert.equal((await reply.json()).result.error.code,'pdsh/control-cleanup-unconfirmed');assert.equal(opens,1);await reloaded.dispose();
});

test('排队的新页面在旧启动迟到的关闭未知后也必须停止，不越过归还 barrier',async()=>{
  let opens=0,fail;const guard={error:null};const h=createCaptureRoute(()=>true,()=>{++opens;return new Promise((_resolve,reject)=>{fail=reject;});},{warn(){}},guard);
  const request=identity=>h.route.fetch(new Request('http://localhost/api/pdsh.capture',{method:'POST',body:JSON.stringify({type:'client-request',rpcId:'queued',method:'pdsh.capture',payload:{op:'capture',owner:identity,requestId:identity}})})).then(response=>response.json());
  const first=request(owner);await new Promise(resolve=>setImmediate(resolve));const second=request(next);await new Promise(resolve=>setImmediate(resolve));fail(new Error('PDSH_MAIN_INSPECTOR_CLOSE_UNCONFIRMED'));
  for(const response of await Promise.all([first,second]))assert.equal(response.result.error.code,'pdsh/inspector-cleanup-unconfirmed');assert.equal(opens,1);await h.dispose();
});
