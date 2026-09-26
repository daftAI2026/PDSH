<!--
[INPUT]: 依赖 package.json 的 bundle/Client 入口、预构建产物及目标版本的验收事实
[OUTPUT]: 提供三种安装来源的准确填写方式、设置入口、开发步骤和显示-only 边界
[POS]: PDSH 的公开使用契约；安装状态与未验范围分列，不把 GitHub 公开等同 npm 发布
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# PDSH

DeepSeek Harness 的同窗口显示增强插件，沿用 InCodex 的早期显示体验。

> **早期 MVP，仅改变显示。** 不提供隐私会话、历史清除、日志保护或账户隔离，也尚未提供搜索旁的入口。已观察到 rc.2 展开侧栏的昵称/头像替换，完整 Desktop 生命周期仍待验收；不要据此录制敏感账户或对话。

## 功能

- 用户与助手消息灰线框，跟随 Harness 浅色/深色主题。
- 插件设置页中的灰框开关、显示昵称、离线生成头像和本地 PNG/JPEG/WebP 头像。
- 保存后应用设置；停用时撤回自有显示资源，不改真实账户资料和原生菜单。
- 使用宿主样式变量与原生控件；每条视觉依赖的提供文件/变量见 [`style-sources.json`](style-sources.json)。

## 在“添加插件”中填什么

三种来源是**任选一种**，不是需要依次填写的三个步骤。

| 入口 | 填写内容 | 当前状态 |
| --- | --- | --- |
| 包名 | `@daftai/pdsh` | npm 包标识，但**尚未发布到 npm**，暂时不要使用此安装入口。 |
| GitHub 仓库地址 | `https://github.com/daftAI2026/PDSH` | 源码和预构建 Client 随仓库提供；安装验证状态见下方。 |
| 本地插件目录 | 本机 PDSH checkout 的绝对路径，例如 `/absolute/path/to/PDSH` | 先在本机准备开发依赖，再通过 Harness 添加；不是 `.tgz` 文件路径。 |

仓库名是大写 **PDSH**；npm 包名保留合法的小写 **`@daftai/pdsh`**。GitHub 公开不等于 npm 已发布。

### GitHub 入口

在 Harness 的插件页选择“添加插件 → GitHub 仓库地址”，填写上面的 URL。为避免后续 main 改动，审阅后可固定到某个 commit；安装工具等价写法为：

```sh
dsh plugin --profile <你的profile> add github:daftAI2026/PDSH#<commit-sha>
```

仓库提交 `client.js` / `client.js.map`，Host 使用原生 ESM，不需要安装时运行 `prepare` 或构建脚本。不会要求放行编译脚本来下载另一个运行时。**插件加载本身仍会以你的权限执行代码**，请先确认来源可信。

### 本地目录入口

开发者克隆项目后：

```sh
git clone https://github.com/daftAI2026/PDSH.git
cd PDSH
pnpm install --frozen-lockfile
pnpm test
```

然后在“本地插件目录”填写当前 checkout 的绝对路径。Harness 会链接目录；不要在它仍启用时搬走或删除 checkout。

### 安装包备用方式

```sh
pnpm run bundle
# 生成 output/daftai-pdsh-<version>.tgz
# 若使用 Harness 的开发安装命令：
dsh plugin --profile <你的profile> add /absolute/path/to/daftai-pdsh-<version>.tgz
```

这是 Harness 自带的安装命令，不是 PDSH 新增产品 CLI。官方机制见[打包与安装文档](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish)。

## 设置与兼容边界

安装并启用后，打开 **插件 → @daftai/pdsh**：

1. 设置灰框、显示身份开关和昵称/头像。
2. 点击“保存”，未保存草稿不影响当前显示。
3. 不需要时关闭开关，或停用整个插件。

目标版本为 **DeepSeek Harness 0.1.7-rc.2**。账号显示适配只识别该版本中唯一、已登录、结构明确的 sidebar launcher；未登录“更多”入口、未知或多重结构不替换，设置页会显示原因。

真实昵称/头像原始节点仍留在 DOM 中；本功能不是防泄露或匿名化系统。原生账号菜单、网络、会话和文件访问行为不变。

## 验证状态

- 本地 13 项回归：Config 验证、纯偏好、lazy factory、DOM 覆盖/恢复、消息 selector、样式来源与停用生命周期。
- 确切 rc.2 提取 runtime 的独立 Web profile：mvp.3 的插件设置、保存/重启恢复、停用/启用，以及离线种子经原生消息组件呈现的浅色/深色灰框通过。
- 本轮 mvp.4：独立 profile 的本地目录安装/有效配置，以及 GitHub URL 的 CLI 安装通过；真实 Web 插件页也已完成填 URL → 安装 → 立即启用 → 打开设置，版本/默认设置/显示资源均正确。
- 用户安装的 mvp.4 / rc.2 Desktop：实际展开侧栏已显示配置的演示昵称与头像，设置页状态为“当前侧栏身份已替换显示”。这是当前窗口的视觉检查，不替代完整生命周期验收。
- **未验**：真实 Desktop 的收起/重挂/停用恢复、流式长对话、跨版本兼容。本轮检查未修改主 Desktop profile 或 App 签名。

## npm 发布状态

暂缓 npm 发布，继续保留 `private: true`。包名/scope 权限和目标 Desktop 验收通过后，先按 `next` 预发布，不直接覆盖 `latest`。维护者步骤见 [PUBLISHING.md](https://github.com/daftAI2026/PDSH/blob/main/PUBLISHING.md)。

## 开发

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run bundle
```

修改源码后必须重建并同时提交 `client.js` 与 `client.js.map`；Git/本地目录安装依赖这两个预构建文件。React 和官方 UI primitives 是宿主外部模块，不复制宿主，不嵌入第二套 React。

### 一个包，按职责组合组件

安装包、Cordis 插件条目和 React 组件不是同一层。当前一个 PDSH 包、一个 Host 条目组合配置模型、Client 生命周期、设置组件和身份显示适配器；插件页显示“包含 1 个组件”，不表示包内只能有一项功能或一个 React 组件。

先按职责拆文件，只有需要独立启停或独立服务依赖时才增加运行时插件条目。官方也建议不要提前拆分独立包，见[能力分层](https://deepseek-harness.github.io/deepseek-harness/en/develop/practice/)与[组合和生命周期](https://deepseek-harness.github.io/deepseek-harness/en/develop/cordis-tutorial/06-composition-and-hmr)。

## 许可

PDSH 使用 [MIT](LICENSE)。内嵌 Blobatar 的独立许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。PDSH 不是 DeepSeek 官方插件。
