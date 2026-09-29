# src/host/
> L2 | 父级: ../CLAUDE.md

- `index.ts`: 声明唯一 Cordis Host Config、设置与认证截图 route；不接触账户或会话数据，构建后是根目录 `index.js`。
- `capture.ts`: 在私有临时目录执行窗口探针和系统截图，读取前限制 PNG 大小并传递取消信号；由精确 Connection route 返回，所有路径清理。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
