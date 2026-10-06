/**
 * [INPUT]: 读取同 helper 的 capture 入口、Objective-C++ 壁纸实现、构建脚本与 native 模块地图。
 * [OUTPUT]: 锁定缓存来源、动态 ID/静图命令、无授权联网分派和 JPEG 预算；macOS 临时 harness 只开 fixture fd。
 * [POS]: native wallpaper adapter 的源码合同测试；不触碰用户缓存，不解码像素，不替代 SDK/素材/Desktop 验收。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const native = join(root, 'native');
const implementation = readFileSync(join(native, 'system-wallpaper.mm'), 'utf8');
const header = readFileSync(join(native, 'system-wallpaper.h'), 'utf8');
const captureEntry = readFileSync(join(native, 'window-capture.mm'), 'utf8');
const buildScript = readFileSync(join(native, 'build.sh'), 'utf8');
const moduleMap = readFileSync(join(native, 'CLAUDE.md'), 'utf8');
const runtime = readFileSync(join(root, 'src/host/capture-runtime.ts'), 'utf8');

test('壁纸 helper 是同一短命 native executable 的独立命令，不经过录屏授权门', () => {
  assert.match(captureEntry, /RunSystemWallpaperCommand/);
  const commandSources = `${captureEntry}\n${implementation}`;
  for (const option of ['--wallpaper-list', '--wallpaper', '--wallpaper-video']) {
    assert.ok(commandSources.includes(option), `helper must dispatch ${option}`);
  }
  assert.match(header, /RunSystemWallpaperCommand/);
  assert.match(implementation, /RunSystemWallpaperCommand/);
  assert.match(captureEntry, /#import "system-wallpaper\.h"/);
  assert.doesNotMatch(implementation, /ScreenCaptureKit|CGRequestScreenCaptureAccess|SCShareableContent/);
  assert.doesNotMatch(implementation, /https?:\/\/|curl|URLSession|NSURLSession/,
    'native helper must not fetch or resolve remote media');
  assert.match(implementation, /download-required/);
  assert.match(implementation, /sourceType/);
  for (const token of [
    'wallpaper-invalid-request', 'wallpaper-unavailable', 'wallpaper-read-failed',
    'wallpaper-decode-failed', 'wallpaper-jpeg-encode-failed',
    'wallpaper-byte-budget-exceeded', 'wallpaper-output-failed',
  ]) assert.ok(implementation.includes(token), `missing fixed helper diagnostic ${token}`);
});

test('历史目录兼容四个 ID，Golden Gate 仍仅按 manifest UUID 读取 Aerial 视频', () => {
  for (const id of [
    'system-wallpaper-golden-gate',
    'system-wallpaper-golden-gate-sunset',
    'system-wallpaper-tahoe',
    'system-wallpaper-tahoe-day',
  ]) assert.ok(implementation.includes(id), `missing closed catalog ID ${id}`);
  for (const uuid of [
    '4DFE24ED-71CC-42D4-9FE8-3B8959B6CC19',
    '4207734D-74FE-4F92-B5E1-6EC8DEE24A15',
    '4C108785-A7BA-422E-9C79-B0129F1D5550',
  ]) assert.ok(implementation.includes(uuid), `missing fixed Apple asset ID ${uuid}`);
  assert.ok(implementation.includes('com.apple.wallpaper/aerials/videos'));
  assert.ok(implementation.includes('/System/Library/ExtensionKit/Extensions/NeptuneOneWallpaper.appex/Contents/Resources/TahoeLight.heic'));
  assert.doesNotMatch(implementation, /DefaultAerial|Golden Gate\.mov|IsGoldenGateDefaultPairAvailable/,
    'unrelated .default resources are not proof of a manifest Aerial identity');
  assert.doesNotMatch(implementation, /major\s*==\s*27/);
  assert.match(implementation, /OpenCacheVideo\(wallpaper, source\) \? DirectSourceKind::Video/);
  assert.match(implementation, /Golden Gate/);
  assert.match(implementation, /downloadable/);
  assert.match(implementation, /available/);
  assert.match(implementation, /invalid-request/);
});

test('未来 UUID 与系统 HEIC 使用同一 helper，但不允许 Renderer 地址或不受信系统路径', () => {
  assert.match(implementation, /system-wallpaper-video-/);
  assert.match(implementation, /system-wallpaper-image-/);
  assert.match(implementation, /CreateDynamicWallpaper/);
  assert.match(implementation, /--wallpaper-system-image/);
  assert.match(implementation, /IsSafeSystemImagePath/);
  assert.match(implementation, /RunSystemImage/);
  assert.match(implementation, /OpenOwnedSource\(path, 0, kMaxImageBytes/);
  assert.doesNotMatch(implementation, /NSURLSession|curl|https?:\/\//);
});

test('活动目录按 Apple 元数据读取，媒体请求重新核对当前来源后本机优先且缺失才下载', () => {
  assert.match(runtime, /discoverSystemWallpaperSources/);
  assert.doesNotMatch(runtime, /runNativeWallpaperList/);
  assert.match(runtime, /sources\.find\(entry => entry\.id === id\)/);
  assert.match(runtime, /systemImagePath: source\.imagePath/);
  assert.match(runtime, /downloadAppleWallpaperVideo\(id, signal, source\.url\)/);
});

test('源媒体严格限界；AVFoundation 禁止外部引用，ImageIO 输出固定边长/字节 JPEG', () => {
  assert.match(implementation, /64\s*\*\s*1024\s*\*\s*1024/);
  assert.match(implementation, /256\s*\*\s*1024\s*\*\s*1024/);
  assert.match(implementation, /8\s*\*\s*1024\s*\*\s*1024/);
  assert.match(implementation, /2600/);
  assert.match(implementation, /O_NOFOLLOW/);
  assert.match(implementation, /S_ISREG/);
  assert.match(implementation, /st_uid/);
  assert.match(implementation, /AVURLAsset/);
  assert.match(implementation, /ReferenceRestrictions/);
  assert.match(implementation, /copyCGImageAtTime/);
  assert.match(implementation, /kUTTypeJPEG|public\.jpeg/);
  assert.match(implementation, /0\.85/);
  assert.match(implementation, /kCGImageSourceThumbnailMaxPixelSize/);
  assert.match(implementation, /kCGImageSourceCreateThumbnailWithTransform/);
  assert.match(implementation, /kCMTimeZero/);
  assert.match(implementation, /AVAssetReferenceRestrictionForbidAll/);
  assert.match(implementation, /openat/);
  assert.match(implementation, /O_DIRECTORY/);
  assert.match(implementation, /download-required/);
  assert.match(implementation, /jpegBytes/);
  assert.match(implementation, /WriteAll/);
});

test('构建链接独立 Objective-C++ 实现所需的 AVFoundation 且 L2 覆盖新增成员', () => {
  assert.match(buildScript, /system-wallpaper\.mm/);
  assert.match(buildScript, /-framework AVFoundation/);
  assert.match(buildScript, /window-capture\.mm/);
  assert.match(moduleMap, /system-wallpaper\.mm/);
  assert.match(moduleMap, /system-wallpaper\.h/);
  assert.match(moduleMap, /\[PROTOCOL\]: 变更时更新此头部，然后检查 CLAUDE\.md/);
  assert.ok(implementation.split('\n').length < 800);
  assert.ok(header.split('\n').length < 800);
});

test('实际 Objective-C++ helper 拒绝 Aerial 缓存目录链中的符号链接', { skip: process.platform !== 'darwin' }, async t => {
  const compiler = spawnSync('xcrun', ['--sdk', 'macosx', '--find', 'clang++'], { encoding: 'utf8' });
  if (compiler.error || compiler.status !== 0 || !compiler.stdout.trim()) {
    t.skip('macOS SDK command-line tools are unavailable');
    return;
  }

  const fixture = await mkdtemp(join(tmpdir(), 'pdsh-wallpaper-openat-'));
  try {
    const sourcePath = join(native, 'system-wallpaper.mm').replaceAll('\\', '\\\\').replaceAll('"', '\\"');
    const harnessPath = join(fixture, 'cache-open-harness.mm');
    const executable = join(fixture, 'cache-open-harness');
    const harness = `
#import <Foundation/Foundation.h>
static NSString *pdshFixtureHome = nil;
static NSString *PdshFixtureHome(void) { return pdshFixtureHome; }
#define NSHomeDirectory() PdshFixtureHome()
#include "${sourcePath}"
int main(int argc, char **argv) {
  if (argc != 2) return 64;
  pdshFixtureHome = [NSString stringWithUTF8String:argv[1]];
  const Wallpaper *wallpaper = FindWallpaper(kGoldenGateID);
  if (wallpaper == nullptr) return 65;
  OpenSource source;
  bool opened = OpenCacheVideo(*wallpaper, &source);
  CloseSource(&source);
  fputs(opened ? "opened\\n" : "closed\\n", stdout);
  return 0;
}
`;
    await writeFile(harnessPath, harness);
    const compile = spawnSync('xcrun', [
      '--sdk', 'macosx', 'clang++', '-x', 'objective-c++', '-std=c++17', '-fobjc-arc',
      harnessPath,
      '-framework', 'Foundation', '-framework', 'AVFoundation', '-framework', 'CoreGraphics',
      '-framework', 'CoreMedia', '-framework', 'ImageIO', '-o', executable,
    ], { cwd: root, encoding: 'utf8' });
    assert.equal(compile.status, 0, `Objective-C++ harness must compile:\n${compile.stderr}`);

    const videoName = '4DFE24ED-71CC-42D4-9FE8-3B8959B6CC19.mov';
    const makeVideo = async (home: string): Promise<void> => {
      await mkdir(join(home, 'Library/Application Support/com.apple.wallpaper/aerials/videos'), { recursive: true });
      await writeFile(join(home, 'Library/Application Support/com.apple.wallpaper/aerials/videos', videoName), Buffer.from([0x01]));
    };
    const directHome = join(fixture, 'direct-home');
    await makeVideo(directHome);
    const direct = spawnSync(executable, [directHome], { encoding: 'utf8' });
    assert.equal(direct.status, 0, direct.stderr);
    assert.equal(direct.stdout, 'opened\n', 'regular user-owned cache tree remains accepted');

    const components = ['Library', 'Application Support', 'com.apple.wallpaper', 'aerials', 'videos'];
    for (const [index, component] of components.entries()) {
      const linkedHome = join(fixture, `linked-home-${index}`);
      const linkedParent = join(linkedHome, ...components.slice(0, index));
      const externalTree = join(fixture, `external-tree-${index}`);
      const externalVideoDirectory = join(externalTree, ...components.slice(index + 1));
      await mkdir(linkedParent, { recursive: true });
      await mkdir(externalVideoDirectory, { recursive: true });
      await writeFile(join(externalVideoDirectory, videoName), Buffer.from([0x02]));
      await symlink(externalTree, join(linkedParent, component));
      const linked = spawnSync(executable, [linkedHome], { encoding: 'utf8' });
      assert.equal(linked.status, 0, linked.stderr);
      assert.equal(linked.stdout, 'closed\n', `a symlink at ${component} must not redirect the source open`);
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
