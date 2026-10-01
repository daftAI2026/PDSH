# src/host/
> L2 | 父级: ../CLAUDE.md

- `index.ts`: 唯一 `pdsh` Cordis Host Config/apply；保留身份/标题旧字段并合并拍照字段，官方 Settings 只配置一次，root Host fiber 持有 Loader volatile-update 监听。
- `capture.ts`: 提供被 root Config 复用的拍照字段与 `pdsh` revision 迁移；按所属 Fiber 的 `loader/volatile-update` 精确监听 `captureEnabled`，同步撤回 exact Fetch route、abort 在途桥，再以 dispose barrier 安全重挂；Main 相对根入口解析，未知关闭隔离跨重挂载保留。

- `page-capture-main.ts`: 原生捕获串行锁、主 frame/document 围栏与系统临时根/真实目录 uid/0700 归属校验的私有 socket 控制；PNG 只交付原 Renderer 接收器，内部桥候选实现仍待原 DSH 安装件验收。

- `capture-route.ts`: 官方 RPC 控制封套与 owner 世代边界；只传控制元数据，Host fiber 停用直接 abort，不等待 Renderer；失败连接先失效化并归还；归还 barrier 和 inspector/control 两类未知隔离态分开，等待后再次校验，确认 closed 才允许下一次用户点击重建。
- `capture-bootstrap.ts`: 真实 macOS ps 末列完整路径与启动时间的父 Main 身份检查、Node 默认 inspector 启动约束与系统临时根内独占 socket 生命周期；不接管已有调试会话，关闭未知明确报错，不重启应用。
- `inspector-ownership.ts`: 固定 Main watchdog/关闭表达式；以 PID、nonce、原调试地址归还启动权限，不干扰后来调试会话。

- `page-save-webp.ts`: 静态 Canvas WebP 封装/尺寸和共享32MP导出预算校验；仅用于保存，不沿用16MP取像限额或伪装原生解码。
- `page-save-file.ts`: 同目录独占临时写入/同步/关闭/围栏；面板已确认覆盖用原子替换，直接保存用独占 link 自动编号，失败不截断旧文件。
- `page-save-main.ts`: 原页面冻结导出→共享32MP/128MB输出预算和格式验证→面板或直接保存→写入回执；生命周期围栏保护提交，不发 HTTP 像素或日志路径。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
