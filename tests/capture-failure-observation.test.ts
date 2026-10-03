/**
 * [INPUT]: 依赖相机控制器、固定失败码诊断与 jsdom 的隔离页面。
 * [OUTPUT]: 验证实际失败码能到达通知和 logger，未知异常不能泄漏内容。
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
