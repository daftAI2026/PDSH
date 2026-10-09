<!--
[INPUT]: 依赖产品边界、双语发布说明、公开简介和用户授权展示图
[OUTPUT]: 提供中文产品入口并互链英文版。保留用户动作、兼容提醒和头像致谢。
[POS]: PDSH 公开入口；截图是设置页示例，不冒充安装或原生打码验收
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->
# DSH 私密模式

[English](README.en.md) · 简体中文

<!-- pdsh:description:start -->
遮挡侧栏标题、自定义昵称与头像，截取并打码编辑当前窗口。不提供会话隔离。
<!-- pdsh:description:end -->

DeepSeek Harness Desktop 插件 · **0.5.6 版本** · [`v0.5.6`](https://github.com/daftAI2026/PDSH/tree/v0.5.6)

支持 macOS 和 Windows，截图助手随插件提供，无需单独安装。

![插件设置与侧栏效果示例](https://raw.githubusercontent.com/daftAI2026/PDSH/main/docs/preview-zh.png)

## 功能

- **标题遮挡**：点击帽子按钮，切换工作区和会话标题的灰条遮挡。
- **本地身份**：自定义昵称，生成或上传头像，也可使用账号头像。身份替换默认关闭。未登录时也可替换“更多”入口的显示身份，原生菜单保持可用。
- **截图编辑**：拍摄当前 DSH 窗口，点击检测到的区域或手动画框打码，调整背景和边距后复制或保存。侧栏收起时，可从会话右上角的相机进入。
- **截图私密**：“私密标题”遮挡侧栏会话标题，“私密身份”遮挡侧栏头像和昵称。两个开关独立，切换后重拍。只有重拍成功才更新图像和开关，失败时两者保持不变。身份覆盖仅用于本次编辑。
- **背景图库**：提供五张预设背景，可添加自己的图片，或获取最多五张系统壁纸。刷新系统壁纸不会清除已存图片。
- **插件更新**：在详情页检查稳定版本，确认后通过官方管理器安装，不静默安装或自行重启。

## 安装

在 Harness **插件 → 添加插件 → GitHub 仓库地址**中填写：

```text
https://github.com/daftAI2026/PDSH
```

固定版本请选择 `v0.5.6`；已安装用户可在插件详情页确认升级。

**旧版提醒**：`0.3.2` 及更早版本首次升级需正常加载一次；运行中的 `0.5.0` 不支持免重启升级。[兼容说明](PUBLISHING.md#升级兼容)。

## 环境与边界

- 适用于 **DeepSeek Harness Desktop 0.2.0-rc.2**，支持 macOS 14+（Apple Silicon 和 Intel）与 Windows 10 1903+ x64。
- 保存 PNG、JPEG 或 WebP，复制为 PNG。默认存入主目录下的 `Downloads`，可另选目录；重名自动编号，不覆盖文件。保存结果未知时，先检查目录，不要立即重试。
- macOS 获取最多五张代表壁纸；Windows 选取最多五张已安装的默认与主题图片，不读取当前壁纸或联网下载。
- 图库和编辑偏好保存在本机，不保存截图、源视频或原文件名。空间满时拒绝导入，不自动删除图片。
- 遮挡只改变显示，不改账号、原始文字、历史、日志或模型请求。不提供会话隔离、凭据迁移或取证级隐私保证。

检测区域不是敏感内容检测，保存或复制前请检查打码。像素对位、深色主题及英文 Desktop 等仍未验。详见[使用细节](PUBLISHING.md#使用细节)与[完整验收状态](PUBLISHING.md#056-发布决定工作台终态与图库)。

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
