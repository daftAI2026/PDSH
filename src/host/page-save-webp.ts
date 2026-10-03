/**
 * [INPUT]: 依赖原页面 Canvas 编码的 WebP 字节与 shared/capture-export 的输出像素预算；不使用 nativeImage 解码 WebP。
 * [OUTPUT]: 提供 readWebPDimensions；检查 RIFF 长度、分块边界、静态 VP8/VP8L/VP8X 尺寸一致性。
 * [POS]: 被 Host window-save-image.ts 复用的静态 WebP 尺寸边界；只验封装/预算，不是通用解码器或已退役 Main 保存入口。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { assertCaptureExportSize } from '../shared/capture-export.ts';
export function readWebPDimensions(bytes: Buffer) {
  const bad = () => new Error('Invalid WebP export');
  if (bytes.length < 20 || bytes.toString('ascii',0,4) !== 'RIFF' || bytes.toString('ascii',8,12) !== 'WEBP' || bytes.readUInt32LE(4) !== bytes.length - 8) throw bad();
  let canvas, image;
  for (let offset = 12; offset < bytes.length;) {
    if (offset + 8 > bytes.length) throw bad();
    const kind = bytes.toString('ascii',offset,offset+4), length = bytes.readUInt32LE(offset+4), start = offset + 8, end = start + length;
    if (end + (length & 1) > bytes.length || ['ANIM','ANMF'].includes(kind)) throw bad();
    if (kind === 'VP8X') {
      if (canvas || length !== 10 || bytes[start] & 0xc3 || bytes[start+1] || bytes[start+2] || bytes[start+3]) throw bad();
      canvas = { width: bytes.readUIntLE(start+4,3)+1, height: bytes.readUIntLE(start+7,3)+1 };
    } else if (kind === 'VP8 ') {
      if (image || length < 10 || bytes[start] & 1 || bytes.toString('hex',start+3,start+6) !== '9d012a') throw bad();
      image = { width: bytes.readUInt16LE(start+6)&0x3fff, height: bytes.readUInt16LE(start+8)&0x3fff };
    } else if (kind === 'VP8L') {
      if (image || length < 5 || bytes[start] !== 0x2f || bytes[start+4] & 0xe0) throw bad();
      const bits = bytes.readUInt32LE(start+1);
      image = { width: (bits & 0x3fff)+1, height: ((bits >>> 14)&0x3fff)+1 };
    }
    offset = end + (length & 1);
  }
  if (!image || canvas && (canvas.width !== image.width || canvas.height !== image.height)) throw bad();
  assertCaptureExportSize(image.width, image.height);
  return image;
}
