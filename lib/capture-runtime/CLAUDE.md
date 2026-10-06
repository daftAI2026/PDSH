# lib/capture-runtime/
> L2 | 父级: ../CLAUDE.md

- `0.5.0.js`: 取像、保存与壁纸业务闭包，由 src/host/capture-runtime.ts 生成。Remote 外壳从 Manager 当前自身包载入。旧操作实际结算后才换载。v2 新增 wallpaper ABI，旧 v1 外壳不能热加载。正常加载 v2 后，同合同实现才可换载。不手工修改，不保留其他版本产物。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
