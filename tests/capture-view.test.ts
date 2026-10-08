/**
 * [INPUT]: 依赖工作台的纯状态、双语文案与 DOM 模板。
 * [OUTPUT]: 验证完整操作面板存在、无 adapter 不伪造系统壁纸，以及中英文标题/身份遮罩语义独立。
 * [POS]: DSH 工作台 UI 合同；不以模板测试冒充 Desktop 像素验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCaptureWindowState } from '../src/client/capture/model.ts';
import { captureWindowCopy } from '../src/client/capture/copy.ts';
import { captureWindowTemplate } from '../src/client/capture/view.ts';

const state = createCaptureWindowState({ width: 2560, height: 1640, scaleFactor: 2 });
for (const locale of ['zh', 'en']) {
  test(`${locale} 工作台具有编辑、隐私、复制和保存操作，缺少系统 adapter 时不展示其按钮`, () => {
    const copy = captureWindowCopy(locale);
    const markup = captureWindowTemplate(state, copy);
    assert.equal(copy.title, locale === 'zh' ? '编辑截图' : 'Edit screenshot');
    assert.ok(markup.includes(`<h1 class="pdsh-capture-title" id="pdsh-capture-title">${copy.title}</h1>`));
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
