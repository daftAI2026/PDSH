<!--
[INPUT]: 随包分发的 macOS Objective-C++ 单窗采集/系统壁纸 helper 与 Windows x64 后端，以及各自平台 SDK。
[OUTPUT]: 无 GUI 权限检查、原生单窗 capture、只读壁纸目录/有界 JPEG 解码和可重复编译入口。
[POS]: L2 native 地图；Host 以包内相对路径显式调用同一短命 helper，壁纸列表不取像/授权，构建与合同测试不执行合法 capture。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->
# native/
> L2 | 父级: ../CLAUDE.md

成员清单
`window-capture.mm`: macOS Objective-C++ 的父链身份、权限预检、唯一所属 Main 窗口与 PNG stdout 守卫；复用独立壁纸分派，不注入 Main
`system-wallpaper.mm`: Host 授权 UUID/系统 HEIC，旧 ID 只兼容缓存。初次 Aerial 打开逐层 openat/no-follow/核 owner。AVURLAsset 按路径解码，前后 stat 检测漂移，不隔离同 UID 改写。拒外部引用，限制源 64/256MiB 与 JPEG 2600px/8MiB。
`system-wallpaper.h`: 同一helper的旧目录/UUID缓存/系统HEIC/Host临时MOV窄分派；材料选择在Host，不引入第二helper或IPC
`build.sh`: 编译 macOS capture/壁纸源为一个 helper 的双架构确定性脚本，最低 macOS 14，lipo 核 arm64/x86_64 且不运行产物；归档门独立验证 0755 执行权限
`window-capture`: `build.sh` 输出的 macOS universal 归档 helper；由 root `index.js` 相对解析，构建时生成、不手写
`windows/`: Windows x64 `CreateForWindow` 与固定默认壁纸后端、身份/窗口归属门、`asInvoker` manifest 与 VS/SDK 构建入口；成员及边界见 `windows/CLAUDE.md`

编译仅生成捆包 helper，不调用 helper、不联网、不打开授权 UI；合法用户触发的实机授权/采集和素材 JPEG 输出是独立验证门。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
