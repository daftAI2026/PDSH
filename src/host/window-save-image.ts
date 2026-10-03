/**
 * [INPUT]: 依赖编辑器Canvas输出、accepted format与32MP/128MB共享预算，仅识别固定的默认sRGB ICC指纹。
 * [OUTPUT]: 提供PNG/JPEG/静态WebP的有限封套/尺寸/metadata验证，不解码通用像素流。
 * [POS]: Host上传字节进入磁盘前的格式边界；原样保留唯一已知Canvas sRGB profile，其余用户metadata/动画拒绝。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { assertCaptureExportSize } from '../shared/capture-export.ts';
import type { CaptureSaveFormat } from '../shared/capture-export.ts';
import { createHash } from 'node:crypto';
import { readWebPDimensions } from './page-save-webp.ts';
import { WINDOW_SAVE_MAX_BYTES } from '../shared/window-save-protocol.ts';

const PNG_SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10]);
const MAX_IMAGE_CHUNKS = 8192;
const MAX_SAFE_COLOR_METADATA_BYTES = 4096;
// +--- Renderer Canvas唯一已验证的默认sRGB ICC字节指纹；不接受任意ICC profile。---+
const CANVAS_SRGB_PROFILE_SHA256 = '12afb4d9953adee0607d347daee5b78b18d6b3cab2d572b88970703f5edb37bc';

/** 检查Canvas输出的有限容器结构、可声明尺寸与metadata边界；不执行通用图像解码。 */
export function validateWindowSaveImage(bytes: Buffer, format: CaptureSaveFormat, width: number, height: number): void {
  if (!Buffer.isBuffer(bytes) || bytes.length < 12 || bytes.length > WINDOW_SAVE_MAX_BYTES) throw invalidImage();
  assertCaptureExportSize(width,height);
  const dimensions = format === 'png' ? readPngDimensions(bytes)
    : format === 'jpeg' ? readJpegDimensions(bytes)
    : format === 'webp' ? readStaticWebpDimensions(bytes) : invalidImage();
  if (dimensions.width !== width || dimensions.height !== height) throw invalidImage();
}

function readPngDimensions(bytes: Buffer): { width:number; height:number } {
  if (!bytes.subarray(0,8).equals(PNG_SIGNATURE)) throw invalidImage();
  let offset=8, chunks=0, seenHeader=false, seenImageData=false, imageDataClosed=false, seenEnd=false;
  let colorMetadataBytes=0, width=0, height=0, palette=false, srgb=false, gamma=false, chromaticity=false, transparency=false;
  while (offset < bytes.length) {
    if (++chunks > MAX_IMAGE_CHUNKS || offset + 12 > bytes.length) throw invalidImage();
    const length=bytes.readUInt32BE(offset), kind=bytes.toString('ascii',offset+4,offset+8), start=offset+8, end=start+length;
    if (end + 4 > bytes.length || !/^[A-Za-z]{4}$/.test(kind) || seenEnd) throw invalidImage();
    if (!seenHeader) {
      if (kind !== 'IHDR' || length !== 13) throw invalidImage();
      seenHeader=true; width=bytes.readUInt32BE(start); height=bytes.readUInt32BE(start+4);
      const depth=bytes[start+8]!, color=bytes[start+9]!;
      const legalDepth = color===0 ? [1,2,4,8,16].includes(depth)
        : color===2 ? [8,16].includes(depth) : color===3 ? [1,2,4,8].includes(depth)
        : color===4 || color===6 ? [8,16].includes(depth) : false;
      if (!legalDepth || bytes[start+10]!==0 || bytes[start+11]!==0 || ![0,1].includes(bytes[start+12]!)) throw invalidImage();
      assertCaptureExportSize(width,height);
    } else if (kind === 'IHDR') throw invalidImage();

    // +--- Renderer Canvas 不输出用户文本/EXIF/ICC/APNG；仅容许结构性调色辅助块 ---+
    if (['tEXt','zTXt','iTXt','eXIf','iCCP','acTL','fcTL','fdAT','hIST','sPLT'].includes(kind)) throw invalidImage();
    if (['PLTE','tRNS','sRGB','gAMA','cHRM'].includes(kind)) {
      if (seenImageData) throw invalidImage();
      colorMetadataBytes+=length;
      if (colorMetadataBytes>MAX_SAFE_COLOR_METADATA_BYTES) throw invalidImage();
      if (kind==='PLTE') { if (palette || !length || length%3 || length>768) throw invalidImage(); palette=true; }
      if (kind==='tRNS') { if (transparency || !length || length>768) throw invalidImage(); transparency=true; }
      if (kind==='sRGB') { if (srgb || length!==1 || bytes[start]!>3) throw invalidImage(); srgb=true; }
      if (kind==='gAMA') { if (gamma || length!==4 || bytes.readUInt32BE(start)===0) throw invalidImage(); gamma=true; }
      if (kind==='cHRM') { if (chromaticity || length!==32) throw invalidImage(); chromaticity=true; }
    } else if (kind==='IHDR' && chunks===1) {
      // 首个IHDR已在上方单独验证。
    } else if (kind === 'IDAT') {
      if (imageDataClosed || length===0) throw invalidImage();
      seenImageData=true;
    } else if (kind === 'IEND') {
      if (length!==0 || !seenImageData || end+4!==bytes.length) throw invalidImage();
      seenEnd=true;
    } else throw invalidImage();

    if (seenImageData && kind!=='IDAT' && kind!=='IEND') imageDataClosed=true;
    offset=end+4;
  }
  if (offset!==bytes.length || !seenHeader || !seenImageData || !seenEnd) throw invalidImage();
  return { width, height };
}

