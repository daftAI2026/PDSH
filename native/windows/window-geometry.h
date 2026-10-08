/**
 * [INPUT]: 依赖 Win32/DWM 窗口几何与 DPI awareness API。
 * [OUTPUT]: 提供稳定几何快照及 PNG 内客户区物理像素 viewport。
 * [POS]: Windows 截图的可选几何扩展；失败不影响 PNG 采集。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <windows.h>
#include <cstdint>

namespace pdsh::windows_capture {
struct CaptureGeometrySnapshot {
  RECT visibleBounds{};
  RECT clientScreenBounds{};
  UINT dpi = 0;
  DPI_AWARENESS awareness = static_cast<DPI_AWARENESS>(-1);
  DPI_AWARENESS_CONTEXT awarenessContext = nullptr;
};

struct CaptureViewport {
  uint32_t x = 0;
  uint32_t y = 0;
  uint32_t width = 0;
  uint32_t height = 0;
};

bool ReadCaptureGeometry(HWND window, CaptureGeometrySnapshot* output);
bool SameCaptureGeometry(const CaptureGeometrySnapshot& left,
                         const CaptureGeometrySnapshot& right);
bool MakeCaptureViewport(const CaptureGeometrySnapshot& geometry, uint32_t contentWidth,
                         uint32_t contentHeight, CaptureViewport* output);
}  // namespace pdsh::windows_capture
