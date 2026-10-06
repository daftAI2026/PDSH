/**
 * [INPUT]: 依赖 model.ts 背景模型、presets.ts 资源 URL 与 wallpaper.ts 支持 AbortSignal 的图像装载端口
 * [OUTPUT]: 提供二项完成图 LRU、当前背景固定、按 URL 共享且按消费者取消的解码、单一可取消 hydrate 与 dispose
 * [POS]: capture-window 的图像所有权边界；只有有效消费者持有共享解码，最后一方取消时中止底层加载并拒绝迟到回填
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { CaptureBackground } from "./model.ts";
import { capturePresetAssetUrl } from "./presets.ts";
import { loadCaptureImage } from "./wallpaper.ts";

export type CaptureBackgroundImageStore = {
  dispose: () => void;
  hydrate: (
    background: CaptureBackground,
    onLoad: () => void,
    onError: (error: unknown) => void,
  ) => void;
  read: (background: CaptureBackground) => HTMLImageElement | null;
  remember: (url: string, image: HTMLImageElement) => void;
  resolve: (background: CaptureBackground, signal?: AbortSignal) => Promise<HTMLImageElement | null>;
};

const COMPLETED_IMAGE_LIMIT = 2;

type ImageLoadConsumer = {
  resolve: (image: HTMLImageElement) => void;
  reject: (error: unknown) => void;
  signal?: AbortSignal;
  onAbort?: () => void;
  settled: boolean;
};

type PendingImageLoad = {
  controller: AbortController;
  consumers: Set<ImageLoadConsumer>;
};

type ActiveHydration = { url: string; controller: AbortController };

export function captureBackgroundImageUrl(background: CaptureBackground): string | null {
  if (background.kind === "preset") return capturePresetAssetUrl(background.id);
  if (background.kind === "wallpaper") return background.dataUrl;
  return null;
}

export function createCaptureBackgroundImageStore(
  loadImage: (url: string, signal?: AbortSignal) => Promise<HTMLImageElement> = loadCaptureImage,
): CaptureBackgroundImageStore {
  const images = new Map<string, HTMLImageElement>();
  const loads = new Map<string, PendingImageLoad>();
  let pinnedUrl: string | null = null;
  let hydration: ActiveHydration | undefined;
  let disposed = false;

  function trimImages(): void {
    while (images.size > COMPLETED_IMAGE_LIMIT) {
      const oldestUnpinned = [...images.keys()].find((url) => url !== pinnedUrl);
      if (oldestUnpinned === undefined) return;
      images.delete(oldestUnpinned);
    }
  }

  function remember(url: string, image: HTMLImageElement): void {
    if (disposed) return;
    images.delete(url);
    images.set(url, image);
    trimImages();
  }

  function read(background: CaptureBackground): HTMLImageElement | null {
    const url = captureBackgroundImageUrl(background);
    if (disposed) return null;
    pinnedUrl = url || null;
    if (!url) return null;
    const image = images.get(url);
    if (!image) return null;
    remember(url, image);
    return image;
  }

  function removeConsumer(pending: PendingImageLoad, consumer: ImageLoadConsumer): boolean {
    if (consumer.settled) return false;
    consumer.settled = true;
    pending.consumers.delete(consumer);
    if (consumer.signal && consumer.onAbort) {
      consumer.signal.removeEventListener('abort', consumer.onAbort);
    }
    return true;
  }

  function cancelConsumer(url: string, pending: PendingImageLoad, consumer: ImageLoadConsumer): void {
    if (!removeConsumer(pending, consumer)) return;
    consumer.reject(abortError());
    if (pending.consumers.size === 0 && loads.get(url) === pending) {
      loads.delete(url);
      pending.controller.abort();
    }
  }

  function finishLoad(url: string, pending: PendingImageLoad, image: HTMLImageElement): void {
    const isCurrent = loads.get(url) === pending;
    if (isCurrent) loads.delete(url);
    const consumers = [...pending.consumers];
    if (!isCurrent || disposed || pending.controller.signal.aborted || consumers.length === 0) return;

    remember(url, image);
    for (const consumer of consumers) {
      if (removeConsumer(pending, consumer)) consumer.resolve(image);
    }
  }

  function failLoad(url: string, pending: PendingImageLoad, error: unknown): void {
    if (loads.get(url) === pending) loads.delete(url);
    for (const consumer of [...pending.consumers]) {
      if (removeConsumer(pending, consumer)) consumer.reject(error);
    }
  }

  function startLoad(url: string, pending: PendingImageLoad): void {
    try {
      void loadImage(url, pending.controller.signal).then(
        (image) => finishLoad(url, pending, image),
        (error: unknown) => failLoad(url, pending, error),
      );
    } catch (error) {
      failLoad(url, pending, error);
    }
  }

  function resolve(background: CaptureBackground, signal?: AbortSignal): Promise<HTMLImageElement | null> {
    const url = captureBackgroundImageUrl(background);
    if (!url || disposed) return Promise.resolve(null);
    if (signal?.aborted) return Promise.reject(abortError());
    const cached = images.get(url);
    if (cached) {
      remember(url, cached);
      return Promise.resolve(cached);
    }

    let pending = loads.get(url);
    let shouldStart = false;
    if (!pending) {
      pending = { controller: new AbortController(), consumers: new Set() };
      loads.set(url, pending);
      shouldStart = true;
    }

    const activeLoad = pending;
    const result = new Promise<HTMLImageElement>((resolveConsumer, rejectConsumer) => {
      const consumer: ImageLoadConsumer = {
        reject: rejectConsumer,
        resolve: resolveConsumer,
        settled: false,
        signal,
      };
      if (signal) {
        consumer.onAbort = () => cancelConsumer(url, activeLoad, consumer);
        signal.addEventListener('abort', consumer.onAbort, { once: true });
      }
      activeLoad.consumers.add(consumer);
      if (signal?.aborted) cancelConsumer(url, activeLoad, consumer);
    });
    if (shouldStart) startLoad(url, activeLoad);
    return result;
  }

  function cancelHydration(): void {
    const current = hydration;
    hydration = undefined;
    current?.controller.abort();
  }

  function hydrate(
    background: CaptureBackground,
    onLoad: () => void,
    onError: (error: unknown) => void,
  ): void {
    if (disposed) return;
    const url = captureBackgroundImageUrl(background);
    if (hydration?.url === url) return;
    cancelHydration();
    if (!url || read(background)) return;

    const active: ActiveHydration = { controller: new AbortController(), url };
    hydration = active;
    void resolve(background, active.controller.signal).then(
      () => {
        if (disposed || hydration !== active || active.controller.signal.aborted) return;
        hydration = undefined;
        onLoad();
      },
      (error: unknown) => {
        if (disposed || hydration !== active || active.controller.signal.aborted) return;
        hydration = undefined;
        if (!isAbortError(error)) onError(error);
      },
    );
  }

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      pinnedUrl = null;
      cancelHydration();
      for (const [url, pending] of [...loads]) {
        loads.delete(url);
        pending.controller.abort();
        for (const consumer of [...pending.consumers]) {
          if (removeConsumer(pending, consumer)) consumer.reject(abortError());
        }
      }
      images.clear();
      loads.clear();
    },
    hydrate,
    read,
    remember,
    resolve,
  };
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted', 'AbortError');
}

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');
}
