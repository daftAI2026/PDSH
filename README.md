<!--
[INPUT]: 依赖 package.json 的 bundle/Client 入口、预构建产物及目标版本的验收事实
[OUTPUT]: 提供三种安装来源的准确填写方式、设置入口、开发步骤和显示-only 边界
[POS]: PDSH 的公开使用契约；安装状态与未验范围分列，不把 GitHub 公开等同 npm 发布
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# DSH 私密模式

项目/仓库标识 **PDSH = Private DeepSeek Harness**；界面展示名为 **DSH 私密模式 / DSH Private Mode**。DSH 指 DeepSeek Harness，名称不重复叠加 Private。`Private` 表示私密，`Preview` 表示预览，不是这里的缩写含义。

面向 DeepSeek Harness 的私密聊天插件，沿用 InCodex 的产品方向；当前早期 MVP 只实现同窗口显示能力。

> **早期 MVP，仅改变显示。** 不提供隐私会话、历史清除、日志保护或账户隔离，搜索旁的帽子眼镜入口打开显示设置，不会创建隐私会话。已观察到 rc.2 展开侧栏的昵称/头像替换，完整 Desktop 生命周期仍待验收；不要据此录制敏感账户或对话。

## 功能

- 用户与助手消息灰线框，跟随 Harness 浅色/深色主题。
- 搜索旁的显示设置入口，保留原生搜索，搜索展开时主动让位。
- 插件设置按“对话显示、显示身份、保存操作”编排；昵称与头像组合预览，支持离线生成头像和本地 PNG/JPEG/WebP 图片。
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

安装并启用后，点击搜索旁的 **帽子眼镜**，或打开 **插件 → DSH 私密模式**（英文为 **DSH Private Mode**，技术包名仍是 `@daftai/pdsh`）：

1. 设置灰框、显示身份开关和昵称/头像。
2. 点击“保存”，未保存草稿不影响当前显示。
3. 不需要时关闭开关，或停用整个插件。

目标版本为 **DeepSeek Harness 0.1.7-rc.2**。账号显示适配只识别该版本中唯一、已登录、结构明确的 sidebar launcher；未登录“更多”入口、未知或多重结构不替换，设置页会显示原因。

搜索入口是 **rc.2 版本相关 DOM 适配**，不是官方搜索子 slot；它读取原生按钮的实时 class/图标尺寸并追加自有节点；可见时只通过邻接样式将原生 searchSlot 的自动留白交给自有按钮，隐藏或卸载后原生对齐规则自动恢复，不复制或替换整个工作区浏览器。未知或多重结构跳过挂载。展开侧栏紧贴搜索左侧，收起侧栏在搜索上方。

身份区采用“资料摘要 + 独立字段行”：顶部头像、昵称摘要与右侧“更换头像”，下方显示昵称和头像来源。昵称点编辑才展开输入框，头像来源点“更换头像”才展开；“完成编辑”只收起输入框，仍需底部保存。摘要头像为两个原生 Input 高度之和，圆形裁切参照宿主 AccountAvatar；不照搬参考图的邮箱或账户操作。头像来源有“按昵称生成”“选择本地头像”“使用账号头像”三种选择，都先编辑草稿、保存后应用。账号头像模式保留宿主原始节点，昵称可独立设置；预览只复用已显示图片，不把账户 URL 写入配置。**原始头像可能暴露身份**，该选项不提供匿名保证。

昵称编辑中 Enter 完成编辑，Esc 只撤回本次昵称编辑并返回编辑入口，不撤销其他字段；输入法组合阶段不截断确认/取消字词。头像读取期间不能保存，但可以放弃或改选来源；迟到结果不会复活取消的草稿。保存只写改动字段，头像和来源作为同一事务；设置在别处更新时保留草稿并提示冲突，不自动覆盖最新值。

设置字号直接引用宿主 `--dsw-font-*`，间距/边线/头像尺寸从原生 `SettingsValueField` 和 `Input` 读取；编辑行最小高度读取原生 `Button`，不写数字 fallback。

真实昵称/头像原始节点仍留在 DOM 中；本功能不是防泄露或匿名化系统。原生账号菜单、网络、会话和文件访问行为不变。

## 验证状态

