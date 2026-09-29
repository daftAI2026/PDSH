/**
 * [INPUT]: 依赖 capture/controller.ts 的截图时序与可注入 Fetch/解码/工作台边界。
 * [OUTPUT]: 验证点击后真截图再开工作台、临时遮挡归还、挂载失败回收和停用取消。
 * [POS]: Client 截图合同测试；像素/原生权限另由 Desktop 实测验证。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountCaptureController } from '../src/client/capture/controller.ts';
const png = Buffer.from('89504e470d0a1a0a000000', 'hex');
function setup(fetchImpl) {
  const dom = new JSDOM('<!doctype html><html lang="zh"><body><div data-slot="settings.launcher"><button aria-haspopup="menu" data-signed-out="false"><span><img src="avatar.png"></span><span>本名</span></button></div></body></html>', { url: 'https://dsh.test/' });
  const doc = dom.window.document; const opened = [];
  const controller = mountCaptureController(doc, { fetchImpl, decode: async () => ({ width: 2560, height: 1640 }), waitFrame: async () => {},
    openEditor: (_host, options) => { opened.push(options); return { destroy: () => options.onClose() }; },
  });
  return { dom, doc, opened, controller };
}
test('点击截当前窗口后才打开工作台；拍摄态隐藏自有 UI 并恢复隐私标记', async () => {
  let captures = 0;
  const { dom, doc, opened, controller } = setup(async (_url, init) => {
    captures++;
    assert.equal(init.method, 'POST');
    assert.equal(doc.documentElement.classList.contains('pdsh-capturing'), true);
    assert.equal(doc.querySelector('[data-slot="settings.launcher"] button > span:last-child').hasAttribute('data-pdsh-capture-redact'), true);
    return new Response(png, { headers: { 'content-type': 'image/png' } });
  });
  await controller.activate();
  assert.equal(captures, 1); assert.equal(opened.length, 1); assert.equal(opened[0].source.width, 2560);
  assert.equal(doc.documentElement.classList.contains('pdsh-capturing'), false);
  assert.equal(doc.querySelector('[data-slot="settings.launcher"] button > span:last-child').hasAttribute('data-pdsh-capture-redact'), false);
  await opened[0].onRetake(1, true); assert.equal(captures, 2);
  opened[0].onClose(); assert.equal(doc.querySelector('[data-pdsh-capture-host]'), null);
  controller.dispose(); dom.window.close();
});
test('截图失败不会打开空工作台，保留可读重试反馈', async () => {
  const { dom, doc, opened, controller } = setup(async () => new Response('failed', { status: 503 }));
  await controller.activate();
  assert.equal(opened.length, 0); assert.match(doc.querySelector('[role="alert"]').textContent, /无法截取/);
  assert.equal(controller.state().disabled, false);
  controller.dispose(); dom.window.close();
});
test('工作台挂载异常时不留空外壳，下一次点击仍可重试', async () => {
  const dom = new JSDOM('<!doctype html><html lang="zh"><body></body></html>', { url: 'https://dsh.test/' });
  const doc = dom.window.document;
  const controller = mountCaptureController(doc, {
    fetchImpl: async () => new Response(png, { headers: { 'content-type': 'image/png' } }),
    decode: async () => ({ width: 2560, height: 1640 }), waitFrame: async () => {},
    openEditor: () => { throw new Error('mount failed'); },
  });
  await controller.activate();
  assert.equal(doc.querySelector('[data-pdsh-capture-host]'), null);
  assert.equal(controller.state().disabled, false);
  await controller.activate();
  assert.equal(doc.querySelector('[data-pdsh-capture-host]'), null);
  controller.dispose(); dom.window.close();
});
