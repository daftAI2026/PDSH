/*
 * [INPUT]: 依赖短命 macOS helper 的 argv 与 Host 活动目录已授权的材料 ID/只读源。
 * [OUTPUT]: 暴露无录屏授权的兼容列表/UUID 缓存/系统 HEIC/Host 临时 MOV 首帧命令分派。
 * [POS]: native 的 read-only wallpaper 边界；仅由 window-capture.mm 复用同一进程入口。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
#pragma once

// 未识别的 argv 返回 -1；壁纸命令始终在本地返回固定退出码。
int RunSystemWallpaperCommand(int argc, char **argv);
