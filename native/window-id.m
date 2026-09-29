/**
 * [INPUT]: 依赖 CoreGraphics 的在屏窗口快照与调用方传入的 Electron 主进程 PID。
 * [OUTPUT]: 输出该进程唯一可见主窗口的 CGWindowID；歧义时失败，不截其他应用。
 * [POS]: macOS 截图适配器的最小原生探针；不读取窗口内容或请求额外权限。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>
int main(int argc, const char *argv[]) {
  @autoreleasepool {
    if (argc != 2) return 2;
    char *end = NULL;
    long pid = strtol(argv[1], &end, 10);
    if (*end != '\0' || pid <= 0 || pid > INT_MAX) return 2;
    CFArrayRef windows = CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements, kCGNullWindowID);
    if (!windows) return 3;
    CGWindowID chosen = 0;
    for (NSDictionary *window in (__bridge NSArray *)windows) {
      if ([window[(NSString *)kCGWindowOwnerPID] intValue] != pid) continue;
      if ([window[(NSString *)kCGWindowLayer] intValue] != 0) continue;
      CGRect bounds;
      if (!CGRectMakeWithDictionaryRepresentation((__bridge CFDictionaryRef)window[(NSString *)kCGWindowBounds], &bounds)) continue;
      if (bounds.size.width < 200 || bounds.size.height < 200) continue;
      if (chosen != 0) { CFRelease(windows); return 4; }
      chosen = [window[(NSString *)kCGWindowNumber] unsignedIntValue];
    }
    CFRelease(windows);
    if (chosen == 0) return 5;
    printf("%u\n", chosen);
    return 0;
  }
}
