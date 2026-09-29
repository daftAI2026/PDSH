/**
 * [INPUT]: 依赖 capture/viewport.ts 的全视口 DOM 栅格化合同与可注入渲染引擎。
 * [OUTPUT]: 验证根节点、DPR、资源边界、清理、取消、尺寸变化及不支持内容守卫。
 * [POS]: Client 视口采集合同；桩引擎只证明编排，不证明真实像素或 Desktop 兼容。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { captureViewport, CaptureViewportError } from '../src/client/capture/viewport.ts';

function setup(markup = '<!doctype html><html><head></head><body><main id="page">页面</main></body></html>') {
  const dom = new JSDOM(markup, { url: 'https://dsh.test/app/' });
  const { window } = dom;
  Object.defineProperties(window, {
    innerWidth: { configurable: true, value: 640 },
    innerHeight: { configurable: true, value: 360 },
    devicePixelRatio: { configurable: true, value: 2 },
  });
  return { dom, doc: window.document, window };
}

function canvas(doc, width = 1280, height = 720) {
  const result = doc.createElement('canvas');
  result.width = width;
  result.height = height;
  return result;
}

function engineFor(doc, { render = async () => canvas(doc), create = async (_root, options) => ({ log: { warn() {} }, options }), destroy = () => {} } = {}) {
  const calls = { root: null, options: null, context: null, destroyed: 0 };
  return {
    calls,
    engine: {
      createContext: async (root, options) => {
        calls.root = root;
        calls.options = options;
        calls.context = await create(root, options);
        return calls.context;
      },
      domToCanvas: (context) => render(context, calls),
      destroyContext: (context) => { calls.destroyed++; destroy(context, calls); },
    },
  };
}

test('根为 documentElement，尺寸/DPR 对齐视口且恢复滚动，成功后销毁 context', async () => {
  const { dom, doc } = setup();
  doc.documentElement.scrollTop = 125;
  const { engine, calls } = engineFor(doc);
  const result = await captureViewport(doc, { engine });
  assert.equal(calls.root, doc.documentElement);
  assert.deepEqual({ width: calls.options.width, height: calls.options.height, scale: calls.options.scale }, { width: 640, height: 360, scale: 2 });
  assert.equal(calls.options.timeout, 8_000);
  assert.equal(calls.options.features.restoreScrollPosition, true);
  assert.equal(calls.options.debug, false);
  assert.ok(calls.options.font.cssText, '预内嵌字体规则，空字体也以非空注释阻断库的 import 刷新');
  assert.equal(result.width, 1280);
  assert.equal(result.height, 720);
  assert.equal(calls.destroyed, 1);
  dom.window.close();
});

test('只过滤自有工作台、提示、probe 和库 sandbox；隐藏的嵌入内容不会拒绝', async () => {
  const { dom, doc } = setup(`<!doctype html><html><body>
    <main id="page">页面</main>
    <div data-pdsh-capture-host><iframe id="hidden-frame" hidden></iframe></div>
    <div data-pdsh-capture-notice></div><span role="tooltip">提示</span><div data-pdsh-probe></div>
    <iframe id="library" hidden></iframe>
  </body></html>`);
  const { engine, calls } = engineFor(doc);
  await captureViewport(doc, { engine });
  const filter = calls.options.filter;
  assert.equal(filter(doc.documentElement), true);
  for (const selector of ['[data-pdsh-capture-host]', '[data-pdsh-capture-notice]', '[role="tooltip"]', '[data-pdsh-probe]']) {
    assert.equal(filter(doc.querySelector(selector)), false, selector);
  }
  const sandbox = doc.createElement('iframe');
  sandbox.id = '__SANDBOX__test';
  assert.equal(filter(sandbox), false);
  dom.window.close();
});

test('资源 fetch 只接受同源、data、blob；fetch 不带凭据或 referrer 并传播取消信号', async () => {
  const { dom, doc } = setup();
  const { engine, calls } = engineFor(doc);
  const abort = new AbortController();
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } });
  };
  try {
    await captureViewport(doc, { engine, signal: abort.signal });
    const dataUrl = await calls.options.fetchFn('data:image/png;base64,AAAA');
    assert.equal(dataUrl, 'data:image/png;base64,AAAA');
    const sameOrigin = await calls.options.fetchFn('/assets/icon.png');
    assert.match(sameOrigin, /^data:image\/png;base64,/);
    assert.equal(request.url, 'https://dsh.test/assets/icon.png');
    assert.equal(request.init.credentials, 'omit');
    assert.equal(request.init.referrerPolicy, 'no-referrer');
    assert.ok(request.init.signal instanceof AbortSignal);
    assert.equal(request.init.signal.aborted, false);
    await assert.rejects(calls.options.fetchFn('https://remote.test/private.png'), CaptureViewportError);
  } finally {
    globalThis.fetch = originalFetch;
    dom.window.close();
  }
});

test('取消立即拒绝，但在渲染停止后才销毁 context，后续克隆不得继续读取页面', async () => {
  const { dom, doc } = setup();
  const abort = new AbortController();
  let finish;
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const { engine, calls } = engineFor(doc, {
    render: () => { started(); return new Promise(resolve => { finish = resolve; }); },
  });
  const pending = captureViewport(doc, { engine, signal: abort.signal });
  await ready;
  abort.abort();
  await assert.rejects(pending, (error) => error instanceof CaptureViewportError && error.code === 'aborted');
  assert.equal(calls.destroyed, 0, '不与仍存活的克隆/渲染并发销毁');
  assert.throws(() => calls.options.filter(doc.body), CaptureViewportError);
  finish(canvas(doc));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.destroyed, 1);
  dom.window.close();
});

test('超出 1600 万像素上限时在创建引擎前失败', async () => {
  const { dom, doc, window } = setup();
  Object.defineProperties(window, {
    innerWidth: { configurable: true, value: 2048 },
    innerHeight: { configurable: true, value: 2048 },
    devicePixelRatio: { configurable: true, value: 2 },
  });
  const { engine, calls } = engineFor(doc);
  await assert.rejects(captureViewport(doc, { engine }), (error) => error instanceof CaptureViewportError && error.code === 'oversize');
  assert.equal(calls.root, null);
  dom.window.close();
});

test('截图中视口或 DPR 改变时拒绝画布并清理 context', async () => {
  const { dom, doc, window } = setup();
  const { engine, calls } = engineFor(doc, {
    render: async () => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 641 });
      return canvas(doc);
    },
  });
  await assert.rejects(captureViewport(doc, { engine }), (error) => error instanceof CaptureViewportError && error.code === 'viewport-changed');
  assert.equal(calls.destroyed, 1);
  dom.window.close();
});

test('截图中 DPR 改变时也拒绝画布并清理 context', async () => {
  const { dom, doc, window } = setup();
  const { engine, calls } = engineFor(doc, {
    render: async () => {
      Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1.5 });
      return canvas(doc);
    },
  });
  await assert.rejects(captureViewport(doc, { engine }), (error) => error instanceof CaptureViewportError && error.code === 'viewport-changed');
  assert.equal(calls.destroyed, 1);
  dom.window.close();
});

test('引擎警告和可见 iframe/webview/video 均不能假装为成功画布', async () => {
  for (const tag of ['iframe', 'webview', 'video']) {
    const { dom, doc } = setup(`<!doctype html><html><body><main>页面</main><${tag} id="embedded"></${tag}></body></html>`);
    Object.defineProperty(doc.querySelector('#embedded'), 'getBoundingClientRect', { value: () => ({
      width: 100, height: 100, left: 0, top: 0, right: 100, bottom: 100,
    }) });
    const { engine, calls } = engineFor(doc);
    await assert.rejects(captureViewport(doc, { engine }), (error) => error instanceof CaptureViewportError && error.code === 'embedded-content');
    assert.equal(calls.root, null);
    dom.window.close();
  }

  const { dom, doc } = setup();

  const warned = engineFor(doc, {
    create: async () => ({ log: { warn() { callsWarningCount++; } } }),
  });
  let callsWarningCount = 0;
  const render = warned.engine.domToCanvas;
  warned.engine.domToCanvas = async (context) => {
    context.log.warn('Failed to fetch resource', 'https://private.test/secret');
    return render(context, warned.calls);
  };
  await assert.rejects(captureViewport(doc, { engine: warned.engine }), (error) => error instanceof CaptureViewportError && error.code === 'resource-warning');
  assert.equal(callsWarningCount, 0, '原 logger 参数（可能含 URL）不向外传播');
  assert.equal(warned.calls.destroyed, 1);
  dom.window.close();
});
