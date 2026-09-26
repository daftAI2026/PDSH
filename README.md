<!--
[INPUT]: 依赖 package.json 的 bundle/Client 入口、预构建产物及目标版本的验收事实
[OUTPUT]: 提供三种安装来源的准确填写方式、设置入口、开发步骤和显示-only 边界
[POS]: PDSH 的公开使用契约；安装状态与未验范围分列，不把 GitHub 公开等同 npm 发布
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# DSH 私密模式

项目/仓库标识 **PDSH = Private DeepSeek Harness**；界面展示名为 **DSH 私密模式 / DSH Private Mode**。DSH 指 DeepSeek Harness，名称不重复叠加 Private。`Private` 表示私密，`Preview` 表示预览，不是这里的缩写含义。

面向 DeepSeek Harness 的私密聊天插件，沿用 InCodex 的产品方向；当前早期 MVP 只实现同窗口显示能力。

> **早期 MVP，仅改变显示。** 不提供隐私会话、历史清除、日志保护或账户隔离，搜索左侧的帽子眼镜只切换标题遮挡，不创建隐私会话。原文仍在 DOM；不要把它当作防泄露系统。

## 功能

- 侧栏工作区、会话标题灰条；识别到的搜索结果标题与工作区名一起遮挡，跟随 Harness 主题。
- 搜索左侧帽子眼镜是遮挡开关，没有菜单、不跳设置；保留原生搜索，搜索展开时主动让位。
- 插件设置按“侧栏显示、显示身份、保存操作”编排；昵称与头像组合预览，支持离线生成、本地 PNG/JPEG/WebP 图片或保留账号原始头像。
- 开关立即生效；“保存”只提交昵称、头像与头像来源。停用时撤回自有显示资源，不改真实账户资料和原生菜单。
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

安装并启用后，点击搜索左侧的 **帽子眼镜** 切换标题遮挡。身份等设置请打开 **插件 → DSH 私密模式**（英文为 **DSH Private Mode**，技术包名仍是 `@daftai/pdsh`）：

1. 标题遮挡、显示身份两个开关立即写入宿主配置，不用再次保存。
2. 修改昵称、头像或头像来源后，在身份区点击“保存”；这些未保存草稿不影响当前显示。
3. 不需要时关闭开关，或停用整个插件。

目标版本为 **DeepSeek Harness 0.1.7-rc.2**。账号显示适配只识别该版本中唯一、已登录、结构明确的 sidebar launcher；未登录“更多”入口、未知或多重结构不替换，设置页会显示原因。

搜索入口是 **rc.2 版本相关 DOM 适配**，不是官方搜索子 slot；它读取原生按钮的实时 class/图标尺寸并追加自有节点；可见时只通过邻接样式将原生 searchSlot 的自动留白交给自有按钮，隐藏或卸载后原生对齐规则自动恢复，不复制或替换整个工作区浏览器。未知或多重结构跳过挂载。展开侧栏紧贴搜索左侧，收起侧栏在搜索上方。

身份区采用“资料摘要 + 独立字段行”：顶部头像、昵称摘要与右侧“更换头像”，下方显示昵称和头像来源。昵称点编辑才展开输入框，头像来源点“更换头像”才展开；右侧勾只完成本次昵称编辑，身份区的保存才应用昵称/头像。摘要头像为两个原生 Input 高度之和，圆形裁切参照宿主 AccountAvatar；不照搬参考图的邮箱或账户操作。头像来源有“按昵称生成”“选择本地头像”“使用账号头像”三种选择，都先编辑草稿、保存后应用。账号头像模式保留宿主原始节点，昵称可独立设置；预览只复用已显示图片，不把账户 URL 写入配置。**原始头像可能暴露身份**，该选项不提供匿名保证。

昵称有效时 Enter 或勾完成编辑，无效时留在字段内；Esc 只撤回本次昵称编辑并返回编辑入口，不撤销其他字段；输入法组合阶段不截断确认/取消字词。头像读取期间不能保存，但可以放弃或改选来源；迟到结果不会复活取消的草稿。保存只写改动字段，头像和来源作为同一事务；昵称/头像在别处更新时保留草稿并提示冲突，不覆盖最新值；仅切换开关或变更无关字段不会制造身份草稿冲突。

