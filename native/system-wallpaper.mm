/*
 * [INPUT]: 依赖 Host 从 Apple 元数据选出的 UUID/系统 HEIC、历史缓存 ID、Host 私有完整 MOV 与 ImageIO/AVFoundation。
 * [OUTPUT]: 提供只读源/有界首帧 JPEG 与固定状态；旧 list 仅为兼容入口，不代表当前活动目录；不请求录屏权限或联网。
 * [POS]: 同一 helper 的素材解码器。Host 授权来源，native 校验初次打开；AVURLAsset 按路径解码，不隔离同 UID 并发改写。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#import <AVFoundation/AVFoundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>
#include "system-wallpaper.h"
#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>
#include <vector>

namespace {

static constexpr size_t kMaxImageBytes = 64 * 1024 * 1024;
static constexpr size_t kMaxVideoBytes = 256 * 1024 * 1024;
static constexpr size_t kMaxJPEGBytes = 8 * 1024 * 1024;
static constexpr size_t kMaxDimension = 2600;

static constexpr char kGoldenGateID[] = "system-wallpaper-golden-gate";
static constexpr char kGoldenGateSunsetID[] = "system-wallpaper-golden-gate-sunset";
static constexpr char kTahoeID[] = "system-wallpaper-tahoe";
static constexpr char kTahoeDayID[] = "system-wallpaper-tahoe-day";

static constexpr char kTahoeLightPath[] = "/System/Library/ExtensionKit/Extensions/NeptuneOneWallpaper.appex/Contents/Resources/TahoeLight.heic";

enum class Status {
  Listed,
  Loaded,
  InvalidRequest,
  Unavailable,
  ReadFailed,
  DecodeFailed,
  JPEGEncodeFailed,
  ByteBudgetExceeded,
  HelperFailed,
  OutputFailed
};

struct Wallpaper {
  const char *id;
  const char *name;
  const char *cacheUUID;
  bool downloadable;
  bool supportsVideo;
};

struct OpenSource {
  int fd = -1;
  struct stat info = {};
  char path[PATH_MAX] = {};
};

static const Wallpaper kWallpapers[] = {
    {kGoldenGateID, "Golden Gate", "4DFE24ED-71CC-42D4-9FE8-3B8959B6CC19", true, true},
    {kGoldenGateSunsetID, "Golden Gate Sunset", "4207734D-74FE-4F92-B5E1-6EC8DEE24A15", true, true},
    {kTahoeID, "Tahoe", nullptr, false, false},
    {kTahoeDayID, "Tahoe Day", "4C108785-A7BA-422E-9C79-B0129F1D5550", true, true},
};

static const char *StatusName(Status status) {
  switch (status) {
    case Status::Listed: return "listed";
    case Status::Loaded: return "loaded";
    case Status::InvalidRequest: return "invalid-request";
    case Status::Unavailable: return "unavailable";
    case Status::DecodeFailed: return "decode-failed";
    case Status::ByteBudgetExceeded: return "byte-budget-exceeded";
    case Status::ReadFailed:
    case Status::JPEGEncodeFailed:
    case Status::OutputFailed:
    case Status::HelperFailed: return "helper-failed";
  }
  return "helper-failed";
}

static const char *DiagnosticName(Status status, bool downloadable = false) {
  if (status == Status::Unavailable && downloadable) return "download-required";
  switch (status) {
    case Status::InvalidRequest: return "wallpaper-invalid-request";
    case Status::Unavailable: return "wallpaper-unavailable";
    case Status::ReadFailed: return "wallpaper-read-failed";
    case Status::DecodeFailed: return "wallpaper-decode-failed";
    case Status::JPEGEncodeFailed: return "wallpaper-jpeg-encode-failed";
    case Status::ByteBudgetExceeded: return "wallpaper-byte-budget-exceeded";
    case Status::OutputFailed: return "wallpaper-output-failed";
    case Status::HelperFailed: return "wallpaper-helper-failed";
    default: return "helper-failed";
  }
}

static int ExitCode(Status status) {
  switch (status) {
    case Status::Listed:
    case Status::Loaded: return 0;
    case Status::InvalidRequest: return 2;
    case Status::Unavailable: return 3;
    case Status::DecodeFailed: return 4;
    case Status::ByteBudgetExceeded: return 5;
    case Status::ReadFailed:
    case Status::JPEGEncodeFailed:
    case Status::HelperFailed:
    case Status::OutputFailed: return 6;
  }
  return 6;
}

static int WriteAll(int fd, const uint8_t *bytes, size_t length) {
  size_t written = 0;
  while (written < length) {
    ssize_t result = write(fd, bytes + written, length - written);
    if (result < 0 && errno == EINTR) continue;
    if (result <= 0) return -1;
    written += static_cast<size_t>(result);
  }
  return 0;
}

static int EmitStatus(Status status, const char *id = nullptr, bool downloadable = false) {
  char json[256];
  if (id != nullptr) {
    snprintf(json, sizeof(json), "{\"status\":\"%s\",\"id\":\"%s\",\"downloadable\":%s}\n",
             StatusName(status), id, downloadable ? "true" : "false");
  } else {
    snprintf(json, sizeof(json), "{\"status\":\"%s\"}\n", StatusName(status));
  }
  if (WriteAll(STDOUT_FILENO, reinterpret_cast<const uint8_t *>(json), strlen(json)) != 0) {
    dprintf(STDERR_FILENO, "wallpaper-output-failed\n");
    return ExitCode(Status::OutputFailed);
  }
  if (status != Status::Listed && status != Status::Loaded) {
    dprintf(STDERR_FILENO, "%s\n", DiagnosticName(status, downloadable));
  }
  return ExitCode(status);
}

static bool SameFile(const struct stat &left, const struct stat &right) {
  return left.st_dev == right.st_dev && left.st_ino == right.st_ino && left.st_uid == right.st_uid &&
      left.st_size == right.st_size && left.st_mtime == right.st_mtime;
}

static void CloseSource(OpenSource *source) {
  if (source != nullptr && source->fd >= 0) {
    close(source->fd);
    source->fd = -1;
  }
}

static bool AdoptOwnedSource(int fd, uid_t owner, size_t maximumBytes, OpenSource *source, const char *path) {
  if (fd < 0) return false;
  if (source == nullptr || path == nullptr || path[0] != '/' || strnlen(path, PATH_MAX) >= PATH_MAX) {
    close(fd);
    return false;
  }
  struct stat info = {};
  bool valid = fstat(fd, &info) == 0 && S_ISREG(info.st_mode) && info.st_uid == owner &&
      info.st_size > 0 && static_cast<uint64_t>(info.st_size) <= maximumBytes;
  if (!valid) {
    close(fd);
    return false;
  }
  source->fd = fd;
  source->info = info;
  strlcpy(source->path, path, sizeof(source->path));
  return true;
}

static bool OpenOwnedSource(const char *path, uid_t owner, size_t maximumBytes, OpenSource *source) {
  if (path == nullptr || source == nullptr || path[0] != '/' ||
      strnlen(path, PATH_MAX) >= PATH_MAX) return false;
  int fd = open(path, O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK);
  return AdoptOwnedSource(fd, owner, maximumBytes, source, path);
}

static bool SourceStillValid(const OpenSource &source, size_t maximumBytes) {
  struct stat byFD = {}, byPath = {};
  return source.fd >= 0 && fstat(source.fd, &byFD) == 0 &&
      lstat(source.path, &byPath) == 0 && S_ISREG(byPath.st_mode) &&
      SameFile(source.info, byFD) && SameFile(source.info, byPath) &&
      static_cast<uint64_t>(byFD.st_size) <= maximumBytes;
}

static NSString *UserVideoPath(const char *uuid) {
  if (uuid == nullptr) return nil;
  NSString *home = NSHomeDirectory();
  if (home.length == 0 || ![home isAbsolutePath]) return nil;
  return [home stringByAppendingPathComponent:
      [NSString stringWithFormat:@"Library/Application Support/com.apple.wallpaper/aerials/videos/%s.mov", uuid]];
}

static bool IsOwnedDirectory(int fd, uid_t owner) {
  struct stat info = {};
  return fd >= 0 && fstat(fd, &info) == 0 && S_ISDIR(info.st_mode) && info.st_uid == owner;
}

static int OpenOwnedDirectoryAt(int parentFD, const char *name, uid_t owner) {
  int fd = openat(parentFD, name, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (fd < 0) return -1;
  if (!IsOwnedDirectory(fd, owner)) {
    close(fd);
    return -1;
  }
  return fd;
}

static const Wallpaper *FindWallpaper(const char *id) {
  if (id == nullptr) return nullptr;
  for (const Wallpaper &wallpaper : kWallpapers) {
    if (strcmp(id, wallpaper.id) == 0) return &wallpaper;
  }
  return nullptr;
}

static bool IsLowerHex(char value) {
  return (value >= '0' && value <= '9') || (value >= 'a' && value <= 'f');
}

// +--- 动态身份不复用四个角色槽；只接受 UUID/摘要，来源授权仍归 Host 当前目录。 ---+
static bool CreateDynamicWallpaper(const char *id, Wallpaper *wallpaper, char *uuid) {
  if (id == nullptr || wallpaper == nullptr || uuid == nullptr) return false;
  const char *videoPrefix = "system-wallpaper-video-";
  const char *imagePrefix = "system-wallpaper-image-";
  const size_t videoPrefixLength = strlen(videoPrefix);
  if (strncmp(id, videoPrefix, videoPrefixLength) == 0) {
    const char *value = id + videoPrefixLength;
    if (strlen(value) != 36) return false;
    for (size_t i = 0; i < 36; ++i) {
      bool dash = i == 8 || i == 13 || i == 18 || i == 23;
      if (dash ? value[i] != '-' : !IsLowerHex(value[i])) return false;
      uuid[i] = value[i] >= 'a' && value[i] <= 'f' ? value[i] - ('a' - 'A') : value[i];
    }
    uuid[36] = '\0';
    *wallpaper = {id, "", uuid, true, true};
    return true;
  }
  const size_t imagePrefixLength = strlen(imagePrefix);
  if (strncmp(id, imagePrefix, imagePrefixLength) != 0 || strlen(id + imagePrefixLength) != 64) return false;
  for (size_t i = imagePrefixLength; id[i] != '\0'; ++i) if (!IsLowerHex(id[i])) return false;
  *wallpaper = {id, "", nullptr, true, true};
  return true;
}

static bool OpenCacheVideo(const Wallpaper &wallpaper, OpenSource *source) {
  if (!wallpaper.supportsVideo || wallpaper.cacheUUID == nullptr || source == nullptr) return false;
  NSString *path = UserVideoPath(wallpaper.cacheUUID);
  NSString *home = NSHomeDirectory();
  const char *homePath = home.fileSystemRepresentation;
  const char *filePath = path.fileSystemRepresentation;
  if (path == nil || home.length == 0 || ![home isAbsolutePath] || homePath == nullptr ||
      filePath == nullptr || strnlen(homePath, PATH_MAX) >= PATH_MAX ||
      strnlen(filePath, PATH_MAX) >= PATH_MAX) return false;

  uid_t owner = getuid();
  int directory = open(homePath, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (!IsOwnedDirectory(directory, owner)) {
    if (directory >= 0) close(directory);
    return false;
  }

  const char *components[] = {
      "Library", "Application Support", "com.apple.wallpaper", "aerials", "videos"};
  for (const char *component : components) {
    int next = OpenOwnedDirectoryAt(directory, component, owner);
    close(directory);
    if (next < 0) return false;
    directory = next;
  }

  char filename[48];
  int filenameLength = snprintf(filename, sizeof(filename), "%s.mov", wallpaper.cacheUUID);
  if (filenameLength <= 0 || static_cast<size_t>(filenameLength) >= sizeof(filename)) {
    close(directory);
    return false;
  }
  int fd = openat(directory, filename, O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK);
  close(directory);
  return AdoptOwnedSource(fd, owner, kMaxVideoBytes, source, filePath);
}

enum class DirectSourceKind { Missing, Image, Video };

static DirectSourceKind OpenDirectSource(const Wallpaper &wallpaper, OpenSource *source) {
  if (strcmp(wallpaper.id, kTahoeID) == 0) {
    return OpenOwnedSource(kTahoeLightPath, 0, kMaxImageBytes, source)
        ? DirectSourceKind::Image : DirectSourceKind::Missing;
  }
  return OpenCacheVideo(wallpaper, source) ? DirectSourceKind::Video : DirectSourceKind::Missing;
}

static bool IsDirectSourceAvailable(const Wallpaper &wallpaper) {
  OpenSource source;
  DirectSourceKind kind = OpenDirectSource(wallpaper, &source);
  CloseSource(&source);
  return kind != DirectSourceKind::Missing;
}

static int RunCatalog(void) {
  char json[1024];
  size_t offset = static_cast<size_t>(snprintf(json, sizeof(json), "{\"status\":\"listed\",\"entries\":["));
  for (size_t index = 0; index < sizeof(kWallpapers) / sizeof(kWallpapers[0]); ++index) {
    const Wallpaper &wallpaper = kWallpapers[index];
    int written = snprintf(json + offset, sizeof(json) - offset,
        "%s{\"id\":\"%s\",\"name\":\"%s\",\"available\":%s,\"downloadable\":%s}",
        index == 0 ? "" : ",", wallpaper.id, wallpaper.name,
        IsDirectSourceAvailable(wallpaper) ? "true" : "false",
        wallpaper.downloadable ? "true" : "false");
    if (written < 0 || static_cast<size_t>(written) >= sizeof(json) - offset) {
      return EmitStatus(Status::HelperFailed);
    }
    offset += static_cast<size_t>(written);
  }
  if (offset + 3 >= sizeof(json)) return EmitStatus(Status::HelperFailed);
  json[offset++] = ']';
  json[offset++] = '}';
  json[offset++] = '\n';
  if (WriteAll(STDOUT_FILENO, reinterpret_cast<const uint8_t *>(json), offset) != 0) {
    dprintf(STDERR_FILENO, "wallpaper-output-failed\n");
    return ExitCode(Status::OutputFailed);
  }
  return 0;
}

static Status ReadBoundedFile(OpenSource *source, size_t maximumBytes, std::vector<uint8_t> *bytes) {
  if (source == nullptr || bytes == nullptr || source->fd < 0) return Status::ReadFailed;
  if (static_cast<uint64_t>(source->info.st_size) > maximumBytes) return Status::ByteBudgetExceeded;
  if (!SourceStillValid(*source, maximumBytes)) return Status::ReadFailed;
  size_t size = static_cast<size_t>(source->info.st_size);
  bytes->clear();
  bytes->reserve(size);
  uint8_t buffer[64 * 1024];
  for (;;) {
    ssize_t count = read(source->fd, buffer, sizeof(buffer));
    if (count < 0 && errno == EINTR) continue;
    if (count < 0) return Status::ReadFailed;
    if (count == 0) break;
    if (static_cast<size_t>(count) > maximumBytes - bytes->size()) return Status::ByteBudgetExceeded;
    bytes->insert(bytes->end(), buffer, buffer + count);
  }
  if (bytes->empty() || !SourceStillValid(*source, maximumBytes)) return Status::ReadFailed;
  return bytes->size() <= maximumBytes ? Status::Loaded : Status::ByteBudgetExceeded;
}

static Status ImageFromData(const std::vector<uint8_t> &bytes, CGImageRef *image) {
  if (image == nullptr || bytes.empty() || bytes.size() > kMaxImageBytes) return Status::ByteBudgetExceeded;
  CFDataRef data = CFDataCreate(kCFAllocatorDefault, bytes.data(), static_cast<CFIndex>(bytes.size()));
  if (data == nullptr) return Status::DecodeFailed;
  CGImageSourceRef source = CGImageSourceCreateWithData(data, nullptr);
  CFRelease(data);
  if (source == nullptr) return Status::DecodeFailed;
  NSDictionary *options = @{
    (__bridge NSString *)kCGImageSourceCreateThumbnailFromImageAlways: @YES,
    (__bridge NSString *)kCGImageSourceThumbnailMaxPixelSize: @(kMaxDimension),
    (__bridge NSString *)kCGImageSourceCreateThumbnailWithTransform: @YES
  };
  CGImageRef decoded = CGImageSourceCreateThumbnailAtIndex(source, 0, (__bridge CFDictionaryRef)options);
  CFRelease(source);
  if (decoded == nullptr) return Status::DecodeFailed;
  if (CGImageGetWidth(decoded) == 0 || CGImageGetHeight(decoded) == 0 ||
      CGImageGetWidth(decoded) > kMaxDimension || CGImageGetHeight(decoded) > kMaxDimension) {
    CGImageRelease(decoded);
    return Status::ByteBudgetExceeded;
  }
  *image = decoded;
  return Status::Loaded;
}

static Status VideoFrame(const OpenSource &source, CGImageRef *image) {
  if (image == nullptr) return Status::DecodeFailed;
  if (!SourceStillValid(source, kMaxVideoBytes)) return Status::ReadFailed;
  // +--- AVURLAsset 按路径解码；前后 stat 检测漂移，不提供同 UID 进程隔离。 ---+
  NSURL *url = [NSURL fileURLWithFileSystemRepresentation:source.path isDirectory:NO relativeToURL:nil];
  if (url == nil || !url.isFileURL) return Status::InvalidRequest;
  NSDictionary *options = @{ AVURLAssetReferenceRestrictionsKey: @(AVAssetReferenceRestrictionForbidAll) };
  AVURLAsset *asset = [AVURLAsset URLAssetWithURL:url options:options];
  if (asset == nil) return Status::DecodeFailed;
  AVAssetImageGenerator *generator = [[AVAssetImageGenerator alloc] initWithAsset:asset];
  if (generator == nil) return Status::DecodeFailed;
  generator.maximumSize = CGSizeMake(kMaxDimension, kMaxDimension);
  generator.appliesPreferredTrackTransform = YES;
  NSError *error = nil;
  CMTime actualTime = kCMTimeZero;
  CGImageRef frame = [generator copyCGImageAtTime:kCMTimeZero actualTime:&actualTime error:&error];
  if (frame == nullptr) return Status::DecodeFailed;
  if (!SourceStillValid(source, kMaxVideoBytes)) {
    CGImageRelease(frame);
    return Status::ReadFailed;
  }
  if (CGImageGetWidth(frame) == 0 || CGImageGetHeight(frame) == 0 ||
      CGImageGetWidth(frame) > kMaxDimension || CGImageGetHeight(frame) > kMaxDimension) {
    CGImageRelease(frame);
    return Status::ByteBudgetExceeded;
  }
  *image = frame;
  return Status::Loaded;
}

static Status EncodeJPEG(CGImageRef image, CFDataRef *encoded) {
  if (image == nullptr || encoded == nullptr) return Status::DecodeFailed;
  CFMutableDataRef data = CFDataCreateMutable(kCFAllocatorDefault, 0);
  if (data == nullptr) return Status::JPEGEncodeFailed;
  CGImageDestinationRef destination = CGImageDestinationCreateWithData(data, CFSTR("public.jpeg"), 1, nullptr);
  if (destination == nullptr) {
    CFRelease(data);
    return Status::JPEGEncodeFailed;
  }
  NSDictionary *properties = @{(__bridge NSString *)kCGImageDestinationLossyCompressionQuality: @0.85};
  CGImageDestinationAddImage(destination, image, (__bridge CFDictionaryRef)properties);
  bool finalized = CGImageDestinationFinalize(destination);
  CFRelease(destination);
  if (!finalized) {
    CFRelease(data);
    return Status::JPEGEncodeFailed;
  }
  CFIndex length = CFDataGetLength(data);
  if (length <= 0 || static_cast<uint64_t>(length) > kMaxJPEGBytes) {
    CFRelease(data);
    return Status::ByteBudgetExceeded;
  }
  *encoded = data;
  return Status::Loaded;
}

static int EmitJPEG(const Wallpaper &wallpaper, const char *sourceType, CGImageRef image) {
  CFDataRef jpeg = nullptr;
  Status status = EncodeJPEG(image, &jpeg);
  if (status != Status::Loaded) return EmitStatus(status, wallpaper.id, wallpaper.downloadable);
  size_t width = CGImageGetWidth(image);
  size_t height = CGImageGetHeight(image);
  size_t bytes = static_cast<size_t>(CFDataGetLength(jpeg));
  char json[320];
  int length = snprintf(json, sizeof(json),
      "{\"status\":\"loaded\",\"id\":\"%s\",\"sourceType\":\"%s\",\"width\":%zu,\"height\":%zu,\"jpegBytes\":%zu}\n",
      wallpaper.id, sourceType, width, height, bytes);
  int result = length > 0 && static_cast<size_t>(length) < sizeof(json) &&
      WriteAll(STDOUT_FILENO, reinterpret_cast<const uint8_t *>(json), static_cast<size_t>(length)) == 0 &&
      WriteAll(STDOUT_FILENO, CFDataGetBytePtr(jpeg), bytes) == 0 ? 0 : ExitCode(Status::OutputFailed);
  CFRelease(jpeg);
  if (result != 0) dprintf(STDERR_FILENO, "wallpaper-output-failed\n");
  return result;
}

static int RunLocalLoad(const Wallpaper &wallpaper) {
  OpenSource source;
  DirectSourceKind kind = OpenDirectSource(wallpaper, &source);
  if (kind == DirectSourceKind::Missing) {
    return EmitStatus(Status::Unavailable, wallpaper.id, wallpaper.downloadable);
  }
  CGImageRef image = nullptr;
  Status status = Status::DecodeFailed;
  if (kind == DirectSourceKind::Image) {
    std::vector<uint8_t> bytes;
    Status readStatus = ReadBoundedFile(&source, kMaxImageBytes, &bytes);
    if (readStatus != Status::Loaded) {
      CloseSource(&source);
      return EmitStatus(readStatus, wallpaper.id, wallpaper.downloadable);
    }
    status = ImageFromData(bytes, &image);
  } else {
    status = VideoFrame(source, &image);
  }
  CloseSource(&source);
  if (status != Status::Loaded || image == nullptr) {
    return EmitStatus(status, wallpaper.id, wallpaper.downloadable);
  }
  int result = EmitJPEG(wallpaper, kind == DirectSourceKind::Image ? "image" : "video", image);
  CGImageRelease(image);
  return result;
}

static bool IsSafeHostVideoPath(const char *path) {
  if (path == nullptr || path[0] != '/' || strnlen(path, PATH_MAX) >= PATH_MAX) return false;
  size_t length = strlen(path);
  if (length < 5 || strcasecmp(path + length - 4, ".mov") != 0) return false;
  const char *cursor = path;
  while (*cursor != '\0') {
    while (*cursor == '/') ++cursor;
    const char *start = cursor;
    while (*cursor != '\0' && *cursor != '/') ++cursor;
    size_t part = static_cast<size_t>(cursor - start);
    if ((part == 1 && start[0] == '.') || (part == 2 && start[0] == '.' && start[1] == '.')) return false;
  }
  return true;
}

static bool OpenHostVideo(const char *path, OpenSource *source) {
  if (!IsSafeHostVideoPath(path) || source == nullptr) return false;
  const char *slash = strrchr(path, '/');
  if (slash == nullptr || slash == path || slash[1] == '\0') return false;
  char directory[PATH_MAX];
  size_t directoryLength = static_cast<size_t>(slash - path);
  if (directoryLength >= sizeof(directory)) return false;
  memcpy(directory, path, directoryLength);
  directory[directoryLength] = '\0';
  int directoryFD = open(directory, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (directoryFD < 0) return false;
  struct stat directoryInfo = {};
  bool secureDirectory = fstat(directoryFD, &directoryInfo) == 0 && S_ISDIR(directoryInfo.st_mode) &&
      directoryInfo.st_uid == getuid() && (directoryInfo.st_mode & (S_IRWXG | S_IRWXO)) == 0;
  if (!secureDirectory) {
    close(directoryFD);
    return false;
  }
  int fd = openat(directoryFD, slash + 1, O_RDONLY | O_NOFOLLOW | O_CLOEXEC | O_NONBLOCK);
  close(directoryFD);
  if (fd < 0) return false;
  struct stat info = {};
  bool valid = fstat(fd, &info) == 0 && S_ISREG(info.st_mode) && info.st_uid == getuid() &&
      (info.st_mode & (S_IRWXG | S_IRWXO)) == 0 && info.st_nlink == 1 && info.st_size > 0 &&
      static_cast<uint64_t>(info.st_size) <= kMaxVideoBytes;
  if (!valid) {
    close(fd);
    return false;
  }
  source->fd = fd;
  source->info = info;
  strlcpy(source->path, path, sizeof(source->path));
  return true;
}

static int RunHostVideo(const Wallpaper &wallpaper, const char *path) {
  if (!wallpaper.supportsVideo || !IsSafeHostVideoPath(path)) {
    return EmitStatus(Status::InvalidRequest, wallpaper.id, false);
  }
  OpenSource source;
  if (!OpenHostVideo(path, &source)) {
    return EmitStatus(Status::InvalidRequest, wallpaper.id, false);
  }
  CGImageRef image = nullptr;
  Status status = VideoFrame(source, &image);
  CloseSource(&source);
  if (status != Status::Loaded || image == nullptr) {
    return EmitStatus(status, wallpaper.id, false);
  }
  int result = EmitJPEG(wallpaper, "video", image);
  CGImageRelease(image);
  return result;
}

// +--- 系统静图只接受 root-owned Wallpaper 扩展资源；不开放任意 Host/Renderer 路径。 ---+
static bool IsSafeSystemImagePath(const char *path) {
  if (path == nullptr || strnlen(path, PATH_MAX) >= PATH_MAX) return false;
  NSString *value = [NSString stringWithUTF8String:path];
  if (value == nil || ![value isEqualToString:value.stringByStandardizingPath]) return false;
  NSArray<NSString *> *parts = value.pathComponents;
  if (parts.count != 9 || ![parts[0] isEqualToString:@"/"] ||
      ![parts[1] isEqualToString:@"System"] || ![parts[2] isEqualToString:@"Library"] ||
      ![parts[3] isEqualToString:@"ExtensionKit"] || ![parts[4] isEqualToString:@"Extensions"] ||
      ![parts[5] hasSuffix:@"Wallpaper.appex"] || ![parts[6] isEqualToString:@"Contents"] ||
      ![parts[7] isEqualToString:@"Resources"]) return false;
  NSString *filename = parts.lastObject;
  if (![filename hasSuffix:@"Light.heic"] || filename.length > 96) return false;
  NSCharacterSet *allowed = [NSCharacterSet characterSetWithCharactersInString:
      @"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 _-."];
  return [filename rangeOfCharacterFromSet:allowed.invertedSet].location == NSNotFound;
}

static int RunSystemImage(const Wallpaper &wallpaper, const char *path) {
  if (!IsSafeSystemImagePath(path)) return EmitStatus(Status::InvalidRequest, wallpaper.id, false);
  OpenSource source;
  if (!OpenOwnedSource(path, 0, kMaxImageBytes, &source)) return EmitStatus(Status::Unavailable, wallpaper.id, true);
  std::vector<uint8_t> bytes;
  Status status = ReadBoundedFile(&source, kMaxImageBytes, &bytes);
  CloseSource(&source);
  CGImageRef image = nullptr;
  if (status == Status::Loaded) status = ImageFromData(bytes, &image);
  if (status != Status::Loaded || image == nullptr) return EmitStatus(status, wallpaper.id, false);
  int result = EmitJPEG(wallpaper, "image", image);
  CGImageRelease(image);
  return result;
}

}  // namespace

int RunSystemWallpaperCommand(int argc, char **argv) {
  if (argc < 2 || argv == nullptr || argv[1] == nullptr) return -1;
  if (strcmp(argv[1], "--wallpaper-list") == 0) {
    return argc == 2 ? RunCatalog() : EmitStatus(Status::InvalidRequest);
  }
  if (strcmp(argv[1], "--wallpaper") == 0) {
    if (argc != 3) return EmitStatus(Status::InvalidRequest);
    Wallpaper dynamic;
    char uuid[37] = {};
    const Wallpaper *wallpaper = FindWallpaper(argv[2]);
    if (wallpaper == nullptr && CreateDynamicWallpaper(argv[2], &dynamic, uuid) && dynamic.cacheUUID != nullptr) wallpaper = &dynamic;
    return wallpaper == nullptr ? EmitStatus(Status::InvalidRequest) : RunLocalLoad(*wallpaper);
  }
  if (strcmp(argv[1], "--wallpaper-video") == 0) {
    if (argc != 4) return EmitStatus(Status::InvalidRequest);
    Wallpaper dynamic;
    char uuid[37] = {};
    const Wallpaper *wallpaper = FindWallpaper(argv[2]);
    if (wallpaper == nullptr && CreateDynamicWallpaper(argv[2], &dynamic, uuid)) wallpaper = &dynamic;
    return wallpaper == nullptr ? EmitStatus(Status::InvalidRequest) : RunHostVideo(*wallpaper, argv[3]);
  }
  if (strcmp(argv[1], "--wallpaper-system-image") == 0) {
    if (argc != 4) return EmitStatus(Status::InvalidRequest);
    Wallpaper dynamic;
    char uuid[37] = {};
    const Wallpaper *wallpaper = FindWallpaper(argv[2]);
    if (wallpaper == nullptr && CreateDynamicWallpaper(argv[2], &dynamic, uuid) && dynamic.cacheUUID == nullptr) wallpaper = &dynamic;
    return wallpaper == nullptr ? EmitStatus(Status::InvalidRequest) : RunSystemImage(*wallpaper, argv[3]);
  }
  return -1;
}
