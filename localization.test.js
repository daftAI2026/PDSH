/**
 * [INPUT]: 依赖发布清单、官方 locale 资源入口与 Client 的语言字典。
 * [OUTPUT]: 验证包文本可离线发现、zh/en 键齐全，语言跟随宿主且不重复渲染使用说明。
 * [POS]: PDSH 本地化合同；实际宿主热切换/草稿保留由独立 runtime 另验。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

test('官方资源入口公开两种包文本，且发行包包含发现入口', () => {
  assert.ok(manifest.exports['./locale/*.json'], '插件标题和简介不能只剩英文 package.description');
  assert.ok(manifest.files.includes('locale/*.json'));
  for (const language of ['zh', 'en']) {
    const resource = manifest.exports['./locale/*.json'].replace('*', language);
    const value = JSON.parse(readFileSync(new URL(resource, import.meta.url), 'utf8'));
    assert.equal(value.meta.title, language === 'zh' ? 'DSH 私密模式' : 'DSH Private Mode');
    assert.ok(value.meta.description.trim());
  }
});

test('运行文案两种语言键一致，语言提示使用宿主设置而非自建状态', async () => {
  const { NS, dictionaries } = await import('./locales.js');
  assert.equal(NS, 'pdsh');
  assert.deepEqual(Object.keys(dictionaries.zh).sort(), Object.keys(dictionaries.en).sort());
  for (const language of ['zh', 'en']) {
    for (const [key, value] of Object.entries(dictionaries[language])) assert.ok(typeof value === 'string' && value.trim(), `${language}.${key}`);
  }
  assert.match(dictionaries.zh.languageHint, /Harness.*设置.*语言/);
  assert.match(dictionaries.en.languageHint, /Harness.*Settings.*Language/);
  const card = readFileSync(new URL('./settings-card.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(card, /t\('languageHint'\)/, '语言跟随宿主，不重复展示使用说明');
  assert.doesNotMatch(card, /localStorage|setLocale|localePreference/);
});
