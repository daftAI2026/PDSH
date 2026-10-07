# lib/
> L2 | 父级: ../CLAUDE.md

- `typert.host.js`: 官方基础 Host 面，供 Loader 注册稳定截图/保存与历史壁纸兼容接口；不引用业务类或内部能力面。禁止手写修补。
- `typert.host.d.ts`: 同次生成的 Host face 类型出口，不引入产品运行时。
- `typert.remote-client.js`: 官方 generator 的 Client contribution/codec，内联进唯一 lazy Client factory。
- `typert.remote-client.d.ts`: 官方生成的 Remote declaration merge，经公开 `./types` 引用同源 DTO。
- `capture-runtime/`: 当前版本业务闭包。固定壳按自身安装身份定位；初始 thenable 等官方能力 Fiber，不改私有缓存。
- `runtime-capabilities/`: 同一 Bundle 内的真实反射包作用域。生成 owner 与版本由根 manifest 派生；子 Fiber 随当前业务注册。
- `types/`: TypeScript 从 shared 源发射的公开声明闭包，跟随协议源码而非独立维护。

官方 faces 的生成标记是源契约，不向第三方生成输出插入手写 L3；业务语义由 Host/shared L3 与本地图解释。源码改动后用 build/typecheck 重生成。
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
