/**
 * [INPUT]: 依赖官方 Remote capture caller、单次流校验与当前 Document 的本地图片/画布能力。
 * [OUTPUT]: 将冻结 PNG 等像素解码为编辑器画布，保留原生 pointPixelScale；不重绘 DOM 或猜页面原点。
 * [POS]: 整窗数据到既有编辑器的窄适配；URL 与 Image 在交付/失败后释放，元数据只在内存 WeakMap。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { consumeCaptureOnce, CaptureClientError } from './window-capture-stream.ts';
const scales = new WeakMap<HTMLCanvasElement, number>();
export function capturedWindowScale(source: HTMLCanvasElement): number { return scales.get(source); }
export async function captureOwnedWindow(doc: Document, open, { signal }: {
  signal?: AbortSignal;
} = {}): Promise<HTMLCanvasElement> {
  let canvas: HTMLCanvasElement;
  const captured = await consumeCaptureOnce(open, { signal,
    createObjectURL: blob => doc.defaultView.URL.createObjectURL(blob),
    revokeObjectURL: url => doc.defaultView.URL.revokeObjectURL(url),
    decode: async (url, expected, abort) => {
      const image = new doc.defaultView.Image();
      const clear = () => { image.src = ''; };
      abort?.addEventListener('abort', clear, { once: true });
      try {
        image.src = url;
        await image.decode();
        if (abort?.aborted)
          throw new CaptureClientError('cancelled');
        if (image.naturalWidth !== expected.width || image.naturalHeight !== expected.height)
          throw new CaptureClientError('invalid-capture');
        canvas = doc.createElement('canvas');
        canvas.width = expected.width;
        canvas.height = expected.height;
        const context = canvas.getContext('2d');
        if (!context)
          throw new CaptureClientError('invalid-capture');
        context.drawImage(image, 0, 0);
        return { width: image.naturalWidth, height: image.naturalHeight };
      }
      finally {
        abort?.removeEventListener('abort', clear);
        clear();
      }
    },
  });
  try {
    scales.set(canvas, captured.pointPixelScale);
    return canvas;
  }
  finally {
    captured.release();
  }
}
