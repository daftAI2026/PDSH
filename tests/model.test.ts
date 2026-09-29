/**
 * [INPUT]: 依赖 node:test、shared/model.ts 的配置与本地头像解析合同。
 * [OUTPUT]: 验证显示偏好不接收远端图片、非法昵称或隐式类型转换。
 * [POS]: PDSH 共享输入边界回归测试，与 DOM 生命周期测试分离。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, resolvePreferences, MAX_NAME_CHARS, MAX_AVATAR_CHARS } from '../src/shared/model.ts';

test('标题遮挡默认关闭，不把旧消息框配置解释为新隐私模式', () => {
  assert.equal(DEFAULTS.maskTitles, false);
  assert.equal(Object.hasOwn(DEFAULTS, 'frames'), false);
  assert.equal(DEFAULTS.maskIdentity, false);
  const { avatar, ...display } = resolvePreferences({});
  const { avatar: storedAvatar, ...defaults } = DEFAULTS;
  assert.deepEqual(display, defaults);
  assert.equal(storedAvatar, '');
  assert.match(avatar, /^data:image\/svg\+xml/);
});
test('昵称安全且头像离线确定生成，中文可用', () => {
  const a = resolvePreferences({ nickname: '  临时访客  ', maskIdentity: true });
  assert.equal(a.nickname, '临时访客');
  assert.match(a.avatar, /^data:image\/svg\+xml/);
  assert.equal(a.avatar, resolvePreferences({ nickname: '临时访客' }).avatar);
});
test('不允许远端头像、用户 SVG、控制字符和超长载荷', () => {
  for (const avatar of ['https://example.com/a.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'file:///a.png', 'data:image/png;base64,@@@']) {
    assert.throws(() => resolvePreferences({ avatar }), /avatar/);
  }
  for (const nickname of ['', '\u0000x', 'a'.repeat(MAX_NAME_CHARS + 1)]) {
    assert.throws(() => resolvePreferences({ nickname }), /nickname/);
  }
  assert.throws(() => resolvePreferences({ avatar: 'a'.repeat(MAX_AVATAR_CHARS + 1) }), /avatar/);
  assert.throws(() => resolvePreferences({ maskTitles: 'false' }), /maskTitles/);
  assert.equal(resolvePreferences({ frames: true }).maskTitles, false);
  assert.equal(Object.hasOwn(resolvePreferences({ frames: true }), 'frames'), false);
});
test('可接收本地光栅头像，空头像恢复生成模式', () => {
  const avatar = 'data:image/png;base64,aGVsbG8=';
  assert.equal(resolvePreferences({ avatar }).avatar, avatar);
  assert.match(resolvePreferences({ avatar: '' }).avatar, /^data:image\/svg\+xml/);
});

test('账号头像选择为独立布尔偏好，不存账户 URL，旧配置默认仍生成或使用本地图片', () => {
  assert.equal(resolvePreferences({}).useAccountAvatar, false);
  assert.equal(resolvePreferences({ useAccountAvatar: true }).useAccountAvatar, true);
  assert.throws(() => resolvePreferences({ useAccountAvatar: 'true' }), /useAccountAvatar/);
});
