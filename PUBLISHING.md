<!--
[INPUT]: 依赖 package.json 唯一版本、可复现构建与 Harness 官方 bundle 安装合同
[OUTPUT]: 提供 Git tag 发布顺序、验收门与 npm 非默认渠道边界
[POS]: PDSH 维护者发布规则；不把 tag、GitHub Release、npm 包或 Desktop 兼容混为一谈
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 发布

PDSH 的默认分发是 **GitHub 仓库中的 Harness bundle**。`package.json.version` 是唯一手写版本号；`build.ts` 把它注入 `client.js`，包元信息也从同一清单读取。`v<version>` Git tag 是不可变的发布锚点，供安装和插件内更新发现。GitHub Release 是可选的发布说明页面，**不是 Harness 安装要求**。npm 仍为 `private: true`，没有 npm 发布流程。

## 每个版本

1. 修改 `package.json.version`，完成代码、翻译、文档和测试；不要手改生成的版本常量。
2. `pnpm install --frozen-lockfile`、`pnpm test`、`pnpm run bundle`；审查 `.tgz` 成员，确认没有凭据、profile、日志或私有研究资料。
3. 在目标 Harness 版本的**独立 profile** 用官方插件管理器安装同一 Git 提交/归档，检查新会话标题、搜索与折叠、设置字段、更新入口、停用撤回。DOM fixture 和成功打包不算 Desktop 验收。
4. 提交源码及预构建 `index.js`、`client.js`、`client.js.map`、`plugin-icon.svg`。工作树清洁后运行 `pnpm release:check`，再用 `v$(node -p "require('./package.json').version")` 打带注释的 Git tag。脚本拒绝版本不符、文档未同步、旧 tag 指向其他提交、缺少嵌入版本或脏工作树。
5. 推送提交与 **明确的 tag**；不要只推 `main` 并假设已安装插件会自动更新。发布说明可以写在 tag 信息或另建 GitHub Release，但不重复维护版本号。

插件详情的 `plugins.detail.badge` 槽位挂载时自动探测 GitHub 稳定 `vX.Y.Z` tag，并校验目标提交 SHA；没有更高版本就不显示入口。点击版本旁上箭头只展开来源提示，用户再次确认才经 Harness 官方 `pluginManager.installBundle` 安装固定提交。不会常驻轮询、自行重启或写偏好。安装成功是否立即应用由宿主返回值决定；若提示需重启，用户自行选时机。**从本地目录/npm 安装的用户确认更新后会切换为 GitHub 来源**，展开确认区必须明示。

包安装、bundle 选择和构建脚本批准由 Harness 宿主管理；用户主 `desktop` profile 不作为打包冒烟环境。网络失败、权限不足或运行中宿主状态变化时，以官方插件页显示的最终状态为准，不宣称原状态一定未改变。

## npm 不是默认发布

只有明确决定支持 npm 渠道并确认 `@daftai` scope 权限后，才单独审阅 `private: true` 的解除、公开许可和归档内容，再建立可信发布工作流。Git tag 和 GitHub 安装不要求 npm 包或 npm token。
