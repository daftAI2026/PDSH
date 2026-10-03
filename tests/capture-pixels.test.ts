/**
 * [INPUT]: 依赖 viewport.ts 与 page-capture-port.ts 的当前页面 PNG 窄契约；注入桥/解码桩，不克隆网页。
 * [OUTPUT]: 验证能力门、关联 ID、冻结解码/释放、预算与生命周期；保留正式 Main IPC 错误分类，不误报调试端口。
 * [POS]: 原生取像适配合同；桩桥不证明已安装 DSH 有这项能力。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { captureViewport, readPageCapturePort, CaptureViewportError } from '../src/client/capture/viewport.ts';

test('原生 Main 的固定错误与 Electron invoke 包装保留分类，忙碌不是调试端口冲突', async () => {
  const cases = {
    'invalid-request': 'capture-failed', unavailable: 'host-unavailable', busy: 'capture-busy',
    cancelled: 'aborted', stale: 'viewport-changed', 'unsupported-content': 'unsupported-content',
    'too-large': 'oversize', 'capture-failed': 'capture-failed',
  };
  for (const [nativeCode, expected] of Object.entries(cases)) {
    for (const prefix of ['', "Error invoking remote method 'dsh-desktop:page-capture': Error: "]) {
      const h = setup(async () => { throw new Error(`${prefix}dsh desktop page capture: ${nativeCode}`); });
      try {
        await assert.rejects(captureViewport(h.doc), error => error instanceof CaptureViewportError && error.code === expected);
        assert.equal(h.calls.decode, 0); assert.equal(h.calls.draw, 0);
      } finally { h.dom.window.close(); }
    }
  }
});

test('未知错误和其他 IPC 通道不冒充正式 Main 分类，不透传诊断文本', async () => {
  for (const message of [
    'dsh desktop page capture: unknown',
    "Error invoking remote method 'other-channel': Error: dsh desktop page capture: unavailable",
    'private-path: dsh desktop page capture: too-large',
  ]) {
    const h = setup(async () => { throw new Error(message); });
    try {
      await assert.rejects(captureViewport(h.doc), error => error instanceof CaptureViewportError
        && error.code === 'capture-failed' && !error.message.includes(message));
    } finally { h.dom.window.close(); }
  }
});

function png(width = 640, height = 360) {
  const bytes = new Uint8Array(33);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width); view.setUint32(20, height);
  return bytes;
}
function setup(capturePng = async id => ({ requestId: id, png: png() })) {
  const dom = new JSDOM('<!doctype html><html><body><input value="原草稿"><div>任意插件布局</div></body></html>', { url: 'https://dsh.test/' });
  const doc = dom.window.document, view = dom.window as any;
  const calls = { requests: [], cancels: [], decode: 0, draw: 0, close: 0 };
  Object.defineProperty(view, 'innerWidth', { value: 640, configurable: true });
  Object.defineProperty(view, 'innerHeight', { value: 360, configurable: true });
  view.dshDesktop = { protocolVersion: 1, pageCapture: { protocolVersion: 1, scope: 'current-page',
    capturePng: async id => { calls.requests.push(id); return capturePng(id); },
    cancel: async id => { calls.cancels.push(id); },
  } };
  view.createImageBitmap = async () => { calls.decode++; return { width: 640, height: 360, close() { calls.close++; } }; };
  view.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() { calls.draw++; } });
  return { dom, doc, view, calls };
}
test('缺少当前页面像素桥时拒绝，不回退 DOM 重绘', async () => {
  const { dom, doc, view, calls } = setup();
  delete view.dshDesktop.pageCapture;
  assert.equal(readPageCapturePort(doc), null);
  await assert.rejects(captureViewport(doc), error => error instanceof CaptureViewportError && error.code === 'host-unavailable');
  assert.equal(calls.decode, 0); dom.window.close();
});
test('装配层可显式注入已连接的桥，取像不依赖伪造宿主全局 API', async () => {
  const { dom, doc, view, calls } = setup();
  const port = view.dshDesktop.pageCapture; delete view.dshDesktop;
  const canvas = await captureViewport(doc, { port });
  assert.deepEqual([canvas.width, canvas.height], [640, 360]);
  assert.equal(calls.requests.length, 1); assert.equal(view.dshDesktop, undefined);
  dom.window.close();
});
test('显式桥同样验证协议与目标范围，null 不偷偷回退宿主桥', async () => {
  const { dom, doc, view, calls } = setup();
  for (const port of [null, { ...view.dshDesktop.pageCapture, scope: 'other-window' },
    { ...view.dshDesktop.pageCapture, protocolVersion: 2 }]) {
    await assert.rejects(captureViewport(doc, { port }), error => error instanceof CaptureViewportError && error.code === 'host-unavailable');
  }
  assert.equal(calls.requests.length, 0); dom.window.close();
});
test('能力必须限定 current-page 与已识别协议，不能用任意窗口取像接口替代', () => {
  const { dom, doc, view } = setup();
  for (const scope of ['all-windows', undefined]) { view.dshDesktop.pageCapture.scope = scope; assert.equal(readPageCapturePort(doc), null); }
  view.dshDesktop.pageCapture.scope = 'current-page'; view.dshDesktop.pageCapture.protocolVersion = 2;
  assert.equal(readPageCapturePort(doc), null); dom.window.close();
});
test('只发送关联 ID，解码已有 PNG；不读取样式、克隆节点或请求页面资源', async () => {
  const { dom, doc, view, calls } = setup();
  const before = doc.documentElement.outerHTML;
  view.getComputedStyle = () => { assert.fail('取像不能读取 DOM 样式'); };
  view.fetch = () => { assert.fail('取像不能重新获取页面资源'); };
  const canvas = await captureViewport(doc);
  assert.deepEqual([canvas.width, canvas.height], [640, 360]);
  assert.equal(calls.requests.length, 1); assert.equal(typeof calls.requests[0], 'string');
  assert.deepEqual([calls.decode, calls.draw, calls.close], [1, 1, 1]);
  assert.equal(doc.documentElement.outerHTML, before); dom.window.close();
});
test('不接受错配请求、非 PNG 或超过像素上限的返回值', async () => {
  for (const response of [id => ({ requestId: 'other', png: png() }), id => ({ requestId: id, png: new Uint8Array(33) }), id => ({ requestId: id, png: png(20_000, 20_000) })]) {
    const { dom, doc, calls } = setup(async id => response(id));
    await assert.rejects(captureViewport(doc), CaptureViewportError);
    assert.equal(calls.decode, 0); dom.window.close();
  }
});
test('停用取消同一请求，迟到 PNG 不解码、不打开工作台', async () => {
  let finish;
  const { dom, doc, calls } = setup(id => new Promise(resolve => { finish = () => resolve({ requestId: id, png: png() }); }));
  const abort = new AbortController(), pending = captureViewport(doc, { signal: abort.signal });
  await Promise.resolve();
  abort.abort();
  await assert.rejects(pending, error => error instanceof CaptureViewportError && error.code === 'aborted');
  finish(); await Promise.resolve();
  assert.deepEqual(calls.cancels, calls.requests); assert.equal(calls.decode, 0); dom.window.close();
});
test('取像期间视口变化则拒绝，但从不修改或还原用户滚动', async () => {
  const { dom, doc, view, calls } = setup(async id => { Object.defineProperty(view, 'innerWidth', { value: 800 }); return { requestId: id, png: png() }; });
  await assert.rejects(captureViewport(doc), error => error instanceof CaptureViewportError && error.code === 'viewport-changed');
  assert.equal(calls.draw, 0); assert.equal(view.innerWidth, 800); dom.window.close();
});
test('超时会取消 Host 请求；迟到响应不解码', async () => {
  let expire, finish;
  const { dom, doc, view, calls } = setup(id => new Promise(resolve => { finish = () => resolve({ requestId: id, png: png() }); }));
  view.setTimeout = callback => { expire = callback; return 1; }; view.clearTimeout = () => {};
  const pending = captureViewport(doc); await Promise.resolve(); expire();
  await assert.rejects(pending, error => error instanceof CaptureViewportError && error.code === 'timeout');
  finish(); await Promise.resolve();
  assert.deepEqual(calls.cancels, calls.requests); assert.equal(calls.decode, 0); dom.window.close();
});
test('即使尺寸恢复，嵌套滚动或 resize 事件也不能混用旧几何', async () => {
  for (const type of ['scroll', 'resize']) {
    const { dom, doc, view } = setup(async id => { (type === 'scroll' ? doc.body : view).dispatchEvent(new view.Event(type)); return { requestId: id, png: png() }; });
    await assert.rejects(captureViewport(doc), error => error instanceof CaptureViewportError && error.code === 'viewport-changed');
    dom.window.close();
  }
});
test('原生 PNG 必须保留当前 DPR 像素尺寸，不接收缩小的返回值', async () => {
  const { dom, doc, view, calls } = setup();
  Object.defineProperty(view, 'devicePixelRatio', { value: 2 });
  await assert.rejects(captureViewport(doc), error => error instanceof CaptureViewportError && error.code === 'invalid-pixels');
  assert.equal(calls.decode, 0); dom.window.close();
});

test('130% Electron 页面缩放保留完整原生像素，不把整数 CSS 视口当精确物理尺寸', async () => {
  // +--- Electron 44/macOS hidden window 的真实观测，非人为像素偏移 ---+
  const { dom, doc, view, calls } = setup(async id => ({ requestId: id, png: png(2560, 1536) }));
  Object.defineProperty(view, 'innerWidth', { value: 984 });
  Object.defineProperty(view, 'innerHeight', { value: 590 });
  Object.defineProperty(view, 'devicePixelRatio', { value: 2.5999999046325684 });
  view.createImageBitmap = async () => ({ width: 2560, height: 1536, close() { calls.close++; } });
  const canvas = await captureViewport(doc);
  assert.deepEqual([canvas.width, canvas.height], [2560, 1536]);
  assert.equal(calls.draw, 1); dom.window.close();
});

test('尺寸量化不是任意容错；越过 CSS 量化范围仍拒绝原生 PNG', async () => {
  for (const width of [2557, 2562]) {
    const { dom, doc, view, calls } = setup(async id => ({ requestId: id, png: png(width, 1536) }));
    Object.defineProperty(view, 'innerWidth', { value: 984 });
    Object.defineProperty(view, 'innerHeight', { value: 590 });
    Object.defineProperty(view, 'devicePixelRatio', { value: 2.5999999046325684 });
    await assert.rejects(captureViewport(doc), error => error.code === 'invalid-pixels');
    assert.equal(calls.decode, 0); dom.window.close();
  }
});

test('视觉视口缩放或平移也拒绝在途截图，不依赖 window resize/页面 scroll', async () => {
  for (const event of ['resize', 'scroll']) {
    const { dom, doc, view, calls } = setup(async id => {
      view.visualViewport.dispatchEvent(new view.Event(event));
      return { requestId: id, png: png() };
    });
    const visual = Object.assign(new view.EventTarget(), { width: 640, height: 360, scale: 1, offsetLeft: 0, offsetTop: 0 });
    Object.defineProperty(view, 'visualViewport', { value: visual });
    await assert.rejects(captureViewport(doc), error => error.code === 'viewport-changed');
    assert.equal(calls.draw, 0); dom.window.close();
  }
});

test('已取消的请求不进入 Host；解码期间取消释放迟到 bitmap 且不绘制', async () => {
  const first = setup(), alreadyAborted = new AbortController();
  alreadyAborted.abort();
  await assert.rejects(captureViewport(first.doc, { signal: alreadyAborted.signal }), error => error.code === 'aborted');
  assert.equal(first.calls.requests.length, 0); first.dom.window.close();

  const { dom, doc, view, calls } = setup();
  let finishDecode, decodeStarted;
  const ready = new Promise(resolve => { decodeStarted = resolve; });
  view.createImageBitmap = () => new Promise(resolve => {
    finishDecode = () => resolve({ width: 640, height: 360, close() { calls.close++; } });
    decodeStarted();
  });
  const abort = new AbortController(), pending = captureViewport(doc, { signal: abort.signal });
  await ready; abort.abort();
  await assert.rejects(pending, error => error.code === 'aborted');
  finishDecode(); await Promise.resolve(); await Promise.resolve();
  assert.equal(calls.close, 1); assert.equal(calls.draw, 0);
  assert.deepEqual(calls.cancels, calls.requests); dom.window.close();
});

test('解码尺寸错配或画布复制异常都释放 bitmap；失败画布清空', async () => {
  for (const failure of ['dimensions', 'draw']) {
    const { dom, doc, view, calls } = setup();
    let created;
    const create = doc.createElement.bind(doc);
    doc.createElement = ((...args) => {
      const node = create(...args);
      if (args[0] === 'canvas') created = node;
      return node;
    }) as typeof doc.createElement;
    view.createImageBitmap = async () => ({ width: failure === 'dimensions' ? 639 : 640, height: 360, close() { calls.close++; } });
    view.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() { throw new Error('fixture draw failure'); } });
    await assert.rejects(captureViewport(doc), error => error.code === (failure === 'dimensions' ? 'invalid-pixels' : 'capture-failed'));
    assert.equal(calls.close, 1);
    if (failure === 'draw') assert.deepEqual([created.width, created.height], [0, 0]);
    else assert.equal(created, undefined);
    dom.window.close();
  }
});
