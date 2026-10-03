# tools/
> L2 | 父级: ../CLAUDE.md

- `generate-typert.ts`: 调用官方 Typert workspace generator；在临时真实 package workspace 中分析当前源码并把原生 generator 输出写入 `lib/`，不手写 descriptor。
- `typert-protocol-reference/`: 固定 rc.2 upstream source 身份供 workspace 类型分析；不是 npm workspace、运行时依赖副本或归档成员。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
