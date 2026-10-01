# src/shared/
> L2 | 父级: ../CLAUDE.md

- `model.ts`: 定义并校验 Host/Client 共用的显示偏好合同，生成本地头像；不把真实账户 URL 写回配置。
- `locales.ts`: 提供 Client 运行文案；语言所有权仍在 Harness locale 服务，区别于包元信息 `locale/*.json`。
- `components.ts`: 唯一 Bundle 名；内部功能模块共用 pdsh 配置域，不创建额外依赖包。

- `capture-bridge.ts`: 三进程共享的控制路由、UUID/预算、非空 record 帧校验与固定页面接收器标识；协议不接受窗口、URL、矩形或可执行代码。

- `capture-export.ts`: 询问/直接保存、格式和 basename 纯合同；编辑后输出独立32MP/128MB预算与尺寸校验供合成/编码/Main复用，原生采样预算保持独立；目录由 Host/用户提供。
- `capture-trace.ts`: 固定阶段与 request UUID 的脱敏诊断；复用官方 logger，记录失败也不影响业务。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
