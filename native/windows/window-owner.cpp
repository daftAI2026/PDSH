/**
 * [INPUT]: 依赖 window-owner.h 的 Host→Main 请求、Win32 进程令牌/代际与 DWM/窗口 API。
 * [OUTPUT]: 证明调用者的父进程链与 DeepSeek Harness 身份，解析并复核唯一可见普通主窗口。
 * [POS]: native/windows 的像素前安全门；在 WGC 初始化前拒绝 PID 重用、身份漂移和歧义窗口。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include "window-owner.h"

#include <dwmapi.h>
#include <tlhelp32.h>
#include <cwchar>
#include <utility>

namespace pdsh::windows_capture {
namespace {
bool EqualFileTime(const FILETIME& left, const FILETIME& right) {
  return left.dwLowDateTime == right.dwLowDateTime && left.dwHighDateTime == right.dwHighDateTime;
}

bool GetParentPID(DWORD pid, DWORD* parentPID) {
  if (pid == 0 || parentPID == nullptr) return false;
  UniqueHandle snapshot(CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0));
  if (!snapshot) return false;
  PROCESSENTRY32W entry{};
  entry.dwSize = sizeof(entry);
  if (!Process32FirstW(snapshot.get(), &entry)) return false;
  do {
    if (entry.th32ProcessID == pid) {
      *parentPID = entry.th32ParentProcessID;
      return *parentPID != 0;
    }
  } while (Process32NextW(snapshot.get(), &entry));
  return false;
}

bool ReadUserSID(HANDLE process, std::vector<BYTE>* sid, bool* elevated) {
  if (process == nullptr || sid == nullptr || elevated == nullptr) return false;
  HANDLE rawToken = nullptr;
  if (!OpenProcessToken(process, TOKEN_QUERY, &rawToken)) return false;
  UniqueHandle token(rawToken);
  DWORD needed = 0;
  GetTokenInformation(token.get(), TokenUser, nullptr, 0, &needed);
  if (needed < sizeof(TOKEN_USER)) return false;
  std::vector<BYTE> tokenBytes(needed);
  if (!GetTokenInformation(token.get(), TokenUser, tokenBytes.data(), needed, &needed)) return false;
  const auto* user = reinterpret_cast<const TOKEN_USER*>(tokenBytes.data());
  const DWORD sidBytes = GetLengthSid(user->User.Sid);
  if (sidBytes == 0) return false;
  sid->resize(sidBytes);
  if (!CopySid(sidBytes, sid->data(), user->User.Sid)) return false;

  TOKEN_ELEVATION elevation{};
  DWORD returned = 0;
  if (!GetTokenInformation(token.get(), TokenElevation, &elevation, sizeof(elevation), &returned)) return false;
  *elevated = elevation.TokenIsElevated != 0;
  return true;
}

std::wstring CanonicalImagePath(HANDLE process) {
  std::vector<wchar_t> raw(32768);
  DWORD length = static_cast<DWORD>(raw.size());
  if (!QueryFullProcessImageNameW(process, 0, raw.data(), &length) || length == 0 || length >= raw.size()) return {};
  std::wstring path(raw.data(), length);
  UniqueHandle file(CreateFileW(path.c_str(), FILE_READ_ATTRIBUTES,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING,
      FILE_ATTRIBUTE_NORMAL, nullptr));
  if (!file) return {};
  std::vector<wchar_t> finalPath(32768);
  DWORD finalLength = GetFinalPathNameByHandleW(file.get(), finalPath.data(),
      static_cast<DWORD>(finalPath.size()), FILE_NAME_NORMALIZED | VOLUME_NAME_DOS);
  if (finalLength == 0 || finalLength >= finalPath.size()) return {};
  std::wstring canonical(finalPath.data(), finalLength);
  if (canonical.rfind(L"\\\\?\\", 0) == 0) canonical.erase(0, 4);
  return canonical;
}

bool ReadProcessSnapshot(DWORD pid, ProcessSnapshot* output) {
  if (pid == 0 || output == nullptr) return false;
  UniqueHandle process(OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | SYNCHRONIZE, FALSE, pid));
  if (!process) return false;
  DWORD exitCode = 0;
  if (!GetExitCodeProcess(process.get(), &exitCode) || exitCode != STILL_ACTIVE) return false;
  FILETIME created{}, exited{}, kernel{}, user{};
  if (!GetProcessTimes(process.get(), &created, &exited, &kernel, &user)) return false;
  DWORD parentPID = 0;
  if (!GetParentPID(pid, &parentPID)) return false;
  std::wstring imagePath = CanonicalImagePath(process.get());
  if (imagePath.empty()) return false;
  std::vector<BYTE> sid;
  bool elevated = false;
  if (!ReadUserSID(process.get(), &sid, &elevated)) return false;

  ProcessSnapshot current;
  current.pid = pid;
  current.parentPID = parentPID;
  current.created = created;
  current.executablePath = std::move(imagePath);
  current.userSid = std::move(sid);
  current.elevated = elevated;
  current.process = std::move(process);
  *output = std::move(current);
  return true;
}

bool SameSID(const std::vector<BYTE>& left, const std::vector<BYTE>& right) {
  return !left.empty() && !right.empty() &&
      EqualSid(const_cast<BYTE*>(left.data()), const_cast<BYTE*>(right.data())) != FALSE;
}

bool SameProcess(const ProcessSnapshot& expected, const ProcessSnapshot& actual) {
  DWORD expectedExit = 0;
  DWORD actualExit = 0;
  return expected.pid == actual.pid && expected.parentPID == actual.parentPID &&
      EqualFileTime(expected.created, actual.created) &&
      _wcsicmp(expected.executablePath.c_str(), actual.executablePath.c_str()) == 0 &&
      SameSID(expected.userSid, actual.userSid) && expected.elevated == actual.elevated &&
      GetExitCodeProcess(expected.process.get(), &expectedExit) && expectedExit == STILL_ACTIVE &&
      GetExitCodeProcess(actual.process.get(), &actualExit) && actualExit == STILL_ACTIVE;
}
}  // namespace

bool ReadAndValidatePair(DWORD hostPID, DWORD mainPID, ProcessSnapshot* mainProcess,
                         ProcessSnapshot* hostProcess, Status* failure) {
  if (failure != nullptr) *failure = Status::ProcessChanged;
  if (mainProcess == nullptr || hostProcess == nullptr || failure == nullptr) return false;
  if (hostPID == mainPID) { *failure = Status::InvalidArgs; return false; }

  DWORD helperParent = 0;
  if (!GetParentPID(GetCurrentProcessId(), &helperParent) || helperParent != hostPID) {
    *failure = Status::CallerIsNotOwnHostParent;
    return false;
  }
  ProcessSnapshot mainSnapshot;
  ProcessSnapshot hostSnapshot;
  if (!ReadProcessSnapshot(mainPID, &mainSnapshot)) {
    *failure = Status::MainProcessUnavailable;
    return false;
  }
  if (!ReadProcessSnapshot(hostPID, &hostSnapshot)) return false;
  if (hostSnapshot.parentPID != mainPID) {
    *failure = Status::HostParentMismatch;
    return false;
  }

  FILETIME helperCreated{}, helperExited{}, helperKernel{}, helperUser{};
  if (!GetProcessTimes(GetCurrentProcess(), &helperCreated, &helperExited, &helperKernel, &helperUser)) {
    *failure = Status::CallerIsNotOwnHostParent;
    return false;
  }

  std::vector<BYTE> helperSID;
  bool helperElevated = false;
  if (!ReadUserSID(GetCurrentProcess(), &helperSID, &helperElevated) || helperElevated ||
      mainSnapshot.elevated || hostSnapshot.elevated ||
      !SameSID(helperSID, mainSnapshot.userSid) || !SameSID(helperSID, hostSnapshot.userSid)) {
    *failure = Status::OwnMainIsNotDSH;
    return false;
  }
  if (_wcsicmp(mainSnapshot.executablePath.c_str(), hostSnapshot.executablePath.c_str()) != 0) {
    *failure = Status::OwnMainIsNotDSH;
    return false;
  }
  const size_t lastSeparator = mainSnapshot.executablePath.find_last_of(L"\\/");
  const wchar_t* executableName = mainSnapshot.executablePath.c_str() +
      (lastSeparator == std::wstring::npos ? 0 : lastSeparator + 1);
  if (_wcsicmp(executableName, L"DeepSeek Harness.exe") != 0) {
    *failure = Status::OwnMainIsNotDSH;
    return false;
  }

  ULARGE_INTEGER mainCreated{};
  mainCreated.LowPart = mainSnapshot.created.dwLowDateTime;
  mainCreated.HighPart = mainSnapshot.created.dwHighDateTime;
  ULARGE_INTEGER hostCreated{};
  hostCreated.LowPart = hostSnapshot.created.dwLowDateTime;
  hostCreated.HighPart = hostSnapshot.created.dwHighDateTime;
  ULARGE_INTEGER helperCreatedTime{};
  helperCreatedTime.LowPart = helperCreated.dwLowDateTime;
  helperCreatedTime.HighPart = helperCreated.dwHighDateTime;
  if (mainCreated.QuadPart >= hostCreated.QuadPart || hostCreated.QuadPart > helperCreatedTime.QuadPart) {
    *failure = Status::HostParentMismatch;
    return false;
  }

  *mainProcess = std::move(mainSnapshot);
  *hostProcess = std::move(hostSnapshot);
  *failure = Status::ApiReady;
  return true;
}

bool ValidatePairSnapshot(DWORD hostPID, DWORD mainPID, const ProcessSnapshot& expectedMain,
                          const ProcessSnapshot& expectedHost) {
  ProcessSnapshot actualMain;
  ProcessSnapshot actualHost;
  Status ignored = Status::ProcessChanged;
  return ReadAndValidatePair(hostPID, mainPID, &actualMain, &actualHost, &ignored) &&
      SameProcess(expectedMain, actualMain) && SameProcess(expectedHost, actualHost);
}

namespace {
bool RectEqual(const RECT& left, const RECT& right) {
  return left.left == right.left && left.top == right.top && left.right == right.right && left.bottom == right.bottom;
}

bool ReadWindowSnapshot(HWND hwnd, DWORD expectedPID, WindowSnapshot* output) {
  if (hwnd == nullptr || output == nullptr || !IsWindow(hwnd) || !IsWindowVisible(hwnd) || IsIconic(hwnd)) return false;
  DWORD pid = 0;
  const DWORD threadID = GetWindowThreadProcessId(hwnd, &pid);
  if (threadID == 0 || pid != expectedPID || GetWindow(hwnd, GW_OWNER) != nullptr ||
      GetAncestor(hwnd, GA_ROOT) != hwnd || GetAncestor(hwnd, GA_ROOTOWNER) != hwnd) return false;
  const LONG_PTR style = GetWindowLongPtrW(hwnd, GWL_STYLE);
  const LONG_PTR exStyle = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
  if ((exStyle & WS_EX_TOOLWINDOW) != 0) return false;
  DWORD cloaked = 0;
  if (FAILED(DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, &cloaked, sizeof(cloaked))) || cloaked != 0) return false;
  RECT rect{};
  if (!GetWindowRect(hwnd, &rect) || rect.right <= rect.left || rect.bottom <= rect.top) return false;
  const UINT dpi = GetDpiForWindow(hwnd);
  if (dpi == 0) return false;
  const auto width64 = static_cast<uint64_t>(static_cast<int64_t>(rect.right) - rect.left);
  const auto height64 = static_cast<uint64_t>(static_cast<int64_t>(rect.bottom) - rect.top);
  if (width64 == 0 || height64 == 0 || width64 > UINT32_MAX || height64 > UINT32_MAX) return false;
  WindowSnapshot current;
  current.hwnd = hwnd;
  current.pid = pid;
  current.threadID = threadID;
  current.rect = rect;
  current.dpi = dpi;
  current.style = style;
  current.exStyle = exStyle;
  current.width = static_cast<uint32_t>(width64);
  current.height = static_cast<uint32_t>(height64);
  *output = current;
  return true;
}

struct WindowSearch {
  DWORD pid = 0;
  std::vector<WindowSnapshot> windows;
};

BOOL CALLBACK EnumerateMainWindow(HWND hwnd, LPARAM parameter) {
  auto* search = reinterpret_cast<WindowSearch*>(parameter);
  DWORD pid = 0;
  GetWindowThreadProcessId(hwnd, &pid);
  if (pid != search->pid) return TRUE;
  WindowSnapshot snapshot;
  if (ReadWindowSnapshot(hwnd, search->pid, &snapshot)) search->windows.push_back(snapshot);
  return search->windows.size() <= 1;
}
}  // namespace

WindowResolution ResolveUniqueWindow(DWORD mainPID, WindowSnapshot* output) {
  if (output == nullptr) return WindowResolution::Missing;
  WindowSearch search;
  search.pid = mainPID;
  SetLastError(ERROR_SUCCESS);
  const BOOL enumerated = EnumWindows(EnumerateMainWindow, reinterpret_cast<LPARAM>(&search));
  if (search.windows.size() > 1) return WindowResolution::Ambiguous;
  if (!enumerated && GetLastError() != ERROR_SUCCESS) return WindowResolution::Missing;
  if (search.windows.empty()) return WindowResolution::Missing;
  *output = search.windows.front();
  return WindowResolution::Found;
}

bool SameWindow(const WindowSnapshot& expected, const WindowSnapshot& actual) {
  return expected.hwnd == actual.hwnd && expected.pid == actual.pid &&
      expected.threadID == actual.threadID && RectEqual(expected.rect, actual.rect) &&
      expected.dpi == actual.dpi && expected.style == actual.style && expected.exStyle == actual.exStyle &&
      expected.width == actual.width && expected.height == actual.height;
}

bool RevalidateWindow(DWORD mainPID, const WindowSnapshot& expected) {
  WindowSnapshot current;
  return ResolveUniqueWindow(mainPID, &current) == WindowResolution::Found &&
      SameWindow(expected, current);
}

}  // namespace pdsh::windows_capture
