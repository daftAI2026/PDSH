/**
 * [INPUT]: 依赖 Host 显式授权请求、window-owner 的进程/窗口归属校验，以及 Windows.Graphics.Capture、D3D11 与 WIC。
 * [OUTPUT]: `--check-api` 返回无GUI能力状态；身份门通过后仅捕获唯一可见 Main 窗口，并以有界 PNG 写 stdout、固定状态写 stderr。
 * [POS]: native/windows 的一次性 x64 取像编排器；复用 window-owner 安全门，隔离 WGC/D3D/WIC，不启动 picker、显示器捕获或提权。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include "window-owner.h"
#include <winternl.h>
#include <d3d11.h>
#include <dxgi.h>
#include <wincodec.h>
#include <windows.graphics.capture.interop.h>
#include <windows.graphics.capture.h>
#include <windows.graphics.directx.direct3d11.interop.h>
#include <winrt/Windows.Foundation.h>
#include <winrt/Windows.Foundation.Metadata.h>
#include <winrt/Windows.Graphics.Capture.h>
#include <winrt/Windows.Graphics.DirectX.h>
#include <winrt/Windows.Graphics.DirectX.Direct3D11.h>
#include <winrt/base.h>
#include <wrl/client.h>
#include <algorithm>
#include <chrono>
#include <condition_variable>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cwchar>
#include <cstring>
#include <fcntl.h>
#include <io.h>
#include <iterator>
#include <memory>
#include <mutex>
#include <string>
#include <utility>
#include <vector>

using Microsoft::WRL::ComPtr;
using winrt::Windows::Graphics::Capture::Direct3D11CaptureFrame;
using winrt::Windows::Graphics::Capture::Direct3D11CaptureFramePool;
using winrt::Windows::Graphics::Capture::GraphicsCaptureItem;
using winrt::Windows::Graphics::Capture::GraphicsCaptureSession;
using winrt::Windows::Graphics::DirectX::DirectXPixelFormat;
using winrt::Windows::Graphics::DirectX::Direct3D11::IDirect3DDevice;

namespace {
using namespace pdsh::windows_capture;

constexpr uint64_t kMaxPixels = 16ULL * 1024ULL * 1024ULL;
constexpr uint64_t kMaxRawBytes = 128ULL * 1024ULL * 1024ULL;
constexpr DWORD kMinimumBuild = 18362;
constexpr DWORD kCaptureDeadlineMs = 12000;
constexpr DWORD kDpiBase = 96;

const char* StatusName(Status status) {
  switch (status) {
    case Status::ApiReady: return "api-ready";
    case Status::InvalidArgs: return "invalid-arguments";
    case Status::InvalidPID: return "invalid-pid";
    case Status::ApiUnavailable: return "api-unavailable";
    case Status::CallerIsNotOwnHostParent: return "caller-is-not-own-host-parent";
    case Status::HostParentMismatch: return "host-parent-mismatch";
    case Status::MainProcessUnavailable: return "main-process-unavailable";
    case Status::OwnMainIsNotDSH: return "own-main-is-not-dsh";
    case Status::ProcessChanged: return "process-changed";
    case Status::NoOrdinaryWindow: return "no-ordinary-window-for-main-pid";
    case Status::AmbiguousMultipleWindows: return "ambiguous-multiple-windows-refuse";
    case Status::NativeSizeInvalidOrOverBudget: return "native-size-invalid-or-over-budget";
    case Status::WindowChanged: return "window-changed";
    case Status::CaptureTimeout: return "capture-timeout";
    case Status::CaptureFailed: return "capture-failed";
    case Status::ByteBudgetExceeded: return "byte-budget-exceeded";
    case Status::EncodedByteBudgetExceeded: return "encoded-byte-budget-exceeded";
    case Status::PngDestinationFailed: return "png-destination-failed";
    case Status::PngEncodeFailed: return "png-encode-failed";
    case Status::OutputPipeFailed: return "output-pipe-failed";
    case Status::Captured: return "captured";
  }
  return "capture-failed";
}

int StatusExitCode(Status status) {
  switch (status) {
    case Status::ApiReady:
    case Status::Captured: return 0;
    case Status::InvalidArgs:
    case Status::InvalidPID: return 2;
    case Status::CallerIsNotOwnHostParent:
    case Status::HostParentMismatch:
    case Status::MainProcessUnavailable:
    case Status::OwnMainIsNotDSH:
    case Status::ProcessChanged: return 3;
    case Status::ApiUnavailable: return 5;
    default: return 6;
  }
}

int EmitStatus(Status status, uint32_t width = 0, uint32_t height = 0,
               double pointPixelScale = 0.0, uint64_t pngBytes = 0) {
  if (status == Status::Captured) {
    std::fprintf(stderr,
      "{\"status\":\"%s\",\"width\":%u,\"height\":%u,\"pngBytes\":%llu,\"pointPixelScale\":%.4f}\n",
      StatusName(status), width, height, static_cast<unsigned long long>(pngBytes), pointPixelScale);
  } else {
    std::fprintf(stderr, "{\"status\":\"%s\"}\n", StatusName(status));
  }
  std::fflush(stderr);
  return StatusExitCode(status);
}

void EmitPhase(const char* phase) {
  // phase 只能由本文件内固定的ASCII常量调用。
  std::fprintf(stderr, "phase=%s\n", phase);
  std::fflush(stderr);
}

bool ParsePID(const wchar_t* text, DWORD* value) {
  if (text == nullptr || value == nullptr || *text == L'\0') return false;
  for (const wchar_t* cursor = text; *cursor != L'\0'; ++cursor) {
    if (*cursor < L'0' || *cursor > L'9') return false;
  }
  wchar_t* end = nullptr;
  unsigned long parsed = std::wcstoul(text, &end, 10);
  if (end == text || *end != L'\0' || parsed == 0 || parsed > MAXDWORD) return false;
  *value = static_cast<DWORD>(parsed);
  return true;
}

bool ReadWindowsBuild(DWORD* build) {
  if (build == nullptr) return false;
  using RtlGetVersionFunction = LONG(WINAPI*)(PRTL_OSVERSIONINFOW);
  HMODULE ntdll = GetModuleHandleW(L"ntdll.dll");
  if (ntdll == nullptr) return false;
  auto getVersion = reinterpret_cast<RtlGetVersionFunction>(GetProcAddress(ntdll, "RtlGetVersion"));
  if (getVersion == nullptr) return false;
  RTL_OSVERSIONINFOW version{};
  version.dwOSVersionInfoSize = sizeof(version);
  if (getVersion(&version) < 0 || version.dwMajorVersion < 10) return false;
  *build = version.dwBuildNumber;
  return true;
}

Status RuntimeAPIStatus() {
  DWORD build = 0;
  if (!ReadWindowsBuild(&build) || build < kMinimumBuild) return Status::ApiUnavailable;
  try {
    if (!GraphicsCaptureSession::IsSupported()) return Status::ApiUnavailable;
  } catch (...) {
    return Status::ApiUnavailable;
  }
  return Status::ApiReady;
}

bool ValidSize(uint32_t width, uint32_t height, uint64_t* rawBytes) {
  if (width == 0 || height == 0 || width > kMaxPixels / height ||
      static_cast<uint64_t>(width) * height > kMaxPixels) return false;
  const uint64_t bytes = static_cast<uint64_t>(width) * height * 4;
  if (bytes == 0 || bytes > kMaxRawBytes) return false;
  if (rawBytes != nullptr) *rawBytes = bytes;
  return true;
}

GraphicsCaptureItem CreateCaptureItemForWindow(HWND hwnd) {
  auto activationFactory = winrt::get_activation_factory<GraphicsCaptureItem>();
  auto interopFactory = activationFactory.as<IGraphicsCaptureItemInterop>();
  GraphicsCaptureItem item{ nullptr };
  winrt::check_hresult(interopFactory->CreateForWindow(
      hwnd, winrt::guid_of<ABI::Windows::Graphics::Capture::IGraphicsCaptureItem>(),
      reinterpret_cast<void**>(winrt::put_abi(item))));
  return item;
}

IDirect3DDevice CreateWinRTDevice(ComPtr<ID3D11Device> const& device) {
  ComPtr<IDXGIDevice> dxgiDevice;
  winrt::check_hresult(device.As(&dxgiDevice));
  winrt::com_ptr<IInspectable> inspectable;
  winrt::check_hresult(CreateDirect3D11DeviceFromDXGIDevice(dxgiDevice.Get(), inspectable.put()));
  return inspectable.as<IDirect3DDevice>();
}

struct FrameWaitState {
  std::mutex mutex;
  std::condition_variable ready;
  Direct3D11CaptureFrame frame{ nullptr };
  bool completed = false;
};

Status CopyFramePixels(Direct3D11CaptureFrame const& frame, ComPtr<ID3D11Device> const& device,
                       ComPtr<ID3D11DeviceContext> const& context, uint32_t* width,
                       uint32_t* height, std::vector<BYTE>* pixels);

struct CaptureResources {
  Direct3D11CaptureFramePool pool{ nullptr };
  GraphicsCaptureSession session{ nullptr };
  winrt::event_token frameToken{};
  bool subscribed = false;
  void Close() noexcept {
    if (pool && subscribed) {
      try { pool.FrameArrived(frameToken); } catch (...) {}
      subscribed = false;
    }
    if (session) { try { session.Close(); } catch (...) {} session = nullptr; }
    if (pool) { try { pool.Close(); } catch (...) {} pool = nullptr; }
  }
  ~CaptureResources() { Close(); }
};

Status WaitForSingleFrame(GraphicsCaptureItem const& item, ComPtr<ID3D11Device> const& d3dDevice,
                          ComPtr<ID3D11DeviceContext> const& context, uint32_t* width,
                          uint32_t* height, std::vector<BYTE>* pixels) {
  if (!item || !d3dDevice || !context || width == nullptr || height == nullptr || pixels == nullptr) {
    return Status::CaptureFailed;
  }
  const auto size = item.Size();
  if (size.Width <= 0 || size.Height <= 0 ||
      !ValidSize(static_cast<uint32_t>(size.Width), static_cast<uint32_t>(size.Height), nullptr)) {
    return Status::NativeSizeInvalidOrOverBudget;
  }

  CaptureResources resources;
  std::shared_ptr<FrameWaitState> state;
  try {
    IDirect3DDevice winrtDevice = CreateWinRTDevice(d3dDevice);
    resources.pool = Direct3D11CaptureFramePool::CreateFreeThreaded(
        winrtDevice, DirectXPixelFormat::B8G8R8A8UIntNormalized, 2, size);
    resources.session = resources.pool.CreateCaptureSession(item);
    if (winrt::Windows::Foundation::Metadata::ApiInformation::IsPropertyPresent(
            L"Windows.Graphics.Capture.GraphicsCaptureSession", L"IsCursorCaptureEnabled")) {
      resources.session.IsCursorCaptureEnabled(false);
    }
    state = std::make_shared<FrameWaitState>();
    resources.frameToken = resources.pool.FrameArrived([state](auto const& sender, auto const&) {
      {
        std::lock_guard<std::mutex> lock(state->mutex);
        if (state->completed) return;
      }
      Direct3D11CaptureFrame frame{ nullptr };
      try { frame = sender.TryGetNextFrame(); } catch (...) { return; }
      if (!frame) return;
      std::lock_guard<std::mutex> lock(state->mutex);
      if (!state->completed) {
        state->frame = std::move(frame);
        state->completed = true;
        state->ready.notify_one();
      }
    });
    resources.subscribed = true;
    resources.session.StartCapture();
  } catch (...) {
    return Status::CaptureFailed;
  }

  std::unique_lock<std::mutex> lock(state->mutex);
  const bool received = state->ready.wait_for(lock, std::chrono::milliseconds(kCaptureDeadlineMs),
      [&state] { return state->completed; });
  if (!received) {
    lock.unlock();
    resources.Close();
    return Status::CaptureTimeout;
  }
  auto frame = std::move(state->frame);
  lock.unlock();
  const Status copied = CopyFramePixels(frame, d3dDevice, context, width, height, pixels);
  frame.Close();
  resources.Close();
  return copied;
}

Status CopyFramePixels(Direct3D11CaptureFrame const& frame, ComPtr<ID3D11Device> const& device,
                       ComPtr<ID3D11DeviceContext> const& context, uint32_t* width,
                       uint32_t* height, std::vector<BYTE>* pixels) {
  if (!frame || !device || !context || width == nullptr || height == nullptr || pixels == nullptr) return Status::CaptureFailed;
  const auto content = frame.ContentSize();
  if (content.Width <= 0 || content.Height <= 0) return Status::NativeSizeInvalidOrOverBudget;
  const uint32_t w = static_cast<uint32_t>(content.Width);
  const uint32_t h = static_cast<uint32_t>(content.Height);
  uint64_t rawBytes = 0;
  if (!ValidSize(w, h, &rawBytes)) return Status::NativeSizeInvalidOrOverBudget;

  winrt::com_ptr<IDirect3DDxgiInterfaceAccess> access;
  try { access = frame.Surface().as<IDirect3DDxgiInterfaceAccess>(); }
  catch (...) { return Status::CaptureFailed; }
  ComPtr<ID3D11Texture2D> source;
  if (FAILED(access->GetInterface(__uuidof(ID3D11Texture2D), reinterpret_cast<void**>(source.GetAddressOf())))) {
    return Status::CaptureFailed;
  }
  D3D11_TEXTURE2D_DESC sourceDesc{};
  source->GetDesc(&sourceDesc);
  if (sourceDesc.Format != DXGI_FORMAT_B8G8R8A8_UNORM || w > sourceDesc.Width || h > sourceDesc.Height) {
    return Status::CaptureFailed;
  }

  D3D11_TEXTURE2D_DESC stagingDesc = sourceDesc;
  stagingDesc.Width = w;
  stagingDesc.Height = h;
  stagingDesc.MipLevels = 1;
  stagingDesc.ArraySize = 1;
  stagingDesc.SampleDesc.Count = 1;
  stagingDesc.SampleDesc.Quality = 0;
  stagingDesc.Usage = D3D11_USAGE_STAGING;
  stagingDesc.BindFlags = 0;
  stagingDesc.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
  stagingDesc.MiscFlags = 0;
  ComPtr<ID3D11Texture2D> staging;
  if (FAILED(device->CreateTexture2D(&stagingDesc, nullptr, &staging))) return Status::CaptureFailed;
  D3D11_BOX box{};
  box.right = w;
  box.bottom = h;
  box.back = 1;
  context->CopySubresourceRegion(staging.Get(), 0, 0, 0, 0, source.Get(), 0, &box);
  D3D11_MAPPED_SUBRESOURCE mapped{};
  if (FAILED(context->Map(staging.Get(), 0, D3D11_MAP_READ, 0, &mapped))) return Status::CaptureFailed;
  const uint64_t rowBytes = static_cast<uint64_t>(w) * 4;
  if (mapped.RowPitch < rowBytes || h > kMaxRawBytes / rowBytes || rawBytes > kMaxRawBytes) {
    context->Unmap(staging.Get(), 0);
    return Status::ByteBudgetExceeded;
  }
  try {
    pixels->resize(static_cast<size_t>(rawBytes));
    const auto* sourceBytes = static_cast<const BYTE*>(mapped.pData);
    for (uint32_t row = 0; row < h; ++row) {
      std::memcpy(pixels->data() + static_cast<size_t>(row) * static_cast<size_t>(rowBytes),
          sourceBytes + static_cast<size_t>(row) * mapped.RowPitch, static_cast<size_t>(rowBytes));
    }
  } catch (...) {
    context->Unmap(staging.Get(), 0);
    pixels->clear();
    return Status::ByteBudgetExceeded;
  }
  context->Unmap(staging.Get(), 0);
  *width = w;
  *height = h;
  return Status::Captured;
}

Status EncodePNG(const std::vector<BYTE>& pixels, uint32_t width, uint32_t height,
                 std::vector<BYTE>* encoded) {
  if (encoded == nullptr) return Status::PngEncodeFailed;
  uint64_t expectedBytes = 0;
  if (!ValidSize(width, height, &expectedBytes)) return Status::NativeSizeInvalidOrOverBudget;
  if (pixels.size() != expectedBytes) return Status::ByteBudgetExceeded;

  ComPtr<IWICImagingFactory> factory;
  if (FAILED(CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER,
      IID_PPV_ARGS(&factory)))) return Status::PngEncodeFailed;
  ComPtr<IStream> stream;
  if (FAILED(CreateStreamOnHGlobal(nullptr, TRUE, &stream))) return Status::PngDestinationFailed;
  ComPtr<IWICBitmapEncoder> encoder;
  if (FAILED(factory->CreateEncoder(GUID_ContainerFormatPng, nullptr, &encoder)) ||
      FAILED(encoder->Initialize(stream.Get(), WICBitmapEncoderNoCache))) return Status::PngEncodeFailed;
  ComPtr<IWICBitmapFrameEncode> frame;
  ComPtr<IPropertyBag2> options;
  if (FAILED(encoder->CreateNewFrame(&frame, &options)) || FAILED(frame->Initialize(options.Get())) ||
      FAILED(frame->SetSize(width, height))) return Status::PngEncodeFailed;
  WICPixelFormatGUID format = GUID_WICPixelFormat32bppBGRA;
  if (FAILED(frame->SetPixelFormat(&format)) || !InlineIsEqualGUID(format, GUID_WICPixelFormat32bppBGRA)) {
    return Status::PngEncodeFailed;
  }
  const uint64_t stride64 = static_cast<uint64_t>(width) * 4;
  if (stride64 > UINT32_MAX || FAILED(frame->WritePixels(height, static_cast<UINT>(stride64),
      static_cast<UINT>(pixels.size()), const_cast<BYTE*>(pixels.data()))) ||
      FAILED(frame->Commit()) || FAILED(encoder->Commit())) return Status::PngEncodeFailed;

  STATSTG stat{};
  if (FAILED(stream->Stat(&stat, STATFLAG_NONAME)) || stat.cbSize.QuadPart == 0) return Status::PngDestinationFailed;
  if (stat.cbSize.QuadPart > kMaxRawBytes) return Status::EncodedByteBudgetExceeded;
  HGLOBAL memory = nullptr;
  if (FAILED(GetHGlobalFromStream(stream.Get(), &memory)) || memory == nullptr) return Status::PngDestinationFailed;
  const SIZE_T length = GlobalSize(memory);
  if (length < stat.cbSize.QuadPart || length == 0 || length > kMaxRawBytes) return Status::EncodedByteBudgetExceeded;
  const auto* bytes = static_cast<const BYTE*>(GlobalLock(memory));
  if (bytes == nullptr) return Status::PngDestinationFailed;
  try { encoded->assign(bytes, bytes + static_cast<size_t>(stat.cbSize.QuadPart)); }
  catch (...) {
    GlobalUnlock(memory);
    return Status::EncodedByteBudgetExceeded;
  }
  GlobalUnlock(memory);
  return Status::Captured;
}

Status WritePNG(const std::vector<BYTE>& bytes) {
  if (bytes.empty() || bytes.size() > kMaxRawBytes) return Status::EncodedByteBudgetExceeded;
  HANDLE output = GetStdHandle(STD_OUTPUT_HANDLE);
  if (output == nullptr || output == INVALID_HANDLE_VALUE) return Status::OutputPipeFailed;
  size_t offset = 0;
  while (offset < bytes.size()) {
    const DWORD request = static_cast<DWORD>(std::min<size_t>(bytes.size() - offset, MAXDWORD));
    DWORD written = 0;
    if (!WriteFile(output, bytes.data() + offset, request, &written, nullptr) || written == 0) {
      return Status::OutputPipeFailed;
    }
    offset += written;
  }
  return Status::Captured;
}

Status CreateD3DDevice(ComPtr<ID3D11Device>* device, ComPtr<ID3D11DeviceContext>* context) {
  if (device == nullptr || context == nullptr) return Status::CaptureFailed;
  constexpr D3D_FEATURE_LEVEL levels[] = {
    D3D_FEATURE_LEVEL_11_0, D3D_FEATURE_LEVEL_10_1, D3D_FEATURE_LEVEL_10_0
  };
  D3D_FEATURE_LEVEL selected{};
  const HRESULT result = D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr,
      D3D11_CREATE_DEVICE_BGRA_SUPPORT, levels, static_cast<UINT>(std::size(levels)),
      D3D11_SDK_VERSION, device->ReleaseAndGetAddressOf(), &selected, context->ReleaseAndGetAddressOf());
  return SUCCEEDED(result) ? Status::Captured : Status::CaptureFailed;
}

int RunCapture(DWORD hostPID, DWORD mainPID) {
  ProcessSnapshot expectedMain;
  ProcessSnapshot expectedHost;
  Status identityFailure = Status::ProcessChanged;
  // +--- 身份门必须先于WinRT初始化、目标窗口枚举及任何像素读取 ---+
  if (!ReadAndValidatePair(hostPID, mainPID, &expectedMain, &expectedHost, &identityFailure)) {
    return EmitStatus(identityFailure);
  }
  try { winrt::init_apartment(winrt::apartment_type::multi_threaded); }
  catch (...) { return EmitStatus(Status::ApiUnavailable); }
  const Status apiStatus = RuntimeAPIStatus();
  if (apiStatus != Status::ApiReady) return EmitStatus(apiStatus);
  if (!ValidatePairSnapshot(hostPID, mainPID, expectedMain, expectedHost)) {
    return EmitStatus(Status::ProcessChanged);
  }

  WindowSnapshot selected;
  const WindowResolution resolution = ResolveUniqueWindow(mainPID, &selected);
  if (resolution == WindowResolution::Ambiguous) return EmitStatus(Status::AmbiguousMultipleWindows);
  if (resolution != WindowResolution::Found) return EmitStatus(Status::NoOrdinaryWindow);

  GraphicsCaptureItem item{ nullptr };
  try { item = CreateCaptureItemForWindow(selected.hwnd); }
  catch (...) { return EmitStatus(Status::CaptureFailed); }
  const auto size = item.Size();
  if (size.Width <= 0 || size.Height <= 0 ||
      !ValidSize(static_cast<uint32_t>(size.Width), static_cast<uint32_t>(size.Height), nullptr)) {
    return EmitStatus(Status::NativeSizeInvalidOrOverBudget);
  }
  if (!ValidatePairSnapshot(hostPID, mainPID, expectedMain, expectedHost) ||
      !RevalidateWindow(mainPID, selected)) return EmitStatus(Status::WindowChanged);

  ComPtr<ID3D11Device> device;
  ComPtr<ID3D11DeviceContext> context;
  if (CreateD3DDevice(&device, &context) != Status::Captured) return EmitStatus(Status::CaptureFailed);
  EmitPhase("capture-ready");
  uint32_t width = 0;
  uint32_t height = 0;
  std::vector<BYTE> pixels;
  Status status = WaitForSingleFrame(item, device, context, &width, &height, &pixels);
  if (status != Status::Captured) return EmitStatus(status);
  if (width != static_cast<uint32_t>(size.Width) || height != static_cast<uint32_t>(size.Height)) {
    return EmitStatus(Status::WindowChanged);
  }
  if (!ValidatePairSnapshot(hostPID, mainPID, expectedMain, expectedHost)) return EmitStatus(Status::ProcessChanged);
  if (!RevalidateWindow(mainPID, selected)) return EmitStatus(Status::WindowChanged);

  std::vector<BYTE> png;
  status = EncodePNG(pixels, width, height, &png);
  pixels.clear();
  std::vector<BYTE>().swap(pixels);
  if (status != Status::Captured) return EmitStatus(status);
  if (!ValidatePairSnapshot(hostPID, mainPID, expectedMain, expectedHost)) return EmitStatus(Status::ProcessChanged);
  if (!RevalidateWindow(mainPID, selected)) return EmitStatus(Status::WindowChanged);
  status = WritePNG(png);
  if (status != Status::Captured) return EmitStatus(status);

  const double pointPixelScale = static_cast<double>(selected.dpi) / static_cast<double>(kDpiBase);
  return EmitStatus(Status::Captured, width, height, pointPixelScale, png.size());
}
}  // namespace

int wmain(int argc, wchar_t* argv[]) {
  if (argc == 2 && std::wcscmp(argv[1], L"--check-api") == 0) {
    try { winrt::init_apartment(winrt::apartment_type::multi_threaded); }
    catch (...) { return EmitStatus(Status::ApiUnavailable); }
    const Status status = RuntimeAPIStatus();
    return EmitStatus(status);
  }
  if (argc != 5 || std::wcscmp(argv[1], L"--capture") != 0 ||
      std::wcscmp(argv[4], L"--request-permission") != 0) {
    return EmitStatus(Status::InvalidArgs);
  }
  DWORD hostPID = 0;
  DWORD mainPID = 0;
  if (!ParsePID(argv[2], &hostPID) || !ParsePID(argv[3], &mainPID) || hostPID == mainPID) {
    return EmitStatus(Status::InvalidPID);
  }
  const int outputMode = _setmode(_fileno(stdout), _O_BINARY);
  if (outputMode == -1) return EmitStatus(Status::OutputPipeFailed);
  return RunCapture(hostPID, mainPID);
}
