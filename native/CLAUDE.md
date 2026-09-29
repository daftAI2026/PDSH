# native/
> L2 | 父级: ../CLAUDE.md

- `window-id.m`: 以 Electron 主进程 PID 在 CoreGraphics 在屏窗口列表中寻找唯一主窗口；多窗口时拒绝猜测，不接触截图像素。
- `window-id`: 由 `window-id.m` 编译的 macOS arm64/x86_64 通用可执行文件；Git 安装无需用户安装 Xcode，发布前验证源与产物同构。

维护者在仓库根执行 `clang -arch arm64 -arch x86_64 -framework Foundation -framework CoreGraphics native/window-id.m -o native/window-id` 重建；链接器 UUID 与输出路径有关，同一路径重复构建必须字节一致。打包后执行位可能丢失，Host 会复制到私有临时目录再执行。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
