/**
 * [INPUT]: 依赖背景图缓存工厂及其图像解码注入端口。
 * [OUTPUT]: 证明二项 LRU、当前背景固定、共享解码的订阅取消与 hydrate/dispose 生命周期。
 * [POS]: capture 背景图像缓存的取消合同；只校验信号与引用围栏，不接触持久图库或浏览器 DOM。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createCaptureBackgroundImageStore } from '../src/client/capture/backgrounds.ts';
import type { CaptureBackground } from '../src/client/capture/model.ts';

function background(id: string): CaptureBackground {
  return { dataUrl: `data:image/png;base64,${id}`, kind: 'wallpaper' };
}

function image(id: string): HTMLImageElement {
  return { id } as unknown as HTMLImageElement;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, reject, resolve };
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

test('keeps two completed images and read touches the LRU position', async () => {
  const store = createCaptureBackgroundImageStore(async url => image(url));
  await store.resolve(background('a'));
  await store.resolve(background('b'));

  assert.ok(store.read(background('a')));
  assert.equal(store.read({ color: '#fff', kind: 'color' }), null, 'a non-image current background releases the pin');
  await store.resolve(background('c'));

  assert.ok(store.read(background('a')), 'read moved the image to the newest LRU position');
  assert.equal(store.read(background('b')), null, 'least-recent non-pinned image is evicted');
  assert.ok(store.read(background('c')));
});

test('a decode completing late cannot evict the image pinned while it was pending', async () => {
  const pendingA = deferred<HTMLImageElement>();
  const store = createCaptureBackgroundImageStore(url => url.endsWith(',a') ? pendingA.promise : Promise.resolve(image(url)));
  const lateA = store.resolve(background('a'));
  assert.equal(store.read(background('a')), null);
  await store.resolve(background('b'));
  await store.resolve(background('c'));

  pendingA.resolve(image('a'));
  assert.equal((await lateA)?.id, 'a');
  assert.ok(store.read(background('a')), 'the current image is retained when its decode finishes last');
});

test('a pre-cancelled resolve rejects without starting image loading', async () => {
  let loads = 0;
  const store = createCaptureBackgroundImageStore(async url => { loads++; return image(url); });
  const abort = new AbortController();
  abort.abort();

  await assert.rejects(store.resolve(background('a'), abort.signal), isAbort);
  assert.equal(loads, 0);
  store.dispose();
});

test('cancelling the only consumer aborts the shared image load and promptly rejects it', async () => {
  const pending = [deferred<HTMLImageElement>(), deferred<HTMLImageElement>()];
  const loadSignals: AbortSignal[] = [];
  let loads = 0;
  const store = createCaptureBackgroundImageStore((_url, signal) => {
    if (signal) loadSignals.push(signal);
    return pending[loads++].promise;
  });
  const abort = new AbortController();
  const result = store.resolve(background('a'), abort.signal);

  abort.abort();
  await assert.rejects(result, isAbort);
  assert.equal(loadSignals[0]?.aborted, true);
  const retry = store.resolve(background('a'));
  assert.equal(loads, 2, 'the abandoned pending URL is removed so a new consumer can retry');
  pending[1].resolve(image('fresh'));
  assert.equal((await retry)?.id, 'fresh');
  pending[0].resolve(image('stale'));
  await flushMicrotasks();
  assert.equal(store.read(background('a'))?.id, 'fresh', 'the ignored stale result cannot replace the retry');
  store.dispose();
});

test('one cancelled subscriber cannot abort a load still needed by another', async () => {
  const pending = deferred<HTMLImageElement>();
  let loads = 0;
  let loadSignal: AbortSignal | undefined;
  const store = createCaptureBackgroundImageStore((_url, signal) => {
    loads++;
    loadSignal = signal;
    return pending.promise;
  });
  const firstAbort = new AbortController();
  const first = store.resolve(background('a'), firstAbort.signal);
  const second = store.resolve(background('a'));
  firstAbort.abort();

  await assert.rejects(first, isAbort);
  assert.equal(loads, 1, 'same URL shares one underlying decoder');
  assert.equal(loadSignal?.aborted, false, 'the surviving subscriber owns the pending load');
  pending.resolve(image('a'));
  assert.equal((await second)?.id, 'a');
  assert.ok(store.read(background('a')));
  store.dispose();
});

test('an ignored late result after the last consumer cancels never re-enters the cache', async () => {
  const pending = deferred<HTMLImageElement>();
  let loadSignal: AbortSignal | undefined;
  const store = createCaptureBackgroundImageStore((_url, signal) => {
    loadSignal = signal;
    return pending.promise;
  });
  const abort = new AbortController();
  const result = store.resolve(background('late'), abort.signal);
  abort.abort();
  await assert.rejects(result, isAbort);
  assert.equal(loadSignal?.aborted, true);

  pending.resolve(image('late'));
  await flushMicrotasks();
  assert.equal(store.read(background('late')), null);
  store.dispose();
});

test('dispose aborts pending consumers immediately and prevents any late cache fill', async () => {
  const pending = deferred<HTMLImageElement>();
  let loads = 0;
  let loadSignal: AbortSignal | undefined;
  const store = createCaptureBackgroundImageStore((url, signal) => {
    loads++;
    loadSignal = signal;
    return url.endsWith(',pending') ? pending.promise : Promise.resolve(image(url));
  });
  await store.resolve(background('cached'));
  const result = store.resolve(background('pending'));

  store.dispose();
  await assert.rejects(result, isAbort);
  assert.equal(loadSignal?.aborted, true);
  assert.equal(await store.resolve(background('after-dispose')), null);
  pending.resolve(image('pending'));
  await flushMicrotasks();
  assert.equal(store.read(background('cached')), null);
  assert.equal(store.read(background('pending')), null);
  assert.equal(loads, 2, 'disposed stores never start another load');
});

test('hydrate replaces the old background request and does not accumulate same-image consumers', async () => {
  const pending = new Map<string, ReturnType<typeof deferred<HTMLImageElement>>>();
  const signals = new Map<string, AbortSignal>();
  let loads = 0;
  const store = createCaptureBackgroundImageStore((url, signal) => {
    loads++;
    const request = deferred<HTMLImageElement>();
    pending.set(url, request);
    if (signal) signals.set(url, signal);
    return request.promise;
  });
  let firstLoads = 0;
  let duplicateLoads = 0;
  let obsoleteErrors = 0;
  let currentLoads = 0;
  store.hydrate(background('a'), () => firstLoads++, () => { obsoleteErrors++; });
  store.hydrate(background('a'), () => duplicateLoads++, () => { obsoleteErrors++; });
  assert.equal(loads, 1, 'same current image keeps one callback and one consumer');

  store.hydrate(background('b'), () => currentLoads++, () => { obsoleteErrors++; });
  assert.equal(signals.get('data:image/png;base64,a')?.aborted, true, 'changing images cancels old hydrate');
  pending.get('data:image/png;base64,a')?.resolve(image('a'));
  pending.get('data:image/png;base64,b')?.resolve(image('b'));
  await flushMicrotasks();

  assert.equal(firstLoads, 0);
  assert.equal(duplicateLoads, 0);
  assert.equal(obsoleteErrors, 0, 'obsolete cancellation is not surfaced as an image error');
  assert.equal(currentLoads, 1);
  assert.equal(loads, 2);
  store.dispose();
});
