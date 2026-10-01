/**
 * [INPUT]: 依赖已合成画布及 shared/capture-export 的保存格式/输出预算；不读取或改变截图状态。
 * [OUTPUT]: 提供尺寸/字节预算内的 PNG/JPEG/WebP 编码与下载交接；JPEG 白底，复制仍调用 PNG。
 * [POS]: 编辑器导出效果边界；下载交接不等于磁盘保存成功，不自造文件系统权限或保存目录。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { assertCaptureExportSize, CAPTURE_EXPORT_MAX_BYTES, type CaptureSaveFormat } from '../../shared/capture-export.ts';
export async function encodeCapture(canvas: HTMLCanvasElement, format: CaptureSaveFormat = 'png'): Promise<Blob> {
  assertCaptureExportSize(canvas.width, canvas.height);
  const mime = `image/${format}`;
  let output = canvas;
  try {
    if (format === 'jpeg') {
      output = canvas.ownerDocument.createElement('canvas'); output.width = canvas.width; output.height = canvas.height;
      const context = output.getContext('2d');
      if (!context) throw new Error('Capture encoder unavailable');
      context.fillStyle = 'white'; context.fillRect(0, 0, output.width, output.height); context.drawImage(canvas, 0, 0);
    }
    return await new Promise<Blob>((resolve, reject) => {
      output.toBlob(blob => {
        if (!blob || blob.type !== mime || !blob.size) reject(new Error('Capture format unavailable'));
        else if (blob.size > CAPTURE_EXPORT_MAX_BYTES) reject(Object.assign(new Error('Capture export budget exceeded'), { code: 'export-oversize' }));
        else resolve(blob);
      }, mime);
    });
  } finally { if (output !== canvas) output.width = output.height = 0; }
}
export function handCaptureToDownload(doc: Document, blob: Blob, fileName: string): void {
  const view = doc.defaultView!, url = view.URL.createObjectURL(blob), anchor = doc.createElement('a');
  anchor.download = fileName; anchor.href = url;
  try { anchor.click(); } finally { view.setTimeout(() => view.URL.revokeObjectURL(url), 0); }
}
