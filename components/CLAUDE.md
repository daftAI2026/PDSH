# components/
> L2 | 父级: ../CLAUDE.md

- identity/: 包内身份入口；头像与昵称独立功能命名，配置地址保持 pdsh，根入口仅为兼容而不形成第四个 patch 行。
- titles/: 包内标题入口；构建派生 manifest/Host/Client/locale，同仓库固定 SHA 的普通传递依赖由官方 hoisted profile 同时发现 Host/Client/元信息，不作为用户管理的 Bundle 独立安装/发布。
- capture/: 包内拍照入口；桥属于其内部生命周期，不要求身份和标题开启。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
