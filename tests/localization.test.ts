/**
 * [INPUT]: 依赖发布清单、官方 locale 资源入口与 Client 的语言字典。
 * [OUTPUT]: 验证包文本可离线发现、zh/en 键齐全，语言跟随宿主且不重复渲染使用说明。
 * [POS]: PDSH 本地化合同；实际宿主热切换/草稿保留由独立 runtime 另验。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('官方资源入口公开两种包文本，且发行包包含发现入口', () => {
  assert.ok(manifest.exports['./locale/*.json'], '插件标题和简介不能只剩英文 package.description');
  assert.ok(manifest.files.includes('locale/*.json'));
  for (const language of ['zh', 'en']) {
    const resource = manifest.exports['./locale/*.json'].replace('*', language);
    const value = JSON.parse(readFileSync(new URL(`../${resource}`, import.meta.url), 'utf8'));
    assert.equal(value.meta.title, language === 'zh' ? 'DSH 私密模式' : 'DSH Private Mode');
    assert.ok(value.meta.description.trim());
  }
});

test('运行文案两种语言键一致，语言提示使用宿主设置而非自建状态', async () => {
  const { NS, dictionaries } = await import('../src/shared/locales.ts');
  assert.equal(NS, 'pdsh');
  assert.deepEqual(Object.keys(dictionaries.zh).sort(), Object.keys(dictionaries.en).sort());
  for (const language of ['zh', 'en']) {
    for (const [key, value] of Object.entries(dictionaries[language])) assert.ok(typeof value === 'string' && value.trim(), `${language}.${key}`);
  }
  assert.match(dictionaries.zh.languageHint, /Harness.*设置.*语言/);
  assert.match(dictionaries.en.languageHint, /Harness.*Settings.*Language/);
  const card = readFileSync(new URL('../src/client/settings-card.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(card, /t\('languageHint'\)/, '语言跟随宿主，不重复展示使用说明');
  assert.doesNotMatch(card, /localStorage|setLocale|localePreference/);
});

test('插件列表图标走官方manifest离线图片入口，复用帽子图形且包含于包', () => {
  assert.equal(manifest.icon, './plugin-icon.svg');
  assert.ok(manifest.files.includes('plugin-icon.svg'));
  const glyph = readFileSync(new URL('../src/client/entry-icon.svg', import.meta.url), 'utf8');
  const icon = readFileSync(new URL(`../${manifest.icon}`, import.meta.url), 'utf8');
  const shapes = text => [...text.matchAll(/<(?:path|circle)\b[^>]*>/g)].map(match => match[0]);
  assert.deepEqual(shapes(icon), shapes(glyph));
  const canvas = glyph.match(/viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/);
  assert.ok(canvas && Number(canvas[3]) === 24 && Number(canvas[4]) === 24, '线条图标应使用自身的24×24坐标，而非外部画板');
  assert.match(glyph, /fill="none"[^>]*stroke="currentColor"[^>]*stroke-width="1\.5"/, '沿用可调线宽的 Lucide 图形');
  assert.equal(shapes(glyph).length, 5, '保留原始线条与圆形结构');
  assert.doesNotMatch(glyph, /stroke-opacity=|fill-opacity=|<path[^>]*opacity=|<circle[^>]*opacity=/, '不逐笔降低透明度');
  assert.doesNotMatch(icon, /<script|<foreignObject|href=|currentColor|var\(/i, '官方img不继承宿主变量，不请求外部资源');
  const palette = JSON.parse(readFileSync(new URL('../style-sources.json', import.meta.url), 'utf8')).artwork;
  assert.ok(palette.file && palette.foreground.variable && palette.background.variable);
  assert.ok(icon.includes(palette.foreground.value)); assert.ok(icon.includes(palette.background.value));
  assert.match(icon, /stroke="rgb\(/, '元信息图标将 currentColor 固化到 stroke 而非填充');
  assert.ok(Buffer.byteLength(icon) < 256 * 1024);
});
