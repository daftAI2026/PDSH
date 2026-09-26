<!--
[INPUT]: 依赖 npm 官方发布/认证文档、package.json 与 Harness 的安装合同
[OUTPUT]: 提供尚未执行的首次 npm 发布检查表、预发布渠道和后续 OIDC 方向
[POS]: PDSH 维护者的发布边界；当前 private=true 防误发布，不承诺 scope 权限或完整 Desktop 兼容
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# npm 发布准备

> **尚未发布。** 当前仍保留 `package.json` 的 `private: true`。公开 GitHub 仓库、GitHub 安装成功和 npm 发布是三件不同的事。

## 当前可用渠道

GitHub 仓库：`https://github.com/daftAI2026/PDSH`。包标识是小写 `@daftai/pdsh`；GitHub 仓库大写不要求 npm 包名也大写。

目前优先通过 GitHub 地址或本地目录安装；三种入口和兼容边界见 [README](README.md)。仓库已携带 Client 预构建产物，没有安装时构建脚本。

## 首次发布前的门

1. **确认 npm 身份和 scope 权限。** `@daftai` 必须属于可用的 npm 用户/组织；GitHub `daftAI2026` 成员权限不等于 npm `@daftai` 的权限。查询不到包也不代表拥有 scope。
2. **明确本次公开的是哪种功能。** 至少通过目标 Desktop 的安装、昵称/头像、开关和恢复验收；若只发显示 MVP，README 必须继续说明“不隔离、不清历史”。
3. **专门审阅发布变更。** 仅在决定实际发布时移除 `private: true`，分配尚未使用的预发布版本（例如 `0.1.0-beta.1`），检查 README、许可证、依赖和归档白名单。
4. **先测试和打包。** `pnpm install --frozen-lockfile` → `pnpm test` → `pnpm run bundle`；检查 `npm pack --dry-run --json` 的成员，无凭据、测试 profile、日志、私人报告或宿主提取包。
5. **安装同一归档验收。** 用独立 Harness profile 安装拟上传的 `.tgz`；不能拿另一个 checkout 的成功替代待发布包验收。
6. **发布前 dry-run，再首次人工发布。** 登录有权限的 npm 账号并完成所要求的 2FA；不要把密码、验证码或 token 写进代码/聊天/日志。

以下命令是**将来发布时的步骤，本轮没有执行发布**，且当前 `private: true` 必须先由专门发布变更解除：

```sh
npm login --registry=https://registry.npmjs.org
npm whoami --registry=https://registry.npmjs.org
# 先对同一已验收归档演练；请替换版本路径
npm publish ./output/daftai-pdsh-0.1.0-beta.1.tgz \
  --dry-run --access public --tag next --registry=https://registry.npmjs.org
# 确认演练内容与权限后，再实际发布
npm publish ./output/daftai-pdsh-0.1.0-beta.1.tgz \
  --access public --tag next --registry=https://registry.npmjs.org
```

`--access public` 明确公开 scoped 包；`--tag next` 不把早期版本自动放到 `latest`。预发布后仍应使用明确版本或 `@next` 验收，不把 npm 发布当作插件兼容证明。

完成后，查询该版本/完整性/标签，并从 npm 下载该确切版本到独立 profile 验收，最后更新 README 的“包名”入口状态。**dry-run 不验证账号权限，也不会替代实际发布后的远端证明。**

依据：[npm scoped 公开包流程](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/) · [scope 的归属](https://docs.npmjs.com/about-scopes/) · [publish/dry-run/标签及同版本不可复用](https://docs.npmjs.com/cli/v11/commands/npm-publish/) · [private 字段的防误发布行为](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#private) · [发布认证与 2FA](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/)。

## 后续自动化，而不是现在塞入 token

首次包建立后，优先采用 npm **Trusted Publishing / OIDC**，绑定 GitHub 组织 `daftAI2026`、仓库 `PDSH` 和明确的 workflow 文件；需要 GitHub Actions `id-token: write`，npm CLI ≥11.5.1、Node ≥22.14.0。不要使用长期 npm token 作为默认方案，也不要把 `main` 每次推送自动当发布。

另一选择是 npm **staged publishing**：先暂存、审阅、再经 2FA 批准；但官方要求包已经存在，**不能用它创建第一个版本**。它需要 npm CLI ≥11.15.0、Node ≥22.14.0。

本轮未创建自动发布 workflow、npm 组织、token、tag 或 GitHub Release，避免不完整 MVP 被自动分发。

依据：[Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) · [staged publishing](https://docs.npmjs.com/staged-publishing/)。
