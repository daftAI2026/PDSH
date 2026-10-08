/**
 * [INPUT]: 依赖 window-geometry.h、DWM 可见 bounds 与 Win32 客户区/DPI API。
 * [OUTPUT]: 只在 PM awareness、有效边界和稳定快照成立时计算相对 viewport。
 * [POS]: Windows WGC 的尽力几何映射；DWM 原点是已验证条件，不是 WGC API 保证。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include "window-geometry.h"

#include <dwmapi.h>
#include <cstdint>

namespace pdsh::windows_capture {
namespace {
class ScopedPerMonitorContext {
 public:
  ScopedPerMonitorContext() : previous_(SetThreadDpiAwarenessContext(
      DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)) {}
  ~ScopedPerMonitorContext() {
    if (previous_ != nullptr) SetThreadDpiAwarenessContext(previous_);
  }
  bool ready() const { return previous_ != nullptr; }

 private:
  DPI_AWARENESS_CONTEXT previous_ = nullptr;
};

bool RectEqual(const RECT& left, const RECT& right) {
  return left.left == right.left && left.top == right.top &&
      left.right == right.right && left.bottom == right.bottom;
}

bool ValidRect(const RECT& rect) {
  return rect.right > rect.left && rect.bottom > rect.top;
}

bool ContextEqual(DPI_AWARENESS_CONTEXT left, DPI_AWARENESS_CONTEXT right) {
  return left != nullptr && right != nullptr &&
      AreDpiAwarenessContextsEqual(left, right) != FALSE;
}
}  // namespace

bool ReadCaptureGeometry(HWND window, CaptureGeometrySnapshot* output) {
  if (window == nullptr || output == nullptr || !IsWindow(window)) return false;
  ScopedPerMonitorContext context;
  if (!context.ready()) return false;

  const DPI_AWARENESS_CONTEXT targetContext = GetWindowDpiAwarenessContext(window);
  if (targetContext == nullptr) return false;
  const DPI_AWARENESS awareness = GetAwarenessFromDpiAwarenessContext(targetContext);
  if (awareness != DPI_AWARENESS_PER_MONITOR_AWARE) return false;

  CaptureGeometrySnapshot current;
  current.awarenessContext = targetContext;
  current.awareness = awareness;
  current.dpi = GetDpiForWindow(window);
  if (current.dpi == 0 ||
      FAILED(DwmGetWindowAttribute(window, DWMWA_EXTENDED_FRAME_BOUNDS,
          &current.visibleBounds, sizeof(current.visibleBounds))) ||
      !ValidRect(current.visibleBounds)) return false;

  RECT client{};
  POINT origin{0, 0};
  POINT end{};
  if (!GetClientRect(window, &client) || !ValidRect(client)) return false;
  end.x = client.right;
  end.y = client.bottom;
  if (!ClientToScreen(window, &origin) || !ClientToScreen(window, &end) ||
      end.x <= origin.x || end.y <= origin.y) return false;

  current.clientScreenBounds = RECT{origin.x, origin.y, end.x, end.y};
  if (current.clientScreenBounds.left < current.visibleBounds.left ||
      current.clientScreenBounds.top < current.visibleBounds.top ||
      current.clientScreenBounds.right > current.visibleBounds.right ||
      current.clientScreenBounds.bottom > current.visibleBounds.bottom) return false;

  *output = current;
  return true;
}

bool SameCaptureGeometry(const CaptureGeometrySnapshot& left,
                         const CaptureGeometrySnapshot& right) {
  return RectEqual(left.visibleBounds, right.visibleBounds) &&
      RectEqual(left.clientScreenBounds, right.clientScreenBounds) &&
      left.dpi == right.dpi && left.awareness == right.awareness &&
      ContextEqual(left.awarenessContext, right.awarenessContext);
}

bool MakeCaptureViewport(const CaptureGeometrySnapshot& geometry, uint32_t contentWidth,
                         uint32_t contentHeight, CaptureViewport* output) {
  if (output == nullptr || contentWidth == 0 || contentHeight == 0 ||
      geometry.awareness != DPI_AWARENESS_PER_MONITOR_AWARE || geometry.dpi == 0 ||
      !ValidRect(geometry.visibleBounds) || !ValidRect(geometry.clientScreenBounds)) return false;

  const int64_t visibleWidth = static_cast<int64_t>(geometry.visibleBounds.right) -
      geometry.visibleBounds.left;
  const int64_t visibleHeight = static_cast<int64_t>(geometry.visibleBounds.bottom) -
      geometry.visibleBounds.top;
  if (visibleWidth != contentWidth || visibleHeight != contentHeight) return false;

  const int64_t x = static_cast<int64_t>(geometry.clientScreenBounds.left) -
      geometry.visibleBounds.left;
  const int64_t y = static_cast<int64_t>(geometry.clientScreenBounds.top) -
      geometry.visibleBounds.top;
  const int64_t width = static_cast<int64_t>(geometry.clientScreenBounds.right) -
      geometry.clientScreenBounds.left;
  const int64_t height = static_cast<int64_t>(geometry.clientScreenBounds.bottom) -
      geometry.clientScreenBounds.top;
  if (x < 0 || y < 0 || width <= 0 || height <= 0 ||
      x + width > visibleWidth || y + height > visibleHeight ||
      x > UINT32_MAX || y > UINT32_MAX || width > UINT32_MAX || height > UINT32_MAX) return false;

  output->x = static_cast<uint32_t>(x);
  output->y = static_cast<uint32_t>(y);
  output->width = static_cast<uint32_t>(width);
  output->height = static_cast<uint32_t>(height);
  return true;
}
}  // namespace pdsh::windows_capture
