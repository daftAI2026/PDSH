/**
 * [INPUT]: capture 依赖 Host→Main 进程身份链与 CoreGraphics/ScreenCaptureKit；壁纸命令委托同目录 ImageIO/AVFoundation adapter。
 * [OUTPUT]: `--check-api` 返回无 GUI 状态；显式 capture 经权限门输出 PNG；壁纸命令列固定目录或输出有界静态 JPEG。
 * [POS]: native/ 的单 helper 主入口；capture 以启动代际拒绝 PID 重用，壁纸保持无授权、无联网并只读系统/Host素材。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>
#import <ScreenCaptureKit/ScreenCaptureKit.h>
#import <objc/runtime.h>
#import <libproc.h>
#import <sys/proc_info.h>
#import <errno.h>
#import <limits.h>
#import <math.h>
#import <memory>
#import <mutex>
#import <signal.h>
#import <stdint.h>
#import <stdio.h>
#import <stdlib.h>
#import <string.h>
#import <time.h>
#import <unistd.h>
#import "system-wallpaper.h"

static constexpr uint64_t kMaxPixels = 16ULL * 1024ULL * 1024ULL;
static constexpr uint64_t kMaxRawBytes = 128ULL * 1024ULL * 1024ULL;
static constexpr uint64_t kNanosPerSecond = 1000000000ULL;
static constexpr NSTimeInterval kContentDeadlineSeconds = 5.0;
static constexpr NSTimeInterval kCaptureDeadlineSeconds = 12.0;
static constexpr NSTimeInterval kWindowRecheckDeadlineSeconds = 3.0;

struct ProcessSnapshot {
  pid_t pid = 0;
  pid_t parentPID = 0;
  uid_t effectiveUID = 0;
  uid_t realUID = 0;
  uint64_t startSeconds = 0;
  uint64_t startMicroseconds = 0;
  char executablePath[PROC_PIDPATHINFO_MAXSIZE] = {};
  char canonicalExecutablePath[PROC_PIDPATHINFO_MAXSIZE] = {};
};

struct WindowSnapshot {
  CGWindowID windowID = kCGNullWindowID;
  CGRect frame = CGRectNull;
  CGRect contentRect = CGRectNull;
  float pointPixelScale = 0.0f;
  size_t pixelWidth = 0;
  size_t pixelHeight = 0;
};

enum class Status {
  ApiReady,
  InvalidArgs,
  InvalidPID,
  RequiresMacOS14,
  APIUnavailable,
  CallerIsNotOwnHostParent,
  HostParentMismatch,
  MainProcessUnavailable,
  OwnMainIsNotDSH,
  ProcessChanged,
  PermissionNotGranted,
  ShareableContentUnavailable,
  ShareableContentTimeout,
  NoOrdinaryWindow,
  AmbiguousMultipleWindows,
  NativePixelScaleUnavailable,
  NativeSizeInvalidOrOverBudget,
  WindowChanged,
  CaptureTimeout,
  CaptureFailed,
  PixelBudgetExceeded,
  ByteBudgetExceeded,
  EncodedByteBudgetExceeded,
  PngDestinationFailed,
  PngEncodeFailed,
  OutputPipeFailed,
  Captured
};

static const char *StatusName(Status status) {
  switch (status) {
    case Status::ApiReady: return "api-ready";
    case Status::InvalidArgs: return "invalid-arguments";
    case Status::InvalidPID: return "invalid-pid";
    case Status::RequiresMacOS14: return "requires-macos-14";
    case Status::APIUnavailable: return "api-unavailable";
    case Status::CallerIsNotOwnHostParent: return "caller-is-not-own-host-parent";
    case Status::HostParentMismatch: return "host-parent-mismatch";
    case Status::MainProcessUnavailable: return "main-process-unavailable";
    case Status::OwnMainIsNotDSH: return "own-main-is-not-dsh";
    case Status::ProcessChanged: return "process-changed";
    case Status::PermissionNotGranted: return "permission-not-granted";
    case Status::ShareableContentUnavailable: return "shareable-content-unavailable";
    case Status::ShareableContentTimeout: return "shareable-content-timeout";
    case Status::NoOrdinaryWindow: return "no-ordinary-window-for-main-pid";
    case Status::AmbiguousMultipleWindows: return "ambiguous-multiple-windows-refuse";
    case Status::NativePixelScaleUnavailable: return "native-pixel-scale-unavailable";
    case Status::NativeSizeInvalidOrOverBudget: return "native-size-invalid-or-over-budget";
    case Status::WindowChanged: return "window-changed";
    case Status::CaptureTimeout: return "capture-timeout";
    case Status::CaptureFailed: return "capture-failed";
    case Status::EncodedByteBudgetExceeded: return "encoded-byte-budget-exceeded";
    case Status::PngDestinationFailed: return "png-destination-failed";
    case Status::PngEncodeFailed: return "png-encode-failed";
    case Status::PixelBudgetExceeded: return "pixel-budget-exceeded";
    case Status::ByteBudgetExceeded: return "byte-budget-exceeded";
    case Status::OutputPipeFailed: return "output-pipe-failed";
    case Status::Captured: return "captured";
  }
  return "capture-failed";
}

static int StatusExitCode(Status status) {
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
    case Status::PermissionNotGranted: return 4;
    case Status::RequiresMacOS14:
    case Status::APIUnavailable: return 5;
    default: return 6;
  }
}

static int EmitStatus(Status status, size_t width = 0, size_t height = 0,
                      float pointPixelScale = 0.0f, size_t bytes = 0) {
  if (status == Status::Captured) {
    dprintf(STDERR_FILENO,
            "{\"status\":\"%s\",\"width\":%zu,\"height\":%zu,\"pngBytes\":%zu,\"pointPixelScale\":%.4f}\n",
            StatusName(status), width, height, bytes, pointPixelScale);
  } else {
    dprintf(STDERR_FILENO, "{\"status\":\"%s\"}\n", StatusName(status));
  }
  return StatusExitCode(status);
}

static void EmitPhase(const char *phase) {
  // phase 只能由调用方传入本文件内的固定 ASCII 常量。
  dprintf(STDERR_FILENO, "phase=%s\n", phase);
  fflush(stderr);
}

static bool ParsePID(const char *text, pid_t *value) {
  if (text == nullptr || value == nullptr || *text == '\0') return false;
  for (const char *cursor = text; *cursor != '\0'; ++cursor) {
    if (*cursor < '0' || *cursor > '9') return false;
  }
  errno = 0;
  char *end = nullptr;
  long parsed = strtol(text, &end, 10);
  if (errno != 0 || end == text || *end != '\0' || parsed <= 0 || parsed > INT_MAX) return false;
  *value = static_cast<pid_t>(parsed);
  return true;
}

static bool ReadProcessSnapshot(pid_t pid, ProcessSnapshot *snapshot) {
  if (pid <= 0 || snapshot == nullptr) return false;
  struct proc_bsdinfo info = {};
  int bytes = proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, &info, sizeof(info));
  if (bytes != sizeof(info) || info.pbi_pid != static_cast<uint32_t>(pid)) return false;

  ProcessSnapshot current = {};
  current.pid = pid;
  current.parentPID = static_cast<pid_t>(info.pbi_ppid);
  current.effectiveUID = static_cast<uid_t>(info.pbi_uid);
  current.realUID = static_cast<uid_t>(info.pbi_ruid);
  current.startSeconds = info.pbi_start_tvsec;
  current.startMicroseconds = info.pbi_start_tvusec;
  int pathBytes = proc_pidpath(pid, current.executablePath, sizeof(current.executablePath));
  if (pathBytes <= 0 || static_cast<size_t>(pathBytes) >= sizeof(current.executablePath) ||
      strnlen(current.executablePath, sizeof(current.executablePath)) == sizeof(current.executablePath)) {
    return false;
  }
  if (realpath(current.executablePath, current.canonicalExecutablePath) == nullptr ||
      current.canonicalExecutablePath[0] != '/' ||
      strnlen(current.canonicalExecutablePath, sizeof(current.canonicalExecutablePath)) ==
          sizeof(current.canonicalExecutablePath)) {
    return false;
  }
  *snapshot = current;
  return true;
}

static bool SameProcess(const ProcessSnapshot &expected, const ProcessSnapshot &actual) {
  return expected.pid == actual.pid && expected.parentPID == actual.parentPID &&
      expected.effectiveUID == actual.effectiveUID && expected.realUID == actual.realUID &&
      expected.startSeconds == actual.startSeconds &&
      expected.startMicroseconds == actual.startMicroseconds &&
      strcmp(expected.executablePath, actual.executablePath) == 0 &&
      strcmp(expected.canonicalExecutablePath, actual.canonicalExecutablePath) == 0;
}

static bool IsDSHBundleExecutable(const char *executablePath) {
  if (executablePath == nullptr || executablePath[0] != '/') return false;
  NSString *path = [NSString stringWithUTF8String:executablePath];
  if (path == nil) return false;
  NSRange marker = [path rangeOfString:@"/Contents/MacOS/" options:NSBackwardsSearch];
  if (marker.location == NSNotFound) return false;
  NSString *bundlePath = [path substringToIndex:marker.location];
  if (![[bundlePath pathExtension] isEqualToString:@"app"]) return false;

  NSURL *bundleURL = [NSURL fileURLWithPath:bundlePath isDirectory:YES];
  if (bundleURL == nil) return false;
  CFBundleRef bundle = CFBundleCreate(kCFAllocatorDefault, (__bridge CFURLRef)bundleURL);
  if (bundle == nullptr) return false;
  CFStringRef identifier = CFBundleGetIdentifier(bundle);
  bool matches = identifier != nullptr &&
      CFStringCompare(identifier, CFSTR("com.deepseek.dsh"), 0) == kCFCompareEqualTo;
  CFRelease(bundle);
  return matches;
}

static bool ReadAndValidatePair(pid_t hostPID, pid_t mainPID,
                                ProcessSnapshot *mainProcess, ProcessSnapshot *hostProcess,
                                Status *failure) {
  if (failure != nullptr) *failure = Status::ProcessChanged;
  if (mainProcess == nullptr || hostProcess == nullptr || failure == nullptr) return false;
  if (hostPID == mainPID) { *failure = Status::InvalidArgs; return false; }
  if (hostPID != getppid()) { *failure = Status::CallerIsNotOwnHostParent; return false; }
  ProcessSnapshot mainSnapshot, hostSnapshot;
  if (!ReadProcessSnapshot(mainPID, &mainSnapshot)) {
    *failure = Status::MainProcessUnavailable;
    return false;
  }
  if (!ReadProcessSnapshot(hostPID, &hostSnapshot)) return false;
  if (hostSnapshot.parentPID != mainPID) {
    *failure = Status::HostParentMismatch;
    return false;
  }
  if (mainSnapshot.effectiveUID != geteuid() || hostSnapshot.effectiveUID != geteuid() ||
      mainSnapshot.realUID != getuid() || hostSnapshot.realUID != getuid()) {
    return false;
  }
  if (strcmp(mainSnapshot.canonicalExecutablePath, hostSnapshot.canonicalExecutablePath) != 0) {
    return false;
  }
  if (!IsDSHBundleExecutable(mainSnapshot.canonicalExecutablePath)) {
    *failure = Status::OwnMainIsNotDSH;
    return false;
  }
  *mainProcess = mainSnapshot;
  *hostProcess = hostSnapshot;
  *failure = Status::ApiReady;
  return true;
}

static bool ValidatePairSnapshot(pid_t hostPID, pid_t mainPID,
                                 const ProcessSnapshot &expectedMain,
                                 const ProcessSnapshot &expectedHost) {
  ProcessSnapshot actualMain, actualHost;
  Status failure = Status::ProcessChanged;
  return ReadAndValidatePair(hostPID, mainPID, &actualMain, &actualHost, &failure) &&
      SameProcess(expectedMain, actualMain) && SameProcess(expectedHost, actualHost);
}

static bool RuntimeAPIAvailable() {
  if (@available(macOS 14.0, *)) {
    Class shareableClass = NSClassFromString(@"SCShareableContent");
    Class windowClass = NSClassFromString(@"SCWindow");
    Class ownerClass = NSClassFromString(@"SCRunningApplication");
    Class filterClass = NSClassFromString(@"SCContentFilter");
    Class infoClass = NSClassFromString(@"SCShareableContentInfo");
    Class managerClass = NSClassFromString(@"SCScreenshotManager");
    Class configClass = NSClassFromString(@"SCStreamConfiguration");
    return shareableClass != Nil && windowClass != Nil && ownerClass != Nil &&
        filterClass != Nil && infoClass != Nil && managerClass != Nil && configClass != Nil &&
        class_getClassMethod(shareableClass,
            sel_registerName("getShareableContentExcludingDesktopWindows:onScreenWindowsOnly:completionHandler:")) != nullptr &&
        class_getClassMethod(shareableClass, sel_registerName("infoForFilter:")) != nullptr &&
        class_getInstanceMethod(windowClass, sel_registerName("windowID")) != nullptr &&
        class_getInstanceMethod(windowClass, sel_registerName("frame")) != nullptr &&
        class_getInstanceMethod(windowClass, sel_registerName("windowLayer")) != nullptr &&
        class_getInstanceMethod(windowClass, sel_registerName("isOnScreen")) != nullptr &&
        class_getInstanceMethod(windowClass, sel_registerName("owningApplication")) != nullptr &&
        class_getInstanceMethod(ownerClass, sel_registerName("processID")) != nullptr &&
        class_getInstanceMethod(ownerClass, sel_registerName("bundleIdentifier")) != nullptr &&
        class_getInstanceMethod(filterClass, sel_registerName("initWithDesktopIndependentWindow:")) != nullptr &&
        class_getInstanceMethod(infoClass, sel_registerName("contentRect")) != nullptr &&
        class_getInstanceMethod(infoClass, sel_registerName("pointPixelScale")) != nullptr &&
        class_getClassMethod(managerClass, sel_registerName("captureImageWithFilter:configuration:completionHandler:")) != nullptr &&
        class_getInstanceMethod(configClass, sel_registerName("setWidth:")) != nullptr &&
        class_getInstanceMethod(configClass, sel_registerName("setHeight:")) != nullptr &&
        class_getInstanceMethod(configClass, sel_registerName("setCapturesAudio:")) != nullptr &&
        class_getInstanceMethod(configClass, sel_registerName("setShowsCursor:")) != nullptr &&
        class_getInstanceMethod(configClass, sel_registerName("setIgnoreShadowsSingleWindow:")) != nullptr &&
        class_getInstanceMethod(configClass, sel_registerName("setShouldBeOpaque:")) != nullptr;
  }
  return false;
}

static Status RuntimeAPIStatus() {
  NSOperatingSystemVersion minimum = {14, 0, 0};
  if (![[NSProcessInfo processInfo] isOperatingSystemAtLeastVersion:minimum]) {
    return Status::RequiresMacOS14;
  }
  return RuntimeAPIAvailable() ? Status::ApiReady : Status::APIUnavailable;
}

static uint64_t MonotonicNanos() {
  struct timespec now = {};
  if (clock_gettime(CLOCK_MONOTONIC, &now) != 0 || now.tv_sec < 0 || now.tv_nsec < 0) return 0;
  uint64_t seconds = static_cast<uint64_t>(now.tv_sec);
  uint64_t nanos = static_cast<uint64_t>(now.tv_nsec);
  if (seconds > (UINT64_MAX - nanos) / kNanosPerSecond) return 0;
  return seconds * kNanosPerSecond + nanos;
}

static bool WaitFor(dispatch_semaphore_t gate, NSTimeInterval seconds) {
  if (gate == nullptr || !isfinite(seconds) || seconds <= 0.0) return false;
  uint64_t started = MonotonicNanos();
  uint64_t duration = static_cast<uint64_t>(seconds * static_cast<double>(kNanosPerSecond));
  if (started == 0 || duration > UINT64_MAX - started) return false;
  uint64_t deadline = started + duration;
  for (;;) {
    if (dispatch_semaphore_wait(gate, DISPATCH_TIME_NOW) == 0) return true;
    uint64_t now = MonotonicNanos();
    if (now == 0 || now >= deadline) return false;
    CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.025, true);
  }
}

static Status FetchShareableContent(NSTimeInterval timeout, SCShareableContent **content) {
  if (content == nullptr) return Status::ShareableContentUnavailable;
  dispatch_semaphore_t gate = dispatch_semaphore_create(0);
  __block SCShareableContent *received = nil;
  __block NSError *receivedError = nil;
  [SCShareableContent getShareableContentExcludingDesktopWindows:YES
      onScreenWindowsOnly:YES completionHandler:^(SCShareableContent *value, NSError *error) {
    received = value;
    receivedError = error;
    dispatch_semaphore_signal(gate);
  }];
  if (!WaitFor(gate, timeout)) return Status::ShareableContentTimeout;
  if (receivedError != nil || received == nil) return Status::ShareableContentUnavailable;
  *content = received;
  return Status::ApiReady;
}

static bool IsFiniteRect(CGRect rect) {
  return isfinite(CGRectGetMinX(rect)) && isfinite(CGRectGetMinY(rect)) &&
      isfinite(CGRectGetWidth(rect)) && isfinite(CGRectGetHeight(rect)) &&
      CGRectGetWidth(rect) > 0.0 && CGRectGetHeight(rect) > 0.0;
}

static bool SameRect(CGRect left, CGRect right) {
  return CGRectGetMinX(left) == CGRectGetMinX(right) &&
      CGRectGetMinY(left) == CGRectGetMinY(right) &&
      CGRectGetWidth(left) == CGRectGetWidth(right) &&
      CGRectGetHeight(left) == CGRectGetHeight(right);
}

static bool IsEligibleWindow(SCWindow *window, pid_t mainPID) {
  if (window == nil || window.owningApplication == nil) return false;
  SCRunningApplication *owner = window.owningApplication;
  CGRect frame = window.frame;
  // +--- 窗口尺寸不参与身份猜测；所有有效可见候选都必须通过唯一性门 ---+
  return owner.processID == mainPID &&
      [owner.bundleIdentifier isEqualToString:@"com.deepseek.dsh"] &&
      window.windowLayer == 0 && window.isOnScreen && IsFiniteRect(frame);
}

enum class WindowResolution { Found, None, Ambiguous };

static WindowResolution ResolveUniqueWindow(SCShareableContent *content, pid_t mainPID,
                                            SCWindow **window, WindowSnapshot *snapshot) {
  if (content == nil || window == nullptr || snapshot == nullptr) return WindowResolution::None;
  SCWindow *match = nil;
  size_t count = 0;
  for (SCWindow *candidate in content.windows) {
    if (!IsEligibleWindow(candidate, mainPID)) continue;
    match = candidate;
    count++;
    if (count > 1) return WindowResolution::Ambiguous;
  }
  if (count != 1 || match.windowID == kCGNullWindowID) return WindowResolution::None;
  *window = match;
  snapshot->windowID = match.windowID;
  snapshot->frame = match.frame;
  return WindowResolution::Found;
}

static Status CalculateGeometry(SCWindow *window, WindowSnapshot *snapshot) {
  if (window == nil || snapshot == nullptr) return Status::NativeSizeInvalidOrOverBudget;
  SCContentFilter *filter = [[SCContentFilter alloc] initWithDesktopIndependentWindow:window];
  if (filter == nil) return Status::NativePixelScaleUnavailable;
  SCShareableContentInfo *info = [SCShareableContent infoForFilter:filter];
  if (info == nil) return Status::NativePixelScaleUnavailable;
  CGRect contentRect = info.contentRect;
  double scale = info.pointPixelScale;
  if (!IsFiniteRect(contentRect) || !isfinite(scale) || scale <= 0.0) {
    return Status::NativePixelScaleUnavailable;
  }
  double rawWidth = ceil(CGRectGetWidth(contentRect) * scale);
  double rawHeight = ceil(CGRectGetHeight(contentRect) * scale);
  if (!isfinite(rawWidth) || !isfinite(rawHeight) || rawWidth < 1.0 || rawHeight < 1.0 ||
      rawWidth > static_cast<double>(SIZE_MAX) || rawHeight > static_cast<double>(SIZE_MAX)) {
    return Status::NativeSizeInvalidOrOverBudget;
  }
  uint64_t width = static_cast<uint64_t>(rawWidth);
  uint64_t height = static_cast<uint64_t>(rawHeight);
  if (width == 0 || height == 0) return Status::NativeSizeInvalidOrOverBudget;
  if (width > kMaxPixels / height || width * height > kMaxPixels) {
    return Status::PixelBudgetExceeded;
  }
  if (width > kMaxRawBytes / 4ULL / height) return Status::ByteBudgetExceeded;
  snapshot->contentRect = contentRect;
  snapshot->pointPixelScale = static_cast<float>(scale);
  snapshot->pixelWidth = static_cast<size_t>(width);
  snapshot->pixelHeight = static_cast<size_t>(height);
  return Status::ApiReady;
}

static bool RevalidateWindow(pid_t mainPID, const WindowSnapshot &expected,
                             NSTimeInterval timeout) {
  SCShareableContent *content = nil;
  if (FetchShareableContent(timeout, &content) != Status::ApiReady) return false;
  SCWindow *window = nil;
  WindowSnapshot current;
  return ResolveUniqueWindow(content, mainPID, &window, &current) == WindowResolution::Found &&
      current.windowID == expected.windowID && SameRect(current.frame, expected.frame) &&
      CalculateGeometry(window, &current) == Status::ApiReady &&
      SameRect(current.contentRect, expected.contentRect) &&
      current.pointPixelScale == expected.pointPixelScale &&
      current.pixelWidth == expected.pixelWidth && current.pixelHeight == expected.pixelHeight;
}

static Status CaptureOneFrame(SCContentFilter *filter, SCStreamConfiguration *configuration,
                              NSTimeInterval timeout, CGImageRef *image) {
  if (filter == nil || configuration == nil || image == nullptr) return Status::CaptureFailed;
  dispatch_semaphore_t gate = dispatch_semaphore_create(0);
  struct CaptureState {
    std::mutex mutex;
    CGImageRef image = nullptr;
    NSError *__strong error = nil;
    bool finished = false;
    bool abandoned = false;
  };
  auto state = std::make_shared<CaptureState>();
  [SCScreenshotManager captureImageWithFilter:filter configuration:configuration
      completionHandler:^(CGImageRef value, NSError *error) {
    CGImageRef retained = value == nullptr ? nullptr : CGImageRetain(value);
    bool releaseLateImage = false;
    {
      std::lock_guard<std::mutex> lock(state->mutex);
      if (state->abandoned || state->finished) {
        releaseLateImage = retained != nullptr;
      } else {
        state->image = retained;
        state->error = error;
        state->finished = true;
      }
    }
    if (releaseLateImage) CGImageRelease(retained);
    dispatch_semaphore_signal(gate);
  }];
  if (!WaitFor(gate, timeout)) {
    std::lock_guard<std::mutex> lock(state->mutex);
    if (!state->finished) {
      state->abandoned = true;
      return Status::CaptureTimeout;
    }
  }
  CGImageRef captured = nullptr;
  NSError *__strong captureError = nil;
  {
    std::lock_guard<std::mutex> lock(state->mutex);
    captured = state->image;
    state->image = nullptr;
    captureError = state->error;
    state->error = nil;
  }
  if (captureError != nil || captured == nullptr) {
    if (captured != nullptr) CGImageRelease(captured);
    return Status::CaptureFailed;
  }
  *image = captured;
  return Status::Captured;
}

static Status EncodePNG(CGImageRef image, size_t expectedWidth, size_t expectedHeight,
                        CFDataRef *encoded) {
  if (image == nullptr || encoded == nullptr) return Status::PngEncodeFailed;
  size_t width = CGImageGetWidth(image);
  size_t height = CGImageGetHeight(image);
  size_t rowBytes = CGImageGetBytesPerRow(image);
  if (width == 0 || height == 0 || width != expectedWidth || height != expectedHeight ||
      width > kMaxPixels / height || static_cast<uint64_t>(width) * height > kMaxPixels) {
    return Status::NativeSizeInvalidOrOverBudget;
  }
  if (rowBytes == 0 || height > kMaxRawBytes / rowBytes ||
      static_cast<uint64_t>(rowBytes) * height > kMaxRawBytes) {
    return Status::ByteBudgetExceeded;
  }

  CFMutableDataRef data = CFDataCreateMutable(kCFAllocatorDefault, 0);
  if (data == nullptr) return Status::PngEncodeFailed;
  CGImageDestinationRef destination = CGImageDestinationCreateWithData(data, CFSTR("public.png"), 1, nullptr);
  if (destination == nullptr) {
    CFRelease(data);
    return Status::PngDestinationFailed;
  }
  CGImageDestinationAddImage(destination, image, nullptr);
  bool finalized = CGImageDestinationFinalize(destination);
  CFRelease(destination);
  if (!finalized) {
    CFRelease(data);
    return Status::PngEncodeFailed;
  }

  CFIndex length = CFDataGetLength(data);
  if (length <= 0 || static_cast<uint64_t>(length) > kMaxRawBytes) {
    CFRelease(data);
    return Status::EncodedByteBudgetExceeded;
  }
  *encoded = data;
  return Status::Captured;
}

static Status WritePNG(CFDataRef data, size_t *encodedBytes) {
  if (data == nullptr || encodedBytes == nullptr) return Status::OutputPipeFailed;
  CFIndex length = CFDataGetLength(data);
  if (length <= 0 || static_cast<uint64_t>(length) > kMaxRawBytes) return Status::EncodedByteBudgetExceeded;
  const UInt8 *bytes = CFDataGetBytePtr(data);
  size_t written = 0;
  while (written < static_cast<size_t>(length)) {
    ssize_t count = write(STDOUT_FILENO, bytes + written, static_cast<size_t>(length) - written);
    if (count < 0 && errno == EINTR) continue;
    if (count <= 0) {
      return Status::OutputPipeFailed;
    }
    written += static_cast<size_t>(count);
  }
  *encodedBytes = written;
  return Status::Captured;
}

static int RunCapture(pid_t hostPID, pid_t mainPID) {
  ProcessSnapshot expectedMain, expectedHost;
  // +--- 所有真实身份门必须先于 AppKit 初始化和任意 TCC/ScreenCaptureKit 调用 ---+
  Status initialFailure = Status::ProcessChanged;
  if (!ReadAndValidatePair(hostPID, mainPID, &expectedMain, &expectedHost, &initialFailure)) {
    return EmitStatus(initialFailure);
  }
  Status apiStatus = RuntimeAPIStatus();
  if (apiStatus != Status::ApiReady) return EmitStatus(apiStatus);

  [NSApplication sharedApplication];
  [NSApp setActivationPolicy:NSApplicationActivationPolicyProhibited];

  if (!ValidatePairSnapshot(hostPID, mainPID, expectedMain, expectedHost)) {
    return EmitStatus(Status::ProcessChanged);
  }
  if (!CGPreflightScreenCaptureAccess()) {
    if (!ValidatePairSnapshot(hostPID, mainPID, expectedMain, expectedHost)) {
      return EmitStatus(Status::ProcessChanged);
    }
    EmitPhase("authorization-required");
    if (!ValidatePairSnapshot(hostPID, mainPID, expectedMain, expectedHost)) {
      return EmitStatus(Status::ProcessChanged);
    }
    (void)CGRequestScreenCaptureAccess();
    if (!ValidatePairSnapshot(hostPID, mainPID, expectedMain, expectedHost)) {
      return EmitStatus(Status::ProcessChanged);
    }
  }

  if (!ValidatePairSnapshot(hostPID, mainPID, expectedMain, expectedHost)) {
    return EmitStatus(Status::ProcessChanged);
  }
  if (!CGPreflightScreenCaptureAccess()) return EmitStatus(Status::PermissionNotGranted);
  if (!ValidatePairSnapshot(hostPID, mainPID, expectedMain, expectedHost)) {
    return EmitStatus(Status::ProcessChanged);
  }
  EmitPhase("capture-ready");

  SCShareableContent *content = nil;
  Status contentStatus = FetchShareableContent(kContentDeadlineSeconds, &content);
  if (contentStatus != Status::ApiReady) return EmitStatus(contentStatus);
  if (!ValidatePairSnapshot(hostPID, mainPID, expectedMain, expectedHost)) {
    return EmitStatus(Status::ProcessChanged);
  }

  SCWindow *window = nil;
  WindowSnapshot selected;
  WindowResolution resolution = ResolveUniqueWindow(content, mainPID, &window, &selected);
  if (resolution == WindowResolution::Ambiguous) {
    return EmitStatus(Status::AmbiguousMultipleWindows);
  }
  if (resolution != WindowResolution::Found) {
    return EmitStatus(Status::NoOrdinaryWindow);
  }
  Status geometryStatus = CalculateGeometry(window, &selected);
  if (geometryStatus != Status::ApiReady) return EmitStatus(geometryStatus);
  SCContentFilter *filter = [[SCContentFilter alloc] initWithDesktopIndependentWindow:window];
  if (filter == nil) return EmitStatus(Status::ShareableContentUnavailable);

  SCStreamConfiguration *configuration = [SCStreamConfiguration new];
  configuration.width = selected.pixelWidth;
  configuration.height = selected.pixelHeight;
  configuration.capturesAudio = NO;
  configuration.showsCursor = NO;
  configuration.ignoreShadowsSingleWindow = YES;
  configuration.shouldBeOpaque = NO;

  CGImageRef image = nullptr;
  Status captureStatus = CaptureOneFrame(filter, configuration, kCaptureDeadlineSeconds, &image);
  if (captureStatus != Status::Captured) return EmitStatus(captureStatus);
  if (!ValidatePairSnapshot(hostPID, mainPID, expectedMain, expectedHost)) {
    CGImageRelease(image);
    return EmitStatus(Status::ProcessChanged);
  }
  if (!RevalidateWindow(mainPID, selected, kWindowRecheckDeadlineSeconds)) {
    CGImageRelease(image);
    return EmitStatus(Status::WindowChanged);
  }

  CFDataRef png = nullptr;
  Status status = EncodePNG(image, selected.pixelWidth, selected.pixelHeight, &png);
  if (status != Status::Captured) {
    CGImageRelease(image);
    return EmitStatus(status);
  }
  if (!ValidatePairSnapshot(hostPID, mainPID, expectedMain, expectedHost)) {
    CFRelease(png);
    CGImageRelease(image);
    return EmitStatus(Status::ProcessChanged);
  }
  if (!RevalidateWindow(mainPID, selected, kWindowRecheckDeadlineSeconds)) {
    CFRelease(png);
    CGImageRelease(image);
    return EmitStatus(Status::WindowChanged);
  }
  size_t encodedBytes = 0;
  status = WritePNG(png, &encodedBytes);
  CFRelease(png);
  size_t width = CGImageGetWidth(image);
  size_t height = CGImageGetHeight(image);
  CGImageRelease(image);
  return EmitStatus(status, width, height, selected.pointPixelScale, encodedBytes);
}

int main(int argc, char **argv) {
  @autoreleasepool {
    signal(SIGPIPE, SIG_IGN);
    int wallpaperResult = RunSystemWallpaperCommand(argc, argv);
    if (wallpaperResult >= 0) return wallpaperResult;
    if (argc == 2 && strcmp(argv[1], "--check-api") == 0) {
      Status status = RuntimeAPIStatus();
      EmitStatus(status);
      return StatusExitCode(status);
    }
    if (argc != 5 || strcmp(argv[1], "--capture") != 0 ||
        strcmp(argv[4], "--request-permission") != 0) {
      return EmitStatus(Status::InvalidArgs);
    }
    pid_t hostPID = 0;
    pid_t mainPID = 0;
    if (!ParsePID(argv[2], &hostPID) || !ParsePID(argv[3], &mainPID) || hostPID == mainPID) {
      return EmitStatus(Status::InvalidPID);
    }
    return RunCapture(hostPID, mainPID);
  }
}
