/**
 * [INPUT]: 依赖 DSH 截图隐私临时标记与视口/PNG 比例映射。
 * [OUTPUT]: 验证源尺寸歧义时舍弃自动区域，原 DOM 属性在截图后原样归还。
 * [POS]: capture 隐私回归测试；不宣称覆盖聊天消息或宿主数据。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mapCandidatesToPng, markDSHPrivacyPlaceholders } from '../src/client/capture/privacy.ts';
test('只在截图与视口同纵横比时映射自动遮挡候选', () => {
  const candidate = [{ id: 'one', x: 10, y: 20, width: 50, height: 30 }];
  assert.deepEqual(mapCandidatesToPng(candidate, { width: 2560, height: 1640 }, { width: 1280, height: 820 }), [{ id: 'one', x: 20, y: 40, width: 100, height: 60 }]);
  assert.deepEqual(mapCandidatesToPng(candidate, { width: 2560, height: 1800 }, { width: 1280, height: 820 }), []);
});
test('唯一账户启动器的原值不改写，临时隐私标记归还', () => {
  const dom = new JSDOM('<div data-slot="settings.launcher"><button aria-haspopup="menu" data-signed-out="false"><span><img src="a.png"></span><span data-pdsh-capture-redact="existing">姓名</span></button></div>');
  const doc = dom.window.document, before = doc.body.innerHTML;
  const restore = markDSHPrivacyPlaceholders(doc);
  assert.equal(doc.querySelector('img').parentElement.hasAttribute('data-pdsh-capture-redact-profile'), true);
  restore(); assert.equal(doc.body.innerHTML, before); dom.window.close();
});
