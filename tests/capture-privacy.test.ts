/**
 * [INPUT]: 依赖标题与身份严格识别、临时标记及视口/PNG 比例映射。
 * [OUTPUT]: 验证标题/身份独立、侧栏名牌/原生名称/头像遮挡、未知结构和账号编辑退让、属性所有权及比例守卫。
 * [POS]: capture 隐私回归测试；不宣称覆盖聊天消息或宿主数据。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { collectDSHCandidates, mapCandidatesToPng, markDSHPrivacyPlaceholders } from '../src/client/capture/privacy.ts';
import { mountSidebarRedaction, recognizedSidebarTitles } from '../src/client/sidebar-redaction.ts';
test('只在截图与视口同纵横比时映射自动遮挡候选', () => {
  const candidate = [{ id: 'one', x: 10, y: 20, width: 50, height: 30 }];
  assert.deepEqual(mapCandidatesToPng(candidate, { width: 2560, height: 1640 }, { width: 1280, height: 820 }), [{ id: 'one', x: 20, y: 40, width: 100, height: 60 }]);
  assert.deepEqual(mapCandidatesToPng(candidate, { width: 2560, height: 1800 }, { width: 1280, height: 820 }), []);
});
test('唯一账户启动器的原值不改写，临时隐私标记归还', () => {
  const dom = new JSDOM('<div data-slot="settings.launcher"><button aria-haspopup="menu" data-collapsed="false" data-signed-out="false"><span><img src="a.png"></span><span data-pdsh-capture-redact="existing">姓名</span></button></div>');
  const doc = dom.window.document, before = doc.body.innerHTML;
  const restore = markDSHPrivacyPlaceholders(doc);
  assert.equal(doc.querySelector('img').parentElement.hasAttribute('data-pdsh-capture-redact-profile'), true);
  restore(); assert.equal(doc.body.innerHTML, before); dom.window.close();
});
test('身份遮挡独立于标题隐私，并同时遮挡可见自有名牌、原生名称与头像', () => {
  const dom = new JSDOM('<div data-slot="settings.launcher"><button aria-haspopup="menu" data-collapsed="false" data-signed-out="false"><span><img src="a.png"></span><span>原生名称</span><span data-pdsh-name data-pdsh-capture-redact="external">自有名牌</span></button></div>');
  const doc = dom.window.document;
  const avatar = doc.querySelector('button > span:first-child');
  const nativeName = doc.querySelector('button > span:nth-child(2)');
  const ownedName = doc.querySelector('[data-pdsh-name]');
  const restore = markDSHPrivacyPlaceholders(doc, { maskTitles: false, maskIdentity: true });
  assert.equal(avatar.hasAttribute('data-pdsh-capture-redact-profile'), true);
  assert.equal(nativeName.getAttribute('data-pdsh-capture-redact'), 'text');
  assert.equal(ownedName.getAttribute('data-pdsh-capture-redact'), 'text');
  restore();
  assert.equal(avatar.hasAttribute('data-pdsh-capture-redact-profile'), false);
  assert.equal(nativeName.hasAttribute('data-pdsh-capture-redact'), false);
  assert.equal(ownedName.getAttribute('data-pdsh-capture-redact'), 'external', 'restore 不覆盖另一个属性所有者');
  dom.window.close();
});
test('标题遮挡不等于身份遮挡，身份未获准时不碰账户信息或设置页昵称编辑', () => {
  const dom = new JSDOM('<div data-slot="sidebar.workspaces"><div role="treeitem" data-row-key="session:one"><span></span><span>标题</span></div></div><div data-slot="settings.launcher"><button aria-haspopup="menu" data-collapsed="false" data-signed-out="false"><span><img src="a.png"></span><span>账户名称</span><span data-pdsh-name>自有名牌</span></button></div><section data-slot="settings.account"><span data-pdsh-name>设置页账户资料</span><input aria-label="昵称编辑" value="用户草稿"></section>');
  const doc = dom.window.document;
  const nativeName = doc.querySelector('[data-slot="settings.launcher"] button > span:nth-child(2)');
  const ownedName = doc.querySelector('[data-pdsh-name]');
  const avatar = doc.querySelector('[data-slot="settings.launcher"] img').parentElement;
  const title = doc.querySelector('[data-row-key="session:one"] span:nth-child(2)');
  const settingsName = doc.querySelector('[data-slot="settings.account"] [data-pdsh-name]');
  const input = doc.querySelector('input');
  const restore = markDSHPrivacyPlaceholders(doc, { maskTitles: true, maskIdentity: false });
  assert.equal(title.getAttribute('data-pdsh-capture-redact'), 'text');
  assert.equal(nativeName.hasAttribute('data-pdsh-capture-redact'), false);
  assert.equal(ownedName.hasAttribute('data-pdsh-capture-redact'), false);
  assert.equal(avatar.hasAttribute('data-pdsh-capture-redact-profile'), false);
  assert.equal(settingsName.hasAttribute('data-pdsh-capture-redact'), false);
  assert.equal(input.value, '用户草稿');
  assert.equal(input.hasAttribute('data-pdsh-capture-redact'), false);
  restore(); dom.window.close();
});
test('拍照和显示灰条识别同一标题；临时拍照标记不改变用户的开关或原文', () => {
  const dom = new JSDOM(`<div data-slot="sidebar.workspaces"><div role="treeitem" data-row-key="session:one"><span></span><span>原始标题</span></div><div role="treeitem" data-row-key="session:bad"><span>未知前置内容</span><span>不要碰</span></div></div>`);
  const doc = dom.window.document, title = recognizedSidebarTitles(doc)[0], titles = mountSidebarRedaction(doc);
  titles.update(false);
  const restore = markDSHPrivacyPlaceholders(doc);
  assert.equal(title.getAttribute('data-pdsh-capture-redact'), 'text');
  assert.equal(title.hasAttribute('data-pdsh-redacted-title'), false);
  assert.equal(doc.querySelector('[data-row-key="session:bad"] [data-pdsh-capture-redact]'), null);
  titles.update(true); restore();
  assert.ok(title.hasAttribute('data-pdsh-redacted-title'), '拍照结束不能撤销用户刚启用的灰条');
  assert.equal(title.hasAttribute('data-pdsh-capture-redact'), false);
  assert.equal(title.textContent, '原始标题');
  titles.dispose(); dom.window.close();
});
test('头像组件不支持的未知账号结构，拍照不能用另一套宽松选择器猜它', () => {
  for (const content of [
    '<span><img src="a.png"></span><span>名字</span><span>额外字段</span>',
    '<span><img src="a.png"></span><div>非原生名字</div>',
  ]) {
    const dom = new JSDOM(`<div data-slot="settings.launcher"><button aria-haspopup="menu" data-collapsed="false" data-signed-out="false">${content}</button></div>`);
    const doc = dom.window.document, before = doc.body.innerHTML;
    const restore = markDSHPrivacyPlaceholders(doc);
    assert.equal(doc.body.innerHTML, before);
    assert.deepEqual(collectDSHCandidates(doc), []);
    restore(); dom.window.close();
  }
});
test('拍照临时属性被其他功能接管时，归还不能覆盖新的所有者', () => {
  const dom = new JSDOM('<div data-slot="sidebar.workspaces"><div role="treeitem" data-row-key="session:one"><span></span><span>标题</span></div></div>');
  const doc = dom.window.document, title = recognizedSidebarTitles(doc)[0];
  const restore = markDSHPrivacyPlaceholders(doc);
  title.setAttribute('data-pdsh-capture-redact', 'new-owner');
  restore(); assert.equal(title.getAttribute('data-pdsh-capture-redact'), 'new-owner');
  dom.window.close();
});
