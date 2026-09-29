<!--
[INPUT]: 依赖当前 package.json、DSH 官方插件管理器及截图工作台的实际平台边界
[OUTPUT]: 提供产品定位、安装/使用、兼容与开发入口，不记录逐次试验过程
[POS]: PDSH 公开使用契约；显示遮挡和本机截图均不冒充会话隔离
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# DSH 私密模式

PDSH（Private DeepSeek Harness）是 DeepSeek Harness 的第三方插件。在当前 **0.2.0-rc.1 源码**中，它提供侧栏显示遮挡、局部身份替换和 macOS 本机截图工作台。**它不创建隔离会话，也不是数据防泄露工具。** 已发布的稳定 tag 为 `v0.1.1`，尚不包含截图工作台。

## 功能

- **侧栏标题：** 帽子眼镜按钮立即切换工作区和会话标题的灰条遮挡，也识别原生“新会话”占位行；搜索结果只遮标题与工作区名。
- **显示身份：** 在官方插件设置中选择本地昵称、离线生成或本地光栅头像，也可以保留账号头像。只改变侧栏外观，不修改账号资料。
- **截图工作台（0.2 预览，macOS Desktop）：** 帽子右侧的相机点击后先截取当前唯一的 DSH 窗口，再打开编辑器。可重拍、标注遮挡区域、调整背景/边距，并复制或保存 PNG。界面跟随 DSH 的主题、字体、圆角与控件语义；照片、渐变与选色光谱保留为编辑内容颜色。截图不写入插件配置。
- **更新提示：** 打开自身插件详情时才探测 GitHub 稳定 tag；发现更高版本后，版本号旁出现上箭头。确认后由官方插件管理器安装固定提交，不自动重启。预发行版本不会触发稳定版提示。

> **边界：** 标题原文仍在宿主 DOM、无障碍树和数据中。截图工作台的“隐私遮罩”只在拍摄前尝试给已识别的侧栏标题和身份放置占位符；聊天内容、菜单、路径、日志、请求和其他窗口并不自动遮挡。打开工作台前请检查原始截图与最终导出。macOS 屏幕录制权限被拒绝、当前 DSH 窗口不唯一或窗口结构不被识别时，截图会失败或跳过建议区域，不会猜测截取别的应用。

## 安装与使用

目标宿主：**DeepSeek Harness 0.1.7-rc.2**。侧栏入口和标题识别是该构建的 DOM 适配，不声明兼容其他版本。PDSH 不修改或重签官方应用。

稳定版可在 **插件 → 添加插件 → GitHub 仓库地址**中填入 `https://github.com/daftAI2026/PDSH`，建议固定 [`v0.1.1`](https://github.com/daftAI2026/PDSH/tree/v0.1.1) 对应提交。要体验 0.2 截图预览，请使用此分支的本地 checkout 或将其构建归档安装到**独立 profile**；它尚不是稳定 tag。安装第三方插件即运行其代码，请先审查来源与依赖。官方机制见[打包与安装指南](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish)。

- 搜索旁帽子：即时切换标题遮挡；相机：立即截取当前窗口并在截图完成后打开工作台。
- **插件 → DSH 私密模式**：开关和“头像来源”选项即时保存；昵称勾选或 Enter 保存，Esc 放弃编辑。控件提示沿用桌面端 Tooltip 样式与交互。
- 语言跟随 **设置 → 通用设置 → 语言**，不另存语言偏好，也不翻译自定义昵称。
- Git 推送不会更新已安装插件；替换包后按宿主提示重启。不要用外部 CLI 修改正在由 Desktop 独占的 `desktop` profile。

## 开发

```text
src/host/            Cordis 配置与认证 PNG 截图 route
native/              CoreGraphics 唯一窗口 ID 探针及 macOS 通用产物
src/shared/          Host/Client 共享验证与文案
src/client/          设置、侧栏适配、更新入口与生命周期
src/client/capture/  截图工作台编辑、背景、遮挡、导出与 DSH 主题样式
locale/              官方离线发现的中英文包元信息
tests/               配置、DOM、样式来源、Host route 和生命周期合同
```

手写源码与测试均为 TypeScript/TSX（原生窗口探针为 Objective-C）。根目录 `index.js`、`client.js`、`client.js.map` 是**生成并随包提交的宿主运行产物**，不能简单改名为 `.ts`。可见 UI 规则及 DSH token 来源见 [`style-sources.json`](style-sources.json)；协作边界见 [`AGENTS.md`](AGENTS.md)。

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run bundle
pnpm release:check # 仅在提交完成、工作树清洁时运行
```

Node/jsdom 测试和单独的系统截图成功都**不能替代安装后的 Desktop UI 验收**。发布稳定 tag 前应在目标版本验证相机位置、主题明暗、屏幕录制权限失败、截图/重拍/复制/保存、停用恢复、搜索展开和侧栏折叠；不得破坏用户主 profile。

## 许可

PDSH 使用 [MIT](LICENSE)；复用资源的许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。PDSH 不是 DeepSeek 官方插件，`@daftai/pdsh` 也未在 npm 发布。
