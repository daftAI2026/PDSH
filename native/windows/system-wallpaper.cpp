/**
 * [INPUT]: 依赖 Win32 固定系统目录/文件句柄、BCrypt SHA-256 与 Windows Imaging Component。
 * [OUTPUT]: 提供有界列表与单图 JPEG；stdout 承载协议，stderr 仅承载闭集错误 JSON。
 * [POS]: Windows x64 helper 的系统壁纸后端；源仅为本机 img0/img19，不触碰用户壁纸、锁屏或网络。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include "system-wallpaper.h"
#include <windows.h>
#include <bcrypt.h>
#include <wincodec.h>
#include <wrl/client.h>
#include <algorithm>
#include <array>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <cwchar>
#include <fcntl.h>
#include <io.h>
#include <initializer_list>
#include <limits>
#include <string>
#include <utility>
#include <vector>

using Microsoft::WRL::ComPtr;

namespace pdsh::windows_wallpaper {
namespace {
constexpr uint64_t kMaxSourceBytes = 64ULL * 1024ULL * 1024ULL;
constexpr uint64_t kMaxPixels = 32ULL * 1024ULL * 1024ULL;
constexpr uint64_t kMaxRawBytes = 128ULL * 1024ULL * 1024ULL;
constexpr uint32_t kMaxDimension = 2600;
constexpr uint64_t kMaxJpegBytes = 8ULL * 1024ULL * 1024ULL;
constexpr size_t kSha256Bytes = 32;

enum class Failure {
  InvalidRequest,
  Unavailable,
  ReadFailed,
  DecodeFailed,
  JpegEncodeFailed,
  ByteBudgetExceeded,
  OutputFailed,
  HelperFailed,
};

struct Source {
  const wchar_t* filename;
  const char* token;
  const char* name;
};

constexpr Source kSources[] = {
  {L"img0.jpg", "img0", "Windows \xC2\xB7 img0"},
  {L"img19.jpg", "img19", "Windows \xC2\xB7 img19"},
};

const char* FailureName(Failure failure) {
  switch (failure) {
    case Failure::InvalidRequest: return "wallpaper-invalid-request";
    case Failure::Unavailable: return "wallpaper-unavailable";
    case Failure::ReadFailed: return "wallpaper-read-failed";
    case Failure::DecodeFailed: return "wallpaper-decode-failed";
    case Failure::JpegEncodeFailed: return "wallpaper-jpeg-encode-failed";
    case Failure::ByteBudgetExceeded: return "wallpaper-byte-budget-exceeded";
    case Failure::OutputFailed: return "wallpaper-output-failed";
    case Failure::HelperFailed: return "wallpaper-helper-failed";
  }
  return "wallpaper-helper-failed";
}

int FailureExitCode(Failure failure) {
  return failure == Failure::InvalidRequest ? 2 : 6;
}

int EmitError(Failure failure) {
  char diagnostic[96]{};
  const int length = std::snprintf(diagnostic, sizeof(diagnostic),
      "{\"status\":\"%s\"}\n", FailureName(failure));
  HANDLE output = GetStdHandle(STD_ERROR_HANDLE);
  if (length <= 0 || length >= static_cast<int>(sizeof(diagnostic)) ||
      output == nullptr || output == INVALID_HANDLE_VALUE) return FailureExitCode(failure);
  DWORD written = 0;
  if (!WriteFile(output, diagnostic, static_cast<DWORD>(length), &written, nullptr) ||
      written != static_cast<DWORD>(length)) return FailureExitCode(failure);
  return FailureExitCode(failure);
}

bool WriteAll(HANDLE output, const void* data, size_t length) {
  if (output == nullptr || output == INVALID_HANDLE_VALUE || (data == nullptr && length != 0)) return false;
  const auto* bytes = static_cast<const BYTE*>(data);
  size_t offset = 0;
  while (offset < length) {
    const DWORD request = static_cast<DWORD>(std::min<size_t>(length - offset, MAXDWORD));
    DWORD written = 0;
    if (!WriteFile(output, bytes + offset, request, &written, nullptr) || written == 0) return false;
    offset += written;
  }
  return true;
}

class UniqueHandle {
 public:
  UniqueHandle() = default;
  explicit UniqueHandle(HANDLE handle) : handle_(handle) {}
  UniqueHandle(const UniqueHandle&) = delete;
  UniqueHandle& operator=(const UniqueHandle&) = delete;
  UniqueHandle(UniqueHandle&& other) noexcept : handle_(std::exchange(other.handle_, INVALID_HANDLE_VALUE)) {}
  UniqueHandle& operator=(UniqueHandle&& other) noexcept {
    if (this != &other) { reset(); handle_ = std::exchange(other.handle_, INVALID_HANDLE_VALUE); }
    return *this;
  }
  ~UniqueHandle() { reset(); }
  HANDLE get() const { return handle_; }
  void reset(HANDLE next = INVALID_HANDLE_VALUE) {
    if (handle_ != nullptr && handle_ != INVALID_HANDLE_VALUE) CloseHandle(handle_);
    handle_ = next;
  }
 private:
  HANDLE handle_ = INVALID_HANDLE_VALUE;
};

struct FileIdentity {
  ULONGLONG volume = 0;
  BYTE id[16]{};
};

enum class DirectoryStatus { Ready, Missing, Failed };

bool ReadIdentity(HANDLE handle, FileIdentity* identity) {
  if (handle == nullptr || handle == INVALID_HANDLE_VALUE || identity == nullptr) return false;
  FILE_ID_INFO info{};
  if (!GetFileInformationByHandleEx(handle, FileIdInfo, &info, sizeof(info))) return false;
  identity->volume = info.VolumeSerialNumber;
  std::memcpy(identity->id, info.FileId.Identifier, sizeof(identity->id));
  return true;
}

bool SameIdentity(const FileIdentity& left, const FileIdentity& right) {
  return left.volume == right.volume && std::memcmp(left.id, right.id, sizeof(left.id)) == 0;
}

bool IsDriveRootedPath(const std::wstring& path) {
  return path.size() >= 3 && ((path[0] >= L'A' && path[0] <= L'Z') || (path[0] >= L'a' && path[0] <= L'z'))
      && path[1] == L':' && path[2] == L'\\' && path.find(L'\0') == std::wstring::npos;
}

std::wstring Join(const std::wstring& parent, const wchar_t* child) {
  std::wstring result = parent;
  if (!result.empty() && result.back() != L'\\') result.push_back(L'\\');
  result += child;
  return result;
}

DirectoryStatus OpenCheckedDirectory(const std::wstring& path, UniqueHandle* handle, FileIdentity* identity) {
  if (handle == nullptr || identity == nullptr) return DirectoryStatus::Failed;
  HANDLE raw = CreateFileW(path.c_str(), FILE_READ_ATTRIBUTES,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING,
      FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
  if (raw == INVALID_HANDLE_VALUE) {
    const DWORD error = GetLastError();
    return error == ERROR_FILE_NOT_FOUND || error == ERROR_PATH_NOT_FOUND
        ? DirectoryStatus::Missing : DirectoryStatus::Failed;
  }
  UniqueHandle opened(raw);
  FILE_ATTRIBUTE_TAG_INFO tag{};
  if (!GetFileInformationByHandleEx(opened.get(), FileAttributeTagInfo, &tag, sizeof(tag)) ||
      (tag.FileAttributes & FILE_ATTRIBUTE_DIRECTORY) == 0 ||
      (tag.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT) != 0 || !ReadIdentity(opened.get(), identity)) {
    return DirectoryStatus::Failed;
  }
  *handle = std::move(opened);
  return DirectoryStatus::Ready;
}

struct DirectoryEntry {
  std::wstring path;
  FileIdentity identity;
  UniqueHandle handle;
  DirectoryEntry(std::wstring value, FileIdentity id, UniqueHandle opened)
      : path(std::move(value)), identity(id), handle(std::move(opened)) {}
  DirectoryEntry(const DirectoryEntry&) = delete;
  DirectoryEntry& operator=(const DirectoryEntry&) = delete;
  DirectoryEntry(DirectoryEntry&&) noexcept = default;
  DirectoryEntry& operator=(DirectoryEntry&&) noexcept = default;
};

class DirectoryLayout {
 public:
  DirectoryStatus Open() {
    std::wstring root;
    if (!GetSystemWindowsPath(&root) || !IsDriveRootedPath(root)) return DirectoryStatus::Failed;
    std::wstring current = root.substr(0, 3);
    if (AppendDirectory(current) != DirectoryStatus::Ready) return DirectoryStatus::Failed;
    size_t start = 3;
    while (start < root.size()) {
      while (start < root.size() && root[start] == L'\\') ++start;
      if (start == root.size()) break;
      const size_t end = root.find(L'\\', start);
      const size_t length = (end == std::wstring::npos ? root.size() : end) - start;
      current = Join(current, root.substr(start, length).c_str());
      if (AppendDirectory(current) != DirectoryStatus::Ready) return DirectoryStatus::Failed;
      start = end == std::wstring::npos ? root.size() : end + 1;
    }
    for (const wchar_t* component : {L"Web", L"Wallpaper", L"Windows"}) {
      current = Join(current, component);
      const DirectoryStatus status = AppendDirectory(current);
      if (status != DirectoryStatus::Ready) return status;
    }
    root_ = std::move(current);
    return DirectoryStatus::Ready;
  }

  const std::wstring& root() const { return root_; }

  bool StillSame() const {
    for (const auto& entry : entries_) {
      UniqueHandle reopened;
      FileIdentity identity{};
      if (OpenCheckedDirectory(entry.path, &reopened, &identity) != DirectoryStatus::Ready ||
          !SameIdentity(entry.identity, identity)) return false;
    }
    return true;
  }

 private:
  static bool GetSystemWindowsPath(std::wstring* path) {
    if (path == nullptr) return false;
    DWORD capacity = MAX_PATH + 1;
    for (unsigned attempt = 0; attempt < 3; ++attempt) {
      std::vector<wchar_t> buffer;
      try { buffer.resize(capacity); } catch (...) { return false; }
      const UINT length = GetSystemWindowsDirectoryW(buffer.data(), capacity);
      if (length == 0) return false;
      if (length < capacity) {
        try { path->assign(buffer.data(), length); } catch (...) { return false; }
        return true;
      }
      if (length >= 32767) return false;
      capacity = length + 1;
    }
    return false;
  }

  DirectoryStatus AppendDirectory(const std::wstring& path) {
    UniqueHandle handle;
    FileIdentity identity{};
    const DirectoryStatus status = OpenCheckedDirectory(path, &handle, &identity);
    if (status != DirectoryStatus::Ready) return status;
    try { entries_.emplace_back(path, identity, std::move(handle)); } catch (...) { return DirectoryStatus::Failed; }
    return DirectoryStatus::Ready;
  }

  std::wstring root_;
  std::vector<DirectoryEntry> entries_;
};

struct FileSnapshot {
  FileIdentity identity;
  LONGLONG size = 0;
  LONGLONG lastWrite = 0;
  LONGLONG change = 0;
  DWORD attributes = 0;
};

bool ReadFileSnapshot(HANDLE handle, FileSnapshot* snapshot) {
  if (snapshot == nullptr) return false;
  FILE_ATTRIBUTE_TAG_INFO tag{};
  FILE_STANDARD_INFO standard{};
  FILE_BASIC_INFO basic{};
  if (!GetFileInformationByHandleEx(handle, FileAttributeTagInfo, &tag, sizeof(tag)) ||
      (tag.FileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0 ||
      (tag.FileAttributes & (FILE_ATTRIBUTE_REPARSE_POINT | FILE_ATTRIBUTE_DEVICE)) != 0 ||
      !GetFileInformationByHandleEx(handle, FileStandardInfo, &standard, sizeof(standard)) || standard.Directory ||
      !GetFileInformationByHandleEx(handle, FileBasicInfo, &basic, sizeof(basic)) ||
      !ReadIdentity(handle, &snapshot->identity)) return false;
  snapshot->size = standard.EndOfFile.QuadPart;
  snapshot->lastWrite = basic.LastWriteTime.QuadPart;
  snapshot->change = basic.ChangeTime.QuadPart;
  snapshot->attributes = tag.FileAttributes;
  return snapshot->size > 0;
}

bool SameSnapshot(const FileSnapshot& left, const FileSnapshot& right) {
  return SameIdentity(left.identity, right.identity) && left.size == right.size &&
      left.lastWrite == right.lastWrite && left.change == right.change && left.attributes == right.attributes;
}

enum class ReadResult { Loaded, Missing, Invalid, Failed, OverBudget, Changed };

ReadResult ReadSource(const DirectoryLayout& layout, const Source& source, std::vector<BYTE>* bytes) {
  if (bytes == nullptr) return ReadResult::Failed;
  const std::wstring path = Join(layout.root(), source.filename);
  HANDLE raw = CreateFileW(path.c_str(), GENERIC_READ | FILE_READ_ATTRIBUTES,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING,
      FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_SEQUENTIAL_SCAN, nullptr);
  if (raw == INVALID_HANDLE_VALUE) {
    const DWORD error = GetLastError();
    return error == ERROR_FILE_NOT_FOUND || error == ERROR_PATH_NOT_FOUND ? ReadResult::Missing : ReadResult::Failed;
  }
  UniqueHandle file(raw);
  FileSnapshot before{};
  if (!ReadFileSnapshot(file.get(), &before)) return ReadResult::Invalid;
  if (static_cast<uint64_t>(before.size) > kMaxSourceBytes ||
      static_cast<uint64_t>(before.size) > std::numeric_limits<size_t>::max()) return ReadResult::OverBudget;
  try { bytes->resize(static_cast<size_t>(before.size)); } catch (...) { return ReadResult::Failed; }
  size_t offset = 0;
  while (offset < bytes->size()) {
    const DWORD request = static_cast<DWORD>(std::min<size_t>(bytes->size() - offset, 1024 * 1024));
    DWORD read = 0;
    if (!ReadFile(file.get(), bytes->data() + offset, request, &read, nullptr) || read == 0) {
      bytes->clear();
      return ReadResult::Failed;
    }
    offset += read;
  }
  BYTE extra = 0;
  DWORD extraRead = 0;
  if (!ReadFile(file.get(), &extra, 1, &extraRead, nullptr) || extraRead != 0) {
    bytes->clear();
    return ReadResult::Changed;
  }
  FileSnapshot after{};
  if (!ReadFileSnapshot(file.get(), &after) || !SameSnapshot(before, after) || !layout.StillSame()) {
    bytes->clear();
    return ReadResult::Changed;
  }
  return ReadResult::Loaded;
}

bool HashSource(const Source& source, const std::vector<BYTE>& bytes, std::string* id) {
  if (id == nullptr || bytes.size() > std::numeric_limits<ULONG>::max()) return false;
  BCRYPT_ALG_HANDLE algorithm = nullptr;
  BCRYPT_HASH_HANDLE hash = nullptr;
  std::vector<BYTE> object;
  bool ok = false;
  DWORD objectLength = 0, resultLength = 0;
  std::array<BYTE, kSha256Bytes> digest{};
  static const BYTE domain[] = "PDSH/windows-system-wallpaper/v1\0";
  static const BYTE separator = 0;
  if (BCryptOpenAlgorithmProvider(&algorithm, BCRYPT_SHA256_ALGORITHM, nullptr, 0) < 0) goto done;
  if (BCryptGetProperty(algorithm, BCRYPT_OBJECT_LENGTH, reinterpret_cast<PUCHAR>(&objectLength),
      sizeof(objectLength), &resultLength, 0) < 0 || objectLength == 0) goto done;
  try { object.resize(objectLength); } catch (...) { goto done; }
  if (BCryptCreateHash(algorithm, &hash, object.data(), objectLength, nullptr, 0, 0) < 0) goto done;
  if (BCryptHashData(hash, const_cast<PUCHAR>(domain), static_cast<ULONG>(sizeof(domain) - 1), 0) < 0 ||
      BCryptHashData(hash, const_cast<PUCHAR>(reinterpret_cast<const BYTE*>(source.token)),
          static_cast<ULONG>(std::strlen(source.token)), 0) < 0 ||
      BCryptHashData(hash, const_cast<PUCHAR>(&separator), 1, 0) < 0 ||
      (!bytes.empty() && BCryptHashData(hash, const_cast<PUCHAR>(bytes.data()), static_cast<ULONG>(bytes.size()), 0) < 0) ||
      BCryptFinishHash(hash, digest.data(), static_cast<ULONG>(digest.size()), 0) < 0) goto done;
  try {
    static constexpr char hex[] = "0123456789abcdef";
    id->assign("system-wallpaper-image-");
    for (BYTE value : digest) { id->push_back(hex[value >> 4]); id->push_back(hex[value & 0x0f]); }
  } catch (...) { goto done; }
  ok = true;
done:
  if (hash != nullptr) BCryptDestroyHash(hash);
  if (algorithm != nullptr) BCryptCloseAlgorithmProvider(algorithm, 0);
  return ok;
}

bool IsValidId(const wchar_t* id) {
  static constexpr wchar_t prefix[] = L"system-wallpaper-image-";
  if (id == nullptr || std::wcslen(id) != (sizeof(prefix) / sizeof(prefix[0]) - 1) + 64 ||
      std::wcsncmp(id, prefix, sizeof(prefix) / sizeof(prefix[0]) - 1) != 0) return false;
  const wchar_t* value = id + (sizeof(prefix) / sizeof(prefix[0]) - 1);
  for (size_t index = 0; index < 64; ++index) {
    if (!((value[index] >= L'0' && value[index] <= L'9') || (value[index] >= L'a' && value[index] <= L'f'))) return false;
  }
  return true;
}

bool WriteCatalog(const DirectoryLayout& layout) {
  std::string json = "{\"entries\":[";
  size_t count = 0;
  for (const auto& source : kSources) {
    std::vector<BYTE> bytes;
    if (ReadSource(layout, source, &bytes) != ReadResult::Loaded) continue;
    std::string id;
    if (!HashSource(source, bytes, &id)) continue;
    if (count++ != 0) json.push_back(',');
    json += "{\"id\":\"" + id + "\",\"name\":\"" + source.name +
        "\",\"available\":true,\"downloadable\":false}";
  }
  json += "],\"status\":\"listed\"}\n";
  return WriteAll(GetStdHandle(STD_OUTPUT_HANDLE), json.data(), json.size());
}

class Apartment {
 public:
  Apartment() : result_(CoInitializeEx(nullptr, COINIT_MULTITHREADED)) {}
  ~Apartment() { if (SUCCEEDED(result_)) CoUninitialize(); }
  bool ready() const { return SUCCEEDED(result_); }
 private:
  HRESULT result_;
};

bool InitializeWic(ComPtr<IWICImagingFactory>* factory) {
  return factory != nullptr && SUCCEEDED(CoCreateInstance(CLSID_WICImagingFactory, nullptr,
      CLSCTX_INPROC_SERVER, IID_PPV_ARGS(factory->ReleaseAndGetAddressOf())));
}

bool EncodeJpeg(const std::vector<BYTE>& sourceBytes, std::vector<BYTE>* jpeg,
                uint32_t* width, uint32_t* height, Failure* failure) {
  if (jpeg == nullptr || width == nullptr || height == nullptr || failure == nullptr) return false;
  *failure = Failure::DecodeFailed;
  if (sourceBytes.empty() || sourceBytes.size() > MAXDWORD) return false;
  Apartment apartment;
  if (!apartment.ready()) return false;
  ComPtr<IWICImagingFactory> factory;
  if (!InitializeWic(&factory)) return false;
  ComPtr<IWICStream> inputStream;
  if (FAILED(factory->CreateStream(&inputStream)) ||
      FAILED(inputStream->InitializeFromMemory(const_cast<BYTE*>(sourceBytes.data()),
          static_cast<DWORD>(sourceBytes.size())))) return false;
  ComPtr<IWICBitmapDecoder> decoder;
  if (FAILED(factory->CreateDecoderFromStream(inputStream.Get(), nullptr,
      WICDecodeMetadataCacheOnDemand, &decoder))) return false;
  UINT frameCount = 0;
  if (FAILED(decoder->GetFrameCount(&frameCount)) || frameCount != 1) return false;
  ComPtr<IWICBitmapFrameDecode> frame;
  if (FAILED(decoder->GetFrame(0, &frame))) return false;
  UINT sourceWidth = 0, sourceHeight = 0;
  if (FAILED(frame->GetSize(&sourceWidth, &sourceHeight)) || sourceWidth == 0 || sourceHeight == 0) return false;
  const uint64_t pixels = static_cast<uint64_t>(sourceWidth) * sourceHeight;
  if (pixels > kMaxPixels || pixels > kMaxRawBytes / 4) {
    *failure = Failure::ByteBudgetExceeded;
    return false;
  }

  UINT targetWidth = sourceWidth, targetHeight = sourceHeight;
  const UINT largest = std::max(sourceWidth, sourceHeight);
  ComPtr<IWICBitmapScaler> scaler;
  IWICBitmapSource* pixelSource = frame.Get();
  if (largest > kMaxDimension) {
    const double scale = static_cast<double>(kMaxDimension) / static_cast<double>(largest);
    targetWidth = std::max<UINT>(1, static_cast<UINT>(std::floor(sourceWidth * scale)));
    targetHeight = std::max<UINT>(1, static_cast<UINT>(std::floor(sourceHeight * scale)));
    if (FAILED(factory->CreateBitmapScaler(&scaler)) ||
        FAILED(scaler->Initialize(frame.Get(), targetWidth, targetHeight, WICBitmapInterpolationModeFant))) return false;
    pixelSource = scaler.Get();
  }

  ComPtr<IWICFormatConverter> converter;
  if (FAILED(factory->CreateFormatConverter(&converter)) ||
      FAILED(converter->Initialize(pixelSource, GUID_WICPixelFormat24bppBGR,
          WICBitmapDitherTypeNone, nullptr, 0.0, WICBitmapPaletteTypeCustom))) return false;
  ComPtr<IStream> outputStream;
  if (FAILED(CreateStreamOnHGlobal(nullptr, TRUE, &outputStream))) {
    *failure = Failure::JpegEncodeFailed;
    return false;
  }
  ComPtr<IWICBitmapEncoder> encoder;
  if (FAILED(factory->CreateEncoder(GUID_ContainerFormatJpeg, nullptr, &encoder)) ||
      FAILED(encoder->Initialize(outputStream.Get(), WICBitmapEncoderNoCache))) {
    *failure = Failure::JpegEncodeFailed;
    return false;
  }
  ComPtr<IWICBitmapFrameEncode> outputFrame;
  ComPtr<IPropertyBag2> options;
  if (FAILED(encoder->CreateNewFrame(&outputFrame, &options)) || !options) {
    *failure = Failure::JpegEncodeFailed;
    return false;
  }
  PROPBAG2 property{};
  property.pstrName = const_cast<LPOLESTR>(L"ImageQuality");
  VARIANT quality{};
  quality.vt = VT_R4;
  quality.fltVal = 0.9f;
  if (FAILED(options->Write(1, &property, &quality))) {
    *failure = Failure::JpegEncodeFailed;
    return false;
  }
  if (FAILED(outputFrame->Initialize(options.Get())) || FAILED(outputFrame->SetSize(targetWidth, targetHeight))) {
    *failure = Failure::JpegEncodeFailed;
    return false;
  }
  WICPixelFormatGUID format = GUID_WICPixelFormat24bppBGR;
  if (FAILED(outputFrame->SetPixelFormat(&format)) || !InlineIsEqualGUID(format, GUID_WICPixelFormat24bppBGR) ||
      FAILED(outputFrame->WriteSource(converter.Get(), nullptr)) || FAILED(outputFrame->Commit()) ||
      FAILED(encoder->Commit())) {
    *failure = Failure::JpegEncodeFailed;
    return false;
  }
  STATSTG stat{};
  HGLOBAL memory = nullptr;
  if (FAILED(outputStream->Stat(&stat, STATFLAG_NONAME)) || stat.cbSize.QuadPart == 0 ||
      stat.cbSize.QuadPart > kMaxJpegBytes || FAILED(GetHGlobalFromStream(outputStream.Get(), &memory)) || memory == nullptr) {
    *failure = stat.cbSize.QuadPart > kMaxJpegBytes ? Failure::ByteBudgetExceeded : Failure::JpegEncodeFailed;
    return false;
  }
  const SIZE_T allocation = GlobalSize(memory);
  if (allocation < stat.cbSize.QuadPart) {
    *failure = Failure::JpegEncodeFailed;
    return false;
  }
  const auto* encoded = static_cast<const BYTE*>(GlobalLock(memory));
  if (encoded == nullptr) {
    *failure = Failure::JpegEncodeFailed;
    return false;
  }
  try { jpeg->assign(encoded, encoded + static_cast<size_t>(stat.cbSize.QuadPart)); }
  catch (...) {
    GlobalUnlock(memory);
    *failure = Failure::ByteBudgetExceeded;
    return false;
  }
  GlobalUnlock(memory);
  if (jpeg->size() < 4 || (*jpeg)[0] != 0xff || (*jpeg)[1] != 0xd8 ||
      (*jpeg)[jpeg->size() - 2] != 0xff || jpeg->back() != 0xd9) {
    jpeg->clear();
    *failure = Failure::JpegEncodeFailed;
    return false;
  }
  *width = targetWidth;
  *height = targetHeight;
  *failure = Failure::HelperFailed;
  return true;
}

bool WriteImage(const std::string& id, const std::vector<BYTE>& sourceBytes) {
  std::vector<BYTE> jpeg;
  uint32_t width = 0, height = 0;
  Failure failure = Failure::DecodeFailed;
  if (!EncodeJpeg(sourceBytes, &jpeg, &width, &height, &failure)) {
    EmitError(failure);
    return false;
  }
  char metadata[512]{};
  const int length = std::snprintf(metadata, sizeof(metadata),
      "{\"status\":\"loaded\",\"id\":\"%s\",\"sourceType\":\"image\",\"width\":%u,\"height\":%u,\"jpegBytes\":%llu}\n",
      id.c_str(), width, height, static_cast<unsigned long long>(jpeg.size()));
  HANDLE output = GetStdHandle(STD_OUTPUT_HANDLE);
  if (length <= 0 || length >= static_cast<int>(sizeof(metadata)) ||
      !WriteAll(output, metadata, static_cast<size_t>(length)) || !WriteAll(output, jpeg.data(), jpeg.size())) {
    EmitError(Failure::OutputFailed);
    return false;
  }
  return true;
}

bool WriteCatalogCommand() {
  DirectoryLayout layout;
  const DirectoryStatus status = layout.Open();
  if (status == DirectoryStatus::Missing) {
    static constexpr char empty[] = "{\"entries\":[],\"status\":\"listed\"}\n";
    if (!WriteAll(GetStdHandle(STD_OUTPUT_HANDLE), empty, sizeof(empty) - 1)) {
      EmitError(Failure::OutputFailed);
      return false;
    }
    return true;
  }
  if (status != DirectoryStatus::Ready) { EmitError(Failure::Unavailable); return false; }
  if (!WriteCatalog(layout)) { EmitError(Failure::OutputFailed); return false; }
  return true;
}

bool LoadCommand(const wchar_t* requestedId) {
  if (!IsValidId(requestedId)) { EmitError(Failure::InvalidRequest); return false; }
  DirectoryLayout layout;
  if (layout.Open() != DirectoryStatus::Ready) { EmitError(Failure::Unavailable); return false; }
  for (const auto& source : kSources) {
    std::vector<BYTE> bytes;
    if (ReadSource(layout, source, &bytes) != ReadResult::Loaded) continue;
    std::string id;
    if (!HashSource(source, bytes, &id)) { EmitError(Failure::HelperFailed); return false; }
    const int required = MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, id.data(),
        static_cast<int>(id.size()), nullptr, 0);
    if (required <= 0) { EmitError(Failure::HelperFailed); return false; }
    std::wstring wideId(static_cast<size_t>(required), L'\0');
    if (MultiByteToWideChar(CP_UTF8, MB_ERR_INVALID_CHARS, id.data(), static_cast<int>(id.size()),
        wideId.data(), required) != required) { EmitError(Failure::HelperFailed); return false; }
    if (wideId == requestedId) return WriteImage(id, bytes);
  }
  EmitError(Failure::Unavailable);
  return false;
}

}  // namespace

int RunSystemWallpaperCommand(int argc, wchar_t* argv[]) {
  if (argc < 2 || argv == nullptr || argv[1] == nullptr) return -1;
  const bool list = std::wcscmp(argv[1], L"--wallpaper-list") == 0;
  const bool load = std::wcscmp(argv[1], L"--wallpaper") == 0;
  if (!list && !load) return -1;
  if (_setmode(_fileno(stdout), _O_BINARY) == -1) return EmitError(Failure::OutputFailed);
  try {
    if (list) {
      if (argc != 2) return EmitError(Failure::InvalidRequest);
      return WriteCatalogCommand() ? 0 : 6;
    }
    if (argc != 3) return EmitError(Failure::InvalidRequest);
    return LoadCommand(argv[2]) ? 0 : 6;
  } catch (...) {
    return EmitError(Failure::HelperFailed);
  }
}
}  // namespace pdsh::windows_wallpaper
