/**
 * [INPUT]: 依赖 capture/viewport-fonts.ts 的 CSSOM 字体规则采集与注入式资产加载边界。
 * [OUTPUT]: 验证 stylesheet 相对 URL、嵌套/import 遍历、取消、不可读样式表拒绝和空字体安全输出。
 * [POS]: 视口截图字体内嵌合同；只验证源 CSSOM 编排，不触发外网或证明 Desktop 字体渲染。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { collectViewportFontCSS, ViewportFontCollectionError } from '../src/client/capture/viewport-fonts.ts';

const FONT_FACE_RULE = 5;
const IMPORT_RULE = 3;
const GROUP_RULE = 4;

function fakeDocument(styleSheets, baseURI = 'https://dsh.test/app/index.html') {
  return { baseURI, styleSheets };
}

function fontFace(cssText) {
  return { type: FONT_FACE_RULE, cssText };
}

test('相对字体 URL 以 stylesheet.href 为基准并内嵌为 data URL', async () => {
  const dom = new JSDOM('<!doctype html><html><head><style>@font-face { font-family: Inter; src: url("../fonts/inter.woff2") format("woff2"); }</style></head></html>', {
    url: 'https://dsh.test/app/index.html',
  });
  const sheet = dom.window.document.styleSheets[0];
  Object.defineProperty(sheet, 'href', { configurable: true, value: 'https://dsh.test/assets/css/theme.css' });
  const loaded = [];

  try {
    const css = await collectViewportFontCSS(dom.window.document, {
      loadAsset: async (url) => { loaded.push(url); return 'data:font/woff2;base64,AA=='; },
    });
    assert.deepEqual(loaded, ['https://dsh.test/assets/fonts/inter.woff2']);
    assert.match(css, /@font-face/);
    assert.match(css, /url\("data:font\/woff2;base64,AA=="\)/);
    assert.doesNotMatch(css, /\.\.\/fonts\/inter\.woff2/);
  } finally {
    dom.window.close();
  }
});

test('递归读取 grouping rule 与已加载的 @import 子样式表，但不刷新未加载 import', async () => {
  const importedSheet = {
    href: 'https://dsh.test/theme/fonts.css',
    cssRules: [fontFace('@font-face { font-family: Imported; src: url("./imported.woff2"); }')],
  };
  const topSheet = {
    href: 'https://dsh.test/entry.css',
    cssRules: [
      { type: GROUP_RULE, cssRules: [fontFace('@font-face { font-family: Nested; src: url("./nested.woff2"); }')] },
      { type: IMPORT_RULE, styleSheet: importedSheet },
      { type: IMPORT_RULE, styleSheet: null },
    ],
  };
  const loaded = [];

  const css = await collectViewportFontCSS(fakeDocument([topSheet]), {
    loadAsset: async (url) => { loaded.push(url); return 'data:font/woff2;base64,AA=='; },
  });

  assert.deepEqual(loaded, [
    'https://dsh.test/nested.woff2',
    'https://dsh.test/theme/imported.woff2',
  ]);
  assert.match(css, /font-family: Nested/);
  assert.match(css, /font-family: Imported/);
  assert.equal((css.match(/data:font\/woff2/g) ?? []).length, 2);
});

test('取消信号在资产加载期间中断字体收集', async () => {
  const controller = new AbortController();
  let started = false;
  const sheet = {
    href: 'https://dsh.test/fonts.css',
    cssRules: [fontFace('@font-face { font-family: Slow; src: url("slow.woff2"); }')],
  };
  const pending = collectViewportFontCSS(fakeDocument([sheet]), {
    signal: controller.signal,
    loadAsset: async () => {
      started = true;
      return new Promise(() => {});
    },
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(started, true);
  controller.abort();
  await assert.rejects(pending, (error) => error?.name === 'AbortError');
});

test('不可读 stylesheet 明确拒绝，不把字体失败降级为缺字体成功', async () => {
  const unreadableSheet = {
    href: 'https://remote.test/private.css',
    get cssRules() { throw new Error('SecurityError: cross-origin stylesheet'); },
  };

  await assert.rejects(
    collectViewportFontCSS(fakeDocument([unreadableSheet]), { loadAsset: async () => 'data:font/woff2;base64,AA==' }),
    (error) => error instanceof ViewportFontCollectionError && error.code === 'stylesheet-unreadable',
  );
});

test('无可读字体时返回非空惰性 CSS，未加载 @import 不触发资产请求', async () => {
  let calls = 0;
  const css = await collectViewportFontCSS(fakeDocument([{
    href: 'https://dsh.test/main.css',
    cssRules: [{ type: IMPORT_RULE, styleSheet: null }],
  }]), { loadAsset: async () => { calls++; return 'data:font/woff2;base64,AA=='; } });

  assert.match(css, /^\/\*/);
  assert.ok(css.length > 0);
  assert.equal(calls, 0);
});
