/**
 * [INPUT]: 依赖 Win32 自有窗口、真实助手、WGC 帧元数据、WIC 和 window-owner 句柄。
 * [OUTPUT]: 验真实帧尺寸差异与 PNG 像素；验证目标关闭拒绝、真实助手终止及 Job 结算。
 * [POS]: Windows 原生合同夹具。自有 Main→Host→helper 进程链不访问 Desktop profile。
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
#include <cwchar>
#include <string>
#include <vector>

using Microsoft::WRL::ComPtr;
using pdsh::windows_capture::UniqueHandle;
using namespace winrt::Windows::Graphics::Capture;
constexpr COLORREF kFixtureColor = RGB(39, 84, 126);
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
  HBRUSH brush = CreateSolidBrush(kFixtureColor);
  HWND window = nullptr;
  ~FixtureWindow() {
    if (window) DestroyWindow(window);
    if (brush) DeleteObject(brush);
  }
};

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

bool VerifyPNG(const std::vector<BYTE>& png, UINT expectedWidth, UINT expectedHeight) {
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
  std::printf("png=%ux%u expected=%ux%u\n", width, height, expectedWidth, expectedHeight);
  if (width != expectedWidth || height != expectedHeight ||
      FAILED(factory->CreateFormatConverter(&converter)) ||
      FAILED(converter->Initialize(frame.Get(), GUID_WICPixelFormat32bppBGRA,
          WICBitmapDitherTypeNone, nullptr, 0, WICBitmapPaletteTypeCustom))) return false;
  WICRect center{static_cast<INT>(width / 2), static_cast<INT>(height / 2), 1, 1};
  BYTE bgra[4]{};
  return SUCCEEDED(converter->CopyPixels(&center, 4, 4, bgra)) &&
      bgra[0] == GetBValue(kFixtureColor) && bgra[1] == GetGValue(kFixtureColor) &&
      bgra[2] == GetRValue(kFixtureColor) && bgra[3] == 255;
}

int RunHost(const wchar_t* helper, DWORD mainPID, UINT width, UINT height, FixtureMode mode) {
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
  const bool valid = VerifyPNG(png, width, height);
  CoUninitialize();
  std::puts(valid ? "native-contract=passed" : "native-contract=failed");
  return valid ? 0 : 14;
}

int RunMain(const wchar_t* helper, FixtureMode mode) {
  const HINSTANCE instance = GetModuleHandleW(nullptr);
  FixtureWindow fixture;
  WNDCLASSW windowClass{};
  windowClass.lpfnWndProc = DefWindowProcW;
  windowClass.hInstance = instance;
  windowClass.hbrBackground = fixture.brush;
  windowClass.lpszClassName = L"PDSHNativeContract";
  if (!RegisterClassW(&windowClass)) return 20;
  HWND window = CreateWindowExW(WS_EX_WINDOWEDGE, windowClass.lpszClassName,
      L"PDSH native contract fixture", WS_OVERLAPPEDWINDOW, 32, 32, 400, 300,
      nullptr, nullptr, instance, nullptr);
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
  if (mode == FixtureMode::ClosedTarget) {
    SendMessageW(window, WM_CLOSE, 0, 0);
    if (IsWindow(window)) return 25;
    fixture.window = nullptr;
    std::puts("target-close=settled");
  } else if (!ReadContentSize(window, &width, &height)) return 26;
  wchar_t executable[32768]{};
  if (!GetModuleFileNameW(nullptr, executable, static_cast<DWORD>(std::size(executable)))) return 23;
  std::wstring command = Quote(executable) + L" --host " + Quote(helper) + L" " +
      std::to_wstring(GetCurrentProcessId()) + L" " + std::to_wstring(width) + L" " +
      std::to_wstring(height) + L" " + ModeName(mode);
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
  return static_cast<int>(exitCode);
}

int wmain(int argc, wchar_t** argv) {
  FixtureMode mode = FixtureMode::Capture;
  if (argc == 7 && std::wcscmp(argv[1], L"--host") == 0 && ParseMode(argv[6], &mode)) {
    return RunHost(argv[2], std::wcstoul(argv[3], nullptr, 10),
        std::wcstoul(argv[4], nullptr, 10), std::wcstoul(argv[5], nullptr, 10), mode);
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
