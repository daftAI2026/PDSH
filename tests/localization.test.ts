/**
 * [INPUT]: 依赖发布清单、官方 locale 资源入口与 Client 的语言字典。
 * [OUTPUT]: 验证包文本可离线发现、zh/en 键齐全，并约束插件图标为单 path 可调前景线稿且透明背景。
 * [POS]: PDSH 本地化与清单图标合同；实际宿主热切换/草稿保留由独立 runtime 另验。
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

test('插件清单图标复用单 path 帽子图形；包图固化前景色但保持透明背景', () => {
  assert.equal(manifest.icon, './plugin-icon.svg');
  assert.ok(manifest.files.includes('plugin-icon.svg'));
  const glyph = readFileSync(new URL('../src/client/entry-icon.svg', import.meta.url), 'utf8');
  const icon = readFileSync(new URL(`../${manifest.icon}`, import.meta.url), 'utf8');
  const canvas = glyph.match(/viewBox="([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)"/);
  assert.ok(canvas && Number(canvas[3]) === 24 && Number(canvas[4]) === 24, '线条图标应使用自身的24×24坐标，而非外部画板');
  assert.match(glyph, /fill="none"[^>]*stroke="currentColor"[^>]*stroke-width="1\.5"/, '沿用可调线宽的 Lucide 图形');
  assert.equal([...glyph.matchAll(/<path\b/g)].length, 1, '五个几何必须合并为唯一的复合 path');
  assert.doesNotMatch(glyph, /<(?:circle|rect)\b|stroke-opacity=|fill-opacity=|<path[^>]*opacity=/, '线稿不拆圆、不加底形或逐笔降低透明度');
  const sourcePath = glyph.match(/<path\b[^>]*>/)?.[0];
  const packagedPath = icon.match(/<path\b[^>]*>/)?.[0];
  assert.ok(sourcePath && packagedPath);
  assert.equal(packagedPath.match(/\bd="([^"]+)"/)?.[1], sourcePath.match(/\bd="([^"]+)"/)?.[1], '包图沿用同一帽子复合几何');
  assert.equal([...icon.matchAll(/<path\b/g)].length, 1);
  assert.doesNotMatch(icon, /<(?:circle|rect)\b/, '清单图标无 circle 与背景 rect');
  assert.doesNotMatch(icon, /<script|<foreignObject|href=|currentColor|var\(/i, '官方img不继承宿主变量，不请求外部资源');
  const palette = JSON.parse(readFileSync(new URL('../style-sources.json', import.meta.url), 'utf8')).artwork;
  assert.ok(palette.file && palette.foreground.variable);
  const root = icon.match(/<svg\b[^>]*>/)?.[0] ?? '';
  assert.match(root, /fill="none"[^>]*stroke-width="1\.5"/, '包图保留透明填充和统一线宽');
  assert.ok(root.includes(`stroke="${palette.foreground.value}"`), '元信息图标将 currentColor 固化为来源账中的原前景色');
  assert.ok(Buffer.byteLength(icon) < 256 * 1024);
});


test('三个功能区有离线 zh/en 文案，不用包路径作为名称', async () => {
  const { dictionaries } = await import('../src/shared/locales.ts');
  for (const lang of ['zh', 'en']) for (const key of ['maskIdentity', 'maskTitles', 'capture']) {
    assert.ok(dictionaries[lang][key]?.trim());
    assert.doesNotMatch(dictionaries[lang][key], /@daftai|file:/);
  }
});