- 本地 39 项回归：Config 验证、纯偏好、zh/en 字典和包文本、lazy factory、DOM 覆盖/恢复、搜索邻接与重挂、草稿/原子保存、头像异步取消、昵称字段取消、冲突及继承语义、焦点保持、消息 selector、样式来源与停用生命周期。
- mvp.10：新增设置交互回归通过；冗余介绍和正常状态小字移除、非法昵称保留头像预览、编辑高度稳定规则仅完成源码/契约检查，尚未完成该版本的 Desktop 中英文/窄屏/键盘实窗验收。已安装 mvp.9 不会因 Git 推送自动变化。
- 后续目标已改为侧栏工作区/会话标题灰条，帽子直接切换遮挡；当前消息描边与设置导航入口是待替换的旧实现，尚未完成新目标，不应据此保护录屏内容。
- mvp.5 / 确切 rc.2 runtime 的独立 Web profile：原生入口导航、搜索让位、分组设置，中英文/浅深色/宽窄窗口实绘检查；不等同用户 Desktop 已加载新版本。
- 确切 rc.2 提取 runtime 的独立 Web profile：mvp.3 的插件设置、保存/重启恢复、停用/启用，以及离线种子经原生消息组件呈现的浅色/深色灰框通过。
- 本轮 mvp.4：独立 profile 的本地目录安装/有效配置，以及 GitHub URL 的 CLI 安装通过；真实 Web 插件页也已完成填 URL → 安装 → 立即启用 → 打开设置，版本/默认设置/显示资源均正确。
- 用户安装的 mvp.4 / rc.2 Desktop：实际展开侧栏已显示配置的演示昵称与头像，设置页状态为“当前侧栏身份已替换显示”。这是当前窗口的视觉检查，不替代完整生命周期验收。
- mvp.6 / 用户安装的 rc.2 Desktop：经本机 CDP 从官方插件页覆盖安装固定 Git commit，收到“下次启动后加载”并正常重启。安装后 Client 摘要与源码相同，原有 profile 设置文件逐字节未改；搜索邻接入口、中文/英文名称与简介、设置热切换、草稿保留/放弃、真实侧栏显示身份、搜索让位与收起/展开重挂通过。
- mvp.8 / 用户安装的 rc.2 Desktop：固定 Git commit 覆盖更新并正常重启，Client 摘要匹配；入口已实测位于搜索左侧，原生间距 4px。横向头像/昵称编辑、三种来源草稿选择、本地 PNG 读取、放弃修改、中英文展示、搜索展开退让、侧栏折叠重挂、整包停用恢复通过。660px 为同一 Electron 渲染器的 CDP 视口模拟，不是另一网页或真实窗口缩放；未见横向溢出。退出调试后正常启动，端口已关闭，原有插件设置文件逐字节未改。
- **未验**：账号头像新开关在真实 Desktop 的保存后重启持久化（Host schema、原子保存交互和原生头像保留已有本地回归）、流式长对话、跨版本兼容。此次更新只走官方包管理和用户授权的正常重启，未改 App 或签名，不清缓存、不卸载用户插件。

## 中英文切换与展示名称

语言跟随 Harness，不在插件里再保存一份语言偏好：

- 中文：**设置 → 通用设置 → 语言 → 中文**。
- English: **Settings → General → Language → English**。

设置页、提示和搜索入口文案实时切换；不会改写你的显示昵称，也不会因为切换语言丢失未保存草稿。Harness 负责语言偏好的持久化，不需要重装 PDSH。

运行文案通过官方 `ctx.locale.register('pdsh', { zh, en })` 注册，设置 slot 获得框架的 `t`；非 React 搜索入口通过 `ctx.locale.subscribe` 刷新。插件列表、详情和组件名称/简介由导出的 `locale/en.json` / `locale/zh.json` 提供，停用时也可读取，不靠激活插件翻译。安装预览仍展示清单/注册表的技术信息，这是宿主接口的边界。

来源：[官方 Locale 接口](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/client/locale/README.md)、[插件展示元信息](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/docs/cookbook/adding-a-package.zh.md#plugin-display-metadata)。

## 已安装插件怎样更新

**推送 GitHub 不会自动更新本机已安装代码。** rc.2 插件管理提供安装/启停/卸载；包代码替换和语言切换不是同一种热更新。

GitHub 来源可以通过官方“插件 → 添加插件”覆盖安装，填入**新的、已审阅 commit**，不要先卸载：

```text
github:daftAI2026/PDSH#<新的完整commit-sha>
```

先保存现有草稿；等待安装成功及“需要重启”提示，再在没有进行中任务时正常退出并重新打开 Harness。插件详情版本应变为所选提交的目标版本。只刷新网页或关闭再开启插件不证明新 JavaScript 已加载。

这里刻意固定新 commit，让 pnpm 的依赖记录确实变化；重复同一 Git 地址/commit 不等于查询并升级最新代码。官方管理器复用同一包的配置，PDSH 本轮未改变设置 schema，不要求清空缓存或账户。Desktop profile 由 Electron 独占管理，不用外部 `dsh plugin --profile desktop` 强行修改。

本地目录开发安装链接 checkout，拉取代码并重建 `client.js` 后仍需重启宿主确认新一代代码。npm 尚未发布，不用包名更新。

来源：[官方管理器的 inspect/installBundle](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/boot/plugin-manager/src/index.ts)、[官方插件页](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/client/ui-plugin-manager/README.zh.md)。

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

插件页的 `pdsh` 是 Cordis 运行时条目 ID，`@daftai/pdsh` 是 npm 安装包/模块名；是同一个插件的技术标识，不是重复安装。这两个字段由官方插件页呈现，不通过 DOM 遮盖管理信息。

安装包、Cordis 插件条目和 React 组件不是同一层。当前一个 PDSH 包、一个 Host 条目组合配置模型、Client 生命周期、设置组件和身份显示适配器；插件页显示“包含 1 个组件”，不表示包内只能有一项功能或一个 React 组件。

先按职责拆文件，只有需要独立启停或独立服务依赖时才增加运行时插件条目。官方也建议不要提前拆分独立包，见[能力分层](https://deepseek-harness.github.io/deepseek-harness/en/develop/practice/)与[组合和生命周期](https://deepseek-harness.github.io/deepseek-harness/en/develop/cordis-tutorial/06-composition-and-hmr)。

## 许可

PDSH 使用 [MIT](LICENSE)。内嵌 Blobatar 的独立许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。PDSH 不是 DeepSeek 官方插件。
