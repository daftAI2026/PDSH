/**
 * [INPUT]: 依赖shared本地图库身份、记录校验与容量预算，不访问浏览器/网络/用户文件。
 * [OUTPUT]: 验证稳定/RC隔离、封闭ID、媒体预算、缩略图安全与路径/文件名字段拒绝。
 * [POS]: 持久图库的纯合同；真实IDB事务、重开与Desktop验收分别记证。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isWallpaperGalleryAsset, isGalleryWallpaperId, isUserWallpaperId,
  wallpaperGalleryDatabaseName, WALLPAPER_GALLERY_LIMITS,
} from '../src/shared/wallpaper-gallery.ts';

const systemId = 'system-wallpaper-golden-gate';
const userId = 'user-wallpaper-' + 'a'.repeat(64);
const asset = () => ({ id: systemId, blob: new Blob(['jpeg'], { type: 'image/jpeg' }), width: 100, height: 100,
  sourceType: 'video', thumbnail: 'data:image/jpeg;base64,YQ==', createdAt: 1 });

test('本地图库按稳定/RC身份分库，固定系统与SHA256用户ID不允许路径', () => {
  assert.notEqual(wallpaperGalleryDatabaseName('pdsh'), wallpaperGalleryDatabaseName('pdsh-rc'));
  assert.throws(() => wallpaperGalleryDatabaseName('../desktop'), { code: 'invalid-asset' });
  assert.equal(isGalleryWallpaperId(systemId), true);
  assert.equal(isUserWallpaperId(userId), true);
  assert.equal(isGalleryWallpaperId('file:///tmp/a.jpg'), false);
  assert.equal(isGalleryWallpaperId('user-wallpaper-' + 'z'.repeat(64)), false);
});

test('系统只缓存有界JPEG静帧，用户图片可保留PNG/WebP透明但受32MP/32MiB预算', () => {
  assert.equal(isWallpaperGalleryAsset(asset()), true);
  assert.equal(isWallpaperGalleryAsset({ ...asset(), id: userId, sourceType: 'image', blob: new Blob(['png'], { type: 'image/png' }) }), true);
  assert.equal(isWallpaperGalleryAsset({ ...asset(), width: 2601 }), false);
  assert.equal(isWallpaperGalleryAsset({ ...asset(), id: userId, sourceType: 'image', width: 100_000, height: 100_000 }), false);
  assert.equal(isWallpaperGalleryAsset({ ...asset(), id: userId, blob: new Blob(['svg'], { type: 'image/svg+xml' }) }), false);
  assert.equal(WALLPAPER_GALLERY_LIMITS.maxEntries, WALLPAPER_GALLERY_LIMITS.maxUserEntries + 4);
});

test('记录不得混入原路径/文件名/外部缩略URL或截图字段', () => {
  for (const field of ['path', 'fileName', 'account', 'screenshot']) assert.equal(isWallpaperGalleryAsset({ ...asset(), [field]: 'private' }), false);
  assert.equal(isWallpaperGalleryAsset({ ...asset(), thumbnail: 'https://example.invalid/image.jpg' }), false);
  assert.equal(isWallpaperGalleryAsset({ ...asset(), thumbnail: 'data:image/jpeg;base64,' + 'A'.repeat(WALLPAPER_GALLERY_LIMITS.maxThumbnailChars) }), false);
});
