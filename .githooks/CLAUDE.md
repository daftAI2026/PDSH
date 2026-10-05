# .githooks/
> L2 | 父级: ../CLAUDE.md

- `pre-push`: 从 Git 推送记录筛选稳定版本 tag，只接受同名本地 tag，创建前执行同版本 release:check（隔离 stdin，保留多 ref 推送记录）；拒绝改写或删除已发布稳定 tag，不安装插件或改写推送内容。普通分支及 RC 不走稳定发布门。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
