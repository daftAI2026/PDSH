# src/host/
> L2 | 父级: ../CLAUDE.md

- `index.ts`: 唯一 `pdsh` Host Config/apply 与 Typert 源面；保留根 Config 地址，macOS 保持注册 capture service，Windows 仅在 x64 且包内 exe 为普通文件时注册；其余功能与 captureEnabled 撤回独立。
- `capture.ts`: 声明 `captureEnabled`、独立身份遮挡与导出设置，引用 shared POSIX/Windows 绝对目录语法；保留历史默认迁移和 root owner-scoped listener，实际写入仍受 Host native path 校验。默认目录沿用本机用户home下Downloads，不探测重定向known folder。
- `context.ts`: 以类型扩充 Cordis Context，描述唯一已注册 capture service；不制造 runtime binding 或 Typert descriptor。
- `window-capture-service.ts`: 固定 Cordis/Remote 外壳；每次调用定位 Manager 当前自身包的版本业务实现，保留 capture/save namespace、同步 invocation uplink 与终态卸载；implementationVersion 只返回实际载入版本，不取像。
- `capture-runtime.ts`: 仅消费当前稳定/RC Config 地址； capture/save 的版本业务闭包；按当前包位置解析 helper，调用前拒绝异版本实例并核对 accepted Settings，在途撤权等待两路真实结算；不自行注册服务，logger 仅记固定白名单码。
- `window-capture-stream.ts`: 纯异步 capture 编排；惰性首拉、单航班、固定阶段/终态和≤32KiB PNG chunk，取消不微任务自旋且在锁释放前等待 helper Promise settle。
- `native-window-capture.ts`: Node adapter 只选择已支持的 macOS/Windows x64 包内 helper，Windows 隐藏子进程窗口；校验固定状态与 PNG envelope，取消后 SIGTERM/强制结束仍等待 close；不持久化图像、不挂 Main 或网络路由。
- `window-save-backend.ts`: 单 service 调用的 Host save backend；复核 shared 绝对目录语法与本机 path.isAbsolute/normalize，规范化 UNC share root 后从 accepted Config 取目录/模板，验证有序 uplink/hash/图像后委托既有安全 writer，真实提交后才回 receipt。
- `window-save-image.ts`: 只验证 PNG/JPEG/静态 WebP envelope 与尺寸；仅保留固定指纹的Canvas默认sRGB ICC原字节，拒绝其他metadata/动画且不做通用解码或文件写入。
- `page-save-file.ts`: 同目录独占临时文件、同步、取消围栏与原子提交的 Host writer；新 save backend 复用其 direct 不覆盖边界。
- `page-save-webp.ts`: 复用作静态 WebP 维度验证；不能据此解读任意 WebP 像素。
- `capture-route.ts`: **已退役**的旧 Fetch 控制面，仍留作迁移历史；任何 runtime entry/service 均不得导入。
- `capture-bootstrap.ts`: **已退役**的旧 Inspector/socket bootstrap；不再因 camera 操作启 Main 注入或监听调试端口。
- `inspector-ownership.ts`: **已退役**的 Inspector 归还表达式；非新采集/保存路径依赖。
- `page-capture-main.ts`: **已退役**的旧 Electron Main pixel route；不挂载、不注入、不供本次 camera 触发。
- `page-save-main.ts`: **已退役**的旧 Main 保存实现；`page-save-file.ts` 的原子 writer仍被新 Host backend复用，Main/dialog 代码本身不挂载。

- `capture-runtime-loader.ts`: 安装身份与构建中的稳定/RC 包严格一致； 标准 realpath/import 的版本实现协调器；只读 Manager 当前自身包，保留单实例与协议围栏，旧 helper/save 结算后才换载，不触碰 Node 私有缓存或设置。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
