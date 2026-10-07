# tests/runtime-upgrade-fixtures/
> L2 | 父级: ../CLAUDE.md

本目录保存固定发布字节。
测试不读取 Git tag。
哈希由升级合同固定。

- `typert.host.v0.4.0.js.fixture`: v0.4.0 官方生成 Host 面原字节；严格注册保留旧基础面。
- `capture-runtime-loader.v0.4.0.ts.fixture`: v0.4.0 已发布 v1 Loader 原文。esbuild 仅编译此源。
- `components.v0.4.0.ts.fixture`: v0.4.0 Loader 的共享身份模块原文。
- `capture-runtime.v0.4.0.js.gz.fixture`: v0.4.0 已发布 ESM payload 原字节的 gzip 副本。
- `package.v0.4.0.json.fixture`: v0.4.0 已发布包 manifest 原文。
- `capture-runtime-loader.v0.5.0.ts.fixture`: v0.5.0 已发布 v2 Loader 原文。测试验证拒绝 v1。
- `components.v0.5.0.ts.fixture`: v0.5.0 Loader 的共享身份模块原文。
- `system-wallpaper-protocol.v0.5.0.ts.fixture`: v0.5.0 Loader 的纯类型依赖原文。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
