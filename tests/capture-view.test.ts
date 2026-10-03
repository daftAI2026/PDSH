/**
 * [INPUT]: 依赖工作台的纯状态、双语文案与 DOM 模板。
 * [OUTPUT]: 验证完整操作面板存在、无 adapter 不伪造系统壁纸，以及中英文语义一致，以及标题遮罩不冒充身份设置。
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
    for (const label of [copy.background, copy.padding, copy.privacy, copy.retake, copy.copy, copy.save]) {
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

test('工作台标题遮罩文案不冒充身份开关，明确引导到插件设置', () => {
  assert.equal(captureWindowCopy('zh').privacy, '标题遮罩');
  assert.match(captureWindowCopy('zh').privacyDescription, /头像和名称.*插件设置/);
  assert.equal(captureWindowCopy('en').privacy, 'Mask titles');
  assert.match(captureWindowCopy('en').privacyDescription, /Avatar and name.*plugin settings/);
});
