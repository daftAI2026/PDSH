# src/shared/
> L2 | 父级: ../CLAUDE.md

- `model.ts`: 定义并校验 Host/Client 共用的显示偏好合同，生成本地头像；不把真实账户 URL 写回配置。
- `locales.ts`: 提供设置、头像来源可用性及更新结果的 zh/en 文案。未登录账号头像提示登录后可用。固定作者名不翻译。Harness locale 拥有语言状态；`locale/*.json` 只提供离线包元信息。
- `components.ts`: 构建注入稳定/RC Bundle 与 root 身份，RC 禁用稳定更新；内部功能模块共用当前包的唯一配置域，不创建额外依赖包。
- `capture-runtime-contract.ts`: 固定截图/保存基础合同，独立声明壁纸扩展。只有破坏原调用或结算语义才升级基础合同。

- `capture-bridge.ts`: 已退出运行时的 Main/Inspector 实验控制合同；保留历史回归，不是现行 Remote 路由，也不作为取像失败回退。

- `capture-export.ts`: `captureEnabled/captureMaskIdentity/saveBehavior/saveDirectory/saveFormat/fileNamePattern` 六字段须完整且符合已有纯合同才判配置就绪（空目录仍有效），不推断 Host 版本/权限；另供询问/直接保存、格式、basename 与纯 POSIX/Windows 绝对目录语法，拒绝相对、控制字符及 device namespace；编辑输出独立32MP/128MB预算。
- `capture-trace.ts`: 固定阶段、共享失败码白名单与 request UUID 的脱敏诊断；复用官方 logger，记录失败也不影响业务。

- `window-capture-protocol.ts`: owned-window Remote stream 的唯一 capture 帧、失败码运行时白名单与硬预算；scope/尺寸/点像素比例明示原生整窗语义，不传窗口标题、目录或源坐标。
- `window-save-protocol.ts`: 同一 Remote service 的有界 PNG/JPEG/WebP uplink、ACK、终态与 receipt 纯 DTO；不接收目标路径。
- `system-wallpaper-protocol.ts`: legacy缓存桥/未来UUID或摘要身份语法、最多四活动项、统一名称控制字符/96字门与固定状态/媒体预算；语法不是Host source授权，DTO不接路径URL。
- `wallpaper-gallery.ts`: 动态/legacy系统与SHA256用户素材、Blob/缩略图/尺寸及36总项容量合同；稳定/RC分域，旧选择/用户图不静默淘汰，语法不充当Host来源ACL。
- `remote-types.ts`: 只把 capture/save/壁纸 DTO 与格式 union 汇总为官方 Typert 所需公开 `./types` 边界，不增加运行时包。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
