# lib/
> L2 | 父级: ../CLAUDE.md

- `typert.host.js`: 官方 generator 的 Host descriptor/schema，供 Loader 注册唯一 capture/save/wallpaper namespace；wallpaper 是新增 ABI，必须正常加载而非旧外壳热替换；禁止手写修补。
- `typert.host.d.ts`: 同次生成的 Host face 类型出口，不引入产品运行时。
- `typert.remote-client.js`: 官方 generator 的 Client contribution/codec，内联进唯一 lazy Client factory。
- `typert.remote-client.d.ts`: 官方生成的 Remote declaration merge，经公开 `./types` 引用同源 DTO。
- `capture-runtime/`: 构建生成的当前版本 Host 业务闭包；固定 Remote 外壳通过 Manager 当前自身包定位，不使用私有模块缓存。
- `types/`: TypeScript 从 shared 源发射的公开声明闭包，跟随协议源码而非独立维护。

官方 faces 的生成标记是源契约，不向第三方生成输出插入手写 L3；业务语义由 Host/shared L3 与本地图解释。源码改动后用 build/typecheck 重生成。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
