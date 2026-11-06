# locale/
> L2 | 父级: ../CLAUDE.md

- `zh.json`: 中文名称与简介由元信息源同步。meta.detail 指向中文短详情，停用插件时仍可读取。
- `en.json`: 英文元信息与短详情入口。宿主语言回退链选择此资源，不建立独立语言状态。
- `detail.zh.md`: 插件页的一行中文说明。宿主读取此文件，不展开完整 README。
- `detail.en.md`: 同源英文短详情。宿主忽略头部 HTML 契约，仅显示正文。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
