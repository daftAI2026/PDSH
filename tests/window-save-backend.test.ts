/**
 * [INPUT]: 依赖窗口保存 backend、Chromium Canvas 编码夹具、固定输出格式与 Node 文件写入适配。
 * [OUTPUT]: 验证有界 uplink、精确sRGB ICC/metadata、POSIX/Windows native-directory围栏、独占落盘及真实回执。
 * [POS]: Host保存边界的临时目录合同；UNC native-path用例在Windows runner验证，保留已知profile原字节，不访问用户目录、不调用Electron、不证明Desktop UI。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWindowSaveBackend } from '../src/host/window-save-backend.ts';
import type { WindowSaveInputFrame, WindowSaveRequest } from '../src/shared/window-save-protocol.ts';
import { captureExportFileName } from '../src/shared/capture-export.ts';
import { writeUniqueImage } from '../src/host/page-save-file.ts';

const CHUNK_BYTES = 32 * 1024;
const request: WindowSaveRequest = {
  requestId: '11111111-1111-4111-8111-111111111111',
  format: 'png', width: 2, height: 1, title: 'Local fixture', capturedAt: '2026-10-03T04:05:06.000Z',
};

// +--- Chromium 154.0.8037.95 Canvas 16x8(#263b52 + 左上4x4白块) toBlob质量0.92原字节；JPEG/WebP共享同一ICC profile。---+
const CHROMIUM_CANVAS_JPEG = Buffer.from(
  [
    '/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABh',
    'Y3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'AAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAAB',
    'UAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAA',
    'AAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9Y',
    'WVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAM',
    'ZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUG',
    'CQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQ',
    'EBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAAIABADASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAYI',
    '/8QAIhAAAAQEBwAAAAAAAAAAAAAAABIUFgMIERMYISdBRWFj/8QAFQEBAQAAAAAAAAAAAAAAAAAABQb/xAAZEQEAAwEBAAAAAAAA',
    'AAAAAAACAAESMQP/2gAMAwEAAhEDEQA/AIKbWbXFI1dP2y2V3KrVCmx4wyFsd1NtTPPIAKYA+ZyeQFu3el2f/9k=',
  ].join(''),
  'base64',
);
const CHROMIUM_CANVAS_WEBP = Buffer.from(
  [
    'UklGRi4CAABXRUJQVlA4WAoAAAAgAAAADwAABwAASUNDUMgBAAAAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABh',
    'Y3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    'AAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAAB',
    'UAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAA',
    'AAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9Y',
    'WVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAM',
    'ZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADZWUDggQAAAANABAJ0BKhAACAAAgA4lAE6XQABr66a4',
    'AP7//pSb//WpDf/rT5f/tXd3Iu6uR3+S7invWe8YEu9+2IQPHOLZDAA=',
  ].join(''),
  'base64',
);
const CHROMIUM_CANVAS_PROFILE_SHA256 = '12afb4d9953adee0607d347daee5b78b18d6b3cab2d572b88970703f5edb37bc';

function jpegIccProfile(bytes: Buffer): Buffer {
  for (let offset=2; offset+4<=bytes.length;) {
    if (bytes[offset]!==0xff) throw new Error('bad fixture JPEG marker');
    while (bytes[offset]===0xff) ++offset;
    const marker=bytes[offset++]!, lengthOffset=offset, length=bytes.readUInt16BE(lengthOffset);
    const start=lengthOffset+2, end=lengthOffset+length;
    if (marker===0xda || marker===0xd9) break;
    if (marker===0xe2) {
      assert.equal(bytes.toString('ascii',start,start+12),'ICC_PROFILE\0');
      assert.equal(bytes[start+12],1,'single JPEG ICC segment sequence starts at one');
      assert.equal(bytes[start+13],1,'single JPEG ICC segment declares one part');
      return bytes.subarray(start+14,end);
    }
    offset=end;
  }
  throw new Error('missing fixture JPEG ICC profile');
}

function webpIccProfile(bytes: Buffer): Buffer {
  for (let offset=12; offset+8<=bytes.length;) {
    const kind=bytes.toString('ascii',offset,offset+4), length=bytes.readUInt32LE(offset+4), start=offset+8;
    if (kind==='ICCP') return bytes.subarray(start,start+length);
    offset=start+length+(length&1);
  }
  throw new Error('missing fixture WebP ICC profile');
}

function iccDescription(profile: Buffer): string {
  const tagCount=profile.readUInt32BE(128);
  for (let index=0; index<tagCount; ++index) {
    const tag=132+index*12;
    if (profile.toString('ascii',tag,tag+4)!=='desc') continue;
    const offset=profile.readUInt32BE(tag+4);
    if (profile.toString('ascii',offset,offset+4)!=='mluc') throw new Error('unsupported fixture ICC description');
    const count=profile.readUInt32BE(offset+8), recordSize=profile.readUInt32BE(offset+12);
    if (!count || recordSize<12 || offset+16+count*recordSize>profile.length) throw new Error('invalid fixture ICC description');
    const record=offset+16, length=profile.readUInt32BE(record+4), textOffset=profile.readUInt32BE(record+8);
    const end=offset+textOffset+length;
    if (length%2 || end>profile.length) throw new Error('invalid fixture ICC description text');
    const text=profile.subarray(offset+textOffset,end), codePoints=[];
    for (let cursor=0; cursor<text.length; cursor+=2) codePoints.push(String.fromCharCode(text.readUInt16BE(cursor)));
    return codePoints.join('');
  }
  throw new Error('missing fixture ICC description');
}

// +--- 测试图片只构造有限结构封套，不以它冒充通用像素解码器 ---+
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; ++bit) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(kind: string, data: Uint8Array): Buffer {
  const type = Buffer.from(kind, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0); type.copy(chunk, 4); Buffer.from(data).copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  return chunk;
}

function png(width = 2, height = 1, extra: Array<[string, Buffer]> = []): Buffer {
  const signature = Buffer.from([137,80,78,71,13,10,26,10]);
  const header = Buffer.alloc(13); header.writeUInt32BE(width,0); header.writeUInt32BE(height,4);
  header.set([8,6,0,0,0],8);
  const pixels = Buffer.alloc(height * (width * 4 + 1));
  const data = [pngChunk('IHDR',header), ...extra.map(([kind, bytes]) => pngChunk(kind,bytes)),
    pngChunk('IDAT',deflateSync(pixels)), pngChunk('IEND',Buffer.alloc(0))];
  return Buffer.concat([signature,...data]);
}

function jpeg(width = 2, height = 1, metadata = false): Buffer {
  const jfif = Buffer.from([0xff,0xe0,0x00,0x10,0x4a,0x46,0x49,0x46,0,1,1,0,0,1,0,1,0,0]);
  const exif = metadata ? Buffer.from([0xff,0xe1,0x00,0x06,0x45,0x78,0x69,0x66,0]) : Buffer.alloc(0);
  const sof = Buffer.from([0xff,0xc0,0x00,0x11,8,height>>8,height&255,width>>8,width&255,3,1,0x11,0,2,0x11,0,3,0x11,0]);
  const sos = Buffer.from([0xff,0xda,0x00,0x0c,3,1,0,2,0x11,3,0x11,0,0x3f,0,0x11,0xff,0xd9]);
  return Buffer.concat([Buffer.from([0xff,0xd8]),jfif,exif,sof,sos]);
}

function webpChunk(kind: string, data: Buffer): Buffer {
  const header = Buffer.alloc(8); header.write(kind,0,'ascii'); header.writeUInt32LE(data.length,4);
  return Buffer.concat([header,data,data.length & 1 ? Buffer.from([0]) : Buffer.alloc(0)]);
}

function webpChunks(bytes: Buffer): Buffer[] {
  const chunks=[];
  for (let offset=12; offset<bytes.length;) {
    if (offset+8>bytes.length) throw new Error('bad fixture WebP chunk');
    const length=bytes.readUInt32LE(offset+4), end=offset+8+length+(length&1);
    if (end>bytes.length) throw new Error('bad fixture WebP chunk length');
    chunks.push(bytes.subarray(offset,end)); offset=end;
  }
  return chunks;
}

function webpWithChunks(chunks: Buffer[]): Buffer {
  const body=Buffer.concat([Buffer.from('WEBP'),...chunks]), header=Buffer.alloc(8);
  header.write('RIFF',0,'ascii'); header.writeUInt32LE(body.length,4);
  return Buffer.concat([header,body]);
}

function jpegSegments(bytes: Buffer): Array<{ marker:number; start:number; end:number }> {
  const segments=[];
  for (let offset=2; offset+4<=bytes.length;) {
    const start=offset;
    if (bytes[offset++]!==0xff) throw new Error('bad fixture JPEG marker');
    while (bytes[offset]===0xff) ++offset;
    const marker=bytes[offset++]!;
    if (marker===0xda || marker===0xd9) break;
    const length=bytes.readUInt16BE(offset), end=offset+length;
    if (length<2 || end>bytes.length) throw new Error('bad fixture JPEG segment');
    segments.push({marker,start,end}); offset=end;
  }
  return segments;
}

function jpegSegment(marker: number, data: Buffer): Buffer {
  const length=data.length+2, header=Buffer.from([0xff,marker,length>>8,length&255]);
  return Buffer.concat([header,data]);
}

function jpegInsertAfter(bytes: Buffer, marker: number, inserted: Buffer): Buffer {
  const segment=jpegSegments(bytes).find(candidate=>candidate.marker===marker);
  if (!segment) throw new Error('missing fixture JPEG insertion point');
  return Buffer.concat([bytes.subarray(0,segment.end),inserted,bytes.subarray(segment.end)]);
}

function webp(width = 2, height = 1, metadata = false): Buffer {
  const bits = Buffer.alloc(10); bits[3]=0x9d; bits[4]=0x01; bits[5]=0x2a;
  bits.writeUInt16LE(width,6); bits.writeUInt16LE(height,8);
  const chunks = [webpChunk('VP8 ',bits), ...(metadata ? [webpChunk('EXIF',Buffer.from('x'))] : [])];
  const body = Buffer.concat([Buffer.from('WEBP'),...chunks]);
  const riff = Buffer.alloc(8); riff.write('RIFF',0,'ascii'); riff.writeUInt32LE(body.length,4);
  return Buffer.concat([riff,body]);
}

function frames(bytes: Buffer): WindowSaveInputFrame[] {
  const output: WindowSaveInputFrame[] = [];
  for (let start = 0, index = 0; start < bytes.length; start += CHUNK_BYTES, ++index) {
    output.push({ type:'chunk', index, base64:bytes.subarray(start,Math.min(start+CHUNK_BYTES,bytes.length)).toString('base64') });
  }
  output.push({ type:'finish', chunkCount:output.length, byteLength:bytes.length, sha256:createHash('sha256').update(bytes).digest('hex') });
  return output;
}

function source(items: readonly WindowSaveInputFrame[]): AsyncIterable<WindowSaveInputFrame> {
  return { async *[Symbol.asyncIterator]() { for (const item of items) yield item; } };
}

function preferences(directory: string, patch = {}) {
  return { captureEnabled:true, saveDirectory:directory, saveFormat:'png', fileNamePattern:'PDSH-{date}-{time}-{title}-{width}x{height}', ...patch };
}

async function collect(iterable: AsyncIterable<unknown>) {
  const items=[];
  for await (const item of iterable) items.push(item);
  return items;
}

test('惰性保存只接受 Host 已接受目录，分块 ack 后真实独占提交才返回 receipt',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pdsh-window-save-'));
  const bytes=png(), accepted=preferences(directory), backend=createWindowSaveBackend({preferences:()=>accepted});
  try {
    const output=await collect(backend.save(request,{signal:new AbortController().signal,lifetimeSignal:new AbortController().signal,uplink:source(frames(bytes))}));
    const fileName=captureExportFileName(accepted,new Date(request.capturedAt),{title:request.title,width:request.width,height:request.height});
    assert.deepEqual(output,[{type:'ack',requestId:request.requestId,nextIndex:1},{type:'receipt',requestId:request.requestId,outcome:'saved',format:'png',byteLength:bytes.length,width:2,height:1}]);
    assert.deepEqual(await readdir(directory),[fileName]);
    assert.deepEqual(await readFile(join(directory,fileName)),bytes);
    assert.equal((await stat(join(directory,fileName))).mode&0o777,0o600);
  } finally { await backend.dispose(); await rm(directory,{recursive:true,force:true}); }
});

test('輸入预算、chunk顺序、finish哈希与Host配置失败均不落盘也不报告成功',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pdsh-window-save-invalid-'));
  const bytes=png(), good=frames(bytes);
  const cases=[
    { input:[{...good[0]!,index:1},good[1]!], expected:[{type:'terminal',code:'invalid-input'}] },
    { input:[good[0]!,{...good[1]!,sha256:'0'.repeat(64)}], expected:[{type:'ack',nextIndex:1},{type:'terminal',code:'invalid-input'}] },
    { input:[{type:'chunk',index:0,base64:'!!!!'},{...good[1]!}], expected:[{type:'terminal',code:'invalid-input'}] },
  ];
  try {
    for (const scenario of cases) {
      const backend=createWindowSaveBackend({preferences:()=>preferences(directory)});
      const output=await collect(backend.save(request,{signal:new AbortController().signal,lifetimeSignal:new AbortController().signal,uplink:source(scenario.input as WindowSaveInputFrame[])}));
      assert.deepEqual(output,scenario.expected.map((frame:any)=>({...frame,requestId:request.requestId})));
      assert.ok(output.every((frame:any)=>frame.type!=='receipt'));
      await backend.dispose();
    }
    const disabled=createWindowSaveBackend({preferences:()=>preferences(directory,{captureEnabled:false})});
    assert.deepEqual(await collect(disabled.save(request,{signal:new AbortController().signal,lifetimeSignal:new AbortController().signal,uplink:source(good)})),[{type:'terminal',requestId:request.requestId,code:'disposed'}]);
    await disabled.dispose();
    const wrongFormat=createWindowSaveBackend({preferences:()=>preferences(directory,{saveFormat:'jpeg'})});
    assert.deepEqual(await collect(wrongFormat.save(request,{signal:new AbortController().signal,lifetimeSignal:new AbortController().signal,uplink:source(good)})),[{type:'terminal',requestId:request.requestId,code:'invalid-request'}]);
    await wrongFormat.dispose();
    assert.deepEqual(await readdir(directory),[]);
  } finally { await rm(directory,{recursive:true,force:true}); }
});

test('Host writer第二边界拒绝Windows device namespace，避免把named pipe当普通目录', {skip:process.platform!=='win32'}, async()=>{
  for (const saveDirectory of ['\\\\.\\pipe\\endpoint','\\\\.\\GLOBALROOT\\Device\\HarddiskVolume1\\dir']) {
    let writes=0;
    const backend=createWindowSaveBackend({preferences:()=>preferences(saveDirectory),writeUniqueImage:async()=>{writes++;}});
    const output=await collect(backend.save(request,{signal:new AbortController().signal,lifetimeSignal:new AbortController().signal,uplink:source(frames(png()))}));
    assert.deepEqual(output,[{type:'terminal',requestId:request.requestId,code:'invalid-request'}]);
    assert.equal(writes,0);
    await backend.dispose();
  }
});

test('Windows UNC share root gains only the native trailing separator before joining a filename', {skip:process.platform!=='win32'}, async()=>{
  const directory='\\\\server\\share';
  let target='';
  const backend=createWindowSaveBackend({preferences:()=>preferences(directory),writeUniqueImage:async(path)=>{target=path;}});
  try {
    const output=await collect(backend.save(request,{signal:new AbortController().signal,lifetimeSignal:new AbortController().signal,uplink:source(frames(png()))}));
    assert.ok(output.some((frame:any)=>frame.type==='receipt'&&frame.outcome==='saved'));
    assert.equal(target.startsWith('\\\\server\\share\\'),true);
  } finally { await backend.dispose(); }
});

test('图片边界校验区分PNG/JPEG/WebP封套并拒绝元数据、动画与声明尺寸不符',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pdsh-window-save-format-'));
  const backend=createWindowSaveBackend({preferences:()=>preferences(directory)});
  const run=async (format:WindowSaveRequest['format'],bytes:Buffer,dims={width:2,height:1})=>{
    const req={...request,format,...dims};
    const prefs=()=>preferences(directory,{saveFormat:format});
    const instance=createWindowSaveBackend({preferences:prefs});
    try { return await collect(instance.save(req,{signal:new AbortController().signal,lifetimeSignal:new AbortController().signal,uplink:source(frames(bytes))})); }
    finally { await instance.dispose(); }
  };
  try {
    for (const [format,bytes] of [['jpeg',jpeg()] as const,['webp',webp()] as const]) {
      assert.ok((await run(format,bytes)).some((frame:any)=>frame.type==='receipt'));
    }
    assert.ok((await run('png',png(3,1))).some((frame:any)=>frame.type==='terminal'&&frame.code==='invalid-image'));
    assert.ok((await run('png',png(2,1,[['tEXt',Buffer.from('title\0private')]]))).some((frame:any)=>frame.type==='terminal'&&frame.code==='invalid-image'));
    assert.ok((await run('jpeg',jpeg(2,1,true))).some((frame:any)=>frame.type==='terminal'&&frame.code==='invalid-image'));
    assert.ok((await run('webp',webp(2,1,true))).some((frame:any)=>frame.type==='terminal'&&frame.code==='invalid-image'));
    assert.deepEqual((await readdir(directory)).sort(),[
      captureExportFileName(preferences(directory,{saveFormat:'jpeg'}),new Date(request.capturedAt),{title:request.title,width:2,height:1}),
      captureExportFileName(preferences(directory,{saveFormat:'webp'}),new Date(request.capturedAt),{title:request.title,width:2,height:1}),
    ].sort());
  } finally { await backend.dispose(); await rm(directory,{recursive:true,force:true}); }
});

test('Chromium Canvas默认sRGB ICC在JPEG/WebP落盘时保色，未知profile与用户元数据仍拒绝',async()=>{
  assert.equal(CHROMIUM_CANVAS_JPEG.length,815);
  assert.equal(createHash('sha256').update(CHROMIUM_CANVAS_JPEG).digest('hex'),'cc345beb23649427e622f51eba89402882761350ba059c00515d00026e588c16');
  assert.equal(CHROMIUM_CANVAS_WEBP.length,566);
  assert.equal(createHash('sha256').update(CHROMIUM_CANVAS_WEBP).digest('hex'),'99f411c145b337b61fc010c02f71b38000ae0bd5ff1b2e7846c5a3a0c41c21e7');
  const jpegProfile=jpegIccProfile(CHROMIUM_CANVAS_JPEG), webpProfile=webpIccProfile(CHROMIUM_CANVAS_WEBP);
  assert.equal(jpegProfile.length,456); assert.equal(iccDescription(jpegProfile),'sRGB');
  assert.equal(createHash('sha256').update(jpegProfile).digest('hex'),CHROMIUM_CANVAS_PROFILE_SHA256);
  assert.deepEqual(webpProfile,jpegProfile,'Chromium emits the same exact sRGB profile in both containers');

  const directory=await mkdtemp(join(tmpdir(),'pdsh-window-save-chromium-'));
  const run=async(format:WindowSaveRequest['format'],bytes:Buffer)=>{
    const req={...request,format,width:16,height:8},accepted=preferences(directory,{saveFormat:format});
    const backend=createWindowSaveBackend({preferences:()=>accepted});
    try {
      const output=await collect(backend.save(req,{signal:new AbortController().signal,lifetimeSignal:new AbortController().signal,uplink:source(frames(bytes))}));
      const name=captureExportFileName(accepted,new Date(req.capturedAt),{title:req.title,width:req.width,height:req.height});
      return {output,name};
    } finally { await backend.dispose(); }
  };
  const expectsInvalid=(output:unknown[])=>assert.ok(output.some((frame:any)=>frame.type==='terminal'&&frame.code==='invalid-image'));
  try {
    for (const [format,bytes] of [['jpeg',CHROMIUM_CANVAS_JPEG],['webp',CHROMIUM_CANVAS_WEBP]] as const) {
      const result=await run(format,bytes);
      assert.ok(result.output.some((frame:any)=>frame.type==='receipt'),`${format} should save the actual Chromium Canvas fixture`);
      assert.deepEqual(await readFile(join(directory,result.name)),bytes,'saving must preserve the exact ICC bytes');
    }

    const unknownJpeg=Buffer.from(CHROMIUM_CANVAS_JPEG); jpegIccProfile(unknownJpeg)[200]^=1;
    const unknownWebp=Buffer.from(CHROMIUM_CANVAS_WEBP); webpIccProfile(unknownWebp)[200]^=1;
    expectsInvalid((await run('jpeg',unknownJpeg)).output);
    expectsInvalid((await run('webp',unknownWebp)).output);

    const app1Xmp=jpegSegment(0xe1,Buffer.from('http://ns.adobe.com/xap/1.0/\0x'));
    const comment=jpegSegment(0xfe,Buffer.from('user comment'));
    const jpegIcc=jpegSegments(CHROMIUM_CANVAS_JPEG).find(segment=>segment.marker===0xe2)!;
    const jpegIccBytes=CHROMIUM_CANVAS_JPEG.subarray(jpegIcc.start,jpegIcc.end);
    const duplicatedJpeg=jpegInsertAfter(CHROMIUM_CANVAS_JPEG,0xe2,jpegIccBytes);
    const withoutJpegIcc=Buffer.concat([CHROMIUM_CANVAS_JPEG.subarray(0,jpegIcc.start),CHROMIUM_CANVAS_JPEG.subarray(jpegIcc.end)]);
    const misplacedJpeg=jpegInsertAfter(withoutJpegIcc,0xdb,jpegIccBytes);
    const splitIccJpeg=Buffer.from(CHROMIUM_CANVAS_JPEG);
    splitIccJpeg[jpegIcc.start+16]=2;
    expectsInvalid((await run('jpeg',jpegInsertAfter(CHROMIUM_CANVAS_JPEG,0xe0,app1Xmp))).output);
    expectsInvalid((await run('jpeg',jpegInsertAfter(CHROMIUM_CANVAS_JPEG,0xe0,comment))).output);
    expectsInvalid((await run('jpeg',duplicatedJpeg)).output);
    expectsInvalid((await run('jpeg',misplacedJpeg)).output);
    expectsInvalid((await run('jpeg',splitIccJpeg)).output);

    const chunks=webpChunks(CHROMIUM_CANVAS_WEBP), [vp8x,iccp,vp8]=chunks;
    assert.ok(vp8x&&iccp&&vp8);
    const noIccFlag=Buffer.from(vp8x); noIccFlag[8]&=~0x20;
    expectsInvalid((await run('webp',webpWithChunks([vp8x,iccp,iccp,vp8]))).output);
    expectsInvalid((await run('webp',webpWithChunks([vp8x,vp8,iccp]))).output);
    expectsInvalid((await run('webp',webpWithChunks([noIccFlag,iccp,vp8]))).output);
    expectsInvalid((await run('webp',webpWithChunks([vp8x,iccp,webpChunk('XMP ',Buffer.from('x')),vp8]))).output);
    expectsInvalid((await run('webp',webpWithChunks([vp8x,iccp,webpChunk('ANIM',Buffer.alloc(6)),vp8]))).output);

    assert.deepEqual((await readdir(directory)).sort(),[
      captureExportFileName(preferences(directory,{saveFormat:'jpeg'}),new Date(request.capturedAt),{title:request.title,width:16,height:8}),
      captureExportFileName(preferences(directory,{saveFormat:'webp'}),new Date(request.capturedAt),{title:request.title,width:16,height:8}),
    ].sort(),'rejected metadata/profile variants must never create files');
  } finally { await rm(directory,{recursive:true,force:true}); }
});

test('卸载在 uplink 等待期间中止并等待迭代真实结束，后续流不再启动',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pdsh-window-save-dispose-'));
  let finishNext:((result:IteratorResult<WindowSaveInputFrame>)=>void)|undefined;
  let closed=false;
  const pending:AsyncIterable<WindowSaveInputFrame>={ [Symbol.asyncIterator]() { return {
    next(){return new Promise<IteratorResult<WindowSaveInputFrame>>(resolve=>{finishNext=resolve;});},
    async return(){closed=true;finishNext?.({done:true,value:undefined});return {done:true,value:undefined};},
  }; } };
  const backend=createWindowSaveBackend({preferences:()=>preferences(directory)});
  const stream=backend.save(request,{signal:new AbortController().signal,lifetimeSignal:new AbortController().signal,uplink:pending});
  const iterator=stream[Symbol.asyncIterator]();
  try {
    const first=iterator.next(); await new Promise(resolve=>setImmediate(resolve));
    let disposed=false; const disposal=backend.dispose().then(()=>{disposed=true;});
    await disposal;
    assert.equal(disposed,true); assert.equal(closed,true);
    const firstResult=await first;
    assert.ok(firstResult.done || (firstResult.value as any)?.type==='terminal');
    if (!firstResult.done) assert.equal((await iterator.next()).done,true);
    assert.deepEqual(await readdir(directory),[]);
    assert.deepEqual(await collect(backend.save(request,{signal:new AbortController().signal,lifetimeSignal:new AbortController().signal,uplink:source([])})),[{type:'terminal',requestId:request.requestId,code:'disposed'}]);
  } finally { await backend.dispose(); await rm(directory,{recursive:true,force:true}); }
});

test('唯一直接写入冲突返回有限busy，不覆盖已有同名目标',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pdsh-window-save-busy-'));
  const bytes=png(); let releaseWrite!:()=>void; let entered!:()=>void;
  const enteredPromise=new Promise<void>(resolve=>{entered=resolve;});
  const blocked=new Promise<void>(resolve=>{releaseWrite=resolve;});
  const targetName=captureExportFileName(preferences(directory),new Date(request.capturedAt),{title:request.title,width:request.width,height:request.height});
  await writeFile(join(directory,targetName),'original');
  const backend=createWindowSaveBackend({preferences:()=>preferences(directory),writeUniqueImage:async(_target,_bytes,beforeCommit)=>{entered();await blocked;beforeCommit();}});
  try {
    const first=backend.save(request,{signal:new AbortController().signal,lifetimeSignal:new AbortController().signal,uplink:source(frames(bytes))});
    const firstPromise=collect(first); await enteredPromise;
    const second=await collect(backend.save({...request,requestId:'22222222-2222-4222-8222-222222222222'},{signal:new AbortController().signal,lifetimeSignal:new AbortController().signal,uplink:source(frames(bytes))}));
    assert.deepEqual(second,[{type:'terminal',requestId:'22222222-2222-4222-8222-222222222222',code:'busy'}]);
    releaseWrite(); assert.ok((await firstPromise).some((frame:any)=>frame.type==='receipt'));
    assert.equal(await readFile(join(directory,targetName),'utf8'),'original');
  } finally { releaseWrite(); await backend.dispose(); await rm(directory,{recursive:true,force:true}); }
});

test('卸载发生在磁盘提交期间时等待真实settle，提交围栏保留旧文件并清理临时字节',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pdsh-window-save-write-cancel-'));
  const bytes=png(), accepted=preferences(directory);
  const name=captureExportFileName(accepted,new Date(request.capturedAt),{title:request.title,width:2,height:1});
  await writeFile(join(directory,name),'old accepted image');
  let releaseWrite!:()=>void,entered!:()=>void;
  const gate=new Promise<void>(resolve=>{releaseWrite=resolve;});
  const enteredPromise=new Promise<void>(resolve=>{entered=resolve;});
  const backend=createWindowSaveBackend({preferences:()=>accepted,writeUniqueImage:async(target,image,beforeCommit)=>{
    entered(); await gate; await writeUniqueImage(target,image,beforeCommit);
  }});
  try {
    const operation=collect(backend.save(request,{signal:new AbortController().signal,lifetimeSignal:new AbortController().signal,uplink:source(frames(bytes))}));
    await enteredPromise;
    let disposed=false; const disposing=backend.dispose().then(()=>{disposed=true;});
    await new Promise(resolve=>setImmediate(resolve)); assert.equal(disposed,false);
    releaseWrite(); await disposing;
    const output=await operation;
    assert.ok(output.some((frame:any)=>frame.type==='terminal'&&frame.code==='cancelled'));
    assert.ok(output.every((frame:any)=>frame.type!=='receipt'));
    assert.equal(await readFile(join(directory,name),'utf8'),'old accepted image');
    assert.deepEqual(await readdir(directory),[name]);
  } finally { releaseWrite(); await backend.dispose(); await rm(directory,{recursive:true,force:true}); }
});

test('提交已原子可见后才收到停用，不撤销图片或把已保存操作谎报为失败',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'pdsh-window-save-after-commit-'));
  const bytes=png(),accepted=preferences(directory);
  const name=captureExportFileName(accepted,new Date(request.capturedAt),{title:request.title,width:2,height:1});
  let releaseWriter!:()=>void,committed!:()=>void;
  const writerGate=new Promise<void>(resolve=>{releaseWriter=resolve;});
  const committedPromise=new Promise<void>(resolve=>{committed=resolve;});
  const backend=createWindowSaveBackend({preferences:()=>accepted,writeUniqueImage:async(target,image,beforeCommit)=>{
    await writeUniqueImage(target,image,beforeCommit); committed(); await writerGate;
  }});
  try {
    const operation=collect(backend.save(request,{signal:new AbortController().signal,lifetimeSignal:new AbortController().signal,uplink:source(frames(bytes))}));
    await committedPromise;
    assert.deepEqual(await readFile(join(directory,name)),bytes);
    let disposed=false; const disposing=backend.dispose().then(()=>{disposed=true;});
    await new Promise(resolve=>setImmediate(resolve)); assert.equal(disposed,false);
    releaseWriter(); await disposing;
    const output=await operation;
    assert.ok(output.some((frame:any)=>frame.type==='receipt'&&frame.outcome==='saved'));
    assert.ok(output.every((frame:any)=>frame.type!=='terminal'));
    assert.deepEqual(await readFile(join(directory,name)),bytes);
    assert.deepEqual(await readdir(directory),[name]);
  } finally { releaseWriter(); await backend.dispose(); await rm(directory,{recursive:true,force:true}); }
});

test('wire不接受Renderer目标路径/文件名；修改后的accepted目录只在显式提交后生效',async()=>{
  const root=await mkdtemp(join(tmpdir(),'pdsh-window-save-path-'));
  const acceptedDir=join(root,'accepted'), hostileDir=join(root,'hostile');
  await (await import('node:fs/promises')).mkdir(acceptedDir); await (await import('node:fs/promises')).mkdir(hostileDir);
  const bytes=png(), accepted=preferences(acceptedDir), backend=createWindowSaveBackend({preferences:()=>accepted});
  try {
    const withPath={...request,directory:hostileDir,fileName:'../../outside.png'} as WindowSaveRequest;
    const rejected=await collect(backend.save(withPath,{signal:new AbortController().signal,lifetimeSignal:new AbortController().signal,uplink:source(frames(bytes))}));
    assert.deepEqual(rejected,[{type:'terminal',requestId:request.requestId,code:'invalid-request'}]);
    assert.deepEqual(await readdir(acceptedDir),[]); assert.deepEqual(await readdir(hostileDir),[]);
    const acceptedName=captureExportFileName(accepted,new Date(request.capturedAt),{title:'../../outside',width:2,height:1});
    const safeTitleRequest={...request,title:'../../outside'};
    const saved=await collect(backend.save(safeTitleRequest,{signal:new AbortController().signal,lifetimeSignal:new AbortController().signal,uplink:source(frames(bytes))}));
    assert.ok(saved.some((frame:any)=>frame.type==='receipt'));
    const names=await readdir(acceptedDir);
    assert.deepEqual(names,[acceptedName]); assert.equal(names.some(name=>name.includes('/')||name==='..'),false);
    assert.deepEqual(await readdir(hostileDir),[]);
  } finally { await backend.dispose(); await rm(root,{recursive:true,force:true}); }
});

test('accepted目录在传输后、提交前变化时围栏拒绝写入',async()=>{
  const root=await mkdtemp(join(tmpdir(),'pdsh-window-save-config-fence-'));
  const acceptedDir=join(root,'before'),replacementDir=join(root,'after');
  await (await import('node:fs/promises')).mkdir(acceptedDir); await (await import('node:fs/promises')).mkdir(replacementDir);
  const accepted=preferences(acceptedDir),bytes=png();
  const backend=createWindowSaveBackend({preferences:()=>accepted,writeUniqueImage:async(target,image,beforeCommit)=>{
    (accepted as any).saveDirectory=replacementDir;
    await writeUniqueImage(target,image,beforeCommit);
  }});
  try {
    const output=await collect(backend.save(request,{signal:new AbortController().signal,lifetimeSignal:new AbortController().signal,uplink:source(frames(bytes))}));
    assert.ok(output.some((frame:any)=>frame.type==='terminal'&&frame.code==='invalid-request'));
    assert.ok(output.every((frame:any)=>frame.type!=='receipt'));
    assert.deepEqual(await readdir(acceptedDir),[]); assert.deepEqual(await readdir(replacementDir),[]);
  } finally { await backend.dispose(); await rm(root,{recursive:true,force:true}); }
});
