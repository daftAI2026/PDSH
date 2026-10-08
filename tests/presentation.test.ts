/**
 * [INPUT]: 依赖 jsdom 的真实 selector/MutationObserver 与 presentation.js。
 * [OUTPUT]: 验证账号适配、官方头像与行高复用、未登录菜单、来源恢复和精确卸载。
 * [POS]: PDSH 展示层安全合同，不把 DOM 测试伪装成真实登录账号验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountPresentation } from '../src/client/presentation.ts';
import { resolvePreferences } from '../src/shared/model.ts';
import { readFileSync } from 'node:fs';

function fixture() {
  const dom = new JSDOM(`<body><div data-slot="settings.launcher"><button type="button" data-collapsed="false" data-signed-out="false" aria-haspopup="menu" aria-expanded="false"><span class="native-avatar"><img src="official.png" alt=""></span><span class="native-label">真实名称</span></button></div><section data-slot="settings.section"><span>真实名称</span></section></body>`);
  const doc = dom.window.document;
  const style = doc.createElement('style');
  style.dataset.plugin = '@deepseek-ai/dsh-client-ui-settings-account';
  style.dataset.pluginCss = `${style.dataset.plugin}/AccountMenu.module.css`;
  style.textContent = `.fixture_trigger { display:flex;align-items:center;height:44px;padding:6px;font:inherit;font-size:14px }
    .fixture_trigger[data-collapsed=true] { width:36px;height:36px;padding:0 }
    .fixture_trigger[data-signed-out=true]:not([data-collapsed=true]) { height:32px;padding:6px 2px 6px 6px;line-height:20px }
    .fixture_avatar { display:flex;align-items:center;justify-content:center;flex:none;width:24px;height:24px;border-radius:50%;corner-shape:round }
    .native-label { white-space:nowrap }`;
  doc.head.append(style);
  const button = doc.querySelector('button');
  button.className = 'fixture_trigger';
  return { dom, doc, button };
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
test('两个身份及畸形的 signed-out 结构拒绝猜测', () => {
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
  assert.equal(controller.status(), 'unsupported');
  assert.equal(doc.querySelector('[data-pdsh-name]'), null);
  controller.dispose(); dom.window.close();
});

function signedOutFixture() {
  const value = fixture();
  const style = value.doc.createElement('style');
  style.textContent = readFileSync(new URL('../src/client/styles.css', import.meta.url), 'utf8');
  value.doc.head.append(style);
  value.button.dataset.signedOut = 'true';
  value.button.innerHTML = '<svg class="native-more" style="width:14px;height:14px"></svg><span class="native-label">更多</span>';
  return value;
}

test('未登录默认保留更多；主动替换复用原按钮和菜单，停用精确恢复', () => {
  const { dom, doc, button } = signedOutFixture();
  const before = doc.body.innerHTML;
  const icon = button.firstElementChild;
  let clicks = 0;
  button.addEventListener('click', () => { clicks++; button.setAttribute('aria-expanded', 'true'); });
  const controller = mountPresentation(doc);
  controller.update(resolvePreferences({}));
  assert.equal(doc.body.innerHTML, before);
  assert.equal(controller.accountStatus(), 'signed-out');
  controller.update(resolvePreferences({ maskIdentity: true, nickname: '访客' }));
  assert.equal(controller.status(), 'masked');
  assert.equal(button.querySelector('[data-pdsh-name]').textContent, '访客');
  assert.equal(dom.window.getComputedStyle(button.querySelector('[data-pdsh-avatar-container]')).width, '24px');
  assert.equal(dom.window.getComputedStyle(button).height, '44px');
  assert.equal(dom.window.getComputedStyle(button).padding, '6px');
  assert.notEqual(dom.window.getComputedStyle(button).lineHeight, '20px');
  assert.equal(button.dataset.signedOut, 'true');
  assert.equal(button.firstElementChild, icon);
  assert.equal(dom.window.getComputedStyle(icon).display, 'none');
  assert.equal(dom.window.getComputedStyle(button.querySelector('.native-label')).display, 'none');
  assert.equal(dom.window.getComputedStyle(button.querySelector('[data-pdsh-name]')).display, '');
  assert.equal(button.querySelector('.native-label').textContent, '更多');
  button.click();
  assert.equal(clicks, 1);
  assert.equal(button.getAttribute('aria-expanded'), 'true');
  button.setAttribute('aria-expanded', 'false');
  controller.update(resolvePreferences({ maskIdentity: false }));
  assert.equal(doc.body.innerHTML, before);
  assert.notEqual(dom.window.getComputedStyle(icon).display, 'none');
  assert.equal(dom.window.getComputedStyle(button).height, '32px');
  assert.equal(dom.window.getComputedStyle(button).paddingRight, '2px');
  assert.equal(dom.window.getComputedStyle(button).lineHeight, '20px');
  controller.dispose(); dom.window.close();
});

test('账号头像退出后只显示生成头像，不写偏好；登录后恢复原账号来源', () => {
  const { dom, doc, button } = fixture();
  const preferences = Object.freeze(resolvePreferences({ maskIdentity: true, useAccountAvatar: true, nickname: '访客', avatar: 'data:image/png;base64,aGVsbG8=' }));
  const controller = mountPresentation(doc);
  controller.update(preferences);
  assert.equal(controller.accountStatus(), 'signed-in');
  button.dataset.signedOut = 'true';
  button.innerHTML = '<svg style="width:14px;height:14px"></svg><span>更多</span>';
  controller.refresh();
  assert.equal(controller.accountAvatar(), '');
  assert.equal(controller.accountStatus(), 'signed-out');
  assert.equal(button.querySelector('[data-pdsh-avatar-image]').getAttribute('src'), resolvePreferences({ nickname: '访客' }).avatar);
  assert.equal(preferences.useAccountAvatar, true);
  assert.equal(preferences.avatar, 'data:image/png;base64,aGVsbG8=');
  button.dataset.signedOut = 'false';
  button.innerHTML = '<span><img src="second.png"></span><span>原账号</span>';
  controller.refresh();
  assert.equal(controller.accountStatus(), 'signed-in');
  assert.equal(controller.accountAvatar(), 'second.png');
  assert.equal(button.querySelector('[data-pdsh-avatar-image]'), null);
  assert.equal(button.querySelector('[data-pdsh-name]').textContent, '访客');
  controller.dispose(); dom.window.close();
});

test('登录可用性独立于替换开关和原生头像是否为图片', () => {
  const { dom, doc, button } = fixture();
  button.innerHTML = '<span><svg></svg></span><span>账号</span>';
  const controller = mountPresentation(doc);
  controller.update(resolvePreferences({}));
  assert.equal(controller.accountStatus(), 'signed-in');
  assert.equal(controller.accountAvatar(), '');
  let changes = 0;
  controller.subscribe(() => changes++);
  button.dataset.signedOut = 'true';
  button.innerHTML = '<svg style="width:14px;height:14px"></svg><span>更多</span>';
  controller.refresh();
  assert.equal(controller.status(), 'disabled');
  assert.equal(controller.accountStatus(), 'signed-out');
  assert.equal(changes, 1);
  controller.dispose(); dom.window.close();
});

test('未登录复用官方头像样式，收起不改原生尺寸，样式撤销时归还覆盖', () => {
  const { dom, doc, button } = signedOutFixture();
  const controller = mountPresentation(doc);
  const preferences = resolvePreferences({ maskIdentity: true, nickname: '访客' });
  controller.update(preferences);
  const detached = button.querySelector('[data-pdsh-avatar-container]');
  button.dataset.collapsed = 'true';
  button.querySelector('.native-label').remove();
  controller.refresh();
  assert.equal(controller.status(), 'masked');
  assert.equal(button.querySelectorAll('[data-pdsh-avatar-container]').length, 1);
  assert.equal(detached.isConnected, false);
  assert.equal(button.querySelector('[data-pdsh-name]'), null);
  const nativeIcon = button.querySelector('svg');
  nativeIcon.style.width = '18px';
  controller.refresh();
  assert.equal(dom.window.getComputedStyle(button.querySelector('[data-pdsh-avatar-container]')).width, '24px');
  assert.equal(dom.window.getComputedStyle(button).height, '36px');
  const officialStyle = doc.querySelector('style[data-plugin-css]');
  officialStyle.textContent = officialStyle.textContent.replaceAll('24px', '28px');
  controller.refresh();
  assert.equal(dom.window.getComputedStyle(button.querySelector('[data-pdsh-avatar-container]')).width, '28px');
  officialStyle.remove();
  controller.refresh();
  assert.equal(controller.status(), 'unsupported');
  assert.equal(button.querySelector('[data-pdsh-avatar-container]'), null);
  assert.equal(nativeIcon.hasAttribute('data-pdsh-original-avatar'), false);
  controller.dispose(); dom.window.close();
});

test('官方样式缺失、重复、错属或触发器不匹配时不猜头像尺寸', () => {
  for (const alter of [
    doc => doc.querySelector('style[data-plugin-css]').remove(),
    doc => { const node = doc.querySelector('style[data-plugin-css]'); doc.head.append(node.cloneNode(true)); },
    doc => { doc.querySelector('style[data-plugin-css]').dataset.plugin = 'other-plugin'; },
    doc => { doc.querySelector('button').className = 'foreign_trigger'; },
  ]) {
    const { dom, doc, button } = signedOutFixture();
    alter(doc);
    const before = doc.body.innerHTML;
    const controller = mountPresentation(doc);
    controller.update(resolvePreferences({ maskIdentity: true }));
    assert.equal(controller.status(), 'unsupported');
    assert.equal(doc.body.innerHTML, before);
    controller.dispose(); dom.window.close();
  }
});

test('样式 shorthand 序列化不改变语义；head 样式移除与重建自动结算', async () => {
  const { dom, doc, button } = signedOutFixture();
  const official = doc.querySelector('style[data-plugin-css]');
  official.textContent = official.textContent.replace('flex:none', 'flex:0 0 auto');
  const controller = mountPresentation(doc);
  controller.update(resolvePreferences({ maskIdentity: true }));
  assert.equal(controller.status(), 'masked');
  const settle = () => new Promise(resolve => dom.window.setTimeout(resolve, 0));
  const removed = doc.querySelector('[data-pdsh-identity-style]');
  removed.remove();
  await settle();
  assert.ok(doc.querySelector('[data-pdsh-identity-style]')?.isConnected);
  assert.equal(dom.window.getComputedStyle(button).height, '44px');
  official.remove();
  await settle();
  assert.equal(controller.status(), 'unsupported');
  assert.equal(button.querySelector('[data-pdsh-avatar-container]'), null);
  doc.head.append(official);
  await settle();
  assert.equal(controller.status(), 'masked');
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

test('账号头像模式不创建覆盖图，昵称仍独立；来源切换与宿主图片更新不写账户', async () => {
  const { dom, doc, button } = fixture();
  const original = button.querySelector('.native-avatar > img');
  const controller = mountPresentation(doc);
  controller.update(resolvePreferences({ maskIdentity: true, useAccountAvatar: true, nickname: '别名' }));
  assert.equal(button.querySelector('[data-pdsh-avatar-image]'), null);
  assert.equal(button.querySelector('[data-pdsh-avatar]'), null);
  assert.equal(button.querySelector('[data-pdsh-name]').textContent, '别名');
  assert.equal(controller.accountAvatar(), 'official.png');
  controller.update(resolvePreferences({ maskIdentity: true, useAccountAvatar: false }));
  assert.ok(button.querySelector('[data-pdsh-avatar-image]'));
  controller.update(resolvePreferences({ maskIdentity: true, useAccountAvatar: true }));
  assert.equal(button.querySelector('[data-pdsh-avatar-image]'), null);
  assert.equal(button.querySelector('.native-avatar > img'), original);
  original.setAttribute('src', 'updated.png');
  await new Promise(resolve => dom.window.setTimeout(resolve, 0));
  assert.equal(controller.accountAvatar(), 'updated.png');
  controller.dispose(); assert.equal(original.getAttribute('src'), 'updated.png'); dom.window.close();
});

test('畸形账号结构不暴露预览来源，不因适配器失效损坏宿主', () => {
  const { dom, doc, button } = fixture();
  button.querySelector('.native-label').remove();
  const controller = mountPresentation(doc);
  assert.doesNotThrow(() => controller.update(resolvePreferences({ maskIdentity: true, useAccountAvatar: true })));
  assert.equal(controller.status(), 'unsupported'); assert.equal(controller.accountAvatar(), '');
  assert.equal(doc.querySelector('[data-pdsh-name]'), null);
  controller.dispose(); dom.window.close();
});
