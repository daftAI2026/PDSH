/**
 * [INPUT]: 依赖截图控制器与串行隐藏生命周期的可注入边界。
 * [OUTPUT]: 验证整窗像素不套页面 DPR/坐标、授权等待不被页面计时器截断。
 * [POS]: RC 原生整窗的 Client 合同；不是实机取像或系统授权证据。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountCaptureController } from '../src/client/capture/controller.ts';
import { capturePreparedWindow } from '../src/client/capture/capture-lifecycle.ts';
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
