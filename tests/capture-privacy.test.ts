/**
 * [INPUT]: 依赖标题与身份严格识别、临时标记及视口/PNG 比例映射。
 * [OUTPUT]: 验证标题/头像/名称独立遮挡、未登录 More 退让、未知结构、属性所有权和比例守卫。
 * [POS]: capture 隐私回归测试；不宣称覆盖聊天消息或宿主数据。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { collectDSHCandidates, mapCandidatesToPng, markDSHPrivacyPlaceholders } from '../src/client/capture/privacy.ts';
import { mountSidebarRedaction, recognizedSidebarTitles } from '../src/client/sidebar-redaction.ts';
import { mountPresentation } from '../src/client/presentation.ts';
import { resolvePreferences } from '../src/shared/model.ts';

test('未登录的原生更多不遮挡；主动替换后只遮挡可见身份', () => {
  const dom = new JSDOM('<div data-slot="settings.launcher"><button aria-haspopup="menu" data-collapsed="false" data-signed-out="true"><svg style="width:14px;height:14px"></svg><span>更多</span></button></div><section>登录与设置</section>');
  const doc = dom.window.document;
  const native = doc.createElement('style');
  native.dataset.plugin = '@deepseek-ai/dsh-client-ui-settings-account';
  native.dataset.pluginCss = `${native.dataset.plugin}/AccountMenu.module.css`;
  native.textContent = '.fixture_trigger {display:flex;align-items:center;height:44px;padding:6px} .fixture_avatar {display:flex;align-items:center;justify-content:center;flex:none;width:24px;height:24px;border-radius:50%}';
  doc.head.append(native);
  doc.querySelector('button').className = 'fixture_trigger';
  const before = doc.body.innerHTML;
  const untouched = markDSHPrivacyPlaceholders(doc, { maskTitles: false });
  assert.equal(doc.body.innerHTML, before);
  untouched();
  const presentation = mountPresentation(doc);
  presentation.update(resolvePreferences({ maskIdentity: true }));
  const restore = markDSHPrivacyPlaceholders(doc, { maskTitles: false });
  assert.ok(doc.querySelector('[data-pdsh-avatar-container]').hasAttribute('data-pdsh-capture-redact-profile'));
  assert.equal(doc.querySelector('[data-pdsh-name]').getAttribute('data-pdsh-capture-redact'), 'text');
  assert.equal(doc.querySelector('button > svg').hasAttribute('data-pdsh-capture-redact-profile'), false);
  assert.equal(doc.querySelector('button > span:not([data-pdsh-avatar-container]):not([data-pdsh-name])').hasAttribute('data-pdsh-capture-redact'), false);
  assert.equal(doc.querySelector('section').textContent, '登录与设置');
  restore(); presentation.dispose();
  assert.equal(doc.body.innerHTML, before);
  dom.window.close();
});
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
test('头像遮罩只覆盖严格识别的头像容器，不遮挡原生名称或自有名牌', () => {
  const dom = new JSDOM('<div data-slot="settings.launcher"><button aria-haspopup="menu" data-collapsed="false" data-signed-out="false"><span><img src="a.png"></span><span>原生名称</span><span data-pdsh-name>自有名牌</span></button></div>');
  const doc = dom.window.document;
  const avatar = doc.querySelector('button > span:first-child');
  const nativeName = doc.querySelector('button > span:nth-child(2)');
  const ownedName = doc.querySelector('[data-pdsh-name]');
  const restore = markDSHPrivacyPlaceholders(doc, { maskTitles: false, maskIdentity: false, maskAvatar: true });
  assert.equal(avatar.getAttribute('data-pdsh-capture-redact-avatar-only'), '');
  assert.equal(nativeName.hasAttribute('data-pdsh-capture-redact'), false);
  assert.equal(ownedName.hasAttribute('data-pdsh-capture-redact'), false);
  restore();
  assert.equal(avatar.hasAttribute('data-pdsh-capture-redact-avatar-only'), false);
  dom.window.close();
});
test('未登录头像遮罩覆盖自有头像容器，不覆盖原生更多或自有名称', () => {
  const dom = new JSDOM('<div data-slot="settings.launcher"><button aria-haspopup="menu" data-collapsed="false" data-signed-out="true"><svg style="width:14px;height:14px"></svg><span>更多</span></button></div>');
  const doc = dom.window.document;
  const native = doc.createElement('style');
  native.dataset.plugin = '@deepseek-ai/dsh-client-ui-settings-account';
  native.dataset.pluginCss = `${native.dataset.plugin}/AccountMenu.module.css`;
  native.textContent = '.fixture_trigger {display:flex;align-items:center;height:44px;padding:6px} .fixture_avatar {display:flex;align-items:center;justify-content:center;flex:none;width:24px;height:24px;border-radius:50%}';
  doc.head.append(native);
  doc.querySelector('button').className = 'fixture_trigger';
  const presentation = mountPresentation(doc);
  presentation.update(resolvePreferences({ maskIdentity: true }));
  const ownedAvatar = doc.querySelector('[data-pdsh-avatar-container]');
  const ownedName = doc.querySelector('[data-pdsh-name]');
  const more = doc.querySelector('button > span:not([data-pdsh-avatar-container]):not([data-pdsh-name])');
  const restore = markDSHPrivacyPlaceholders(doc, { maskTitles: false, maskIdentity: false, maskAvatar: true });
  assert.equal(ownedAvatar.getAttribute('data-pdsh-capture-redact-avatar-only'), '');
  assert.equal(ownedName.hasAttribute('data-pdsh-capture-redact'), false);
  assert.equal(more.textContent, '更多');
  assert.equal(more.hasAttribute('data-pdsh-capture-redact'), false);
  assert.equal(doc.querySelector('button > svg').hasAttribute('data-pdsh-capture-redact-avatar-only'), false);
  restore();
  assert.equal(ownedAvatar.hasAttribute('data-pdsh-capture-redact-avatar-only'), false);
  presentation.dispose();
  dom.window.close();
});
test('接受的身份配置可遮名称，同时本地头像覆盖单独关闭头像标记', () => {
  const dom = new JSDOM('<div data-slot="settings.launcher"><button aria-haspopup="menu" data-collapsed="false" data-signed-out="false"><span><img src="a.png"></span><span>原生名称</span><span data-pdsh-name>自有名牌</span></button></div>');
  const doc = dom.window.document;
  const trigger = doc.querySelector('button');
  const avatar = trigger.children[0];
  const nativeName = trigger.children[1];
  const ownedName = trigger.querySelector('[data-pdsh-name]');
  const restore = markDSHPrivacyPlaceholders(doc, { maskTitles: false, maskIdentity: true, maskAvatar: false });
  assert.equal(avatar.hasAttribute('data-pdsh-capture-redact-avatar-only'), false);
  assert.equal(avatar.hasAttribute('data-pdsh-capture-redact-profile'), false);
  assert.equal(nativeName.getAttribute('data-pdsh-capture-redact'), 'text');
  assert.equal(ownedName.getAttribute('data-pdsh-capture-redact'), 'text');
  restore();
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
