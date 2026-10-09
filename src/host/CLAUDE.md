# src/host/
> L2 | 父级: ../CLAUDE.md

- `index.ts`: 唯一 `pdsh` Host Config/apply 与 Typert 源面；保留根 Config 地址，macOS 保持注册 capture service，Windows 仅在 x64 且包内 exe 为普通文件时注册；其余功能与 captureEnabled 撤回独立。
- `capture.ts`: 声明 `captureEnabled`、独立身份遮挡与导出设置，引用 shared POSIX/Windows 绝对目录语法；保留历史默认迁移和 root owner-scoped listener，实际写入仍受 Host native path 校验。默认目录沿用本机用户home下Downloads，不探测重定向known folder。
- `context.ts`: 以类型扩充 Cordis Context，描述唯一已注册 capture service；不制造 runtime binding 或 Typert descriptor。
- `window-capture-service.ts`: 固定基础 Remote 壳，提供截图/保存及历史壁纸兼容面。只依赖 Loader 的稳定接口；新能力不进入根生成面。
- `runtime-capabilities-service.ts`: 官方内部能力 service；子 Fiber 拥有版本、壁纸与 digest 查询的视口几何接口，权限与业务仍归根实例。
- `capture-runtime.ts`: 稳定基础与内部能力闭包。初始 thenable 等官方子 Fiber。壁纸按平台分流；Windows 加载前重读 native roster，Mac 保留 Apple 目录。截图只暂存一份 digest 绑定几何，停用/卸载/换代撤销。
- `window-capture-stream.ts`: 纯异步 capture 编排；惰性首拉、单航班、固定阶段/终态和≤32KiB PNG chunk。内部 viewport 不进基础帧；几何只随完整终态提交，取消等待 helper settle。
- `native-window-capture.ts`: Node adapter 只选择已支持的 macOS/Windows x64 包内 helper，Windows 隐藏子进程窗口；校验固定状态/PNG envelope，附带的视口矩形失效只禁用几何；取消后等待 close，不持久化图像。
- `system-wallpaper-native.ts`: 同包 helper 的有界 JPEG 适配。Mac 接受 Host 授权 HEIC/MOV；Windows x64 只接收当次最多五项 hash roster 的 ID，保留严格闭集 schema。固定码映射不反射 stderr；取消等待真实 close。
- `system-wallpaper-download.ts`: 共享受控URL与三次严格206/强ETag Range，累计≤18MiB+64B；重建完整首sample MOV，唯一本地临时媒体owner；生产复用系统transport，fake-fetch只供合同，不整段GET/改TLS。
- `system-wallpaper-mov.ts`: 纯64B固定头/尾moov解析与首sync sample定位；仅接受单hvc1视频描述、单自包含alis引用及已知索引，保留tapt/hdlr/hvcC/nclc/matrix并重建完整单sample MOV；独立限制逻辑length/metadata/sample。
- `system-wallpaper-mov-aux.ts`: 严格验证固定Apple tapt、media/data handler、HEVC sample-entry尾零及已知sgpd/csgm/cslg/sdtp布局；拒绝未知/外部必要结构，旧sample辅助索引只验证后丢弃。
- `system-wallpaper-stream.ts`: Mac 与 Windows x64 共用的惰性目录/JPEG 状态机。共享目录最多五项；Mac 保留完整原四项，按候选流截取前五项。ID/name 经共享校验；accepted 配置、单航班与取消 return 等待真实结算。未知平台不启动 helper。
- `window-save-backend.ts`: 单 service 调用的 Host save backend；复核 shared 绝对目录语法与本机 path.isAbsolute/normalize，规范化 UNC share root 后从 accepted Config 取目录/模板，验证有序 uplink/hash/图像后委托既有安全 writer，真实提交后才回 receipt。
- `window-save-image.ts`: 只验证 PNG/JPEG/静态 WebP envelope 与尺寸；仅保留固定指纹的Canvas默认sRGB ICC原字节，拒绝其他metadata/动画且不做通用解码或文件写入。
- `page-save-file.ts`: 同目录独占临时文件、同步、取消围栏与原子提交的 Host writer；新 save backend 复用其 direct 不覆盖边界。
- `page-save-webp.ts`: 复用作静态 WebP 维度验证；不能据此解读任意 WebP 像素。
- `capture-route.ts`: **已退役**的旧 Fetch 控制面，仍留作迁移历史；任何 runtime entry/service 均不得导入。
- `capture-bootstrap.ts`: **已退役**的旧 Inspector/socket bootstrap；不再因 camera 操作启 Main 注入或监听调试端口。
- `inspector-ownership.ts`: **已退役**的 Inspector 归还表达式；非新采集/保存路径依赖。
- `page-capture-main.ts`: **已退役**的旧 Electron Main pixel route；不挂载、不注入、不供本次 camera 触发。
- `page-save-main.ts`: **已退役**的旧 Main 保存实现；`page-save-file.ts` 的原子 writer仍被新 Host backend复用，Main/dialog 代码本身不挂载。

- `capture-runtime-loader.ts`: 标准 realpath/import 的单实例协调器。严格验证稳定 v1 与已发布 v2 基础面，壁纸按独立合同判定；旧操作结算后换载。

- `system-wallpaper-catalog.ts`: 只读有界Apple metadata选择器；按唯一preferredOrder遍历Landscape组，先取唯一dynamic或root-owned扩展再取景观代表，候选流截取前五项；前两组须完整，不把排序当OS版本；旧ID缓存桥/未来材料身份，未知关联拒绝，路径URL留Host。

- `system-wallpaper-transport.ts`: 固定/usr/bin/curl窄Range；--disable忽略curlrc、shell:false、默认系统TLS/Apple URL、头体stderr硬预算；验头后按Range预分配单Buffer、分片顺拷；分配失败释放并等真实close，不是DSH应用内fetch/proxy dispatcher。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
