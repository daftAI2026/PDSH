# src/
> L2 | 父级: ../CLAUDE.md

TypeScript 是手写实现的唯一来源；构建边界将 Host 与 Client 分别映射为 Harness 可加载的 JavaScript。

- `host/`: Cordis 配置、设置接线与认证窗口截图；原生探针是唯一平台特化依赖。
- `shared/`: Host/Client 共用的偏好验证与文案，防止两个运行时形成不同合同。
- `client/`: 浏览器侧设置、视觉适配与生命周期；截图工作台通过认证 route 获取 PNG，不直接调用 Electron 主进程。
- `env.d.ts`: 描述宿主提供的 UI 模块和 esbuild 文本资源，不伪造运行时实现。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
