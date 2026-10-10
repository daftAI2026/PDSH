# src/
> L2 | 父级: ../CLAUDE.md

TypeScript 是手写实现的唯一来源；构建边界将 Host 与 Client 分别映射为 Harness 可加载的 JavaScript。

- `host/`: Cordis 配置、官方 Remote 整窗/保存及系统壁纸流；helper、Apple按需下载与磁盘后端受同一拍照开关生命周期治理，新增壁纸ABI须正常加载。
- `shared/`: Host/Client 共用的偏好验证与文案，防止两个运行时形成不同合同。
- `client/`: 浏览器侧设置、视觉适配与生命周期；截图工作台消费官方 Remote 返回的原生整窗冻结 PNG，未提供能力时不重绘或绕过隔离。
- `env.d.ts`: 声明 Host UI 模块、StateDot、LinkIconRegular、SegmentedControl、Modal 和 esbuild 文本资源。运行实现仍由 Host 提供。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
