# tools/
> L2 | 父级: ../CLAUDE.md

- `generate-typert.ts`: 调用官方 Typert workspace generator；按根身份在临时真实 workspace 生成基础/内部能力面、manifest 和两份同源 DTO；不改生成 owner，不手写 descriptor。
- `pack-rc.ts`: 从显式公开源码白名单构建独立 `@daftai/pdsh-rc` 候选；私有 0700 staging、拒绝源链接与覆盖、保留 helper 执行位并校验真实 tgz，不安装或触碰 profile。
- `release-metadata.ts`: 唯一公开文案源与 package/locale/README/GitHub About/topics 一致性门；本地同步限字段，远端只经 `gh api` 显式同步与读回，不发布、不安装、不改版本。
- `assess-host-compatibility.ts`: 只读宿主依赖与七类触点盘点，限定源码/构建白名单并输出 imports、相对位置及扫描缺口；结果仅供人工核验，不安装、不运行宿主或推断目标兼容。
- `typert-protocol-reference/`: 固定 rc.2 upstream source 身份供 workspace 类型分析；不是 npm workspace、运行时依赖副本或归档成员。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
