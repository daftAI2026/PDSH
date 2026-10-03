/**
 * [INPUT]: 依赖本地截图 SVG 与 style-sources 中锁定版本的 Lucide 内容摘要。
 * [OUTPUT]: 验证工作台全部图标与侧栏相机同源，尺寸与描边仍由 Host 探针控制。
 * [POS]: 图标资源回归边界；测试不联网，不添加运行时图标库。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { captureIcon, type CaptureIconName } from '../src/client/capture/icons.ts';
const sources = JSON.parse(readFileSync(new URL('../style-sources.json', import.meta.url), 'utf8'));
const digest = (body: string) => createHash('sha256').update(body).digest('hex');
test('全部29个工作台图标来自锁定的官方Lucide SVG，宿主保留尺寸和描边控制', () => {
  const manifest = sources.captureIcons;
  assert.ok(manifest, '缺失官方SVG来源账');
  assert.equal(manifest.release, '1.51.0');
  assert.equal(manifest.commit, '45b0e148db4ee4d748340d0f99982aa1c2159d52');
  assert.equal(Object.keys(manifest.icons).length, 29);
  for (const [name, item] of Object.entries(manifest.icons) as [CaptureIconName, { bodySha256: string; source: string }][]) {
    const svg = captureIcon(name);
    assert.equal(digest(svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/)![1]), item.bodySha256, name);
    assert.ok(item.source.startsWith(`https://raw.githubusercontent.com/lucide-icons/lucide/${manifest.commit}/icons/`));
    assert.doesNotMatch(svg.match(/<svg[^>]*>/)![0], /(?:stroke-width|width|height)="/);
    assert.match(svg, /viewBox="0 0 24 24"/);
  }
});
test('侧栏相机与工作台相机使用同一官方图形并保留许可证', () => {
  const camera = readFileSync(new URL('../src/client/camera-icon.svg', import.meta.url), 'utf8');
  const body = camera.match(/<svg[^>]*>([\s\S]*)<\/svg>/)![1];
  assert.equal(body, captureIcon('camera').match(/<svg[^>]*>([\s\S]*)<\/svg>/)![1]);
  const notices = readFileSync(new URL('../THIRD_PARTY_NOTICES.md', import.meta.url), 'utf8');
  assert.match(notices, /Lucide 1\.51\.0/);
  assert.match(notices, /ISC License/);
});