function readJpegDimensions(bytes: Buffer): { width:number; height:number } {
  if (bytes[0]!==0xff || bytes[1]!==0xd8) throw invalidImage();
  let offset=2, width=0, height=0, frames=0, scans=0, ended=false, segments=0, jfif=false, icc=false;
  while (offset < bytes.length) {
    if (++segments > MAX_IMAGE_CHUNKS) throw invalidImage();
    if (bytes[offset]!==0xff) throw invalidImage();
    while (bytes[offset]===0xff) ++offset;
    if (offset>=bytes.length) throw invalidImage();
    const marker=bytes[offset++]!;
    if (marker===0xd9) { ended=true; break; }
    if (marker===0x00 || marker===0xd8 || (marker>=0xd0&&marker<=0xd7)) throw invalidImage();
    if (offset+2>bytes.length) throw invalidImage();
    const length=bytes.readUInt16BE(offset);
    if (length<2 || offset+length>bytes.length) throw invalidImage();
    const start=offset+2, end=offset+length, payloadLength=length-2;
    if (marker>=0xe0&&marker<=0xef) {
      if (marker===0xe0) {
        // +--- 只接受位于SOI之后的无缩略图JFIF；不容许插入任意APPn metadata ---+
        if (segments!==1 || jfif || payloadLength!==14 || bytes.toString('ascii',start,start+5)!=='JFIF\0'
          || bytes[start+7]!>2 || bytes[start+12]!==0 || bytes[start+13]!==0) throw invalidImage();
        jfif=true;
      } else if (marker===0xe2) {
        // +--- Chromium Canvas的唯一安全profile紧随JFIF，且只允许单段ICC_PROFILE 1/1 ---+
        if (!jfif || icc || segments!==2 || frames || payloadLength<14+128 || payloadLength>14+MAX_SAFE_COLOR_METADATA_BYTES
          || bytes.toString('ascii',start,start+12)!=='ICC_PROFILE\0' || bytes[start+12]!==1 || bytes[start+13]!==1
          || !isCanvasSrgbProfile(bytes.subarray(start+14,end))) throw invalidImage();
        icc=true;
      } else throw invalidImage();
    }
    if (marker===0xfe) throw invalidImage();
    if (isJpegFrameMarker(marker)) {
      if (++frames!==1 || payloadLength<6) throw invalidImage();
      const precision=bytes[start]!, frameHeight=bytes.readUInt16BE(start+1), frameWidth=bytes.readUInt16BE(start+3), components=bytes[start+5]!;
      if (![8,12].includes(precision) || components<1 || components>4 || payloadLength!==6+components*3) throw invalidImage();
      assertCaptureExportSize(frameWidth,frameHeight); width=frameWidth; height=frameHeight;
    }
    if (marker===0xda) {
      if (!frames || payloadLength<6) throw invalidImage();
      ++scans; offset=end;
      // JPEG entropy bytes are opaque here; only locate marker boundaries and do not claim bitstream decoding.
      let nextMarker=-1;
      for (let index=offset; index<bytes.length-1; ++index) {
        if (bytes[index]!==0xff) continue;
        let cursor=index+1; while (bytes[cursor]===0xff) ++cursor;
        const code=bytes[cursor];
        if (code===0x00 || (code!==undefined&&code>=0xd0&&code<=0xd7)) { index=cursor; continue; }
        nextMarker=index; break;
      }
      if (nextMarker<0) throw invalidImage();
      offset=nextMarker;
      continue;
    }
    offset=end;
  }
  if (!ended || offset!==bytes.length || frames!==1 || scans<1 || !width || !height) throw invalidImage();
  return { width, height };
}

