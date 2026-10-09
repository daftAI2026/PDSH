/**
 * [INPUT]: 依赖工作台的生产 CSS、状态、双语文案与 DOM 模板。
 * [OUTPUT]: 验证语义、布局、图标笔画和双语字形指标、滑轨刻度与无 adapter 退让。
 * [POS]: DSH 工作台模板和样式合同；不证明 Desktop 可见墨迹像素。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCaptureWindowState } from '../src/client/capture/model.ts';
import { captureWindowCopy } from '../src/client/capture/copy.ts';
import { captureWindowTemplate } from '../src/client/capture/view.ts';
import { JSDOM } from 'jsdom';
import { mountCaptureRegionLayer } from '../src/client/capture/regions.ts';
import { applyCaptureCommand } from '../src/client/capture/model.ts';

const state = createCaptureWindowState({ width: 2560, height: 1640, scaleFactor: 2 });
const captureCss = readFileSync(new URL('../src/client/capture/capture-window.css', import.meta.url), 'utf8');
for (const locale of ['zh', 'en']) {
  test(`${locale} 工作台具有编辑、隐私、复制和保存操作，缺少系统 adapter 时不展示其按钮`, () => {
    const copy = captureWindowCopy(locale);
    const markup = captureWindowTemplate(state, copy);
    assert.equal(copy.title, locale === 'zh' ? '编辑截图' : 'Edit screenshot');
    assert.ok(markup.includes(`<h1 class="pdsh-capture-title" id="pdsh-capture-editor-title">${copy.title}</h1>`));
    for (const label of [copy.background, copy.padding, copy.privacy, copy.identityMask, copy.retake, copy.copy, copy.save]) {
      assert.ok(markup.includes(label), label);
    }
    assert.match(markup, /data-action="retake"/);
    assert.match(markup, /data-action="copy"/);
    assert.match(markup, /data-action="save"/);
    assert.match(markup, /data-pdsh-tooltip=/);
    assert.doesNotMatch(markup, /\stitle=/);
    assert.doesNotMatch(markup, /data-system-wallpaper=/);
  });
}

test('私密标题与私密身份使用已确认的短文案，分别说明打码范围', () => {
  assert.equal(captureWindowCopy('zh').privacy, '私密标题');
  assert.equal(captureWindowCopy('zh').privacyDescription, '对侧边栏会话标题打码。');
  assert.equal(captureWindowCopy('en').privacy, 'Private titles');
  assert.equal(captureWindowCopy('en').privacyDescription, 'Redact sidebar session titles.');
  assert.equal(captureWindowCopy('zh').identityMask, '私密身份');
  assert.equal(captureWindowCopy('zh').identityMaskDescription, '对侧边栏头像和昵称打码。');
  assert.equal(captureWindowCopy('en').identityMask, 'Private identity');
  assert.equal(captureWindowCopy('en').identityMaskDescription, 'Redact the sidebar avatar and nickname.');
});

test('身份遮罩是唯一工作台身份开关，标题遮罩保持独立', () => {
  for (const locale of ['zh', 'en']) {
    const markup = captureWindowTemplate(state, captureWindowCopy(locale));
    assert.equal((markup.match(/data-input="privacy"/g) ?? []).length, 1);
    assert.equal((markup.match(/data-input="identity-mask"/g) ?? []).length, 1);
    assert.doesNotMatch(markup, /data-input="avatar-mask"/);
  }
});

test('标题下收紧工作区，并应用图标笔画和双语字形指标校准', () => {
  const header = captureCss.match(/\.pdsh-capture-header\s*\{([^}]*)\}/)?.[1] ?? '';
  const controls = captureCss.match(/\.pdsh-capture-toolbar-controls\s*\{([^}]*)\}/)?.[1] ?? '';
  const icon = captureCss.match(/\.pdsh-capture-icon-button\s*>\s*svg\s*\{([^}]*)\}/)?.[1] ?? '';
  const hitTarget = captureCss.match(/\.pdsh-capture-icon-button\s*\{([^}]*)\}/)?.[1] ?? '';
  const inspector = captureCss.match(/\.pdsh-capture-inspector\s*\{([^}]*)\}/)?.[1] ?? '';
  const inspectorTitle = captureCss.match(/\.pdsh-capture-inspector\s*>\s*\.pdsh-capture-section-title\s*\{([^}]*)\}/)?.[1] ?? '';
  const visibleTop = captureCss.match(/--pdsh-capture-toolbar-icon-ink-top:\s*calc\(([\s\S]*?)\);/)?.[1] ?? '';

  assert.match(header, /padding:\s*var\(--pdsh-capture-shell-inset\) var\(--pdsh-capture-shell-inset\) calc\(var\(--pdsh-capture-space\) \* 1\)/);
  assert.match(controls, /align-self:\s*flex-start/);
  assert.match(controls, /align-items:\s*center/);
  assert.match(captureCss, /--pdsh-capture-space:\s*calc\(var\(--pdsh-field-gap\) \/ 2\)/);
  assert.match(captureCss, /--pdsh-capture-control-height:\s*var\(--pdsh-action-size\)/);
  assert.match(captureCss, /--pdsh-capture-icon-sm:\s*var\(--pdsh-native-icon-size\)/);
  assert.match(visibleTop, /var\(--pdsh-capture-control-height\)\s*-\s*var\(--pdsh-capture-icon-sm\)/);
  assert.match(visibleTop, /3\s*\/\s*24/);
  assert.match(visibleTop, /var\(--pdsh-native-icon-stroke-ratio\)\s*\/\s*2/);
  assert.match(visibleTop, /\*\s*var\(--pdsh-capture-icon-sm\)/);
  assert.match(icon, /display:\s*block/);
  assert.match(icon, /height:\s*var\(--pdsh-capture-icon-sm\)/);
  assert.match(icon, /width:\s*var\(--pdsh-capture-icon-sm\)/);
  assert.match(hitTarget, /height:\s*var\(--pdsh-capture-control-height\)/);
  assert.match(hitTarget, /width:\s*var\(--pdsh-capture-control-height\)/);
  assert.match(inspector, /padding-block:\s*var\(--pdsh-capture-space\)/);
  assert.match(inspector, /padding-block-start:\s*var\(--pdsh-capture-toolbar-icon-ink-top\)/);
  assert.match(inspectorTitle, /text-box-trim:\s*trim-start/);
  assert.match(inspectorTitle, /text-box-edge:\s*cap alphabetic/);
  assert.doesNotMatch(inspectorTitle, /inset-block-start/);
  const chineseTitleAlignment = captureCss.match(/\.pdsh-capture-inspector\s*>\s*\.pdsh-capture-section-title:lang\(zh\)\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(chineseTitleAlignment, /position:\s*relative/);
  assert.match(chineseTitleAlignment, /inset-block-start:\s*calc\(\(1em\s*-\s*1cap\)\s*\/\s*2\)/);
  assert.doesNotMatch(chineseTitleAlignment, /px|translate/);
  assert.match(captureCss, /\.pdsh-capture-section-title\s*\{[^}]*font:\s*var\(--dsw-font-xxs-strong-12\)/);

  const dom = new JSDOM(`<body>${captureWindowTemplate(state, captureWindowCopy('zh'))}</body>`);
  try {
    const doc = dom.window.document;
    const toolbar = doc.querySelector('.pdsh-capture-toolbar');
    const fit = toolbar?.querySelector('[data-action="zoom-fit"] > svg[data-capture-icon="maximize"]');
    const background = doc.querySelector('.pdsh-capture-inspector > .pdsh-capture-section-title');
    assert.ok(fit, '工具栏必须使用四角取景图标');
    assert.equal(fit.getAttribute('viewBox'), '0 0 24 24');
    assert.match(fit.querySelector('path')?.getAttribute('d') ?? '', /M8 3H5/);
    assert.equal(background?.textContent, captureWindowCopy('zh').background);
  } finally { dom.window.close(); }
});

test('边距刻度点覆盖原生滑轨且不占用底部布局空间', () => {
  const field = captureCss.match(/\.pdsh-capture-range-field\s*\{([^}]*)\}/)?.[1] ?? '';
  const range = captureCss.match(/\.pdsh-capture-range\s*\{([^}]*)\}/)?.[1] ?? '';
  const ticks = captureCss.match(/\.pdsh-capture-range-ticks\s*\{([^}]*)\}/)?.[1] ?? '';
  const tick = captureCss.match(/\.pdsh-capture-range-ticks\s*>\s*i\s*\{([^}]*)\}/)?.[1] ?? '';

  assert.match(field, /position:\s*relative/);
  assert.match(range, /display:\s*block/);
  assert.match(range, /cursor:\s*pointer/);
  assert.match(range, /width:\s*100%/);
  assert.doesNotMatch(range, /appearance:\s*none|height:|padding:/);
  assert.match(ticks, /height:\s*var\(--pdsh-capture-space\)/);
  assert.match(ticks, /left:\s*calc\(var\(--pdsh-capture-space\) \* 2\)/);
  assert.match(ticks, /right:\s*calc\(var\(--pdsh-capture-space\) \* 2\)/);
  assert.match(ticks, /margin:\s*0/);
  assert.match(ticks, /pointer-events:\s*none/);
  assert.match(ticks, /position:\s*absolute/);
  assert.match(ticks, /top:\s*50%/);
  assert.match(ticks, /transform:\s*translateY\(-50%\)/);
  assert.match(tick, /left:\s*var\(--capture-tick-position\)/);
  assert.match(tick, /top:\s*50%/);
  assert.match(tick, /transform:\s*translate\(-50%,\s*-50%\)/);

  const dom = new JSDOM(`<body>${captureWindowTemplate(state, captureWindowCopy('zh'))}</body>`);
  try {
    const doc = dom.window.document;
    const rangeInput = doc.querySelector<HTMLInputElement>('[data-input="padding"]');
    const ticksContainer = doc.querySelector('.pdsh-capture-range-ticks');
    assert.equal(rangeInput?.type, 'range');
    assert.equal(rangeInput?.min, '0');
    assert.equal(rangeInput?.max, '45');
    assert.equal(rangeInput?.step, '1');
    assert.equal(ticksContainer?.children.length, 11);
    assert.deepEqual([...ticksContainer?.children ?? []].map(tick => (tick as HTMLElement).style.getPropertyValue('--capture-tick-position')), Array.from({ length: 11 }, (_, index) => `${index * 10}%`));
  } finally { dom.window.close(); }
});

test('编辑器标题关联不借用同页设置卡片的标题', () => {
  const copy = captureWindowCopy('zh');
  const dom = new JSDOM(`<body><h4 id="pdsh-capture-title">截取当前窗口</h4>${captureWindowTemplate(state, copy)}</body>`);
  try {
    const dialog = dom.window.document.querySelector('[role="dialog"]');
    const title = dom.window.document.getElementById(dialog.getAttribute('aria-labelledby'));
    assert.equal(title.textContent, copy.title);
    assert.equal(title.closest('[role="dialog"]'), dialog);
  } finally { dom.window.close(); }
});

test('检测区域不藏在 aria-hidden 下，区域名称及点击沿用共享命令', () => {
  const copy = captureWindowCopy('zh');
  const editing = { ...state, tool: 'redact' as const };
  const dom = new JSDOM(`<body>${captureWindowTemplate(editing, copy)}</body>`);
  const previousDocument = globalThis.document;
  globalThis.document = dom.window.document;
  try {
    const doc = dom.window.document;
    const frame = doc.querySelector<HTMLElement>('.pdsh-capture-canvas-frame');
    const canvas = doc.createElement('canvas');
    canvas.width = state.source.width; canvas.height = state.source.height;
    const candidate = { id: 'detected', x: 50, y: 60, width: 100, height: 30 };
    const commands = [];
    mountCaptureRegionLayer(frame, canvas, editing, [candidate], copy, command => commands.push(command));
    const button = frame.querySelector<HTMLElement>('[role="button"]');
    assert.equal(button.closest('[aria-hidden="true"]'), null);
    assert.equal(button.getAttribute('aria-label'), copy.regionSuggestion);
    button.click();
    assert.deepEqual(commands[0], { id: 'detected', kind: 'select-automatic-region', rect: { x: 50, y: 60, width: 100, height: 30 } });
    const selected = applyCaptureCommand(editing, commands[0]);
    mountCaptureRegionLayer(frame, canvas, selected, [candidate], copy, command => commands.push(command));
    const confirmed = frame.querySelector<HTMLElement>('[role="button"]');
    assert.equal(confirmed.getAttribute('aria-label'), copy.regionRemove);
    confirmed.click();
    assert.deepEqual(commands[1], { id: 'detected', kind: 'remove-region' });
  } finally { globalThis.document = previousDocument; dom.window.close(); }
});
