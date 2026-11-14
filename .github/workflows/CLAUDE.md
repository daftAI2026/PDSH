# workflows/
> L2 | 父级: ../CLAUDE.md

- `native-windows.yml`: Windows2022/MSVC编译x64系统取像helper，通过 setup-node 的 pnpm 下载缓存复用锁定Node/PNPM运行Windows目录合同并上传短期构建物；不执行截图、不授予权限、不推代码或tag。
- `host-update-watch.yml`: 每日 UTC 01:23 读取官方 Harness 标签。schedule 发现新稳定版或 RC 时创建人工审查 issue；手动运行默认 dry-run。仅授予 contents:read 与 issues:write，固定 action SHA 并串行运行；不安装、构建或发布。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
