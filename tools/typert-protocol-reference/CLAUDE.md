# tools/typert-protocol-reference/
> L2 | 父级: ../CLAUDE.md

- `package.json`: 上游 Typert protocol 包在固定 rc.2 commit 的原始 manifest；用于 Generator workspace source identity，不被 pnpm 安装。
- `LICENSE`: 上游 Harness 仓库根 MIT 许可文本随 vendored source 留存。
- `PROVENANCE.md`: 固定 Git SHA、五源文件/manifest/license SHA-256 与本地 build-only 用途。
- `src/`: 五个固定官方 upstream TS source 的不可变输入地图，不添加本仓 L3 注释、不作业务修改；以 `PROVENANCE.md` 的 SHA 自证。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
