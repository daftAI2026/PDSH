/**
 * [INPUT]: 依赖纯导出偏好/预算、真实合成尺寸、可替换画布编码器与固定枚举诊断。
 * [OUTPUT]: 验证5K边距和分配前预算、编码字节上限、basename、MIME、JPEG临时画布释放及日志脱敏。
 * [POS]: 设置到编辑导出的合同门；下载交接不冒充 Desktop 文件写入成功。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { captureExportFileName, resolveCaptureExportPreferences, DEFAULT_CAPTURE_EXPORT } from '../src/shared/capture-export.ts';
import { encodeCapture } from '../src/client/capture/export.ts';
import { createCaptureTrace } from '../src/shared/capture-trace.ts';
import * as exportContract from '../src/shared/capture-export.ts';
import { createCaptureWindowState } from '../src/client/capture/model.ts';
import { captureOutputSize, renderCaptureToCanvas } from '../src/client/capture/compositor.ts';
test('文件名模板仅构造 basename，格式扩展名统一，未知字段不穿透',()=>{
  const date=new Date(2026,9,1,13,2,3);
  assert.equal(captureExportFileName({saveFormat:'webp',fileNamePattern:'演示 {date} {time}.png'},date),'演示 2026-10-01 13-02-03.webp');
  assert.equal(captureExportFileName({saveFormat:'jpeg',fileNamePattern:'.png'},date),'PDSH.jpg');
  for(const fileNamePattern of ['../private','x/y','{account}','\u0000secret','...',''])assert.equal(resolveCaptureExportPreferences({fileNamePattern}).fileNamePattern,DEFAULT_CAPTURE_EXPORT.fileNamePattern);
  assert.deepEqual(resolveCaptureExportPreferences({saveFormat:'gif',png:'secret'}),DEFAULT_CAPTURE_EXPORT);
});
function canvasFixture({mimeOverride=null,fail=false,drawFail=false}={}){
  const calls=[],ctx={fillStyle:'',fillRect(...args){calls.push(['fill',this.fillStyle,...args]);},drawImage(...args){if(drawFail)throw Error('draw');calls.push(['draw',...args]);}};
  const make=()=>({width:24,height:12,ownerDocument:null,getContext:()=>ctx,toBlob(fn,mime){calls.push(['encode',mime]);fn(fail?null:new Blob(['fixture'],{type:mimeOverride??mime}));}});
  const source=make(),temporary=make();source.ownerDocument={createElement(){return temporary;}};return {source,temporary,calls};
}
test('PNG/WebP 编码 MIME 精确匹配；不改原画布',async()=>{
  for(const format of ['png','webp'] as const){const h=canvasFixture();const blob=await encodeCapture(h.source as any,format);assert.equal(blob.type,`image/${format}`);assert.deepEqual(h.calls,[['encode',`image/${format}`]]);assert.equal(h.source.width,24);}
  const h=canvasFixture({mimeOverride:'image/png'});await assert.rejects(encodeCapture(h.source as any,'webp'));assert.equal(h.source.width,24);
});
test('JPEG 明确白底合成，成功与编码失败均归还临时画布',async()=>{
  for(const fail of [false,true]){const h=canvasFixture({fail});if(fail)await assert.rejects(encodeCapture(h.source as any,'jpeg'));else assert.equal((await encodeCapture(h.source as any,'jpeg')).type,'image/jpeg');assert.deepEqual(h.calls[0],['fill','white',0,0,24,12]);assert.equal(h.calls[1][0],'draw');assert.equal(h.temporary.width,0);assert.equal(h.temporary.height,0);assert.equal(h.source.width,24);}
});
test('固定阶段日志仅含运行侧/枚举/UUID，非法字段或 logger 故障不泄漏或中断',()=>{
  const logs=[],trace=createCaptureTrace({info(...args){logs.push(args);}},'host');
  trace('bootstrap-port-busy','11111111-1111-4111-8111-111111111111');trace('native-failed','/private/pixels.png');trace('/private/raw-error' as any,'secret');
  assert.equal(logs.length,2);assert.equal(logs[1].at(-1),'-');assert.match(JSON.stringify(logs),/bootstrap-port-busy/);assert.doesNotMatch(JSON.stringify(logs),/private|pixels\.png|secret|raw-error/);
  assert.doesNotThrow(()=>createCaptureTrace({info(){throw Error('log failed');}},'renderer')('capture-click'));
});

test('JPEG 绘制抛错也释放临时画布，不把异常对象记录',async()=>{
  const h=canvasFixture({drawFail:true});await assert.rejects(encodeCapture(h.source as any,'jpeg'));assert.equal(h.temporary.width,0);assert.equal(h.source.width,24);
});

test('Kiri 模板五类元数据、字符清理与 UTF-8 字素预算保持 basename',()=>{
  assert.equal(captureExportFileName({fileNamePattern:'{title}-{width}x{height}'},new Date(2026,0,1),{title:'a/b\u202ec',width:1200,height:800}),'a-b-c-1200x800.png');
  assert.equal(captureExportFileName({fileNamePattern:'CON'}),'PDSH-CON.png');
  const name=captureExportFileName({fileNamePattern:'{title}'},new Date(),{title:'👨‍👩‍👧‍👦'.repeat(100)});assert.ok(Buffer.byteLength(name)<=224);assert.ok(name.endsWith('👨‍👩‍👧‍👦.png'));
  assert.equal(resolveCaptureExportPreferences({saveDirectory:'../x'}).saveDirectory,'');assert.equal(resolveCaptureExportPreferences({saveDirectory:'/tmp/fixture'}).saveDirectory,'/tmp/fixture');
});

test('导出预算独立于16MP取像，5K默认边距合法；越界合成在创建画布前拒绝',()=>{
  assert.equal(exportContract.CAPTURE_EXPORT_MAX_PIXELS,32_000_000);
  assert.equal(exportContract.CAPTURE_EXPORT_MAX_BYTES,128_000_000);
  const state=createCaptureWindowState({width:5120,height:2880}),size=captureOutputSize(state.source,state.padding);
  assert.deepEqual(size,{width:5580,height:3340});
  assert.doesNotThrow(()=>exportContract.assertCaptureExportSize(size.width,size.height));
  assert.doesNotThrow(()=>exportContract.assertCaptureExportSize(8000,4000));
  for(const [width,height] of [[8001,4000],[0,1],[NaN,10],[10.5,10]])assert.throws(()=>exportContract.assertCaptureExportSize(width,height),/export budget/);
  const previous=Object.getOwnPropertyDescriptor(globalThis,'document');let allocations=0;
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement(){++allocations;throw Error('allocation reached');}}});
  try {
    const oversized={...state,padding:45};
    assert.throws(()=>renderCaptureToCanvas({} as any,oversized,{isMacOS:true}),/export budget/);
    assert.equal(allocations,0);
  } finally {if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;}
});

test('编码尺寸先于JPEG临时分配校验，编码字节越界也不能交付',async()=>{
  const oversized=canvasFixture();oversized.source.width=8001;oversized.source.height=4000;
  await assert.rejects(encodeCapture(oversized.source as any,'jpeg'),/export budget/);
  assert.deepEqual(oversized.calls,[]);assert.equal(oversized.temporary.width,24);
  const bytes=canvasFixture();bytes.source.toBlob=(fn,mime)=>fn({type:mime,size:128_000_001} as any);
  await assert.rejects(encodeCapture(bytes.source as any),/export budget/);
});
