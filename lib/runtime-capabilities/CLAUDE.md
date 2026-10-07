# lib/runtime-capabilities/
> L2 | 父级: ../CLAUDE.md

- `package.json`: 根身份派生的真实 private 包作用域。版本由根 manifest 生成；不安装第二依赖。
- `typert.host.js`: 官方能力反射面。版本化业务在自有子 Fiber 注册，不覆盖旧基础面。
- `typert.host.d.ts`: 同次生成的 Host 面声明。
- `typert.remote-client.js`: 官方能力 Remote 贡献，内联到唯一根 Client。
- `typert.remote-client.d.ts`: 官方 Remote 声明，self-reference 指向同源 ./types。
- `types/`: 从 shared 源复制的 TypeScript 声明闭包。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