设置字号直接引用宿主 `--dsw-font-*`，间距/边线/头像尺寸从原生 `SettingsValueField` 和 `Input` 读取；编辑行最小高度读取原生 `Button`，不写数字 fallback。组间隙与行 padding 不重复累加；昵称输入靠右保持原生固有宽度，不拉伸成整行大输入。

标题与真实昵称/头像原始节点仍留在 DOM 中；本功能不是防泄露或匿名化系统。只遮挡确认的文字叶，不覆盖整行、时间、状态、图标或点击区域。搜索 snippet、工作区路径、菜单、重命名输入、对话内容、复制文本与无障碍文本不在遮挡范围内。HoverCard 没有公开 owner 链接，仅在结构及指针来源可确认时遮挡标题，未知结构保守跳过。原生账号菜单、网络、会话和文件访问行为不变。

## 验证状态

- mvp.11：本地回归覆盖 Host 配置/旧字段兼容、标题叶与搜索结果选择、HoverCard owner、原文与 marker 恢复、开关忙态/失败/只读、身份覆盖、设置草稿/原子保存/头像取消/昵称键盘/焦点/冲突、zh/en 与样式来源。
- mvp.11 / rc.2 Desktop：官方固定提交覆盖安装、Client SHA一致；安装时原有配置文件逐字节未改。帽子切换不导航，三条原生标题被遮挡且原文/行框尺寸不变；搜索结果两类文字叶、搜索退让、展开/rail实时颜色变量、工作区HoverCard标题通过。Native双击仍打开重命名，长文字临时DOM探针验证overflow:clip令scrollLeft保持0，不创建测试会话。
- mvp.12：即时开关、身份独立保存、check编辑器与间距修正需在更新安装后单独验收；不把本地回归或mvp.11截图当作新版本实窗证明。
- 先前 mvp.8 / rc.2 Desktop 已验官方覆盖更新、搜索左侧入口、横向身份编辑、三种来源、图片读取与放弃、zh/en、搜索退让、折叠重挂和整包停用恢复。
- 未承诺：会话隔离、历史/日志清除、DOM/剪贴板匿名化、跨版本兼容或无遗漏的录屏隐私。无需改 App 签名，不清缓存、不卸载其他插件。

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

这里刻意固定新 commit，让 pnpm 的依赖记录确实变化；重复同一 Git 地址/commit 不等于查询并升级最新代码。官方管理器复用同一包的配置，mvp.11 新增 `maskTitles`，移除旧 `frames` 的使用；不会把旧开关解释成新模式，也不要求清空缓存或账户。Desktop profile 由 Electron 独占管理，不用外部 `dsh plugin --profile desktop` 强行修改。

本地目录开发安装链接 checkout，拉取代码并重建 `client.js` 后仍需重启宿主确认新一代代码。npm 尚未发布，不用包名更新。

来源：[官方管理器的 inspect/installBundle](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/boot/plugin-manager/src/index.ts)、[官方插件页](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/client/ui-plugin-manager/README.zh.md)。

## 内置更新的可行性

尚未实现自更新按钮。官方 Remote 可以让本插件调用覆盖安装，省去手填地址；Git inspect 不查询最新版，需要另外提供可靠版本比较与用户确认。包替换仍需正常重启，不能叫“无重启刷新”。不通过 App 本体 updater 更新插件，不自动批准依赖脚本，不用外部 CLI 绕过桌面 profile 管理。

来源：[官方 Plugin manager](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/boot/plugin-manager/README.md)、[包替换与 HMR 边界](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/boot/hmr/README.md)。

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

安装包、Cordis 插件条目和 React 组件不是同一层。当前一个 PDSH 包、一个 Host 条目组合配置模型、Client 生命周期、设置组件、身份适配器、标题适配器与开关控制器；插件页显示“包含 1 个组件”，不表示包内只能有一项功能或一个 React 组件。

先按职责拆文件，只有需要独立启停或独立服务依赖时才增加运行时插件条目。官方也建议不要提前拆分独立包，见[能力分层](https://deepseek-harness.github.io/deepseek-harness/en/develop/practice/)与[组合和生命周期](https://deepseek-harness.github.io/deepseek-harness/en/develop/cordis-tutorial/06-composition-and-hmr)。

## 许可

PDSH 使用 [MIT](LICENSE)。内嵌 Blobatar 的独立许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。PDSH 不是 DeepSeek 官方插件。
