/**
 * [INPUT]: 依赖截图控制器与串行隐藏生命周期的可注入边界。
 * [OUTPUT]: 验证不读取引擎版本的双平台候选映射、重拍与未知几何退让；授权等待不被页面计时器截断。
 * [POS]: RC 原生整窗的 Client 合同；不是实机取像或系统授权证据。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountCaptureController } from '../src/client/capture/controller.ts';
import { capturePreparedWindow } from '../src/client/capture/capture-lifecycle.ts';
import { readCandidateWindowViewport, mapWindowCandidatesToPng } from '../src/client/capture/candidate-mapping.ts';

function fullWindowFixture(electron = '44.0.0') {
  const dom = new JSDOM('<html><body><p>测试段落</p></body></html>', { url: 'dsh-app://app/' });
  const view = dom.window;
  for (const [key, value] of Object.entries({ innerWidth: 1280, innerHeight: 820, outerWidth: 1280, outerHeight: 820, devicePixelRatio: 2, screenX: 215, screenY: 80 })) {
    Object.defineProperty(view, key, { configurable: true, writable: true, value });
  }
  Object.defineProperty(view.navigator, 'platform', { configurable: true, value: 'MacIntel' });
  Object.defineProperty(view.navigator, 'userAgent', electron === 'unavailable'
    ? { configurable: true, get() { throw new Error('userAgent must not determine capture geometry'); } }
    : { configurable: true, value: `DSH Electron/${electron}` });
  Object.defineProperty(view, 'visualViewport', { configurable: true, value: { scale: 1, offsetLeft: 0, offsetTop: 0 } });
  const position = { x: 120.5, y: 160.25, width: 240, height: 40 };
  view.document.querySelector('p').getBoundingClientRect = () => ({ ...position, left: position.x, top: position.y, right: position.x + position.width, bottom: position.y + position.height, toJSON() {} });
  return { dom, position };
}

test('已知 Mac 满窗原点接通真实 DOM 候选，重拍重新采样位置', async () => {
  const { dom, position } = fullWindowFixture();
  let opened;
  const controller = mountCaptureController(dom.window.document, {
    capture: async () => ({ width: 2560, height: 1640 }), waitFrame: async () => {},
    captureScope: 'owned-window', sourceScale: () => 2,
    openEditor: (_host, options) => { opened = options; return { destroy() {} }; },
  });
  try {
    await controller.activate();
    const first = opened.automaticRegions;
    assert.equal(first.length, 1, '已有几何合同的原生分支不能继续硬编码空候选');
    assert.deepEqual(first[0], { id: first[0].id, x: 241, y: 320.5, width: 480, height: 80 });
    position.y = 220;
    const retake = await opened.onRetake(1, false);
    assert.equal(retake.automaticRegions[0].id, first[0].id);
    assert.equal(retake.automaticRegions[0].y, 440, '重拍坐标不复用上一张照片');
  } finally { controller.dispose(); dom.window.close(); }
});

test('Windows 使用同一识别器，并将原生客户区偏移加入冻结候选', async () => {
  const { dom, position } = fullWindowFixture();
  Object.defineProperty(dom.window.navigator, 'platform', { value: 'Win32' });
  dom.window.outerWidth = 1296;
  dom.window.outerHeight = 828;
  const geometry = { x: 1, y: 0, width: 2560, height: 1640, pointPixelScale: 2 };
  let opened;
  const controller = mountCaptureController(dom.window.document, {
    capture: async () => ({ width: 2562, height: 1641 }), waitFrame: async () => {},
    captureScope: 'owned-window', sourceScale: () => 2, sourceGeometry: () => geometry,
    openEditor: (_host, options) => { opened = options; return { destroy() {} }; },
  });
  try {
    await controller.activate();
    assert.equal(opened.automaticRegions.length, 1, 'Windows 不得在共享识别前被 Mac 平台门挡住');
    const first = opened.automaticRegions[0];
    assert.deepEqual(first, { id: first.id, x: 242, y: 320.5, width: 480, height: 80 });
    position.y = 200;
    const retake = await opened.onRetake(1, false);
    assert.equal(retake.automaticRegions[0].y, 400);
  } finally { controller.dispose(); dom.window.close(); }
});

test('双平台按真实画布与原生几何映射，不读取或限制引擎版本', async (t) => {
  for (const electron of ['44.0.0', '44.7.0', '45.0.0', '999.0.0', 'unavailable']) {
    for (const platform of ['MacIntel', 'Win32']) {
      await t.test(`${platform} Electron/${electron}`, async () => {
        const { dom } = fullWindowFixture(electron);
        const windows = platform === 'Win32';
        Object.defineProperty(dom.window.navigator, 'platform', { value: platform });
        if (windows) { dom.window.outerWidth = 1296; dom.window.outerHeight = 828; }
        const source = dom.window.document.createElement('canvas');
        source.width = windows ? 2562 : 2560;
        source.height = windows ? 1641 : 1640;
        assert.equal(Object.hasOwn(source, 'width'), false, '保留生产画布的原型访问器，不以自有字段替代');
        assert.equal(Object.hasOwn(source, 'height'), false);
        let opened;
        const controller = mountCaptureController(dom.window.document, {
          capture: async () => source, waitFrame: async () => {},
          captureScope: 'owned-window', sourceScale: () => 2,
          sourceGeometry: () => windows ? { x: 1, y: 0, width: 2560, height: 1640, pointPixelScale: 2 } : undefined,
          openEditor: (_host, options) => { opened = options; return { destroy() {} }; },
        });
        try {
          await controller.activate();
          assert.ok(opened, '引擎版本或 UA 不可读不能阻断有效截图');
          assert.equal(opened.source, source);
          assert.equal(opened.automaticRegions.length, 1, `${platform} 的真实画布必须保留候选`);
          assert.equal(opened.automaticRegions[0].x, windows ? 242 : 241);
          assert.equal(opened.automaticRegions[0].y, 320.5);
        } finally { controller.dispose(); dom.window.close(); }
      });
    }
  }
});

test('Windows 元数据缺失、错位、比例或视口不符时保留照片但不给候选', async () => {
  const correct = { x: 1, y: 0, width: 2560, height: 1640, pointPixelScale: 2 };
  for (const geometry of [undefined, { ...correct, x: 3 }, { ...correct, width: 2559 },
    { ...correct, height: 1639 }, { ...correct, pointPixelScale: 1 }, { ...correct, screenX: 215 }]) {
    const { dom } = fullWindowFixture('44.7.0');
    Object.defineProperty(dom.window.navigator, 'platform', { value: 'Win32' });
    dom.window.outerWidth = 1296; dom.window.outerHeight = 828;
    const source = { width: 2562, height: 1641 }; let opened;
    const controller = mountCaptureController(dom.window.document, {
      capture: async () => source, waitFrame: async () => {},
      captureScope: 'owned-window', sourceScale: () => 2, sourceGeometry: () => geometry,
      openEditor: (_host, options) => { opened = options; return { destroy() {} }; },
    });
    try { await controller.activate(); assert.equal(opened.source, source); assert.deepEqual(opened.automaticRegions, []); }
    finally { controller.dispose(); dom.window.close(); }
  }
});

test('原生映射拒绝边框、docked DevTools、未知平台、缩放和拍摄中几何变化', async () => {
  const variants = [
    (view) => { view.outerHeight = 850; },
    (view) => { view.innerWidth = 1000; },
    (view) => { Object.defineProperty(view.navigator, 'platform', { value: 'Win32' }); },
    (view) => { Object.defineProperty(view.navigator, 'platform', { value: 'Linux x86_64' }); },
    (view) => { view.devicePixelRatio = 2.6; },
    (view) => { view.visualViewport.offsetTop = 10; },
    (view) => { view.visualViewport.scale = 1.1; },
    (view) => { view.innerHeight = Number.NaN; },
  ];
  for (const mutate of variants) {
    const { dom } = fullWindowFixture('44.7.0'); mutate(dom.window);
    let opened;
    const controller = mountCaptureController(dom.window.document, {
      capture: async () => ({ width: 2560, height: 1640 }), waitFrame: async () => {},
      captureScope: 'owned-window', sourceScale: () => 2,
      openEditor: (_host, options) => { opened = options; return { destroy() {} }; },
    });
    try { await controller.activate(); assert.deepEqual(opened.automaticRegions, []); }
    finally { controller.dispose(); dom.window.close(); }
  }
  for (const mutate of [
    ({ dom }) => { dom.window.screenX += 20; },
    ({ dom }) => { dom.window.devicePixelRatio = 1; },
    ({ position }) => { position.y += 20; },
  ]) {
    const fixture = fullWindowFixture('44.7.0'); let opened;
    const controller = mountCaptureController(fixture.dom.window.document, {
      capture: async () => { mutate(fixture); return { width: 2560, height: 1640 }; }, waitFrame: async () => {},
      captureScope: 'owned-window', sourceScale: () => 2,
      openEditor: (_host, options) => { opened = options; return { destroy() {} }; },
    });
    try { await controller.activate(); assert.deepEqual(opened.automaticRegions, []); }
    finally { controller.dispose(); fixture.dom.window.close(); }
  }
});

test('建议复采异常不丢掉可手动编辑的冻结照片', async () => {
  for (const mutation of [
    (doc: Document) => { doc.querySelector('p').getBoundingClientRect = () => { throw new Error('geometry unavailable'); }; },
  ]) {
    const { dom } = fullWindowFixture(); let opened;
    const source = { width: 2560, height: 1640 };
    const controller = mountCaptureController(dom.window.document, {
      capture: async (doc) => { mutation(doc); return source; }, waitFrame: async () => {},
      captureScope: 'owned-window', sourceScale: () => 2,
      openEditor: (_host, options) => { opened = options; return { destroy() {} }; },
    });
    try {
      await controller.activate();
      assert.equal(opened.source, source);
      assert.deepEqual(opened.automaticRegions, []);
    } finally { controller.dispose(); dom.window.close(); }
  }
});

test('原生候选映射拒绝单像素尺寸差和比例差，正确保留非整数矩形', () => {
  const { dom } = fullWindowFixture();
  try {
    const viewport = readCandidateWindowViewport(dom.window.document);
    assert.ok(viewport);
    const candidates = [{ id: 'edge', x: 10.25, y: 20.5, width: 30.5, height: 40.25 }];
    const source = { width: 2560, height: 1640 };
    assert.deepEqual(mapWindowCandidatesToPng(candidates, candidates, source, 2, viewport, viewport), [
      { id: 'edge', x: 20.5, y: 41, width: 61, height: 80.5 },
    ]);
    for (const frame of [{ ...source, width: 2561 }, { ...source, height: 1641 }]) {
      assert.deepEqual(mapWindowCandidatesToPng(candidates, candidates, frame, 2, viewport, viewport), []);
    }
    assert.deepEqual(mapWindowCandidatesToPng(candidates, candidates, source, 1, viewport, viewport), []);
    dom.window.document.documentElement.remove();
    assert.equal(readCandidateWindowViewport(dom.window.document), null, '脱离当前页面的 Document 不再提供映射合同');
  } finally { dom.window.close(); }
});
test('整窗使用原生比例且不把页面候选错位映射到带边框照片', async () => {
  const dom = new JSDOM('<html><body/></html>', { url: 'https://dsh.test/' });
  let opened;
  const controller = mountCaptureController(dom.window.document, {
    capture: async () => ({ width: 2560, height: 1640 }), waitFrame: async () => { },
    captureScope: 'owned-window', sourceScale: () => 2,
    openEditor: (_host, options) => { opened = options; return { destroy() { } }; },
  });
  try {
    await controller.activate();
    assert.equal(opened.sourceScaleFactor, 2);
    assert.deepEqual(opened.automaticRegions, []);
  }
  finally {
    controller.dispose();
    dom.window.close();
  }
});
test('明确空取像预算保留人工授权等待；其他调用仍可保留机器超时', async () => {
  const classes = new Set<string>();
  const nativeTimeout = globalThis.setTimeout;
  globalThis.setTimeout = ((callback, ms, ...args) => nativeTimeout(callback, ms === 30000 ? 1 : ms, ...args)) as typeof setTimeout;
  try {
    const source = await capturePreparedWindow({ capture: () => new Promise(resolve => setTimeout(() => resolve('pixels'), 25)),
      timeoutMs: null, waitForFrame: async () => { }, collectCandidates: () => [], privacyEnabled: false,
      root: { classList: { add: value => classes.add(value), remove: value => classes.delete(value) } } });
    assert.equal(source.source, 'pixels');
    assert.equal(classes.size, 0);
  }
  finally {
    globalThis.setTimeout = nativeTimeout;
  }
});
