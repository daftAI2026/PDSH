<!--
[INPUT]: 随 RC 捆包分发的 macOS Objective-C++ 与 Windows x64 原生单窗 helper，以及各自平台 SDK。
[OUTPUT]: 无 GUI 检查和点击后运行的单窗 capture 源、平台 helper 与可重复编译入口。
[POS]: L2 native 地图；Host 以包内相对路径显式调用平台 helper，构建与合同测试不执行合法 capture。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->
# native/
> L2 | 父级: ../CLAUDE.md

成员清单
`window-capture.mm`: macOS Objective-C++ 的父链身份、权限预检、唯一所属 Main 窗口与 PNG stdout 守卫；不注入 Main
`build.sh`: 编译 macOS 捆包 helper 的双架构确定性脚本，最低 macOS 14，lipo 核 arm64/x86_64 且不运行产物；归档门独立验证 0755 执行权限
`window-capture`: `build.sh` 输出的 macOS universal 归档 helper；由 root `index.js` 相对解析，构建时生成、不手写
`windows/`: Windows x64 `CreateForWindow` 后端、身份/窗口归属门、`asInvoker` manifest 与 VS/SDK 构建入口；成员及边界见 `windows/CLAUDE.md`

编译仅生成捆包 helper，不调用 helper、不打开授权 UI；合法用户触发的实机授权与采集是独立验证门。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
