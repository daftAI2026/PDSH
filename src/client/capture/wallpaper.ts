/**
 * [INPUT]: 依赖浏览器 Image API 与可选 AbortSignal 解码固定预设、Gallery Blob 或背景 data URL。
 * [OUTPUT]: 提供可取消的 CaptureImage loader；成功保留渲染源，取消/失败撤掉 src 并归还事件监听。
 * [POS]: capture 的共享图像加载端口，被有界 preset、背景缓存与持久 Gallery 解码复用；不负责持久化或素材预算。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function loadCaptureImage(source: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  if (signal?.aborted) return Promise.reject(createAbortError());

  return new Promise((resolve, reject) => {
    const image = new Image();
    let settled = false;

    const cleanup = (clearSource: boolean): void => {
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
      if (clearSource) image.removeAttribute('src');
    };

    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      cleanup(error !== undefined);
      if (error) reject(error);
      else resolve(image);
    };

    const onLoad = (): void => finish();
    const onError = (): void => finish(new Error('Unable to load image'));
    const onAbort = (): void => finish(createAbortError());

    image.addEventListener('load', onLoad);
    image.addEventListener('error', onError);
    signal?.addEventListener('abort', onAbort, { once: true });

    if (signal?.aborted) {
      onAbort();
      return;
    }

    try {
      image.src = source;
    } catch {
      finish(new Error('Unable to load image'));
    }
  });
}

function createAbortError(): DOMException {
  return new DOMException('The operation was aborted', 'AbortError');
}
