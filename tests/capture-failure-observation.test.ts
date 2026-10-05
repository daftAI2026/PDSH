/**
 * [INPUT]: 依赖相机控制器、固定失败码诊断与 jsdom 的隔离页面。
 * [OUTPUT]: 验证实际失败码能到达通知和 logger，旧后台有独立可执行提示，未知异常不能泄漏内容。
 * [POS]: Client 可观测性回归；不代表官方 Remote 或原生取像成功。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountCaptureController } from '../src/client/capture/controller.ts';
import { CaptureClientError } from '../src/client/capture/window-capture-stream.ts';
import { createCaptureTrace } from '../src/shared/capture-trace.ts';

test('真实分类穿过失败通知和阶段日志，不输出原始异常', async () => {
  for (const code of ['disposed', 'stream-failed', 'helper-failed', 'invalid-capture'] as const) {
    const dom = new JSDOM('<html lang="zh"><body></body></html>', {url:'https://dsh.test/'});
    const notices: string[] = [], logs: unknown[][] = [];
    const controller = mountCaptureController(dom.window.document, {
      capture: async () => {throw new CaptureClientError(code);},
      waitFrame: async () => {},
      notify: message => notices.push(message),
      trace: createCaptureTrace({info: (...args) => logs.push(args)}, 'renderer'),
    });
    await controller.activate();
    assert.match(notices.at(-1), new RegExp(code));
    assert.ok(logs.some(args => args.includes('capture-failed') && args.includes(code)));
    controller.dispose(); dom.window.close();
  }
});

test('日志白名单拒绝任意code，失效logger不能损坏取像', () => {
  const logs: unknown[][] = [];
  const trace = createCaptureTrace({info: (...args) => logs.push(args)}, 'renderer');
  trace('capture-failed', undefined, 'helper-failed');
  assert.ok(logs[0].includes('helper-failed'));
  trace('capture-failed', undefined, '/private/secret arbitrary-error' as never);
  assert.ok(!JSON.stringify(logs).includes('/private/secret'));
  assert.doesNotThrow(() => createCaptureTrace({info: () => {throw Error('logger');}}, 'renderer')('capture-failed', undefined, 'disposed'));
});


test('已知旧后台提示保留工作后加载，连接未知不猜授权或重启', async () => {
  for (const [code, expected, rejected] of [
    ['runtime-not-current', /后台.*插件版本.*保留工作.*重新打开 DSH/, /录屏权限/],
    ['stream-failed', /连接未完成.*插件状态/, /重新打开 DSH|录屏权限/],
  ] as const) {
    const dom = new JSDOM('<html lang="zh"><body></body></html>', { url: 'https://dsh.test/' })
    const notices: string[] = []
    const controller = mountCaptureController(dom.window.document, {
      capture: async () => { throw new CaptureClientError(code) }, waitFrame: async () => {},
      notify: message => notices.push(message),
    })
    try {
      await controller.activate()
      assert.match(notices.at(-1)!, expected)
      assert.doesNotMatch(notices.at(-1)!, rejected)
    } finally { controller.dispose(); dom.window.close() }
  }
})


test('公开取像失败码都有中英文提示，未知异常内容不被翻译或展示', async () => {
  const { CAPTURE_FAILURE_CODES } = await import('../src/shared/window-capture-protocol.ts')
  const { captureFailureMessage } = await import('../src/client/capture/copy.ts')
  for (const code of [...CAPTURE_FAILURE_CODES, 'runtime-not-current', 'stream-failed', 'invalid-capture']) {
    assert.ok(captureFailureMessage(code, 'zh'))
    assert.ok(captureFailureMessage(code, 'en'))
  }
  assert.equal(captureFailureMessage('/private/secret raw-error', 'zh'), undefined)
})
