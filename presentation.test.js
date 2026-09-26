/**
 * [INPUT]: 依赖 jsdom 的真实 selector/MutationObserver 与 presentation.js。
 * [OUTPUT]: 验证 rc.2 账号适配的归属、重挂、拒绝歧义和无残留卸载。
 * [POS]: PDSH 展示层安全合同，不把 DOM 测试伪装成真实登录账号验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountPresentation } from './presentation.js';
import { resolvePreferences } from './model.js';

function fixture() {
  const dom = new JSDOM(`<body><div data-slot="settings.launcher"><button type="button" data-collapsed="false" data-signed-out="false" aria-haspopup="menu" aria-expanded="false"><span class="native-avatar"><img src="official.png" alt=""></span><span class="native-label">真实名称</span></button></div><section data-slot="settings.section"><span>真实名称</span></section></body>`);
  return { dom, doc: dom.window.document, button: dom.window.document.querySelector('button') };
}
test('只覆盖已识别身份的视觉，不写真实文字、图片或按钮语义', () => {
  const { dom, doc, button } = fixture();
  const before = doc.body.innerHTML;
  const controller = mountPresentation(doc);
  controller.update(resolvePreferences({ maskIdentity: true, nickname: '临时访客' }));
  assert.equal(controller.status(), 'masked');
  assert.equal(button.querySelector('.native-label').textContent, '真实名称');
  assert.equal(button.querySelector('.native-avatar > img:not([data-pdsh-avatar-image])').getAttribute('src'), 'official.png');
  assert.equal(button.querySelector('[data-pdsh-name]').textContent, '临时访客');
  assert.equal(doc.querySelector('section').textContent, '真实名称');
  assert.equal(button.getAttribute('aria-expanded'), 'false');
  controller.dispose();
  assert.equal(doc.body.innerHTML, before);
  dom.window.close();
});
test('原生重渲染后修复；更新昵称；停用后完全恢复', async () => {
  const { dom, doc, button } = fixture();
  const controller = mountPresentation(doc);
  controller.update(resolvePreferences({ maskIdentity: true }));
  button.innerHTML = '<span class="native-avatar"><svg></svg></span><span class="native-label">新真实名称</span>';
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(button.querySelector('[data-pdsh-name]').textContent, '临时访客');
  controller.update(resolvePreferences({ maskIdentity: true, nickname: '<b>不是 HTML</b>' }));
  assert.equal(button.querySelector('[data-pdsh-name]').textContent, '<b>不是 HTML</b>');
  assert.equal(button.querySelector('[data-pdsh-name] b'), null);
  controller.update(resolvePreferences({ maskIdentity: false, frames: false }));
  assert.equal(doc.querySelector('[data-pdsh-name]'), null);
  assert.equal(doc.body.hasAttribute('data-pdsh-frames'), false);
  assert.equal(controller.status(), 'disabled');
  controller.dispose(); dom.window.close();
});
test('两个身份拒绝猜测；signed-out 的 More 不冒充登录身份', () => {
  const { dom, doc, button } = fixture();
  const controller = mountPresentation(doc);
  controller.update(resolvePreferences({ maskIdentity: true }));
  const clone = button.cloneNode(true);
  clone.querySelectorAll('[data-pdsh-name], [data-pdsh-avatar-image]').forEach(node => node.remove());
  doc.querySelector('[data-slot]').append(clone);
  controller.refresh();
  assert.equal(controller.status(), 'unsupported');
  assert.equal(doc.querySelector('[data-pdsh-name]'), null);
  clone.remove();
  button.setAttribute('data-signed-out', 'true');
  controller.refresh();
  assert.equal(controller.status(), 'signed-out');
  assert.equal(doc.querySelector('[data-pdsh-name]'), null);
  controller.dispose(); dom.window.close();
});
test('收起侧栏没有昵称，仍保留原生头像尺寸容器', () => {
  const { dom, doc, button } = fixture();
  button.setAttribute('data-collapsed', 'true');
  button.querySelector('.native-label').remove();
  const controller = mountPresentation(doc);
  controller.update(resolvePreferences({ maskIdentity: true }));
  assert.equal(controller.status(), 'masked');
  assert.equal(button.querySelector('[data-pdsh-name]'), null);
  assert.equal(button.querySelector('[data-pdsh-avatar-image]').parentElement.className, 'native-avatar');
  controller.dispose(); dom.window.close();
});
