<!--
[INPUT]: 依赖父级 native/ Host-owned-window 合同、Windows SDK 的 WGC/Win32 interop 与 WIC。
[OUTPUT]: 定义 Windows x64 原生取像模块成员、进程身份边界与构建/归档职责。
[POS]: native/ 下的 Windows 平台后端；隔离 Windows API，不扩展 Mac helper 或 Host/Client DTO。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->
# native/windows/
> L2 | 父级: ../CLAUDE.md

成员清单
`window-capture.cpp`: WGC 单窗编排器。归属门先于取像。帧池尺寸仅定容量；按 ContentSize 验纹理边界并编码 PNG。仅在几何稳定且已验的 PM-aware 条件下附加相对 viewport；几何缺失不影响 PNG。
`window-geometry.cpp`: 临时切 PMv2 读取 DWM 可见 bounds、客户区物理边界与目标 awareness；只有 ContentSize 与可见 bounds 相等才算出相对 viewport，其他情况省略元数据，不阻断采集。
`window-geometry.h`: 窗口几何快照和 PNG viewport 的内部契约；DWM 原点对应 WGC 内容仅是已验目标环境条件，不是通用 API 保证。
`system-wallpaper.cpp`: 固定序列 Windows/img0,img19、ThemeA/img20、ThemeB/img24、ThemeC/img28、ThemeD/img32、Theme1/img1、Theme2/img7、Theme1/img2、Theme2/img8，最多取五项且不枚举。保留旧 Windows ID；主题 ID 绑定目录与来源字节。句柄拒 reparse 并复核目录/文件身份，WIC 输出有界 JPEG。
`system-wallpaper.h`: 同一 helper 的 ID-only 壁纸命令分派；不接受用户路径或 URL。
`window-owner.cpp`: Host→Main 身份链与窗口归属实现；复核 helper/Host/Main 的 PID 创建代际、同路径/同用户、唯一可见普通窗口及窗口状态漂移
`window-owner.h`: Windows helper 内部状态码、进程/窗口快照与归属校验接口；避免 capture 编排器重复实现 Win32 身份规则
`window-capture.manifest`: helper使用 `asInvoker` 且 `uiAccess=false`，不请求管理员权限、不声明程序化/无边框取像能力
`build.ps1`: 通过 `vswhere`/`vcvars64` 发现 VS x64 工具链，以 UTF-8、静态 MSVC CRT、Windows SDK/C++/WinRT 编译取像、几何、归属及壁纸源并嵌入 `asInvoker`；默认原位输出，显式 staging 需唯一目录和固定 owner marker。
`window-capture-x64.exe`: `build.ps1` 生成的 x64 控制台 PE 产物；正式归档由父级构建/发布门复核架构与 manifest，不手写

平台约束：`CreateForWindow` 最低 Windows 10 1903/build 18362；仅支持官方 Harness 当前公开的 Windows x64 target。用户点击才会启动 helper；WGC 系统捕获边框保持默认开启。取消由Host终止一次性helper并等待真实进程关闭，进程退出由Windows释放其WGC/D3D/WIC资源。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