function isJpegFrameMarker(marker:number):boolean {
  return [0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker);
}

function isCanvasSrgbProfile(profile: Buffer): boolean {
  if (profile.length<128 || profile.length>MAX_SAFE_COLOR_METADATA_BYTES || profile.readUInt32BE(0)!==profile.length
    || profile.toString('ascii',16,20)!=='RGB ' || profile.toString('ascii',20,24)!=='XYZ '
    || profile.toString('ascii',36,40)!=='acsp') return false;
  return createHash('sha256').update(profile).digest('hex')===CANVAS_SRGB_PROFILE_SHA256;
}

function readStaticWebpDimensions(bytes: Buffer): { width:number; height:number } {
  const dimensions=readWebPDimensions(bytes);
  let offset=12, chunks=0, imageChunks=0, seenExtended=false, alpha=false, iccFlag=false, icc=false;
  while (offset<bytes.length) {
    if (++chunks>MAX_IMAGE_CHUNKS || offset+8>bytes.length) throw invalidImage();
    const kind=bytes.toString('ascii',offset,offset+4), length=bytes.readUInt32LE(offset+4), start=offset+8, end=start+length;
    if (end+(length&1)>bytes.length) throw invalidImage();
    if (kind==='VP8X') {
      if (seenExtended || length!==10 || (bytes[start]!&0x0e)!==0) throw invalidImage();
      seenExtended=true; iccFlag=(bytes[start]!&0x20)!==0;
    } else if (kind==='ICCP') {
      // +--- ICCP必须紧跟VP8X，受ICC feature bit保护且只保留精确已知的Canvas sRGB ---+
      if (!seenExtended || !iccFlag || icc || chunks!==2 || alpha || imageChunks || length<128
        || length>MAX_SAFE_COLOR_METADATA_BYTES || !isCanvasSrgbProfile(bytes.subarray(start,end))) throw invalidImage();
      icc=true;
    } else if (kind==='ALPH') {
      if (!seenExtended || alpha || imageChunks || length===0) throw invalidImage(); alpha=true;
    } else if (kind==='VP8 ' || kind==='VP8L') {
      if (++imageChunks!==1 || (kind==='VP8L'&&alpha)) throw invalidImage();
    } else if (['EXIF','XMP ','ANIM','ANMF'].includes(kind)) throw invalidImage();
    else throw invalidImage();
    offset=end+(length&1);
  }
  if (offset!==bytes.length || imageChunks!==1 || iccFlag!==icc) throw invalidImage();
  return dimensions;
}

function invalidImage(): never { throw new Error('invalid image'); }
