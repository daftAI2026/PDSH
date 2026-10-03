# tools/typert-protocol-reference/src/
> L2 | 父级: ../CLAUDE.md

- `index.ts`: 官方 Remote decorator、Typert Host service base 与协议入口；为 Host source-analysis 提供真实 exported symbol。
- `json-value.ts`: 官方 lossless JSON/uplink wire 值检查类型与实现，决定协议接受的 JSON 数据边界。
- `owned-value.ts`: 官方 invocation-owned value carrier 标签及类型，不被本 Bundle 运行时复制实现。
- `remote-error.ts`: 官方固定 Remote 错误类型与序列化边界，避免业务服务自造 wire error shape。
- `types.ts`: 官方 Remote stream/uplink/descriptor/Context 映射；`RemoteStream<Out, In>` 的第二类型参数是上行 codec source。

这些文件是 upstream commit 的不可变第三方分析输入；不添加 L3 文件头、不手改源码，以父级 `PROVENANCE.md` SHA-256 验证。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
