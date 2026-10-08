/**
 * [INPUT]: 依赖工作台的纯状态、双语文案与 DOM 模板。
 * [OUTPUT]: 验证双语操作面板、独立标题关联与检测区域语义；无 adapter 不伪造系统壁纸。
 * [POS]: DSH 工作台 UI 合同；不以模板测试冒充 Desktop 像素验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCaptureWindowState } from '../src/client/capture/model.ts';
import { captureWindowCopy } from '../src/client/capture/copy.ts';
import { captureWindowTemplate } from '../src/client/capture/view.ts';
import { JSDOM } from 'jsdom';
import { mountCaptureRegionLayer } from '../src/client/capture/regions.ts';
import { applyCaptureCommand } from '../src/client/capture/model.ts';

const state = createCaptureWindowState({ width: 2560, height: 1640, scaleFactor: 2 });
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

test('工作台标题遮罩保持独立，身份遮罩文案只描述实际范围', () => {
  assert.equal(captureWindowCopy('zh').privacy, '标题遮罩');
  assert.equal(captureWindowCopy('zh').privacyDescription, '截取前遮挡可识别的标题。');
  assert.equal(captureWindowCopy('en').privacy, 'Mask titles');
  assert.equal(captureWindowCopy('en').privacyDescription, 'Mask recognized titles before capture.');
  assert.equal(captureWindowCopy('zh').identityMask, '身份遮罩');
  assert.equal(captureWindowCopy('zh').identityMaskDescription, '遮挡侧栏头像和名称。');
  assert.equal(captureWindowCopy('en').identityMask, 'Identity masking');
  assert.equal(captureWindowCopy('en').identityMaskDescription, 'Mask the sidebar avatar and name.');
});

test('身份遮罩是唯一工作台身份开关，标题遮罩保持独立', () => {
  for (const locale of ['zh', 'en']) {
    const markup = captureWindowTemplate(state, captureWindowCopy(locale));
    assert.equal((markup.match(/data-input="privacy"/g) ?? []).length, 1);
    assert.equal((markup.match(/data-input="identity-mask"/g) ?? []).length, 1);
    assert.doesNotMatch(markup, /data-input="avatar-mask"/);
  }
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
