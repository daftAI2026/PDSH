# src/shared/
> L2 | 父级: ../CLAUDE.md

- `model.ts`: 定义并校验 Host/Client 共用的显示偏好合同，生成本地头像；不把真实账户 URL 写回配置。
- `locales.ts`: 提供 Client 运行文案，含截图配置未加载时的中英文重启提示与更新后重启确认文案；语言所有权仍在 Harness locale 服务，区别于包元信息 `locale/*.json`。
- `components.ts`: 唯一 Bundle 名；内部功能模块共用 pdsh 配置域，不创建额外依赖包。

- `capture-bridge.ts`: 已退出运行时的 Main/Inspector 实验控制合同；保留历史回归，不是现行 Remote 路由，也不作为取像失败回退。

- `capture-export.ts`: `captureEnabled/captureMaskIdentity/saveBehavior/saveDirectory/saveFormat/fileNamePattern` 六字段须完整且符合已有纯合同才判配置就绪（空目录仍有效），不推断 Host 版本/权限；另供询问/直接保存、格式、basename 与纯 POSIX/Windows 绝对目录语法，拒绝相对、控制字符及 device namespace；编辑输出独立32MP/128MB预算。
- `capture-trace.ts`: 固定阶段、共享失败码白名单与 request UUID 的脱敏诊断；复用官方 logger，记录失败也不影响业务。

- `window-capture-protocol.ts`: owned-window Remote stream 的唯一 capture 帧、失败码运行时白名单与硬预算；scope/尺寸/点像素比例明示原生整窗语义，不传窗口标题、目录或源坐标。
- `window-save-protocol.ts`: 同一 Remote service 的有界 PNG/JPEG/WebP uplink、ACK、终态与 receipt 纯 DTO；不接收目标路径。
- `remote-types.ts`: 只把 capture/save DTO 与格式 union 汇总为官方 Typert 所需公开 `./types` 边界，不增加运行时包。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
