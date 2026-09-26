/**
 * [INPUT]: 依赖 node:test 与真实 Schemastery Config，不模拟校验结果。
 * [OUTPUT]: 验证持久化入口只接收合法本地显示配置和 volatile 字段。
 * [POS]: PDSH Host 合同，防止 Client 验证通过却绕过 Host 的保存边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { Config } from './index.js';
test('Host 默认和 live 配置字段', () => {
  const value = Config({});
  assert.equal(value.frames.get(), true);
  assert.equal(value.maskIdentity.get(), false);
  assert.equal(value.nickname.get(), '临时访客');
  assert.equal(value.avatar.get(), '');
});
test('Host 拒绝控制字符、空白昵称与远端或 SVG 头像', () => {
  for (const nickname of ['', '   ', '\u0000', 'abc\n', 'a'.repeat(65)]) {
    assert.throws(() => Config({ nickname }));
  }
  for (const avatar of ['https://example.com/x.png', 'data:image/svg+xml;base64,PHN2Zz4=', 'x']) {
    assert.throws(() => Config({ avatar }));
  }
  assert.equal(Config({ nickname: '林纳斯', avatar: 'data:image/png;base64,aGVsbG8=' }).nickname.get(), '林纳斯');
});

test('Host 接收账号头像来源开关，不接受隐式类型转换', () => {
  assert.equal(Config({}).useAccountAvatar.get(), false);
  assert.equal(Config({ useAccountAvatar: true }).useAccountAvatar.get(), true);
  assert.throws(() => Config({ useAccountAvatar: 'true' }));
});
