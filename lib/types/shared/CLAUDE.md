# lib/types/shared/
> L2 | 父级: ../CLAUDE.md

- `remote-types.d.ts`: 公开 DTO 类型门面，生成 Remote face 只依赖这个包边界。
- `window-capture-protocol.d.ts`: owned-window capture 帧、阶段和终态声明，与 Host/Client 共用预算一致。
- `window-save-protocol.d.ts`: 双向 save 请求、uplink/ACK/commit receipt 声明，不允许路径和目标文件名输入。
- `capture-export.d.ts`: 保存格式与编辑器导出预算声明，被 save 协议引用；无截图或配置持久化副作用。

以上文件由 TypeScript 从 src/shared 发射，L3 沿源头保留；禁止单独编辑声明。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
