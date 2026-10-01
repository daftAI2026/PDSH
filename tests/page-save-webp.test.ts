/**
 * [INPUT]: 依赖静态 WebP 封装验证器与已知字段的字节 fixture。
 * [OUTPUT]: 验证静态尺寸、非法长度/动画/不一致及独立32MP导出预算，覆盖5K默认边距。
 * [POS]: 格式适配合同；fixture 不保证完整压缩位流或 Electron GUI 保存结果。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readWebPDimensions } from '../src/host/page-save-webp.ts';
function fixtureWebP(kind='VP8 ',width=10,height=20) {
  const data=Buffer.alloc(kind==='VP8 '?10:5);
  if(kind==='VP8 '){data.set([0x9d,0x01,0x2a],3);data.writeUInt16LE(width,6);data.writeUInt16LE(height,8);}
  else {data[0]=0x2f;data.writeUInt32LE((width-1)|((height-1)<<14),1);}
  const chunk=Buffer.alloc(8+data.length+(data.length&1));chunk.write(kind);chunk.writeUInt32LE(data.length,4);data.copy(chunk,8);
  const result=Buffer.alloc(12+chunk.length);result.write('RIFF');result.writeUInt32LE(result.length-8,4);result.write('WEBP',8);chunk.copy(result,12);return result;
}
test('静态 VP8/VP8L 头部给出整数尺寸，不依赖 nativeImage WebP 解码',()=>{for(const kind of ['VP8 ','VP8L'])assert.deepEqual(readWebPDimensions(fixtureWebP(kind)),{width:10,height:20});});
test('RIFF 边界、动画、缺少图片与超预算必须拒绝',()=>{
  const badLength=fixtureWebP();badLength.writeUInt32LE(100000,16);assert.throws(()=>readWebPDimensions(badLength));
  const animated=fixtureWebP();animated.write('ANMF',12);assert.throws(()=>readWebPDimensions(animated));
  const extended=fixtureWebP();extended.write('VP8X',12);extended[20]=2;assert.throws(()=>readWebPDimensions(extended));
  assert.throws(()=>readWebPDimensions(fixtureWebP('VP8L',16000,16000)));assert.throws(()=>readWebPDimensions(fixtureWebP().subarray(0,25)));
});

test('VP8X 的静态画布必须与实际图片头部尺寸相同',()=>{
  const base=fixtureWebP(),extended=Buffer.alloc(48);base.subarray(0,12).copy(extended);extended.writeUInt32LE(40,4);extended.write('VP8X',12);extended.writeUInt32LE(10,16);extended.writeUIntLE(9,24,3);extended.writeUIntLE(19,27,3);base.subarray(12).copy(extended,30);assert.deepEqual(readWebPDimensions(extended),{width:10,height:20});extended.writeUIntLE(99,24,3);assert.throws(()=>readWebPDimensions(extended));
});

test('WebP 与其它保存格式共用导出预算，5K默认边距合法，32MP以上拒绝',()=>{
  assert.deepEqual(readWebPDimensions(fixtureWebP('VP8L',5580,3340)),{width:5580,height:3340});
  assert.deepEqual(readWebPDimensions(fixtureWebP('VP8L',8000,4000)),{width:8000,height:4000});
  assert.throws(()=>readWebPDimensions(fixtureWebP('VP8L',8001,4000)),/export budget/);
});
