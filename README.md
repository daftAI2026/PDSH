<!--
[INPUT]: 依赖 0.1.0 安装包、DeepSeek Harness 官方插件管理接口与当前声明的显示边界
[OUTPUT]: 提供产品定位、安装/使用、兼容范围和开发入口，不记录逐次试验过程
[POS]: PDSH 公开使用契约；版本证据留在测试和维护记录，不把视觉遮挡误写为会话隔离
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# DSH 私密模式

PDSH（Private DeepSeek Harness）是 DeepSeek Harness 的第三方显示插件。**0.1.0 只改变本机窗口的呈现，不创建隔离会话。** 它适合临时演示、录屏或共屏时降低侧栏标题和账号外观的可见度；不适合保护敏感资料免遭读取。

## 能做什么

- 用跟随宿主主题的灰条遮挡已识别的工作区、会话标题，**包括尚未发送消息的“新会话”占位行**；搜索结果只遮标题与工作区名。
- 在搜索按钮旁提供帽子眼镜开关；开启、关闭均即时写入宿主设置，不替换搜索按钮。
- 在插件设置中选择本地昵称和头像：离线生成、校验后的本地 PNG/JPEG/WebP，或保留原账号头像。昵称由勾选/Enter 单独保存，Esc 放弃本次编辑。
- 停用插件时撤回自有节点、样式与遮罩标记，不改真实账号资料或原生会话数据。

> **边界：** 标题原文仍在 DOM、无障碍树和宿主数据中。菜单、路径、搜索摘要、重命名输入框、聊天内容、剪贴板、请求、日志与历史均不遮挡或清除。未知/歧义结构会跳过，不是防泄露保证。选“账号头像”会展示真实头像。帽子开关不启动私密窗口。

## 安装

目标版本：**DeepSeek Harness 0.1.7-rc.2**。侧栏入口与标题识别依赖该版本的 DOM；其他版本尚未声明兼容。PDSH 是 out-of-tree Cordis bundle，不修改或重签官方应用。

在 Harness **插件 → 添加插件 → GitHub 仓库地址**填写：

```text
https://github.com/daftAI2026/PDSH
```

稳定版以 [`v0.1.0` Git tag](https://github.com/daftAI2026/PDSH/tree/v0.1.0) 为锚点。建议固定该 tag 对应的提交，而不是让安装来源随 `main` 漂移。包标识 `@daftai/pdsh` 用于宿主识别，**不代表它已在 npm 发布**。安装第三方插件等同运行其代码，请先检查来源和依赖。官方机制见[打包与安装指南](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish)。

开发者也可以在“本地插件目录”填写本仓库 checkout 的绝对路径，或运行 `pnpm run bundle` 生成 `.tgz`，在独立 profile 使用官方 `dsh plugin --profile <name> add <tgz路径>`。不要用外部 CLI 改正在由 Desktop 独占的 `desktop` profile。

## 使用与更新

- 搜索左侧帽子眼镜：立即切换**侧栏标题遮挡**，不会导航到设置。
- **插件 → DSH 私密模式**：配置“遮挡侧栏标题”和“替换侧栏身份”。开关与头像操作即时保存；昵称有独立编辑草稿。
- 设置页的“插件更新”可手动检查 GitHub 稳定版本；确认“安装版本”后由 Harness 官方插件管理器安装固定提交。不会自动重启；若宿主提示需要重启，请在没有进行中任务时自行重启。从本地目录等来源安装的用户确认后将切换为 GitHub 来源。GitHub 推送本身不会替换已安装代码。
- 语言跟随 **Harness 设置 → 通用设置 → 语言**；插件不另存语言偏好，也不翻译自定义昵称。

## 结构与开发

```text
src/host/       Cordis 配置入口
src/shared/     Host/Client 共用的偏好验证与文案
src/client/     设置组件、侧栏 DOM 适配器、入口与样式
locale/         宿主离线发现的中英文包元信息
tests/          DOM、配置、生命周期和产物合同测试
build.ts       将 TypeScript 源码构建为宿主可加载的 JavaScript
```

源码和测试使用 TypeScript/TSX。根目录 `index.js`、`client.js`、`client.js.map` 是**生成并随包提交的运行产物**：Harness 按 JavaScript 入口加载，不能把它们简单改名为 `.ts`。`styles.css` 的宿主变量与视觉来源见 [`style-sources.json`](style-sources.json)。项目约定见 [`AGENTS.md`](AGENTS.md)。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run bundle
pnpm release:check # 提交完成且工作树清洁时运行
```

本地 DOM 测试不能替代真实 Desktop 验收。发布前须在目标版本检查新会话遮挡、搜索/侧栏折叠、停用恢复和设置写入；不要在用户主 profile 上做破坏性试验。

## 许可

PDSH 使用 [MIT](LICENSE)；内嵌与复用资源的许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。PDSH 不是 DeepSeek 官方插件。
