/**
 * [INPUT]: 依赖共享头像 MRU 纯函数与 node:test。
 * [OUTPUT]: 验证两个旧头像的去重、顺序、容量及输入预算。
 * [POS]: 身份历史的数据合同；不模拟 Host 持久化或 Desktop 加载。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarConfigurationMode, isAvatarHistory, MAX_PREVIOUS_AVATARS, rotateAvatarHistory, sameAvatarHistory } from '../src/shared/avatar-history.ts';
import { MAX_AVATAR_CHARS } from '../src/shared/model.ts';
const [A, B, C, D] = ['YQ==', 'Yg==', 'Yw==', 'ZA=='].map(value => `data:image/png;base64,${value}`);

test('最近使用顺序：旧当前置首，移除新当前，截断最旧', () => {
  assert.equal(MAX_PREVIOUS_AVATARS, 2);
  assert.deepEqual(rotateAvatarHistory([B, A], C, D), [C, B]);
  assert.deepEqual(rotateAvatarHistory([B, A], C, A), [C, B]);
  assert.deepEqual(rotateAvatarHistory([B, A], C, B), [C, A]);
  assert.deepEqual(rotateAvatarHistory([B, A], C, C), [B, A]);
  assert.deepEqual(rotateAvatarHistory([B, A], C, ''), [C, B]);
  assert.deepEqual(rotateAvatarHistory([B, A], '', A), [B]);
  assert.deepEqual(rotateAvatarHistory([], '', A), []);
});

test('穷举短数组：不修改输入、无重复、排除当前、始终有界', () => {
  const values = ['', A, B, C];
  for (const first of values) for (const second of values) for (const previous of values) for (const next of values) {
    const history = Object.freeze([first, second]);
    const result = rotateAvatarHistory(history, previous, next);
    assert.ok(result.length <= 2);
    assert.equal(new Set(result).size, result.length);
    assert.ok(result.every(value => value !== '' && value !== next));
    const expected = [previous, ...history].filter((value, index, all) => value && value !== next && all.indexOf(value) === index).slice(0, 2);
    assert.deepEqual(result, expected);
  }
});

test('同一来源字节去重，不把不同编码的视觉内容当成相同图片', () => {
  assert.deepEqual(rotateAvatarHistory([A, B], A, C), [A, B]);
  assert.ok(sameAvatarHistory([A, B], [A, B]));
  assert.equal(sameAvatarHistory([A, B], [B, A]), false);
});

test('历史只接收至多两个不同的有界本地栅格数据 URL', () => {
  for (const valid of [[], [A], [A, B]]) assert.ok(isAvatarHistory(valid));
  for (const invalid of [undefined, null, {}, A, [A, B, C], [A, A], [''], [12],
    ['https://example.com/avatar.png'], ['data:image/svg+xml;base64,YQ=='],
    [`data:image/png;base64,${'A'.repeat(MAX_AVATAR_CHARS)}`]]) assert.equal(isAvatarHistory(invalid), false);
});


test('基础头像与历史能力独立判别，不把损坏新字段冒充旧合同', () => {
  const legacy = { avatar: A, useAccountAvatar: false };
  assert.equal(avatarConfigurationMode(legacy), 'legacy');
  assert.equal(avatarConfigurationMode({ ...legacy, avatarHistory: [] }), 'history');
  for (const value of [null, {}, Object.create(legacy), { avatar: A }, { useAccountAvatar: false },
    { avatar: 'https://example.com/a.png', useAccountAvatar: false },
    { ...legacy, avatarHistory: undefined }, { ...legacy, avatarHistory: null },
    { ...legacy, avatarHistory: [A, A] }]) assert.equal(avatarConfigurationMode(value), 'invalid');
});
