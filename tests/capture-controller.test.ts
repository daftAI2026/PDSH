/**
 * [INPUT]: 依赖 capture/controller.ts 的截图时序、身份与壁纸能力读取端口，以及可注入取像/工作台边界。
 * [OUTPUT]: 验证标题、名称与会话头像遮罩的分离重读、失败归因与停用取消；壁纸能力按工作台重读。
 * [POS]: Client 截图合同测试；真实像素另由 Desktop 实测验证。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { CaptureViewportError } from '../src/client/capture/viewport.ts';
import { mountCaptureController } from '../src/client/capture/controller.ts';
function setup(capture, { captureMaskIdentity = () => true } = {}) {
  const dom = new JSDOM('<!doctype html><html lang="zh"><body><div data-slot="settings.launcher"><button aria-haspopup="menu" data-collapsed="false" data-signed-out="false"><span><img src="avatar.png"></span><span>本名</span></button></div></body></html>', { url: 'https://dsh.test/' });
  const doc = dom.window.document; const opened = [], notices = [];
  const controller = mountCaptureController(doc, { capture, captureMaskIdentity, notify: message => notices.push(message), waitFrame: async () => {},
    openEditor: (_host, options) => { opened.push(options); return { destroy: () => options.onClose() }; },
  });
  return { dom, doc, opened, notices, controller };
}
test('每次初拍与重拍读取 Host 身份开关，且与工作台标题预遮挡正交', async () => {
  const dom = new JSDOM('<!doctype html><html lang="zh"><body><div data-slot="sidebar.workspaces"><div role="treeitem" data-row-key="session:one"><span></span><span>标题</span></div></div><div data-slot="settings.launcher"><button aria-haspopup="menu" data-collapsed="false" data-signed-out="false"><span><img src="avatar.png"></span><span>原生名称</span><span data-pdsh-name>自有名牌</span></button></div></body></html>', { url: 'https://dsh.test/' });
  const doc = dom.window.document, snapshots = [], opened = [];
  doc.defaultView.localStorage.setItem('pdsh-window-capture-prefs', JSON.stringify({ privacyEnabled: false }));
  let maskIdentity = true;
  const controller = mountCaptureController(doc, {
    captureMaskIdentity: () => maskIdentity,
    capture: async () => {
      const trigger = doc.querySelector('[data-slot="settings.launcher"] button');
      const title = doc.querySelector('[data-row-key="session:one"] span:nth-child(2)');
      snapshots.push({
        title: title.hasAttribute('data-pdsh-capture-redact'),
        nativeName: trigger.children[1].hasAttribute('data-pdsh-capture-redact'),
        ownedName: trigger.querySelector(':scope > [data-pdsh-name]').hasAttribute('data-pdsh-capture-redact'),
        avatar: trigger.children[0].hasAttribute('data-pdsh-capture-redact-profile'),
        redactionClass: doc.documentElement.classList.contains('pdsh-capture-redact'),
      });
      return { width: 2560, height: 1640 };
    },
    waitFrame: async () => {},
    openEditor: (_host, options) => { opened.push(options); return { destroy() {} }; },
  });
  try {
    await controller.activate();
    assert.deepEqual(snapshots[0], { title: false, nativeName: true, ownedName: true, avatar: true, redactionClass: true }, '身份开启、标题预遮挡关闭');
    maskIdentity = false;
    await opened[0].onRetake(1, false);
    assert.deepEqual(snapshots[1], { title: false, nativeName: false, ownedName: false, avatar: false, redactionClass: false }, '每次重拍都重新读取 Host 接受值');
    await opened[0].onRetake(2, true);
    assert.deepEqual(snapshots[2], { title: true, nativeName: false, ownedName: false, avatar: false, redactionClass: true }, '标题开启不反向打开身份遮挡');
  } finally { controller.dispose(); dom.window.close(); }
});
test('初拍头像跟随 accepted 身份；重拍名称重读 Host，头像由编辑器第三参独立覆盖', async () => {
  const dom = new JSDOM('<!doctype html><html lang="zh"><body><div data-slot="sidebar.workspaces"><div role="treeitem" data-row-key="session:one"><span></span><span>标题</span></div></div><div data-slot="settings.launcher"><button aria-haspopup="menu" data-collapsed="false" data-signed-out="false"><span><img src="avatar.png"></span><span>原生名称</span><span data-pdsh-name>自有名牌</span></button></div></body></html>', { url: 'https://dsh.test/' });
  const doc = dom.window.document, snapshots = [], opened = [];
  doc.defaultView.localStorage.setItem('pdsh-window-capture-prefs', JSON.stringify({ privacyEnabled: false }));
  let maskIdentity = true;
  const controller = mountCaptureController(doc, {
    captureMaskIdentity: () => maskIdentity,
    capture: async () => {
      const trigger = doc.querySelector('[data-slot="settings.launcher"] button');
      const avatar = trigger.children[0];
      snapshots.push({
        title: doc.querySelector('[data-row-key="session:one"] span:nth-child(2)').hasAttribute('data-pdsh-capture-redact'),
        nativeName: trigger.children[1].hasAttribute('data-pdsh-capture-redact'),
        ownedName: trigger.querySelector(':scope > [data-pdsh-name]').hasAttribute('data-pdsh-capture-redact'),
        avatar: avatar.hasAttribute('data-pdsh-capture-redact-avatar-only'),
        redactionClass: doc.documentElement.classList.contains('pdsh-capture-redact'),
      });
      return { width: 2560, height: 1640 };
    },
    waitFrame: async () => {},
    openEditor: (_host, options) => { opened.push(options); return { destroy() {} }; },
  });
  try {
    await controller.activate();
    assert.equal(opened[0].initialAvatarMaskEnabled, true);
    assert.deepEqual(snapshots[0], { title: false, nativeName: true, ownedName: true, avatar: true, redactionClass: true });
    await opened[0].onRetake(1, false, false);
    assert.deepEqual(snapshots[1], { title: false, nativeName: true, ownedName: true, avatar: false, redactionClass: true }, '关闭头像不关闭仍被 Host 接受的名称遮罩');
    maskIdentity = false;
    await opened[0].onRetake(2, false, true);
    assert.deepEqual(snapshots[2], { title: false, nativeName: false, ownedName: false, avatar: true, redactionClass: true }, '本地头像覆盖不重写名称配置');
    await opened[0].onRetake(3, true, false);
    assert.deepEqual(snapshots[3], { title: true, nativeName: false, ownedName: false, avatar: false, redactionClass: true }, '标题开关与头像/名称各自独立');
    await opened[0].onRetake(4, false, false);
    assert.deepEqual(snapshots[4], { title: false, nativeName: false, ownedName: false, avatar: false, redactionClass: false });
  } finally { controller.dispose(); dom.window.close(); }
});
test('关闭工作台会取消在途重拍并归还临时头像标记', async () => {
  const dom = new JSDOM('<!doctype html><html lang="zh"><body><div data-slot="settings.launcher"><button aria-haspopup="menu" data-collapsed="false" data-signed-out="false"><span><img src="avatar.png"></span><span>原名</span></button></div></body></html>', { url: 'https://dsh.test/' });
  const doc = dom.window.document, opened = [];
  let captureCount = 0, signal, beginRetake;
  const retakeStarted = new Promise(resolve => { beginRetake = resolve; });
  const controller = mountCaptureController(doc, {
    capture: async (_doc, options) => {
      captureCount++;
      if (captureCount === 1) return { width: 120, height: 80 };
      signal = options.signal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new dom.window.DOMException('aborted', 'AbortError')), { once: true });
        beginRetake();
      });
    },
    waitFrame: async () => {},
    openEditor: (_host, options) => { opened.push(options); return { destroy() {} }; },
  });
  try {
    await controller.activate();
    const pending = opened[0].onRetake(1, true, false).then(() => null, error => error);
    await retakeStarted;
    opened[0].onClose();
    assert.equal(signal.aborted, true);
    assert.notEqual(await pending, null);
    assert.equal(doc.documentElement.classList.contains('pdsh-capture-redact'), false);
    assert.equal(doc.querySelector('[data-pdsh-capture-redact-avatar-only]'), null);
  } finally { controller.dispose(); dom.window.close(); }
});
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

test('可选壁纸能力每次打开工作台重读，不阻塞截图或替换当前工作台', async () => {
  const dom = new JSDOM('<html><body/></html>', { url: 'https://dsh.test/' });
  const opened = [];
  const adapter = { catalog: async () => [], load: async () => assert.fail('打开工作台不能下载壁纸') };
  let available, reads = 0, captures = 0, destroyed = 0;
  const controller = mountCaptureController(dom.window.document, {
    capture: async () => { captures++; return { width: 100, height: 100 }; },
    waitFrame: async () => {},
    readSystemWallpapers: () => { reads++; return available; },
    openEditor: (_host, options) => {
      opened.push(options);
      return { destroy() { destroyed++; options.onClose(); } };
    },
  });
  try {
    assert.equal(reads, 0, 'mount 不读取媒体能力');
    await controller.activate();
    assert.equal(opened[0].systemWallpapers, undefined);
    assert.equal(captures, 1, '扩展未知不妨碍基础截图');
    available = adapter;
    await controller.activate();
    assert.equal(reads, 1, '迟到能力不重建当前工作台');
    assert.equal(opened.length, 1);
    assert.equal(destroyed, 0);
    opened[0].onClose();
    await controller.activate();
    assert.equal(opened[1].systemWallpapers, adapter);
    available = undefined;
    opened[1].onClose();
    await controller.activate();
    assert.equal(opened[2].systemWallpapers, undefined, '能力撤回不沿用旧 adapter');
    assert.equal(captures, 3);
    assert.equal(reads, 3);
  } finally { controller.dispose(); dom.window.close(); }
});
