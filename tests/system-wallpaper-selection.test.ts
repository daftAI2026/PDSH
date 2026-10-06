/**
 * [INPUT]: 依赖系统壁纸 controller/pipeline 与可控背景解码端口。
 * [OUTPUT]: 验证新选择、模式失效与销毁将同一选择 signal 传递至媒体返回后的背景解码，缓存命中也不绕过取消。
 * [POS]: 系统 JPEG 选择的端到端取消合同；不读取预设或系统文件，不冒充浏览器解码线程/RSS实测。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSystemWallpaperController, createSystemWallpaperEditorActions } from '../src/client/capture/system-wallpapers.ts';

const id = 'system-wallpaper-golden-gate';
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

async function fixture() {
  let mediaLoads = 0;
  const controller = createSystemWallpaperController({
    list: async () => [{ id, name: 'Golden Gate', available: true }],
    load: async () => { mediaLoads++; return 'data:image/jpeg;base64,YQ=='; },
  });
  await controller.ensureLoaded();
  const decodes: { signal?: AbortSignal; finish: (image: HTMLImageElement | null) => void }[] = [];
  let applied = 0;
  let errors = 0;
  const actions = createSystemWallpaperEditorActions(controller, {
    apply: () => { applied++; },
    isAlive: () => true,
    onError: () => { errors++; },
    resolve: (_selection, signal?: AbortSignal) => new Promise(resolve => {
      decodes.push({ signal, finish: resolve });
      signal?.addEventListener('abort', () => resolve(null), { once: true });
    }),
  });
  return { actions, controller, decodes, mediaLoads: () => mediaLoads, applied: () => applied, errors: () => errors };
}

test('重新选择缓存图也中止旧的后置背景解码，而不再次请求媒体', async () => {
  const h = await fixture();
  const first = h.actions.select(id);
  await tick();
  assert.ok(h.decodes[0].signal, 'media 返回后必须仍有选择 owner signal');
  const second = h.actions.select(id);
  await tick();
  assert.equal(h.decodes[0].signal?.aborted, true);
  assert.equal(h.decodes[1].signal?.aborted, false);
  assert.equal(h.mediaLoads(), 1, '缓存选择复用媒体，但拥有新的解码取消范围');
  h.decodes[1].finish({} as HTMLImageElement);
  await Promise.all([first, second]);
  assert.equal(h.applied(), 1);
  assert.equal(h.errors(), 0);
  h.controller.destroy();
});

for (const action of ['invalidate', 'destroy'] as const) {
  test(`${action} 在系统媒体已返回后仍取消背景解码，无迟到应用/提示`, async () => {
    const h = await fixture();
    const pending = h.actions.select(id);
    await tick();
    assert.ok(h.decodes[0].signal);
    if (action === 'invalidate') h.controller.invalidateSelection(); else h.controller.destroy();
    assert.equal(h.decodes[0].signal?.aborted, true);
    await pending;
    h.decodes[0].finish({} as HTMLImageElement);
    await tick();
    assert.equal(h.applied(), 0);
    assert.equal(h.errors(), 0);
    h.controller.destroy();
  });
}
