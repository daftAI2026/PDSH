# tools/
> L2 | 父级: ../CLAUDE.md

- `generate-typert.ts`: 官方 Generator 生成基础/内部能力面及 DTO。Windows 用 junction 和 Node 驱动 tsc；固定 SHA 允许同源 LF/CRLF，拒绝内容漂移。
- `pack-rc.ts`: 白名单源码派生独立 RC。Windows 用自有 junction 复用依赖。拒绝覆盖，验真实 tgz；不安装插件。
- `pack-windows.ts`: 用 Node 配套 npm 选归档成员。用其 tar 写 Mac 助手 0755 元数据；字节门保持独立。
- `pack-bundle.ts`: 稳定身份归档入口。Windows 使用已验 ACL 的自有临时目录；字节门通过后原子提交 tgz。
- `native-baseline.ts`: Windows 构建复用固定 Mac 原生闭包。任一输入或助手变化时拒绝，要求 macOS SDK 重建。
- `windows-temp-ownership.ts`: 用真实 owner 和写 ACE 验 Windows 私有路径。祖先禁止替换权限；新目录先验继承权限，再保护空目录。不改全局 ACL。
- `release-metadata.ts`: 双语 README 与 package/locale 的唯一文案门。全部目标结构合格后才写允许字段。GitHub 仅经 gh 显式同步与回读，不发布或改版本。
- `assess-host-compatibility.ts`: 只读宿主依赖与七类触点盘点，限定源码/构建白名单并输出 imports、相对位置及扫描缺口；结果仅供人工核验，不安装、不运行宿主或推断目标兼容。
- `typert-protocol-reference/`: 固定 rc.2 upstream source 身份供 workspace 类型分析；不是 npm workspace、运行时依赖副本或归档成员。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
