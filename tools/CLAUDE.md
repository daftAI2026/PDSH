# tools/
> L2 | 父级: ../CLAUDE.md

- `generate-typert.ts`: 调用官方 Typert workspace generator；按 manifest 身份在临时真实 package workspace 中生成 stable 或私有 RC 的 Host/Remote faces 与声明，不手写 descriptor。
- `pack-rc.ts`: 从显式公开源码白名单构建独立 `@daftai/pdsh-rc` 候选；私有 0700 staging、拒绝源链接与覆盖、保留 helper 执行位并校验真实 tgz，不安装或触碰 profile。
- `typert-protocol-reference/`: 固定 rc.2 upstream source 身份供 workspace 类型分析；不是 npm workspace、运行时依赖副本或归档成员。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
