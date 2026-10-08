/**
 * [INPUT]: 依赖 Windows 固定系统壁纸源、BCrypt SHA-256、COM 与 WIC。
 * [OUTPUT]: 提供固定的壁纸列表和 ID-only 单图处理分派。
 * [POS]: Windows capture helper 内部的系统壁纸后端；只访问系统默认壁纸，不接收路径或用户壁纸。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

namespace pdsh::windows_wallpaper {
int RunSystemWallpaperCommand(int argc, wchar_t* argv[]);
}
