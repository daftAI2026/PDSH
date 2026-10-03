/**
 * [INPUT]: 依赖 Win32 进程令牌、进程创建时间、窗口枚举与 DWM 可见性状态；不触碰像素。
 * [OUTPUT]: 对外提供共享状态码、进程/窗口快照，以及 Host→Main 身份和唯一普通窗口的校验接口。
 * [POS]: native/windows 的身份与窗口归属边界；只有本模块证明目标后，capture helper 才能初始化 WGC。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

#include <windows.h>
#include <cstdint>
#include <string>
#include <vector>

namespace pdsh::windows_capture {
enum class Status {
  ApiReady,
  InvalidArgs,
  InvalidPID,
  ApiUnavailable,
  CallerIsNotOwnHostParent,
  HostParentMismatch,
  MainProcessUnavailable,
  OwnMainIsNotDSH,
  ProcessChanged,
  NoOrdinaryWindow,
  AmbiguousMultipleWindows,
  NativeSizeInvalidOrOverBudget,
  WindowChanged,
  CaptureTimeout,
  CaptureFailed,
  ByteBudgetExceeded,
  EncodedByteBudgetExceeded,
  PngDestinationFailed,
  PngEncodeFailed,
  OutputPipeFailed,
  Captured
};

class UniqueHandle {
 public:
  UniqueHandle() = default;
  explicit UniqueHandle(HANDLE value) : value_(value) {}
  ~UniqueHandle() { reset(); }
  UniqueHandle(const UniqueHandle&) = delete;
  UniqueHandle& operator=(const UniqueHandle&) = delete;
  UniqueHandle(UniqueHandle&& other) noexcept : value_(other.release()) {}
  UniqueHandle& operator=(UniqueHandle&& other) noexcept {
    if (this != &other) reset(other.release());
    return *this;
  }
  HANDLE get() const { return value_; }
  explicit operator bool() const { return value_ != nullptr && value_ != INVALID_HANDLE_VALUE; }
  HANDLE release() { HANDLE out = value_; value_ = nullptr; return out; }
  void reset(HANDLE next = nullptr) {
    if (*this) CloseHandle(value_);
    value_ = next;
  }
 private:
  HANDLE value_ = nullptr;
};

struct ProcessSnapshot {
  DWORD pid = 0;
  DWORD parentPID = 0;
  FILETIME created{};
  std::wstring executablePath;
  std::vector<BYTE> userSid;
  bool elevated = false;
  UniqueHandle process;
};

struct WindowSnapshot {
  HWND hwnd = nullptr;
  DWORD pid = 0;
  DWORD threadID = 0;
  RECT rect{};
  UINT dpi = 0;
  LONG_PTR style = 0;
  LONG_PTR exStyle = 0;
  uint32_t width = 0;
  uint32_t height = 0;
};
enum class WindowResolution { Found, Missing, Ambiguous };

bool ReadAndValidatePair(DWORD hostPID, DWORD mainPID, ProcessSnapshot* mainProcess,
                         ProcessSnapshot* hostProcess, Status* failure);
bool ValidatePairSnapshot(DWORD hostPID, DWORD mainPID, const ProcessSnapshot& expectedMain,
                          const ProcessSnapshot& expectedHost);
WindowResolution ResolveUniqueWindow(DWORD mainPID, WindowSnapshot* output);
bool RevalidateWindow(DWORD mainPID, const WindowSnapshot& expected);

}  // namespace pdsh::windows_capture
