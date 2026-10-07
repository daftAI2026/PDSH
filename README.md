<!--
[INPUT]: 依赖当前产品边界、tools/release-metadata.ts 的公开简介和用户授权展示图
[OUTPUT]: 提供产品、安装、兼容与隐私边界。保留头像开源致谢。
[POS]: PDSH 公开入口；截图是设置页示例，不冒充安装或原生打码验收
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->
# DSH 私密模式

<!-- pdsh:description:start -->
遮挡侧栏标题、自定义昵称与头像，截取并打码编辑当前窗口。不提供会话隔离。
<!-- pdsh:description:end -->

DeepSeek Harness Desktop 插件 · **0.5.1 版本** · [`v0.5.1`](https://github.com/daftAI2026/PDSH/tree/v0.5.1)

![插件设置与侧栏效果示例](https://raw.githubusercontent.com/daftAI2026/PDSH/main/docs/preview.jpg)

## 功能

- **标题遮挡**：帽子按钮切换工作区与会话标题的灰条显示。
- **本地身份**：自定义昵称、生成或上传头像，也可保留账号头像。
- **截图编辑**：拍摄当前 DSH 窗口；点击候选或手动画框打码，调整背景、边距，复制或保存图片。切到手绘只隐藏候选，不清除已打码区域。
- **背景图库**：保留五张预设，缓存系统静帧与上传图片。macOS 可显式获取最近两代系统的代表壁纸。
- **插件更新**：详情页检查稳定版本，确认后通过官方管理器安装；不静默安装或自行重启。
- **项目链接**：详情页底部提供 GitHub Star 提示和作者链接，语言跟随宿主。

## 安装

在 Harness **插件 → 添加插件 → GitHub 仓库地址**中填写：

```text
https://github.com/daftAI2026/PDSH
```

需要固定版本时选择 `v0.5.1`。已安装用户在插件详情页确认升级；请先阅读下列旧壳限制。

0.3.2 及更早版本首次升级需正常重启一次；此后协议兼容的截图/保存业务更新可自动换载。Config、Remote 协议或固定外壳变化仍需重启。

0.5.1 恢复仍运行 0.3.3–0.4.0 旧壳的截图/保存合同。壁纸是独立可选扩展；新接口未正常加载时不显示获取入口，已存图库仍可用。

此修复 tag 不是已运行 0.5.0 v2 壳的免重启迁移包。该壳不接受恢复的 v1 payload；不要把这一代壳的升级写成已兼容。官方正常加载与旧截图业务换载是不同边界。

## 环境与边界

- 目标宿主：**DeepSeek Harness Desktop 0.2.0-rc.2**。截图支持 macOS 14+（Apple Silicon / Intel）与 Windows 10 1903+ x64；助手随包提供，无需单独安装或双击 EXE。
- 保存 PNG、JPEG 或 WebP，复制为 PNG。默认目录为用户 home 下的 `Downloads`，可另选目录；重名自动编号，不覆盖已有文件。保存结果未知时先检查目录，不要立即重试。
- 系统壁纸适配依赖 Apple 本机目录。陈列关联不是系统版本 API。
  未知或歧义格式不补位，保留已存图片。
  只有显式获取才读取系统来源或补缺下载；普通浏览可使用缓存。
  Windows 不提供系统壁纸获取。
- 背景媒体与编辑偏好存在本地浏览器仓，不保存截图、源视频或原文件名。空间满时拒绝导入，不静默淘汰用户图片。
- 检测候选仅适用于已研究的 Mac 满窗布局，不是敏感内容检测。
  原生 PNG 候选对位与完整 Desktop 绘制仍待验收。
  暖切换像素一致性、当前深色主题及 Windows 实机也未完成验收。
  保存或复制前请检查图片。
- 显示遮挡不改变账号、原始文字、历史、日志或模型请求。PDSH 不提供会话隔离、凭据迁移或取证级隐私保证。

## 开发

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run bundle
```

[架构与协作](AGENTS.md) · [发布流程](PUBLISHING.md) · [样式来源](style-sources.json)

## 致谢

默认头像由 [blobatar](https://github.com/Alain00/blobatar) 在本地生成，遵循 MIT 许可证。完整许可见[第三方声明](THIRD_PARTY_NOTICES.md)。

## 许可

[MIT](LICENSE) · [第三方声明](THIRD_PARTY_NOTICES.md)。本项目非 DeepSeek 官方插件，`@daftai/pdsh` 未在 npm 发布。
