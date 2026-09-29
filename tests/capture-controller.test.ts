/**
 * [INPUT]: 依赖 capture/controller.ts 的截图时序与可注入视口取像/工作台边界。
 * [OUTPUT]: 验证截图与工作台失败分层、不臆断系统权限、临时遮挡归还、挂载回收和停用取消。
 * [POS]: Client 截图合同测试；真实像素另由 Desktop 实测验证。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { CaptureViewportError } from '../src/client/capture/viewport.ts';
import { mountCaptureController } from '../src/client/capture/controller.ts';
function setup(capture) {
  const dom = new JSDOM('<!doctype html><html lang="zh"><body><div data-slot="settings.launcher"><button aria-haspopup="menu" data-signed-out="false"><span><img src="avatar.png"></span><span>本名</span></button></div></body></html>', { url: 'https://dsh.test/' });
  const doc = dom.window.document; const opened = [];
  const controller = mountCaptureController(doc, { capture, waitFrame: async () => {},
    openEditor: (_host, options) => { opened.push(options); return { destroy: () => options.onClose() }; },
  });
  return { dom, doc, opened, controller };
}
test('点击截当前窗口后才打开工作台；拍摄态隐藏自有 UI 并恢复隐私标记', async () => {
  let captures = 0;
  const { dom, doc, opened, controller } = setup(async (_url, init) => {
    captures++;
    assert.ok(init.signal instanceof AbortSignal);
    assert.equal(_url, doc);
    assert.equal(doc.documentElement.classList.contains('pdsh-capturing'), true);
    assert.equal(doc.querySelector('[data-slot="settings.launcher"] button > span:last-child').hasAttribute('data-pdsh-capture-redact'), true);
    return { width: 2560, height: 1640 };
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
  const { dom, doc, opened, controller } = setup(async () => { throw new Error('capture failed'); });
  await controller.activate();
  assert.equal(opened.length, 0); assert.match(doc.querySelector('[role="alert"]').textContent, /无法截取/);
  assert.doesNotMatch(doc.querySelector('[role="alert"]').textContent, /屏幕录制|Screen Recording/);
  assert.equal(controller.state().disabled, false);
  controller.dispose(); dom.window.close();
});
test('工作台挂载异常时不留空外壳，下一次点击仍可重试', async () => {
  const dom = new JSDOM('<!doctype html><html lang="zh"><body></body></html>', { url: 'https://dsh.test/' });
  const doc = dom.window.document;
  const controller = mountCaptureController(doc, {
    capture: async () => ({ width: 2560, height: 1640 }), waitFrame: async () => {},
    openEditor: () => { throw new Error('mount failed'); },
  });
  await controller.activate();
  assert.equal(doc.querySelector('[data-pdsh-capture-host]'), null);
  assert.match(doc.querySelector('[role="alert"]').textContent, /工作台未能打开/);
  assert.equal(controller.state().disabled, false);
  await controller.activate();
  assert.equal(doc.querySelector('[data-pdsh-capture-host]'), null);
  controller.dispose(); dom.window.close();
});
test('停用会取消在途视口取像，迟到画布不得打开工作台', async () => {
  let finish, started, request;
  const ready = new Promise(resolve => { started = resolve; });
  const { dom, doc, opened, controller } = setup((_doc, options) => {
    request = options.signal; started();
    return new Promise(resolve => { finish = resolve; });
  });
  const pending = controller.activate();
  await ready;
  controller.dispose();
  assert.equal(request.aborted, true);
  finish({ width: 2560, height: 1640 });
  await pending;
  assert.equal(opened.length, 0);
  assert.equal(doc.querySelector('[role="alert"]'), null);
  assert.equal(doc.documentElement.classList.contains('pdsh-capturing'), false);
  dom.window.close();
});

test('不完整资源与嵌入内容给出具体反馈，不开空工作台', async () => {
  for (const [code, expected] of [['embedded-content', /嵌入网页或视频/], ['resource-warning', /页面资源/]]) {
    const { dom, doc, opened, controller } = setup(async () => { throw new CaptureViewportError(code); });
    await controller.activate();
    assert.match(doc.querySelector('[role="alert"]').textContent, expected);
    assert.equal(opened.length, 0);
    controller.dispose(); dom.window.close();
  }
});
