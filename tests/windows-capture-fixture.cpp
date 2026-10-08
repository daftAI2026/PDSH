/**
 * [INPUT]: 依赖 Win32 PMv2 合成窗口、真实 WGC helper 与 WIC PNG 解码。
 * [OUTPUT]: 验证 DWM 相对 viewport、四角标记、客户区边线及真实 PNG 像素对位。
 * [POS]: Windows 原生几何合同夹具；只捕获自身窗口并结算自有进程树。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#include <dwmapi.h>
#include <wincodec.h>
#include <wrl/client.h>
#include "../native/windows/window-owner.h"
#include <d3d11.h>
#include <windows.graphics.capture.interop.h>
#include <windows.graphics.directx.direct3d11.interop.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Graphics.Capture.h>
#include <winrt/Windows.Graphics.DirectX.h>
#include <winrt/Windows.Graphics.DirectX.Direct3D11.h>
#include <cstdio>
#include <climits>
#include <cwchar>
#include <initializer_list>
#include <string>
#include <vector>

using Microsoft::WRL::ComPtr;
using pdsh::windows_capture::UniqueHandle;
using namespace winrt::Windows::Graphics::Capture;
constexpr COLORREF kBackgroundColor = RGB(25, 37, 49);
constexpr COLORREF kTopLeftColor = RGB(241, 49, 74);
constexpr COLORREF kTopRightColor = RGB(38, 211, 106);
constexpr COLORREF kBottomLeftColor = RGB(54, 121, 244);
constexpr COLORREF kBottomRightColor = RGB(244, 196, 42);
constexpr COLORREF kEdgeColor = RGB(250, 250, 250);
constexpr LONG kMarkerInset = 12;
constexpr LONG kMarkerSize = 8;
constexpr DWORD kFixtureDeadline = 30000;
constexpr DWORD kAbortExitCode = 0xE00000A5;

enum class FixtureMode { Capture, ClosedTarget, AbortHelper };

const wchar_t* ModeName(FixtureMode mode) {
  switch (mode) {
    case FixtureMode::Capture: return L"capture";
    case FixtureMode::ClosedTarget: return L"closed-target";
    case FixtureMode::AbortHelper: return L"abort-helper";
  }
  return L"invalid";
}

bool ParseMode(const wchar_t* value, FixtureMode* mode) {
  if (value == nullptr || mode == nullptr) return false;
  if (std::wcscmp(value, L"capture") == 0) { *mode = FixtureMode::Capture; return true; }
  if (std::wcscmp(value, L"closed-target") == 0) { *mode = FixtureMode::ClosedTarget; return true; }
  if (std::wcscmp(value, L"abort-helper") == 0) { *mode = FixtureMode::AbortHelper; return true; }
  return false;
}

void PumpMessages() {
  MSG message{};
  while (PeekMessageW(&message, nullptr, 0, 0, PM_REMOVE)) {
    TranslateMessage(&message); DispatchMessageW(&message);
  }
}

struct FixtureWindow {
  HBRUSH background = CreateSolidBrush(kBackgroundColor);
  HBRUSH topLeft = CreateSolidBrush(kTopLeftColor);
  HBRUSH topRight = CreateSolidBrush(kTopRightColor);
  HBRUSH bottomLeft = CreateSolidBrush(kBottomLeftColor);
  HBRUSH bottomRight = CreateSolidBrush(kBottomRightColor);
  HBRUSH edge = CreateSolidBrush(kEdgeColor);
  HWND window = nullptr;
  bool ready() const {
    return background && topLeft && topRight && bottomLeft && bottomRight && edge;
  }
  ~FixtureWindow() {
    if (window) DestroyWindow(window);
    for (HBRUSH brush : {background, topLeft, topRight, bottomLeft, bottomRight, edge}) {
      if (brush) DeleteObject(brush);
    }
  }
};

struct FixtureGeometry {
  UINT pngWidth = 0;
  UINT pngHeight = 0;
  UINT dpi = 0;
  UINT x = 0;
  UINT y = 0;
  UINT width = 0;
  UINT height = 0;
};

LRESULT CALLBACK FixtureWindowProc(HWND window, UINT message, WPARAM wParam, LPARAM lParam) {
  auto* fixture = reinterpret_cast<FixtureWindow*>(GetWindowLongPtrW(window, GWLP_USERDATA));
  if (message == WM_NCCREATE) {
    const auto* create = reinterpret_cast<const CREATESTRUCTW*>(lParam);
    fixture = static_cast<FixtureWindow*>(create->lpCreateParams);
    SetWindowLongPtrW(window, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(fixture));
  }
  if (message == WM_ERASEBKGND) return 1;
  if (message == WM_PAINT) {
    PAINTSTRUCT paint{};
    HDC dc = BeginPaint(window, &paint);
    RECT client{};
    GetClientRect(window, &client);
    if (fixture && fixture->ready() && client.right > 2 * kMarkerInset + kMarkerSize &&
        client.bottom > 2 * kMarkerInset + kMarkerSize) {
      FillRect(dc, &client, fixture->background);
      RECT topEdge{0, 0, client.right, 1};
      RECT rightEdge{client.right - 1, 0, client.right, client.bottom};
      RECT bottomEdge{0, client.bottom - 1, client.right, client.bottom};
      RECT leftEdge{0, 0, 1, client.bottom};
      FillRect(dc, &topEdge, fixture->edge);
      FillRect(dc, &rightEdge, fixture->edge);
      FillRect(dc, &bottomEdge, fixture->edge);
      FillRect(dc, &leftEdge, fixture->edge);
      RECT tl{kMarkerInset, kMarkerInset, kMarkerInset + kMarkerSize, kMarkerInset + kMarkerSize};
      RECT tr{client.right - kMarkerInset - kMarkerSize, kMarkerInset,
          client.right - kMarkerInset, kMarkerInset + kMarkerSize};
      RECT bl{kMarkerInset, client.bottom - kMarkerInset - kMarkerSize,
          kMarkerInset + kMarkerSize, client.bottom - kMarkerInset};
      RECT br{client.right - kMarkerInset - kMarkerSize,
          client.bottom - kMarkerInset - kMarkerSize,
          client.right - kMarkerInset, client.bottom - kMarkerInset};
      FillRect(dc, &tl, fixture->topLeft);
      FillRect(dc, &tr, fixture->topRight);
      FillRect(dc, &bl, fixture->bottomLeft);
      FillRect(dc, &br, fixture->bottomRight);
    }
    EndPaint(window, &paint);
    return 0;
  }
  return DefWindowProcW(window, message, wParam, lParam);
}

struct MetadataCapture {
  Direct3D11CaptureFramePool pool{nullptr};
  GraphicsCaptureSession session{nullptr};
  ~MetadataCapture() {
    if (session) { try { session.Close(); } catch (...) {} }
    if (pool) { try { pool.Close(); } catch (...) {} }
  }
};

// +--- 预期尺寸来自同一合成窗口的真实帧，不从 DWM 几何推导 ---+
bool ReadContentSize(HWND window, UINT* width, UINT* height) {
  try {
    ComPtr<ID3D11Device> device;
    winrt::check_hresult(D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr,
        D3D11_CREATE_DEVICE_BGRA_SUPPORT, nullptr, 0, D3D11_SDK_VERSION, &device, nullptr, nullptr));
    ComPtr<IDXGIDevice> dxgi;
    winrt::check_hresult(device.As(&dxgi));
    winrt::com_ptr<IInspectable> inspectable;
    winrt::check_hresult(CreateDirect3D11DeviceFromDXGIDevice(dxgi.Get(), inspectable.put()));
    auto runtimeDevice = inspectable.as<winrt::Windows::Graphics::DirectX::Direct3D11::IDirect3DDevice>();
    auto interop = winrt::get_activation_factory<GraphicsCaptureItem, IGraphicsCaptureItemInterop>();
    GraphicsCaptureItem item{nullptr};
    winrt::check_hresult(interop->CreateForWindow(window,
        winrt::guid_of<ABI::Windows::Graphics::Capture::IGraphicsCaptureItem>(),
        reinterpret_cast<void**>(winrt::put_abi(item))));
    const auto allocation = item.Size();
    MetadataCapture capture;
    capture.pool = Direct3D11CaptureFramePool::CreateFreeThreaded(runtimeDevice,
        winrt::Windows::Graphics::DirectX::DirectXPixelFormat::B8G8R8A8UIntNormalized, 2, allocation);
    capture.session = capture.pool.CreateCaptureSession(item);
    capture.session.StartCapture();
    const auto start = GetTickCount64();
    while (GetTickCount64() - start < 5000) {
      PumpMessages();
      auto frame = capture.pool.TryGetNextFrame();
      if (!frame) { Sleep(5); continue; }
      const auto content = frame.ContentSize();
      auto access = frame.Surface().as<::Windows::Graphics::DirectX::Direct3D11::IDirect3DDxgiInterfaceAccess>();
      ComPtr<ID3D11Texture2D> texture;
      winrt::check_hresult(access->GetInterface(IID_PPV_ARGS(&texture)));
      D3D11_TEXTURE2D_DESC desc{};
      texture->GetDesc(&desc);
      frame.Close();
      if (content.Width <= 0 || content.Height <= 0 ||
          static_cast<UINT>(content.Width) > desc.Width || static_cast<UINT>(content.Height) > desc.Height) return false;
      *width = content.Width; *height = content.Height;
      std::printf("frame-content=%ux%u allocation=%dx%d texture=%ux%u\n",
          *width, *height, allocation.Width, allocation.Height, desc.Width, desc.Height);
      const bool differs = content.Width != allocation.Width || content.Height != allocation.Height;
      std::puts(differs ? "size-mismatch-regression=covered" : "size-mismatch-regression=not-observed");
      return differs;
    }
  } catch (...) {}
  return false;
}

bool ReadFixtureGeometry(HWND window, UINT pngWidth, UINT pngHeight, FixtureGeometry* output) {
  if (window == nullptr || output == nullptr || pngWidth == 0 || pngHeight == 0) return false;
  const DPI_AWARENESS_CONTEXT targetContext = GetWindowDpiAwarenessContext(window);
  if (targetContext == nullptr || GetAwarenessFromDpiAwarenessContext(targetContext) !=
      DPI_AWARENESS_PER_MONITOR_AWARE) return false;
  RECT visible{}, client{};
  if (FAILED(DwmGetWindowAttribute(window, DWMWA_EXTENDED_FRAME_BOUNDS,
          &visible, sizeof(visible))) || !GetClientRect(window, &client) ||
      visible.right <= visible.left || visible.bottom <= visible.top ||
      client.right <= 0 || client.bottom <= 0) return false;
  const int64_t visibleWidth = static_cast<int64_t>(visible.right) - visible.left;
  const int64_t visibleHeight = static_cast<int64_t>(visible.bottom) - visible.top;
  if (visibleWidth != pngWidth || visibleHeight != pngHeight) return false;

  POINT origin{0, 0};
  POINT end{client.right, client.bottom};
  if (!ClientToScreen(window, &origin) || !ClientToScreen(window, &end) ||
      end.x <= origin.x || end.y <= origin.y) return false;
  const int64_t x = static_cast<int64_t>(origin.x) - visible.left;
  const int64_t y = static_cast<int64_t>(origin.y) - visible.top;
  const int64_t width = static_cast<int64_t>(end.x) - origin.x;
  const int64_t height = static_cast<int64_t>(end.y) - origin.y;
  if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > visibleWidth ||
      y + height > visibleHeight || x > UINT_MAX || y > UINT_MAX ||
      width > UINT_MAX || height > UINT_MAX) return false;

  FixtureGeometry current;
  current.pngWidth = pngWidth;
  current.pngHeight = pngHeight;
  current.dpi = GetDpiForWindow(window);
  current.x = static_cast<UINT>(x);
  current.y = static_cast<UINT>(y);
  current.width = static_cast<UINT>(width);
  current.height = static_cast<UINT>(height);
  if (current.dpi == 0) return false;
  *output = current;
  return true;
}

bool SameFixtureGeometry(const FixtureGeometry& left, const FixtureGeometry& right) {
  return left.pngWidth == right.pngWidth && left.pngHeight == right.pngHeight &&
      left.dpi == right.dpi && left.x == right.x && left.y == right.y &&
      left.width == right.width && left.height == right.height;
}

// +--- 参数只传给 CreateProcess，不进入 shell ---+
std::wstring Quote(const std::wstring& value) {
  std::wstring result = L"\"";
  size_t slashes = 0;
  for (wchar_t ch : value) {
    if (ch == L'\\') { ++slashes; continue; }
    result.append(slashes * (ch == L'\"' ? 2 : 1), L'\\');
    slashes = 0;
    if (ch == L'\"') result += L'\\';
    result += ch;
  }
  result.append(slashes * 2, L'\\');
  return result + L'\"';
}

bool ReadPipe(HANDLE pipe, std::vector<BYTE>* bytes) {
  if (pipe == nullptr || bytes == nullptr) return false;
  bytes->clear();
  BYTE block[4096];
  for (;;) {
    DWORD count = 0;
    if (ReadFile(pipe, block, sizeof(block), &count, nullptr)) {
      if (count == 0) return true;
      if (bytes->size() + count > 1024 * 1024) return false;
      bytes->insert(bytes->end(), block, block + count);
      continue;
    }
    return GetLastError() == ERROR_BROKEN_PIPE;
  }
}

bool VerifyPNG(const std::vector<BYTE>& png, const FixtureGeometry& expected) {
  if (png.empty()) return false;
  ComPtr<IWICImagingFactory> factory;
  ComPtr<IWICStream> stream;
  ComPtr<IWICBitmapDecoder> decoder;
  ComPtr<IWICBitmapFrameDecode> frame;
  ComPtr<IWICFormatConverter> converter;
  if (FAILED(CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER,
      IID_PPV_ARGS(&factory))) || FAILED(factory->CreateStream(&stream)) ||
      FAILED(stream->InitializeFromMemory(const_cast<BYTE*>(png.data()), static_cast<DWORD>(png.size()))) ||
      FAILED(factory->CreateDecoderFromStream(stream.Get(), nullptr, WICDecodeMetadataCacheOnLoad, &decoder)) ||
      FAILED(decoder->GetFrame(0, &frame))) return false;
  UINT width = 0, height = 0;
  if (FAILED(frame->GetSize(&width, &height))) return false;
  std::printf("png=%ux%u expected=%ux%u\n", width, height,
      expected.pngWidth, expected.pngHeight);
  if (width != expected.pngWidth || height != expected.pngHeight ||
      FAILED(factory->CreateFormatConverter(&converter)) ||
      FAILED(converter->Initialize(frame.Get(), GUID_WICPixelFormat32bppBGRA,
          WICBitmapDitherTypeNone, nullptr, 0, WICBitmapPaletteTypeCustom))) return false;
  const uint64_t stride64 = static_cast<uint64_t>(width) * 4;
  const uint64_t byteCount = stride64 * height;
  if (stride64 > UINT_MAX || byteCount > UINT_MAX || byteCount == 0) return false;
  std::vector<BYTE> pixels(static_cast<size_t>(byteCount));
  if (FAILED(converter->CopyPixels(nullptr, static_cast<UINT>(stride64),
          static_cast<UINT>(pixels.size()), pixels.data())) ||
      expected.x + expected.width > width || expected.y + expected.height > height) return false;

  const auto pixelEquals = [&pixels, width, height](UINT x, UINT y, COLORREF color) {
    if (x >= width || y >= height) return false;
    const size_t offset = (static_cast<size_t>(y) * width + x) * 4;
    return offset + 3 < pixels.size() && pixels[offset] == GetBValue(color) &&
        pixels[offset + 1] == GetGValue(color) && pixels[offset + 2] == GetRValue(color) &&
        pixels[offset + 3] == 255;
  };
  const auto regionEquals = [&pixelEquals](UINT x, UINT y, COLORREF color) {
    for (UINT row = 0; row < kMarkerSize; ++row) {
      for (UINT column = 0; column < kMarkerSize; ++column) {
        if (!pixelEquals(x + column, y + row, color)) return false;
      }
    }
    return true;
  };
  const UINT rightMarkerX = expected.x + expected.width - kMarkerInset - kMarkerSize;
  const UINT bottomMarkerY = expected.y + expected.height - kMarkerInset - kMarkerSize;
  const bool corners = regionEquals(expected.x + kMarkerInset, expected.y + kMarkerInset, kTopLeftColor) &&
      regionEquals(rightMarkerX, expected.y + kMarkerInset, kTopRightColor) &&
      regionEquals(expected.x + kMarkerInset, bottomMarkerY, kBottomLeftColor) &&
      regionEquals(rightMarkerX, bottomMarkerY, kBottomRightColor);
  const bool edges = pixelEquals(expected.x + expected.width / 2, expected.y, kEdgeColor) &&
      pixelEquals(expected.x + expected.width - 1, expected.y + expected.height / 2, kEdgeColor) &&
      pixelEquals(expected.x + expected.width / 2, expected.y + expected.height - 1, kEdgeColor) &&
      pixelEquals(expected.x, expected.y + expected.height / 2, kEdgeColor);
  const bool center = pixelEquals(expected.x + expected.width / 2,
      expected.y + expected.height / 2, kBackgroundColor);
  std::printf("fixture-pixel-origin=%s fixture-four-corners=%s fixture-client-edges=%s\n",
      corners && edges && center ? "matched" : "mismatch",
      corners ? "matched" : "mismatch", edges ? "matched" : "mismatch");
  return corners && edges && center;
}

int RunHost(const wchar_t* helper, DWORD mainPID, const FixtureGeometry& expected,
            FixtureMode mode) {
  SECURITY_ATTRIBUTES security{sizeof(security), nullptr, TRUE};
  HANDLE stdoutRead = nullptr, stdoutWrite = nullptr, stderrRead = nullptr, stderrWrite = nullptr;
  if (!CreatePipe(&stdoutRead, &stdoutWrite, &security, 0)) return 10;
  UniqueHandle outputRead(stdoutRead), outputWrite(stdoutWrite);
  if (!CreatePipe(&stderrRead, &stderrWrite, &security, 0)) return 10;
  UniqueHandle errorRead(stderrRead), errorWrite(stderrWrite);
  if (!SetHandleInformation(stdoutRead, HANDLE_FLAG_INHERIT, 0) ||
      !SetHandleInformation(stderrRead, HANDLE_FLAG_INHERIT, 0)) return 10;
  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  startup.dwFlags = STARTF_USESTDHANDLES;
  startup.hStdOutput = stdoutWrite;
  startup.hStdError = stderrWrite;
  startup.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
  PROCESS_INFORMATION child{};
  std::wstring command = Quote(helper) + L" --capture " + std::to_wstring(GetCurrentProcessId()) +
      L" " + std::to_wstring(mainPID) + L" --request-permission";
  const DWORD creationFlags = CREATE_NO_WINDOW |
      (mode == FixtureMode::AbortHelper ? CREATE_SUSPENDED : 0);
  const BOOL started = CreateProcessW(helper, command.data(), nullptr, nullptr, TRUE,
      creationFlags, nullptr, nullptr, &startup, &child);
  outputWrite.reset(); errorWrite.reset();
  if (!started) return 11;
  UniqueHandle process(child.hProcess), thread(child.hThread);
  if (mode == FixtureMode::AbortHelper) {
    if (!TerminateProcess(process.get(), kAbortExitCode)) return 16;
    std::puts("helper-abort=triggered");
    std::fflush(stdout);
    if (WaitForSingleObject(process.get(), 5000) != WAIT_OBJECT_0) return 16;
    DWORD exitCode = 0;
    if (!GetExitCodeProcess(process.get(), &exitCode) || exitCode != kAbortExitCode) return 16;
    std::vector<BYTE> png, diagnostic;
    if (!ReadPipe(stdoutRead, &png) || !ReadPipe(stderrRead, &diagnostic)) return 16;
    const bool empty = png.empty() && diagnostic.empty();
    std::printf("helper-settled=true helper-exit=%lu stdout-empty=%s stderr-empty=%s\n",
        exitCode, png.empty() ? "true" : "false", diagnostic.empty() ? "true" : "false");
    return empty ? 0 : 17;
  }
  std::vector<BYTE> png, diagnostic;
  if (!ReadPipe(stdoutRead, &png) || !ReadPipe(stderrRead, &diagnostic)) return 15;
  if (WaitForSingleObject(process.get(), kFixtureDeadline) != WAIT_OBJECT_0) return 15;
  DWORD exitCode = 0;
  if (!GetExitCodeProcess(process.get(), &exitCode)) return 15;
  if (mode == FixtureMode::ClosedTarget) {
    const std::string status(diagnostic.begin(), diagnostic.end());
    const bool rejected = exitCode == 6 &&
        status.find("\"status\":\"no-ordinary-window-for-main-pid\"") != std::string::npos && png.empty();
    std::printf("target-close-rejected=%s helper-exit=%lu png-empty=%s\n",
        rejected ? "true" : "false", exitCode, png.empty() ? "true" : "false");
    return rejected ? 0 : 18;
  }
  if (exitCode != 0) {
    const std::string status(diagnostic.begin(), diagnostic.end());
    std::printf("helper-exit=%lu window-changed=%s png-empty=%s\n", exitCode,
        status.find("\"status\":\"window-changed\"") != std::string::npos ? "true" : "false",
        png.empty() ? "true" : "false");
    return 12;
  }
  if (FAILED(CoInitializeEx(nullptr, COINIT_MULTITHREADED))) return 13;
  const bool valid = VerifyPNG(png, expected);
  CoUninitialize();
  if (!valid) {
    std::puts("capture-png-valid=false viewport-required=true");
    return 14;
  }

  const std::string status(diagnostic.begin(), diagnostic.end());
  const std::string expectedViewport = "\"viewport\":{\"x\":" + std::to_string(expected.x) +
      ",\"y\":" + std::to_string(expected.y) + ",\"width\":" +
      std::to_string(expected.width) + ",\"height\":" + std::to_string(expected.height) + "}";
  if (status.find("\"status\":\"captured\"") == std::string::npos) return 14;
  if (status.find("\"viewport\":") == std::string::npos) {
    std::puts("capture-png-valid=true viewport-missing=true");
    return 19;
  }
  if (status.find(expectedViewport) == std::string::npos ||
      status.find("screenX") != std::string::npos || status.find("screenY") != std::string::npos) {
    std::puts("capture-png-valid=true viewport-json=mismatch");
    return 20;
  }
  std::printf("fixture-dpi=%u viewport=%u,%u %ux%u\n", expected.dpi,
      expected.x, expected.y, expected.width, expected.height);
  std::puts(expected.dpi > USER_DEFAULT_SCREEN_DPI
      ? "high-dpi-boundary=observed" : "high-dpi-boundary=not-verified");
  std::puts("capture-png-valid=true viewport-png-alignment=passed");
  return 0;
}

int RunMain(const wchar_t* helper, FixtureMode mode) {
  if (!SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2)) return 30;
  const HINSTANCE instance = GetModuleHandleW(nullptr);
  FixtureWindow fixture;
  if (!fixture.ready()) return 21;
  WNDCLASSW windowClass{};
  windowClass.lpfnWndProc = FixtureWindowProc;
  windowClass.hInstance = instance;
  windowClass.lpszClassName = L"PDSHNativeContract";
  if (!RegisterClassW(&windowClass)) return 20;
  HWND window = CreateWindowExW(WS_EX_WINDOWEDGE, windowClass.lpszClassName,
      L"PDSH native contract fixture", WS_OVERLAPPEDWINDOW, 32, 32, 400, 300,
      nullptr, nullptr, instance, &fixture);
  fixture.window = window;
  if (!window) return 21;
  ShowWindow(window, SW_SHOWNOACTIVATE);
  UpdateWindow(window);
  DwmFlush();
  RECT visible{}, outer{};
  if (FAILED(DwmGetWindowAttribute(window, DWMWA_EXTENDED_FRAME_BOUNDS, &visible, sizeof(visible))) ||
      !GetWindowRect(window, &outer)) return 22;
  std::printf("fixture-outer=%ldx%ld visible=%ldx%ld\n", outer.right - outer.left,
      outer.bottom - outer.top, visible.right - visible.left, visible.bottom - visible.top);
  UINT width = 0, height = 0;
  FixtureGeometry geometry{};
  if (mode == FixtureMode::ClosedTarget) {
    SendMessageW(window, WM_CLOSE, 0, 0);
    if (IsWindow(window)) return 25;
    fixture.window = nullptr;
    std::puts("target-close=settled");
  } else if (!ReadContentSize(window, &width, &height) ||
      !ReadFixtureGeometry(window, width, height, &geometry)) return 26;
  if (mode != FixtureMode::ClosedTarget) {
    std::printf("fixture-awareness=per-monitor dpi=%u client=%ux%u relative=%u,%u\n",
        geometry.dpi, geometry.width, geometry.height, geometry.x, geometry.y);
  }
  wchar_t executable[32768]{};
  if (!GetModuleFileNameW(nullptr, executable, static_cast<DWORD>(std::size(executable)))) return 23;
  std::wstring command = Quote(executable) + L" --host " + Quote(helper) + L" " +
      std::to_wstring(GetCurrentProcessId()) + L" " + std::to_wstring(width) + L" " +
      std::to_wstring(height) + L" " + std::to_wstring(geometry.x) + L" " +
      std::to_wstring(geometry.y) + L" " + std::to_wstring(geometry.width) + L" " +
      std::to_wstring(geometry.height) + L" " + std::to_wstring(geometry.dpi) + L" " + ModeName(mode);
  UniqueHandle job(CreateJobObjectW(nullptr, nullptr));
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};
  limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
  if (!job || !SetInformationJobObject(job.get(), JobObjectExtendedLimitInformation, &limits, sizeof(limits))) return 27;
  STARTUPINFOW startup{}; startup.cb = sizeof(startup);
  PROCESS_INFORMATION child{};
  if (!CreateProcessW(executable, command.data(), nullptr, nullptr, TRUE, CREATE_SUSPENDED,
      nullptr, nullptr, &startup, &child)) return 24;
  UniqueHandle process(child.hProcess), thread(child.hThread);
  if (!AssignProcessToJobObject(job.get(), process.get())) {
    TerminateProcess(process.get(), 27);
    WaitForSingleObject(process.get(), 5000);
    return 27;
  }
  const bool resumed = ResumeThread(thread.get()) != static_cast<DWORD>(-1);
  const auto start = GetTickCount64();
  DWORD exitCode = resumed ? 25 : 27;
  while (resumed && GetTickCount64() - start < kFixtureDeadline) {
    const DWORD state = WaitForSingleObject(process.get(), 0);
    if (state == WAIT_OBJECT_0) {
      if (!GetExitCodeProcess(process.get(), &exitCode)) exitCode = 28;
      break;
    }
    if (state != WAIT_TIMEOUT) { exitCode = 28; break; }
    PumpMessages();
    Sleep(5);
  }
  // +--- 只结算本夹具创建的进程树；超时不能遗留 Host 或 helper ---+
  if (!TerminateJobObject(job.get(), 25)) return 28;
  const auto settlementStart = GetTickCount64();
  for (;;) {
    JOBOBJECT_BASIC_ACCOUNTING_INFORMATION accounting{};
    if (!QueryInformationJobObject(job.get(), JobObjectBasicAccountingInformation,
        &accounting, sizeof(accounting), nullptr)) return 28;
    if (accounting.ActiveProcesses == 0) {
      std::puts("fixture-job-active=0");
      break;
    }
    if (GetTickCount64() - settlementStart >= 5000) return 28;
    Sleep(5);
  }
  if (mode == FixtureMode::Capture && exitCode == 0) {
    FixtureGeometry after{};
    if (!ReadFixtureGeometry(window, width, height, &after) ||
        !SameFixtureGeometry(geometry, after)) return 31;
    std::puts("fixture-geometry-stable=true");
  }
  return static_cast<int>(exitCode);
}

int wmain(int argc, wchar_t** argv) {
  FixtureMode mode = FixtureMode::Capture;
  if (argc == 12 && std::wcscmp(argv[1], L"--host") == 0 && ParseMode(argv[11], &mode)) {
    FixtureGeometry expected{};
    const DWORD mainPID = std::wcstoul(argv[3], nullptr, 10);
    expected.pngWidth = std::wcstoul(argv[4], nullptr, 10);
    expected.pngHeight = std::wcstoul(argv[5], nullptr, 10);
    expected.x = std::wcstoul(argv[6], nullptr, 10);
    expected.y = std::wcstoul(argv[7], nullptr, 10);
    expected.width = std::wcstoul(argv[8], nullptr, 10);
    expected.height = std::wcstoul(argv[9], nullptr, 10);
    expected.dpi = std::wcstoul(argv[10], nullptr, 10);
    return RunHost(argv[2], mainPID, expected, mode);
  }
  if ((argc != 2 && argc != 3) || (argc == 3 &&
      (std::wcscmp(argv[2], L"--closed-target") != 0 && std::wcscmp(argv[2], L"--abort-helper") != 0))) return 2;
  if (argc == 3) mode = std::wcscmp(argv[2], L"--closed-target") == 0
      ? FixtureMode::ClosedTarget : FixtureMode::AbortHelper;
  try {
    winrt::init_apartment(winrt::apartment_type::multi_threaded);
    const int result = RunMain(argv[1], mode);
    winrt::uninit_apartment();
    return result;
  } catch (...) { return 29; }
}
