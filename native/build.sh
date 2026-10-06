#!/bin/sh
#
# [INPUT]: 依赖本目录单 helper capture 与系统壁纸 Objective-C++ 源、macOS SDK 与 AppKit/CoreGraphics/ScreenCaptureKit/AVFoundation/ImageIO。
# [OUTPUT]: 编译随包分发的 window-capture helper。不运行、不请求权限、不联网或显示 UI。
# [POS]: native/ 的可复现双架构构建入口，最低macOS14，只生成本目录捆包产物；执行权限由归档及安装门复核。
# [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
#
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SDK=$(xcrun --sdk macosx --show-sdk-path)
xcrun --sdk macosx clang++ \
  -arch arm64 \
  -arch x86_64 \
  -std=c++17 \
  -fobjc-arc \
  -fblocks \
  -mmacosx-version-min=14.0 \
  -Wall -Wextra \
  -isysroot "$SDK" \
  "$ROOT/window-capture.mm" \
  "$ROOT/system-wallpaper.mm" \
  -framework AppKit \
  -framework CoreGraphics \
  -framework CoreMedia \
  -framework Foundation \
  -framework AVFoundation \
  -framework ImageIO \
  -framework ScreenCaptureKit \
  -o "$ROOT/window-capture"
xcrun lipo -verify_arch arm64 "$ROOT/window-capture"
xcrun lipo -verify_arch x86_64 "$ROOT/window-capture"
chmod 0755 "$ROOT/window-capture"
