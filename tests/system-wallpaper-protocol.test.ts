/**
 * [INPUT]: 依赖 Host/Client 共用的壁纸目录、终态白名单与硬预算。
 * [OUTPUT]: 锁定旧缓存 ID 与动态材料 ID 的语法、五项共享活动目录预算；语法通过不代表 Host 已授权该素材，拒绝路径/URL。
 * [POS]: shared 壁纸协议回归；纯合同，不访问系统资源、网络或 DSH。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import * as protocol from '../src/shared/system-wallpaper-protocol.ts';

test('历史四 ID 保留缓存兼容，但不再充当活动目录或系统版本判断', () => {
  assert.deepEqual(protocol.SYSTEM_WALLPAPER_IDS, [
    'system-wallpaper-golden-gate',
    'system-wallpaper-golden-gate-sunset',
    'system-wallpaper-tahoe',
    'system-wallpaper-tahoe-day',
  ]);
  for (const id of protocol.SYSTEM_WALLPAPER_IDS) assert.equal(protocol.isSystemWallpaperId(id), true);
  for (const value of ['', 'file:///tmp/a.mov', 'https://example.com/a.mov', '/tmp/a.mov',
    'system-wallpaper-current', null, undefined, {}, 'system-wallpaper-sequoia']) {
    assert.equal(protocol.isSystemWallpaperId(value), false);
  }
});

test('未来素材使用稳定 UUID/摘要身份，共享目录最多五项且不能接受任意名称/地址', () => {
  for (const id of ['system-wallpaper-video-11111111-2222-4333-8444-555555555555',
    `system-wallpaper-image-${'a'.repeat(64)}`]) assert.equal(protocol.isSystemWallpaperId(id), true);
  for (const id of ['system-wallpaper-video-newest', 'system-wallpaper-video-../x',
    'system-wallpaper-video-11111111-2222-4333-8444-555555555555.mov',
    `system-wallpaper-image-${'a'.repeat(63)}`, `system-wallpaper-image-${'G'.repeat(64)}`]) {
    assert.equal(protocol.isSystemWallpaperId(id), false);
  }
  assert.equal(protocol.WALLPAPER_LIMITS.maxCatalogEntries, 5);
});

test('系统语义名称有界且拒绝所有控制字符，不用名字决定版本', () => {
  assert.equal(protocol.isSystemWallpaperName?.('Future Day'), true);
  for (const value of ['', 'x'.repeat(97), 'a\u0085b', 'a\nb', null]) {
    assert.equal(protocol.isSystemWallpaperName?.(value), false);
  }
});

test('图像、源媒体与启动/下载预算统一且分块不会绕过总量', () => {
  const limits = protocol.WALLPAPER_LIMITS;
  assert.equal(limits.maxBytes, 8 * 1024 * 1024);
  assert.equal(limits.maxDimension, 2600);
  assert.equal(limits.chunkBytes, 32 * 1024);
  assert.equal(limits.maxChunks * limits.chunkBytes, limits.maxBytes);
  assert.equal(limits.maxSourceImageBytes, 64 * 1024 * 1024);
  assert.equal(limits.maxVideoBytes, 256 * 1024 * 1024);
  assert.equal(limits.maxCatalogBytes, 16 * 1024);
  assert.ok(limits.helperStartMs < limits.helperMs);
  assert.ok(limits.helperMs < limits.downloadMs);
});

test('固定终态不外泄原始异常、URL或用户路径', () => {
  for (const status of protocol.WALLPAPER_STATUSES) assert.equal(protocol.isWallpaperStatus(status), true);
  assert.equal(new Set(protocol.WALLPAPER_STATUSES).size, protocol.WALLPAPER_STATUSES.length);
  for (const value of ['download timeout at /Users/name/a.mov', '/tmp/a.jpg', 'unknown', {}, null]) {
    assert.equal(protocol.isWallpaperStatus(value), false);
  }
});
