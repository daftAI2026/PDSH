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
  const dom = new JSDOM('<!doctype html><html lang="zh"><body><div data-slot="settings.launcher"><button aria-haspopup="menu" data-collapsed="false" data-signed-out="false"><span><img src="avatar.png"></span><span>本名</span></button></div></body></html>', { url: 'https://dsh.test/' });
  const doc = dom.window.document; const opened = [], notices = [];
  const controller = mountCaptureController(doc, { capture, notify: message => notices.push(message), waitFrame: async () => {},
    openEditor: (_host, options) => { opened.push(options); return { destroy: () => options.onClose() }; },
  });
  return { dom, doc, opened, notices, controller };
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
  const { dom, doc, opened, notices, controller } = setup(async () => { throw new Error('capture failed'); });
  await controller.activate();
  assert.equal(opened.length, 0); assert.match(notices.at(-1), /无法截取/);
  assert.doesNotMatch(notices.at(-1), /屏幕录制|Screen Recording/);
  assert.equal(doc.querySelector('[role="alert"]'), null, '控制器不自造常驻通知 DOM');
  assert.equal(controller.state().disabled, false);
  controller.dispose(); dom.window.close();
});

test('工作台接收 Host 导出偏好；取像日志仅记录枚举阶段',async()=>{
  const dom=new JSDOM('<html><body/></html>',{url:'https://dsh.test/'}),opened=[],phases=[];
  const preferences={saveFormat:'webp',fileNamePattern:'演示 {date} {time}'};
  const controller=mountCaptureController(dom.window.document,{
    capture:async()=>({width:100,height:100}),waitFrame:async()=>{},
    exportPreferences:()=>preferences,trace:phase=>phases.push(phase),
    openEditor:(_host,options)=>{opened.push(options);return {destroy(){}};},
  });
  try{
    await controller.activate();assert.deepEqual(opened[0].exportPreferences,preferences);
    assert.deepEqual(phases,['capture-click','pixels-start','pixels-ready','editor-ready']);
  }finally{controller.dispose();dom.window.close();}
});
test('工作台挂载异常时不留空外壳，下一次点击仍可重试', async () => {
  const dom = new JSDOM('<!doctype html><html lang="zh"><body></body></html>', { url: 'https://dsh.test/' });
  const doc = dom.window.document;
  const notices = [];
  const controller = mountCaptureController(doc, {
    notify: message => notices.push(message),
    capture: async () => ({ width: 2560, height: 1640 }), waitFrame: async () => {},
    openEditor: () => { throw new Error('mount failed'); },
  });
  await controller.activate();
  assert.equal(doc.querySelector('[data-pdsh-capture-host]'), null);
  assert.match(notices.at(-1), /工作台未能打开/);
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

test('宿主像素能力缺失给出具体反馈，不重绘、不打开空工作台', async () => {
    const { dom, doc, opened, notices, controller } = setup(async () => { throw new CaptureViewportError('host-unavailable'); });
    await controller.activate();
    assert.match(notices.at(-1), /尚未提供页面像素采集/);
    assert.equal(opened.length, 0);
    controller.dispose(); dom.window.close();
});

test('材质外观跟随每次取像冻结，重拍可换外观但不持久化', async () => {
  const { dom, doc, opened, controller } = setup(async () => ({ width: 2560, height: 1640 }));
  await controller.activate(); assert.equal(opened[0].materialAppearance, 'light');
  assert.equal(opened[0].sourceScaleFactor, 1);
  doc.documentElement.setAttribute('data-ds-dark-theme', '');
  assert.equal(opened[0].materialAppearance, 'light');
  const retake = await opened[0].onRetake(1, true); assert.equal(retake.materialAppearance, 'dark');
  assert.equal(retake.sourceScaleFactor, 1);
  controller.dispose(); dom.window.close();
});
test('取像期间换主题拒绝外观错配的结果，不交给模拟材质', async () => {
  const { dom, doc, opened, notices, controller } = setup(async () => {
    doc.documentElement.setAttribute('data-ds-dark-theme', '');
    return { width: 2560, height: 1640 };
  });
  await controller.activate(); assert.equal(opened.length, 0); assert.match(notices.at(-1), /无法截取/);
  controller.dispose(); dom.window.close();
});
test('重拍同时冻结新的 DPR，旧截图的材质比例不随宿主先行变化', async () => {
  const { dom, doc, opened, controller } = setup(async () => ({ width: 2560, height: 1640 }));
  await controller.activate();
  Object.defineProperty(doc.defaultView, 'devicePixelRatio', { value: 2 });
  assert.equal(opened[0].sourceScaleFactor, 1);
  assert.equal((await opened[0].onRetake(1, true)).sourceScaleFactor, 2);
  controller.dispose(); dom.window.close();
});
test('调试入口关闭无法确认给出明确处置，不用泛化重试消息掩盖风险', async () => {
  const { dom, opened, notices, controller } = setup(async () => { throw new CaptureViewportError('bridge-cleanup-unconfirmed'); });
  await controller.activate();assert.equal(opened.length,0);assert.match(notices.at(-1),/无法确认.*调试接口.*关闭/);assert.match(notices.at(-1),/保留工作/);assert.match(notices.at(-1),/不会自动重启/);
  controller.dispose();dom.window.close();
});

test('控制连接释放未知不误称调试接口仍开，不自动重连',async()=>{
  const {dom,opened,notices,controller}=setup(async()=>{throw new CaptureViewportError('control-cleanup-unconfirmed');});await controller.activate();assert.equal(opened.length,0);assert.match(notices.at(-1),/取像连接.*释放/);assert.doesNotMatch(notices.at(-1),/调试接口/);controller.dispose();dom.window.close();
});
