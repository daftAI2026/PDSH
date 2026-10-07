# tools/
> L2 | 父级: ../CLAUDE.md

- `generate-typert.ts`: 调用官方 Typert workspace generator；按根身份在临时真实 workspace 生成基础/内部能力面、manifest 和两份同源 DTO；不改生成 owner，不手写 descriptor。
- `pack-rc.ts`: 白名单源码与双语说明派生独立 RC。自有 0700 staging 拒绝链接和覆盖，保留权限并验真实 tgz。不安装或触碰 profile。
- `release-metadata.ts`: 双语 README 与 package/locale 的唯一文案门。全部目标结构合格后才写允许字段。GitHub 仅经 gh 显式同步与回读，不发布或改版本。
- `assess-host-compatibility.ts`: 只读宿主依赖与七类触点盘点，限定源码/构建白名单并输出 imports、相对位置及扫描缺口；结果仅供人工核验，不安装、不运行宿主或推断目标兼容。
- `typert-protocol-reference/`: 固定 rc.2 upstream source 身份供 workspace 类型分析；不是 npm workspace、运行时依赖副本或归档成员。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
