/**
 * [INPUT]: 依赖工作台模板、闭集系统壁纸 ID、双语文案与背景按钮事件适配。
 * [OUTPUT]: 验证来源分组/个人plus接线与焦点、动态系统语义名精确ARIA标签、静默图库/固定失败码及批获取状态边界。
 * [POS]: 图片来源分组与一键获取交互合同；保留五张随包预设，不以 DOM 桩证明媒体获取或 Desktop 视觉。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { SYSTEM_WALLPAPER_IDS } from '../src/shared/system-wallpaper-protocol.ts';
import { captureWindowCopy } from '../src/client/capture/copy.ts';
import { createCaptureWindowState } from '../src/client/capture/model.ts';
import { captureWindowTemplate, rememberCaptureWindowRender, restoreCaptureWindowRender } from '../src/client/capture/view.ts';
import { wireCaptureBackgroundActions } from '../src/client/capture/background-controls.ts';
import type { SystemWallpaperState } from '../src/client/capture/system-wallpapers.ts';

const thumbnail = 'data:image/jpeg;base64,YQ==';
const state = createCaptureWindowState({ width: 800, height: 600, scaleFactor: 1 });

for (const locale of ['zh', 'en']) {
  test(`${locale} 获取入口本机优先缺失自动下载，不要求证书/权限设置`, () => {
    const copy = captureWindowCopy(locale);
    assert.equal(copy.loadWallpapers, locale === 'zh' ? '获取系统壁纸' : 'Get system wallpapers');
    assert.equal(copy.systemWallpapersPartial, locale === 'zh'
      ? '部分系统壁纸获取失败，已存图片不受影响。'
      : 'Some system wallpapers could not be acquired. Saved images are kept.');
  });
  test(`${locale} 读取本地图库不显示加载行，保留busy语义、缓存项和失败提示`, () => {
    const copy = captureWindowCopy(locale);
    for (const cached of [false, true]) {
      const assets = cached ? [{
        id: `user-wallpaper-${'a'.repeat(64)}`, blob: new Blob(['owned fixture'], { type: 'image/png' }),
        width: 1, height: 1, sourceType: 'image' as const, thumbnail, createdAt: 1,
      }] : [];
      const dom = new JSDOM(captureWindowTemplate(state, copy, { galleryStatus: 'loading', galleryAssets: assets }));
      try {
        const group = dom.window.document.querySelector<HTMLElement>(`[aria-label="${copy.myImages}"]`)!;
        assert.equal(group.querySelector('[data-gallery-status]'), null, '读取中不插入会挤动网格的提示行');
        assert.equal(group.getAttribute('aria-busy'), 'true', '真实读取仍有非视觉busy语义');
        assert.equal(group.querySelectorAll('[data-gallery-user-image]').length, cached ? 1 : 0,
          '不显示提示不能顺手清空已缓存缩略图');
        dom.window.document.body.innerHTML = captureWindowTemplate(state, copy,
          { galleryStatus: 'error', galleryAssets: assets });
        const failed = dom.window.document.querySelector<HTMLElement>(`[aria-label="${copy.myImages}"]`)!;
        assert.equal(failed.getAttribute('aria-busy'), 'false');
        const alert = failed.querySelector('[data-gallery-status][role="alert"]');
        assert.equal(alert?.textContent, copy.galleryError, '读取失败仍明确显示，不能作为加载文案一起删除');
      } finally { dom.window.close(); }
    }
  });
}

function fixture({ cached = 0, status = 'ready', acquisition, locale = 'zh' }: {
  cached?: number;
  status?: SystemWallpaperState['status'];
  acquisition?: SystemWallpaperState['acquisition'];
  locale?: string;
} = {}) {
  const copy = captureWindowCopy(locale);
  const entries = SYSTEM_WALLPAPER_IDS.map((id, index) => ({
    id, name: copy.systemWallpaperNames[id], available: false, downloadable: true,
    ...(index < cached ? { thumbnail, sourceType: 'video' as const, loadStatus: 'ready' as const } : {}),
  }));
  const dom = new JSDOM(captureWindowTemplate(state, copy, {
    systemWallpapers: { entries, status, acquisition },
  }));
  const panel = dom.window.document.querySelector<HTMLElement>('[data-background-section="wallpapers"]')!;
  return { copy, dom, panel };
}

function expectSystemWallpaperGroup(panel: HTMLElement, locale: string): HTMLElement {
  const groups = panel.querySelectorAll<HTMLElement>('[data-system-wallpaper-group]');
  assert.equal(groups.length, 1, '系统壁纸要有独立来源分组');
  const group = groups[0];
  const expectedTitle = locale === 'en' ? 'System wallpapers' : '系统壁纸';
  assert.equal(group.getAttribute('aria-label'), expectedTitle, '分组无障碍名称与获取系统壁纸术语统一');
  const heading = [...group.querySelectorAll<HTMLElement>('h2, h3, h4, [role="heading"]')]
    .find(candidate => candidate.textContent?.trim() === expectedTitle);
  assert.ok(heading, '系统壁纸分组必须使用精确的本地化标题');
  return group;
}

for (const locale of ['zh', 'en']) {
  test(`${locale} 系统缩略图不弹媒体说明，保留精确无障碍名称`, () => {
    const h = fixture({ cached: 4, locale });
    try {
      const buttons = h.panel.querySelectorAll<HTMLButtonElement>('[data-system-wallpaper]');
      assert.equal(buttons.length, 4, '正例必须真实覆盖四个系统缩略图');
      for (const button of buttons) {
        const id = button.dataset.systemWallpaper as typeof SYSTEM_WALLPAPER_IDS[number];
        assert.equal(button.getAttribute('aria-label'), h.copy.systemWallpaperNames[id]);
        assert.equal(button.getAttribute('data-pdsh-tooltip'), null, '用户不需要缩略图的重复长提示');
        assert.equal(button.hasAttribute('title'), false, '不能退回浏览器默认tooltip');
      }
      const h2 = fixture({ cached: 0, locale });
      try {
        assert.ok(h2.panel.querySelector('[data-action="acquire-system-wallpapers"]')?.hasAttribute('data-pdsh-tooltip'),
          '获取操作仍保留下载提示，不把资源选择与网络动作混为一谈');
      } finally { h2.dom.window.close(); }
    } finally { h.dom.window.close(); }
  });
}

for (const locale of ['zh', 'en']) {
  test(`${locale} 部分失败仅显示固定错误码，不显示未知异常正文`, () => {
    for (const code of ['download-failed', 'private-file-path-credentials']) {
      const h = fixture({ cached: 2, locale,
        acquisition: { status: 'error', completed: 2, total: 4, failureCode: code } as never });
      try {
        const alert = h.panel.querySelector('[data-system-wallpapers-status][role="alert"]')!;
        assert.equal(alert.textContent!.includes(code), code === 'download-failed');
        assert.equal(h.panel.querySelectorAll('[data-system-wallpaper]').length, 2);
      } finally { h.dom.window.close(); }
    }
  });
}

for (const locale of ['zh', 'en']) {
  test(`${locale} 未获取不摆四个下载项，只保留一次获取按钮和既有五图/加图`, () => {
    const h = fixture({ locale });
    try {
      const systemGroup = expectSystemWallpaperGroup(h.panel, locale);
      assert.equal(h.panel.querySelectorAll('[data-system-wallpaper]').length, 0);
      const actions = h.panel.querySelectorAll('[data-action="acquire-system-wallpapers"]');
      assert.equal(actions.length, 1);
      assert.ok(systemGroup.contains(actions[0]), '唯一获取按钮归系统壁纸分组');
      assert.equal(actions[0].getAttribute('aria-label'), h.copy.loadWallpapers);
      assert.equal(actions[0].textContent?.trim(), h.copy.loadWallpapers, '入口有可见文字，不是另一个下载素材占位');
      assert.equal(h.panel.querySelectorAll('[data-background]').length, 5);
      assert.equal(h.panel.querySelectorAll('.pdsh-capture-background-grid [data-background]').length, 5,
        '五张随包预设继续留在既有预设网格');
      assert.equal(h.panel.querySelectorAll('[data-background-wallpaper]').length, 1);
      assert.equal(h.panel.querySelector('.pdsh-capture-background-grid [data-background-wallpaper]'), null,
        '上传加号不混在五张随包预设的主网格');
      assert.equal(h.panel.querySelector('[data-action="retry-system-wallpapers"]'), null);
    } finally { h.dom.window.close(); }
  });
}

for (const locale of ['zh', 'en']) {
  test(`${locale} 系统缓存项和批获取入口归独立系统壁纸分组`, () => {
    const h = fixture({ cached: 1, locale });
    try {
      const systemGroup = expectSystemWallpaperGroup(h.panel, locale);
      const myImages = h.panel.querySelector<HTMLElement>(`[aria-label="${h.copy.myImages}"]`);
      assert.ok(myImages, '用户导入素材保留自己的图库分组');
      assert.notEqual(systemGroup, myImages);
      assert.ok(!systemGroup.contains(myImages), '系统源与用户上传源不得嵌套混账');

      const systemAction = h.panel.querySelector<HTMLElement>('[data-action="acquire-system-wallpapers"]');
      const systemTiles = [...h.panel.querySelectorAll<HTMLElement>('[data-system-wallpaper]')];
      assert.ok(systemAction && systemGroup.contains(systemAction));
      assert.equal(systemTiles.length, 1);
      assert.ok(systemTiles.every(tile => systemGroup.contains(tile)), '已缓存系统 tile 也归系统来源组');
      assert.equal(h.panel.querySelectorAll('.pdsh-capture-background-grid [data-system-wallpaper]').length, 0,
        '系统缓存 tile 不混入五张随包预设网格');
      assert.equal(h.panel.querySelectorAll('[data-background]').length, 5,
        '重排来源不能删改五张既有随包预设');
      assert.equal(h.panel.querySelectorAll('.pdsh-capture-background-grid [data-background]').length, 5,
        '五张随包预设继续留在既有预设网格');
    } finally { h.dom.window.close(); }
  });
}

for (const locale of ['zh', 'en']) {
  test(`${locale} 我的图片标题行放加号并保留原 picker 接线`, () => {
    const h = fixture({ locale });
    let picked = 0;
    try {
      const myImages = h.panel.querySelector<HTMLElement>(`[aria-label="${h.copy.myImages}"]`);
      assert.ok(myImages, '用户导入素材保留自己的图库分组');
      const addImage = myImages.querySelector<HTMLButtonElement>('[data-background-wallpaper]');
      assert.ok(addImage, '原上传加号应移入“我的图片”分组，而不是留在主网格');
      const myImagesHeading = [...myImages.querySelectorAll<HTMLElement>('h2, h3, h4, p, [role="heading"]')]
        .find(node => node.textContent?.trim() === h.copy.myImages);
      assert.ok(myImagesHeading, '我的图片分组保留可见标题');
      assert.equal(addImage.parentElement, myImagesHeading.parentElement,
        '加号与“我的图片”标题同处标题行');
      assert.equal(addImage.getAttribute('aria-label'), h.copy.addImage);
      assert.equal(addImage.getAttribute('data-pdsh-tooltip'), h.copy.addImage);
      assert.ok(addImage.querySelector('[data-wallpaper-placeholder]'), '原有加号图标槽保留');

      const input = myImages.querySelector<HTMLInputElement>('[data-input="wallpaper"]');
      assert.ok(input, '原本地图片 file input 随用户图库保留');
      assert.equal(input.type, 'file');
      assert.equal(input.accept, 'image/png,image/jpeg,image/webp');
      wireCaptureBackgroundActions(h.panel as HTMLElement, {
        dispatch: () => {},
        pickWallpaper: () => { picked++; },
        setBackgroundColor: () => {},
      });
      addImage.click();
      assert.equal(picked, 1, '移动 DOM 归属不应断开既有上传 action wiring');
    } finally { h.dom.window.close(); }
  });
}

test('部分缓存仅显示已取得缩略图；补取按钮不冒充四张已完成', () => {
  const h = fixture({ cached: 2, acquisition: { status: 'error', completed: 2, total: 4 } });
  try {
    const systemGroup = expectSystemWallpaperGroup(h.panel, 'zh');
    assert.equal(h.panel.querySelectorAll('[data-system-wallpaper]').length, 2);
    assert.equal(h.panel.querySelectorAll('[data-system-wallpaper] img').length, 2);
    assert.equal(h.panel.querySelectorAll('[data-gallery-wallpaper]').length, 2);
    assert.equal(h.panel.querySelectorAll('[data-action="acquire-system-wallpapers"]').length, 1);
    assert.ok(systemGroup.querySelector('[data-action="acquire-system-wallpapers"]'));
    assert.equal(systemGroup.querySelectorAll('[data-system-wallpaper]').length, 2);
    assert.ok(h.panel.querySelector('[data-system-wallpapers-status][role="alert"]'));
    assert.doesNotMatch(h.panel.querySelector('[data-system-wallpaper]')!.getAttribute('aria-label')!, /下载|获取|未缓存/);
  } finally { h.dom.window.close(); }
});

test('四张已入库时显示四个可选缩略图，不再显示重复获取入口', () => {
  const h = fixture({ cached: 4, acquisition: { status: 'ready', completed: 4, total: 4 } });
  try {
    const systemGroup = expectSystemWallpaperGroup(h.panel, 'zh');
    assert.equal(h.panel.querySelectorAll('[data-system-wallpaper]').length, 4);
    assert.equal(systemGroup.querySelectorAll('[data-system-wallpaper]').length, 4);
    assert.equal(h.panel.querySelectorAll('[data-gallery-wallpaper]').length, 4);
    assert.ok(h.panel.querySelector('[data-action="acquire-system-wallpapers"]'), '完整缓存仍可显式更新系统目录');
    assert.equal(h.panel.querySelectorAll('[data-background]').length, 5);
  } finally { h.dom.window.close(); }
});

test('后台获取不插进度提示行，只保留按钮busy且已缓存素材仍可选择', () => {
  const h = fixture({ cached: 1, acquisition: { status: 'loading', completed: 1, total: 4 } });
  try {
    const systemGroup = expectSystemWallpaperGroup(h.panel, 'zh');
    const button = h.panel.querySelector<HTMLButtonElement>('[data-action="acquire-system-wallpapers"]')!;
    assert.ok(button);
    assert.equal(button.disabled, true);
    assert.equal(button.getAttribute('aria-busy'), 'true');
    assert.ok(systemGroup.contains(button));
    assert.equal(h.panel.querySelector('[data-system-wallpapers-status]'), null);
    assert.equal(h.panel.querySelector<HTMLButtonElement>('[data-system-wallpaper]')!.disabled, false);
  } finally { h.dom.window.close(); }
});

test('未来系统素材以当前目录顺序显示，不依赖旧四ID或媒体tooltip', () => {
  const futureId = 'system-wallpaper-video-11111111-2222-4333-8444-555555555555';
  const copy = captureWindowCopy('en');
  const dom = new JSDOM(captureWindowTemplate(state, copy, { systemWallpapers: {
    status: 'ready', entries: [{ id: futureId, name: 'Future Day', available: true, downloadable: false,
      thumbnail, loadStatus: 'ready' }],
  } }));
  try {
    const tile = dom.window.document.querySelector('[data-system-wallpaper]');
    assert.equal(tile?.getAttribute('data-system-wallpaper'), futureId);
    assert.equal(tile?.getAttribute('aria-label'), 'Future Day');
    assert.equal(tile?.getAttribute('data-pdsh-tooltip'), null);
  } finally { dom.window.close(); }
});

test('无 provider 不伪造批获取，但仍显示本地已缓存素材', () => {
  const h = fixture({ cached: 1, status: 'unavailable' });
  try {
    const systemGroup = expectSystemWallpaperGroup(h.panel, 'zh');
    assert.equal(h.panel.querySelector('[data-action="acquire-system-wallpapers"]'), null);
    assert.equal(h.panel.querySelectorAll('[data-system-wallpaper]').length, 1);
    assert.equal(systemGroup.querySelectorAll('[data-system-wallpaper]').length, 1);
  } finally { h.dom.window.close(); }
});

test('离线动态系统缩略图从持久语义名恢复精确无障碍名称', () => {
  const id = `system-wallpaper-image-${'b'.repeat(64)}`;
  const copy = captureWindowCopy('zh');
  const dom = new JSDOM(captureWindowTemplate(state, copy, {
    galleryAssets: [{ id, systemName: 'Windows · img0', blob: new Blob(['jpeg'], { type: 'image/jpeg' }),
      width: 1, height: 1, sourceType: 'image', thumbnail, createdAt: 1 }],
  }));
  try {
    const button = dom.window.document.querySelector<HTMLButtonElement>('[data-system-wallpaper]');
    assert.equal(button?.getAttribute('aria-label'), 'Windows · img0');
    assert.equal(button?.getAttribute('data-pdsh-tooltip'), null);
  } finally { dom.window.close(); }
});

test('获取按钮只调用一次批获取，不调用选择或旧目录读取动作', async () => {
  const h = fixture();
  let acquisitions = 0;
  try {
    const systemGroup = expectSystemWallpaperGroup(h.panel, 'zh');
    wireCaptureBackgroundActions(h.panel as HTMLElement, {
      dispatch: () => assert.fail('批获取不得改变背景'),
      pickWallpaper: () => assert.fail('批获取不得打开用户图片 picker'),
      setBackgroundColor: () => assert.fail('批获取不得改变颜色'),
      systemWallpapers: {
        acquireAll: async () => { acquisitions++; },
        loadCatalog: async () => assert.fail('按钮不得仅获取目录'),
        loadCurrent: async () => assert.fail('不得伪装当前桌面'),
        restoreCurrent: async () => {},
        select: async () => assert.fail('批获取不得选择背景'),
      },
    });
    systemGroup.querySelector<HTMLButtonElement>('[data-action="acquire-system-wallpapers"]')!.click();
    await Promise.resolve();
    assert.equal(acquisitions, 1);
  } finally { h.dom.window.close(); }
});

test('加图忙态重建焦点暂留个人标题，结算后归还加号且不增加Tab停靠', () => {
  const h = fixture();
  const previousDocument = globalThis.document;
  const previousHTMLElement = globalThis.HTMLElement;
  try {
    Object.assign(globalThis, { document: h.dom.window.document, HTMLElement: h.dom.window.HTMLElement });
    const root = h.dom.window.document.body;
    root.querySelector<HTMLButtonElement>('[data-background-wallpaper]')!.focus();
    const memory = rememberCaptureWindowRender(root);
    root.innerHTML = captureWindowTemplate(state, h.copy, { galleryBusyId: 'importing' });
    restoreCaptureWindowRender(root, memory);
    const heading = root.querySelector<HTMLElement>('[data-gallery-import-focus]');
    assert.ok(heading, '个人标题提供重建期间可见的逻辑焦点目的地');
    assert.equal(heading.tabIndex, -1, '忙态目的地不能增加普通Tab停靠');
    assert.equal(h.dom.window.document.activeElement, heading, '不能把焦点留在被替换的DOM或body');
    const busyMemory = rememberCaptureWindowRender(root);
    root.innerHTML = captureWindowTemplate(state, h.copy);
    restoreCaptureWindowRender(root, busyMemory);
    assert.equal(h.dom.window.document.activeElement, root.querySelector('[data-background-wallpaper]'), '已可用加号重新接回逻辑焦点');
    const settledMemory = rememberCaptureWindowRender(root);
    root.innerHTML = captureWindowTemplate({ ...state, background: { kind: 'transparent' } }, h.copy);
    const hiddenPanel = root.querySelector<HTMLElement>('[data-background-section="wallpapers"]')!;
    assert.ok(hiddenPanel.hidden && hiddenPanel.hasAttribute('inert'));
    restoreCaptureWindowRender(root, settledMemory);
    assert.equal(h.dom.window.document.activeElement, root, '切出图片模式后不得把焦点夺回隐藏/inert加号');
  } finally {
    Object.assign(globalThis, { document: previousDocument, HTMLElement: previousHTMLElement });
    h.dom.window.close();
  }
});
