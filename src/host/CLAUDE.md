# src/host/
> L2 | 父级: ../CLAUDE.md

- `index.ts`: 唯一 `pdsh` Host Config/apply 与 Typert 源面；保留根 Config 地址，macOS 保持注册 capture service，Windows 仅在 x64 且包内 exe 为普通文件时注册；其余功能与 captureEnabled 撤回独立。
- `capture.ts`: 声明 `captureEnabled`、独立身份遮挡与导出设置，引用 shared POSIX/Windows 绝对目录语法；保留历史默认迁移和 root owner-scoped listener，实际写入仍受 Host native path 校验。默认目录沿用本机用户home下Downloads，不探测重定向known folder。
- `context.ts`: 以类型扩充 Cordis Context，描述唯一已注册 capture service；不制造 runtime binding 或 Typert descriptor。
- `window-capture-service.ts`: 唯一 Cordis/Remote v2 外壳，提供三流与 implementationVersion。按调用定位 Manager 当前自身包版本。wallpaper 改变 Remote ABI，旧 v1 外壳必须正常加载，不承诺 payload 热兼容。
- `capture-runtime.ts`: v2 capture/save/wallpaper唯一业务闭包；目录选当前Apple两主题，load重新核对四项来源后本机优先/缺失下载；撤权/卸载join网络、临时文件及helper真实结算。
- `window-capture-stream.ts`: 纯异步 capture 编排；惰性首拉、单航班、固定阶段/终态和≤32KiB PNG chunk，取消不微任务自旋且在锁释放前等待 helper Promise settle。
- `native-window-capture.ts`: Node adapter 只选择已支持的 macOS/Windows x64 包内 helper，Windows 隐藏子进程窗口；校验固定状态与 PNG envelope，取消后 SIGTERM/强制结束仍等待 close；不持久化图像、不挂 Main 或网络路由。
- `system-wallpaper-native.ts`: 同包macOS helper的有界JPEG边界；旧list只保留兼容，动态材料ID与固定系统HEIC/Host私有MOV仅由Host选择；匹配缺失状态可下载，取消等真实close，不泄漏stderr。
- `system-wallpaper-download.ts`: 共享受控URL与三次严格206/强ETag Range，累计≤18MiB+64B；重建完整首sample MOV，唯一本地临时媒体owner；生产复用系统transport，fake-fetch只供合同，不整段GET/改TLS。
- `system-wallpaper-mov.ts`: 纯64B固定头/尾moov解析与首sync sample定位；仅接受单hvc1视频描述、单自包含alis引用及已知索引，保留tapt/hdlr/hvcC/nclc/matrix并重建完整单sample MOV；独立限制逻辑length/metadata/sample。
- `system-wallpaper-mov-aux.ts`: 严格验证固定Apple tapt、media/data handler、HEVC sample-entry尾零及已知sgpd/csgm/cslg/sdtp布局；拒绝未知/外部必要结构，旧sample辅助索引只验证后丢弃。
- `system-wallpaper-stream.ts`: 同一Remote的惰性0–4活动材料目录/JPEG状态机；动态ID/name共享校验，ID语法不要求legacy集合；accepted配置/single-flight/取消return仍等待真实操作结算。
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

- `system-wallpaper-catalog.ts`: 只读有界Apple metadata选择器；前两Landscape subgroup的preferredOrder/代表UUID对应dynamic子组或root-owned扩展，不把排序当OS版本；旧ID缓存桥/未来材料身份，未知关联拒绝，路径URL留Host。

- `system-wallpaper-transport.ts`: 固定/usr/bin/curl窄Range；--disable忽略curlrc、shell:false、默认系统TLS/Apple URL、头体stderr硬预算；验头后按Range预分配单Buffer、分片顺拷；分配失败释放并等真实close，不是DSH应用内fetch/proxy dispatcher。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
