# PDSH Agent Guide

本文件是所有 Agent 与 AI 的项目指南。
根 `CLAUDE.md` 是本文件的相对符号链接。
模块 `CLAUDE.md` 只描述局部结构。

禁止加入会话进度、验收流水和版本逐次记录。
其他 Agent 与 AI 必须遵守此边界。
任务原话、实验、故障和发布例外归入私人文档。
私人文档目录为 `daftAI-project-docs/pdsh/`。
只有长期架构、安全边界或协作流程变化才修改本指南。
单次实验结论不自动成为长期规则。

## Project

- PDSH 指 Private DeepSeek Harness。
- 公开名称为“DSH 私密模式”及“DSH Private Mode”。
- 代码仓库为 `https://github.com/daftAI2026/PDSH`。
- 稳定包名为 `@daftai/pdsh`。npm 发布保持关闭。
- 技术栈：TypeScript + React + Cordis + Typert。
- 原生助手使用 Objective-C++ 和 Windows C++。
- 目标宿主为 DeepSeek Harness Desktop `0.2.0-rc.2`。
- PDSH 是一个外置 Cordis Bundle，不是独立应用。
- 保留一个 `pdsh` 根 Config 和一个根 Client。
- 身份、标题、截图是内部模块，不是三个依赖包。
- 品牌不代表会话隔离或隐私保证。
- `../incodex` 提供行为与安全参考，不是移植模板。

## Product Direction

### 产品范围

- 在官方 Harness 窗口内提供视觉身份、标题遮挡和截图编辑。
- 保留官方应用、正常启动路径和官方插件接口。
- 设置留在官方 Plugins 页面。
- Host Settings 是插件配置的唯一持久化来源。
- UI 语言跟随 `ctx.locale`。
- `locale/*.json` 提供停用时仍可读取的包元信息。
- 不翻译用户昵称，不增加独立语言设置。
- 开关和头像来源立即提交。
- 昵称保留本地草稿，用勾选或 Enter 提交。
- Escape 取消昵称草稿。不增加全局 Save 按钮。
- 头像值与来源必须原子提交。
- 头像来源控件保留可见标签。
- 默认头像由 `blobatar` 在本地生成。
- 保留 README 上游致谢及完整第三方许可。

### 不做什么

- 不实现第二应用实例、CLI 产品或会话销毁模块。
- 不迁移凭据，不删除历史，不承诺取证级隐私。
- 不改账号、模型请求、日志或原始 DOM 文字。
- 不修改或重签 Harness 应用。
- 不添加第二安装器、配置仓或像素传输桥。
- 不为未知宿主或系统平台伪造 provider。
- 不把候选 RC 能力写成已发布稳定能力。

### 功能取舍

新增功能前确认四点：

1. 功能属于现有内部模块。
2. 官方接口能表达它，且不扩大权限。
3. 生命周期、取消和卸载能独立验证。
4. 用户能识别操作结果及未验边界。

先复用已有模型、错误码、logger、工具和状态范式。
不复制实现，不为假想需求新增抽象或设置。
InCodex 的所有权与路径安全约束应按目标场景保留。
不复制 Codex 目录、凭据、IPC、DOM 选择器或补丁路径。

## Repository Map

| 路径 | 职责与边界 |
| --- | --- |
| `AGENTS.md` / `CLAUDE.md` | 单一项目指南；保留根符号链接。 |
| `src/host/` | 唯一 Config、基础壳与版本化内部能力。详见局部地图。 |
| `src/shared/` | 两端共用的偏好、文案、DTO 和预算。 |
| `src/client/` | React 设置、更新入口和独立功能生命周期。 |
| `src/client/capture/` | 工作台状态、背景图库、合成和导出。 |
| `native/` | 包内 macOS universal 与 Windows x64 助手。 |
| `lib/` | 官方基础/内部能力面、声明和版本化运行产物。 |
| `tests/` | Node/jsdom 合同及 Windows 合成窗口原生夹具；不代替 Desktop 验收。 |
| `locale/` | 中英文导出包元信息。 |
| `tools/` | 构建、协议生成、RC staging 和只读宿主评估。 |
| `.agents/skills/pdsh-host-compatibility/` | 宿主升级评估与授权迁移；不安装普通插件更新。 |
| `.agents/skills/pdsh-release-lifecycle/` | RC 与正式版的验收、恢复和发布；不增加安装器。 |
| `.github/workflows/` | 固定 Windows SDK 构建；不自动发布。 |
| `.githooks/` | 本地稳定 tag 门；不覆盖用户 hooks。 |
| `docs/` | 用户授权的 README 展示图；不是验收回执。 |
| `README.md` / `README.en.md` | 双语产品入口；安装、兼容提醒和致谢成对同步。 |
| `PUBLISHING.md` / `PUBLISHING.en.md` | 双语渠道、发布门与版本决定；历史原文只保留一份。 |
| `plugin-icon.svg` | 构建生成的透明品牌图标；供插件元信息使用。 |
| `style-sources.json` | 上游文件、选择器、变量和图标来源。 |
| `THIRD_PARTY_NOTICES.md` / `LICENSE` | 完整分发许可。 |
| `package.json` / `pnpm-lock.yaml` | 单 Bundle manifest、唯一版本及锁定依赖。 |
| `cordis.patch.yml` | 唯一 Cordis 插入层。 |
| `build.ts` / `tsconfig*.json` | 构建与源码类型边界。 |
| `bundle-artifacts.ts` | 入口、双语 README、二进制、tgz 字节与权限验真。 |
| `verify-host.ts` | 临时 profile 的官方安装、业务与生命周期门；Windows 路径须验真实 ACL。 |
| `check-release.ts` | 长期发布章节、双语版本、产物与清洁树门。 |
| `tools/release-metadata.ts` | 公开简介和 Topics 的唯一声明。 |
| `tools/pack-rc.ts` | 同源临时 RC 构建；不安装到用户 profile。 |
| `tools/native-baseline.ts` | Windows 构建的固定 Mac 原生闭包复用门；输入漂移时拒绝。 |
| `tools/pack-windows.ts` | Windows 打包期写实际 tar 执行位；不增加安装 hook。 |
| `tools/pack-bundle.ts` | 稳定归档验成员、字节和权限后原子提交；拒绝覆盖。 |
| `tools/assess-host-compatibility.ts` | 只读触点评估；不启动 Host 或认证兼容。 |
| `tests/public-guides.test.ts` | 验证双语互链、指南边界、skill 同步与头像许可。 |
| `output/` / `node_modules/` | 忽略的证据、临时产物与依赖。 |

手写行为留在 TypeScript 或原生源码。
`index.js`、`client.js/map`、Typert 面和助手是生成产物。
Git 安装依赖这些已提交产物。不要分别手写它们。
`main.cjs` 和旧 Main/Inspector/socket 文件已退役。
旧文件与测试不是运行时回退，也不是安装件能力证据。

## Commands

先读取 `package.json`。脚本定义是命令事实来源。

| 命令 | 用途与副作用 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 安装锁定依赖；不改锁文件。 |
| `pnpm typecheck` | 生成 Typert 面和声明，再检查类型。 |
| `pnpm test` | 类型、构建、产物检查和全部 Node 合同。 |
| `pnpm test:windows-wallpaper` | 验真实固定系统壁纸、JPEG 与中途取消；不访问 profile。 |
| `pnpm test:windows-capture` | 重建 Windows 助手和自有合成窗口夹具。验证真实 PNG，不访问 Desktop profile。 |
| `pnpm build` | 重建 Host、Client 和版本化实现。 |
| `pnpm run bundle` | 构建、验产物、打包并验真实 tgz。 |
| `pnpm bundle:rc <候选号>` | 仅授权时构建同源 RC。Windows 重建本机助手，异平台原生输入须通过基线门。 |
| `pnpm metadata:check` | 只读核对本地公开简介。 |
| `pnpm metadata:check-github` | 只读核对 GitHub About、homepage 和 Topics。 |
| `pnpm compat:assess` | 只读列出宿主触点；输出不等于兼容验收。 |
| `pnpm release:check` | 清洁 main 上执行稳定发布门；不发布或安装。 |
| `node --experimental-strip-types --test tests/public-guides.test.ts` | 验证公共指南和头像致谢；不启动 Host。 |

安装、重建、同步远端和发布具有不同副作用。
命令清单不授予 tag、push 或实机安装权限。
`verify-host.ts` 的参数和边界见文件头及局部地图。
临时 profile 检查不准写入用户的 live Desktop profile。

## Critical Safety Rules

### 用户数据与操作权限

- 不修改或删除用户的 `~/.dsh`、会话、凭据或 Chromium 数据。
- 不把凭据复制到临时 profile。
- 不打印、提交或上传用户像素、路径、标题和账号数据。
- 普通插件互相信任。UI 点击不是 Host ACL。
- 原生媒体前后 stat 只检测路径漂移。
- 视频解码不提供同 UID 进程隔离。
- 所有权不明时停止清理，保留现场。
- 仅清理本任务已过期且明确自有的临时产物。
- 删除前核对路径、owner、符号链接与活动进程。
- 进程检查结果未知时保留文件。
- 未提交源码快照、候选和红证据不按时间批量删除。
- 结项后核对私人归档与当前复现依赖。
- 已归档且不再验收的旧包按清单删除。
- output 不是永久档案馆；保留必要的最小证据。
- 不杀未知进程，不修改全局 TLS、代理或信任根。
- 不接管 resolver，不放宽 exotic-subdependency 策略。

### Desktop 检查

- 不抢前台，不显式激活用户窗口。
- 原生点击仍会改变焦点。不要声称它完全无干扰。
- 仅使用已启用且确认身份的 loopback CDP。
- Host HTTP listener 不是 CDP endpoint。
- 不为启用 CDP 重启应用或开启 Inspector。
- 无真实 UI 能力时明确保留验收缺口。
- 不用后台检查冒充实际 Desktop 验证。
- 外部 CLI 不得绕过 Desktop 独占的插件操作。
- 实机安装、退出和重启须有本次授权。
- 替换包后遵守 Host 的加载或重启结果。
- 保留用户未保存工作，不伪造重启 API 或私有 IPC。

### 原生取像与保存

- 只拍摄唯一归属的普通 DSH 窗口，包含原生边框。
- mount 和 enable 不请求录屏权限或像素。
- 首次显式截图才检查或请求系统授权。
- 人工授权不设页面计时器。
- 启动与取像阶段必须有界。
- 取消、撤权和卸载须等待实际操作结算。
- 禁止 DOM 栅格化、Main 注入、CDP 取像和 HTTP 像素回退。
- 原生 `pointPixelScale` 决定编辑几何。
- 页面 DPR 与 `innerHeight` 不能证明整窗尺寸。
- 助手目标为 macOS 14+ arm64/x64 和 Windows 10 1903+ x64。
- Windows 分发必须含真实 MSVC x64 EXE 和 `asInvoker`。
- 截图像素不得写入 Settings 或日志。
- 诊断只记录白名单阶段、失败码和请求 UUID。
- 未知异常不反射路径、标题或 carrier 原文。
- 保存路径与 basename 由 Host 已接受的配置决定。
- Client 不提交任意路径或 basename。
- ask 用官方目录 picker，并通过 revision fence 接受目录。
- ask 不是原生文件名 Save dialog。direct 复用已接受目录。
- PNG、JPEG、WebP 使用有界有序 uplink。
- 保留逐块 ACK、finish/hash 和 half-close。
- Host 执行 fsync、close、独占提交和重名编号。
- 仅有效 commit receipt 后的自然流结束表示保存成功。
- 正常取消不得报成功，也不得覆盖已有文件。
- 提交结果未知时要求检查目录，不自动重试。
- PNG 剪贴板与文件保存保持独立。
- 导出沿用共享 32MP/128MB 预算。
- JPEG/WebP 只保留已验 Canvas 默认 sRGB ICC 原字节。
- 拒绝未知或重复 ICC、EXIF/XMP、comments 和动画。
- 不以通用 ICC 解析或去色彩配置替代此边界。

### Remote 与升级

- 使用官方 `pdshWindowCapture` 服务。
- namespace 保留 `pdshNativeWindowCapture`。
- Host/Client 面必须经官方 Typert generator 生成。
- 每次操作先确认完整 accepted 配置和实现版本。
- owner 仍在 LOADING 时，不把子服务永久锁为关闭。
- disposing/disposed 不得重新激活。
- 兼容业务实现须等旧操作结算后再换载。
- 截图/保存基础合同保持稳定，扩展独立声明。
- 扩展缺失或不兼容只撤回该扩展。
- 基础变更须保留旧壳兼容面并验证真实升级。
- 每项新增业务功能都须验同一官方 tag 升级路径。
- 升级后逐项核对入口、实际接口和业务动作。
- 基础截图恢复不代表新增能力已就绪。
- 实现版本独立演进，不用删除校验代替兼容。
- 新增业务接口随版本化实现注册官方能力面。
- 内部能力面属于同一归档，不增加安装依赖。
- 初始 thenable 等官方子 Fiber，不改变实例身份。
- 基础版本回复后，Client 仍须独立核对能力版本。
- Config、固定壳或依赖变化须正常加载。
- Client 本地方法不证明 Host 注册；扩展须实际握手。
- 首次桥 bootstrap 不是免重启升级证据。
- `setBundleEnabled` 只协调配置，不证明代码已重载。
- 保留 Host `restart-required`、官方 Modal 和行内提醒。
- 提醒只保证当前 controller；不承诺跨 Fiber 保留。
- 旧 Client 不能展示尚未载入的新逻辑。
- updater 仅用自身 detail badge 和用户确认的固定 Git SHA。
- 不后台轮询，不持久化更新状态，不静默安装。
- 自动重试只限以下官方结果同时成立：
  - `changed=false`；
  - `application=failed`；
  - `failedAt=spec-host`；
  - `packageResult.kind=timeout`。
- 重试前复核自身安装版本，并响应 disposal。
- 原尝试加重试最多两次。
- PNPM 失败、取消、状态前移和未知结果均不重装。
- Host 写入前校验 title、date、hash 和 chunks 的业务上限。
- Client 每次只发送一个待 ACK 的 chunk。
- Typert 的无界字符串发生在业务校验之前。
- 上游 WS 默认 100MiB，stream inbox 256KiB 在解析后限制。
- 插件预算不等于 hostile-Client DoS 防护或 ACL。
- 不手写 codecs，也不另建桥模拟上游传输边界。

## Working Rules

### 修改顺序

1. 进入目录前读取该目录的 `CLAUDE.md`。
2. 修改文件前读取 L3 契约及现有范式。
3. 行为修复先写能在旧实现失败的合同。
4. 实现后检查 L3、L2 和根指南。
5. 分别记录源码、产物、Host 和 Desktop 结果。

测试与候选结果只入本次授权的私人证据。
不把单次结果追加到本指南或 README。
产品能力与兼容边界仍须同步 README。
公开产品和发布说明须同步中英文。
两套说明互链；版本、平台和未验门同源。
历史原文及第三方许可保留原字节。
双语维护步骤见项目发布 skill。

缺失 L3 时先补契约。新模块必须有 L2。
L2 列出全部成员，保留有效父级链接。
契约陈述职责、依赖方向和数据流。
不得只罗列变量名或导出签名。
L2/L3 必须带固定 PROTOCOL 行。
文档与代码不同构时，任务未完成。

### 代码与写作

- 一个函数做一件事。高层依赖稳定边界。
- 复用已有错误类型、logger、请求封装和状态模式。
- 不添加重复日志路径、裸请求或第二状态仓。
- 单文件不超过 800 行。超限先拆职责。
- 中文注释使用 ASCII 分块。
- 交互使用中文，并以“哥”开头。
- GEB 文档采用 STE 启发的清晰规则，严格度 80%。
- 一句一事，用主动语态，中文句子不超过 40 字。
- 同一概念只用一个词。
- 不用模糊词。写明对象、条件和动作。
- 写断言，条件前置，步骤用祈使句。
- 简化文字不得删掉协议、边界或重要架构细节。
- 用户原话逐字保留，不能按写作规则改写。

### 协作与私人文档

- 只有主代理指派子代理。
- 子代理只使用 GPT-6 Luna，推理强度 Max。
- 子代理承担调研、编码、测试或审查。
- 主代理拆分、协调、验收并作最终决定。
- 并行编辑不得争用同一文件。
- 私人研究按 `private-docs-publish` skill 发布。
- 写入前获取 repository owner lock。
- 只提交本任务文件，不挪用他人 WIP。
- 不 stash、reset、clean 或强推共享私人仓库。
- 私人发布不授予公开 main、tag 或安装权限。
- 公开指南不收录私人用户数据或本机日志。

## Hotspot Ownership

### 功能装配与视觉身份

- `client-entry.tsx` 装配设置、样式、语言和更新生命周期。
- `component-runtime.tsx` 独立拥有身份、标题和截图 controller。
- 单个开关关闭只归还对应资源。Bundle 关闭归还全部资源。
- 保留 nickname、avatar、maskIdentity、maskTitles 地址。
- 官方 Plugins 依次展示身份、标题和截图设置。
- 功能标题本地化，不展示包路径。
- `captureEnabled` 独立控制相机、工作台和 stream。
- 会话相机追加官方 header utilities，不替换 corner。
- 两相机入口共用一个截图 controller。
- 会话相机只在侧栏收起时显示。
- 无 Session 的首页不渲染该会话插槽。
- 侧栏状态只读 rc.2 AppFrame 语义属性。
- root/main/sidebar 归属未知时隐藏会话相机。
- 根表单完整 accepted 且 revision 一致时才提交。
- 身份覆盖只作用于唯一识别的 rc.2 sidebar launcher。
- 保留 native button、账号节点、菜单及登录语义。
- 未知或多身份时跳过覆盖。
- 未登录默认保留原生 More。主动开启后只替换头像与文案。
- 身份替换保留原按钮、菜单、设置与登录语义。
- 未登录禁用账号头像。已选账号来源临时用生成头像。
- 登录状态不改头像配置。重新登录恢复账号来源。
- 账号头像选项不得把真实账户 URL 写入配置。
- 帽子直接切换 accepted `maskTitles`，不打开菜单。
- 搜索旁没有受支持的 child slot，不声称存在。
- 旧 `frames` 不改解释为标题遮挡。
- 临时截图遮挡复用现有 recognizer 和灰条规则。
- 临时遮挡仅归还仍由自身拥有的属性。
- 初拍与重拍均重读 `captureMaskIdentity`。
- 它独立于常驻 `maskIdentity` 和工作台标题遮挡。
- 只暂遮唯一 launcher 的头像、native name 和自有名牌。
- 不写常驻偏好，不改变昵称或账号设置。
- 工作台头像遮罩独立于标题和名称遮挡。
- 开关重拍成功后才提交来源和状态。
- 会话头像覆盖不持久化，失败保留原图。
- 标题 recognizer 保留 workspace、session 与 search 围栏。
- provisional 两格行须有非空 `session:` key。
- 其首格须为空，第二格须为纯文本 span。
- 畸形或歧义行不遮挡。
- HoverCard 标题必须与已识别 owner 关联。

### 主题、控件与编辑几何

- `style-sources.json` 记录真实上游文件、selector 与变量。
- 使用 DSH `--dsw-*` 语义色、字体、圆角和动效。
- 不复制 CSS Modules hash 或 Codex theme class。
- 不添加数值主题回退、Base UI 或 Tailwind runtime。
- 内容像素、渐变、色谱和透明棋盘不是主题 chrome。
- React 设置和更新入口使用 Host Tooltip。
- DOM 控件共用一个可卸载 Tooltip adapter。
- 保留 Host delay、placement、gap 和图标参数。
- 不回退到浏览器 title 气泡。
- 本地图标遵循固定 Lucide 1.51.0 路径。
- size、stroke 和 opacity 仍由实时 Host probe 决定。
- 不添加运行时图标库，不替换 Host 原生控件。
- `background-modes.ts` 对接受控 Host SegmentedControl。
- None/Color/Gradient/Image 保留四个稳定 ARIA 面板。
- inactive 面板 hidden/inert，且不进入焦点遍历。
- None 空面板不增加焦点停靠点。
- 切换类别立即应用该类别最近选择的材料。
- 显示全部渐变，不添加展开或重复标题。
- 自定义色 pipette 保持可见。
- 只减细选中环，不削弱键盘 focus outline。
- `editor-viewport.ts` 拥有 fit/pan 与合帧 transform。
- zoom 留在编辑模型，滚轮、工具栏和百分比共用它。
- 纯视图操作不重合成像素，不增加 easing transition。
- dispose 取消 RAF 和 pointer 状态。
- 自动候选只映射已研究的 Mac Electron 44 rc.2 满窗。
- renderer/native scale 必须相等，前后 bounds 必须稳定。
- 零原点是研究假设，不是原生 PNG 对位验收。
- 未知布局返回无候选；保留手绘和尽力的拍前遮挡。

### 系统壁纸与本地图库

- 系统壁纸按平台分流，不改变统一 Remote 合同。
- macOS 使用 Apple 官方目录与受控补缺下载。
- Windows x64 从固定系统目录候选中选至多五张。
- Windows 只读取当前已安装图片，不联网补图。
- 文件与分组名称不证明材料所属系统版本。
- Windows 不读当前用户壁纸、锁屏或网络来源。
- Windows 材料 ID 绑定来源字节，加载前重读目录。
- `system-wallpaper-catalog.ts` 独占活动 roster 来源。
- 目标为最近两代 macOS 的各两项代表材料。
- Apple metadata 没有逐材料 OS release 字段。
- 当前规则选两个 Landscape subgroup 的 unique preferredOrder。
- 用 representativeAssetID 关联 dynamic subgroup 或 root-owned 扩展。
- 陈列关联不是通用系统版本 API。
- 未知或歧义 schema 拒绝新增，保留已有缓存。
- UUID/源摘要是材料身份。历史 ID 只供缓存兼容。
- 不复用“当前/上一代”角色槽作为材料 ID。
- 只有当前 Host roster 授权来源；Renderer 不传 URL 或路径。
- 源 MOV 不跨 Remote；只传有界静帧。
- 每次显式获取都重读真实目录。
- 获取失败不得由旧缓存吞掉；离线浏览仍可用缓存。
- 仅唯一“获取系统壁纸”动作触发补缺下载。
- mount、Tab 重入和普通选择不发 Host 媒体请求。
- 图片面板复用就绪或在途本地库存。
- 首次读取或失败重试只读本地元数据。
- 导入、删除和显式获取后刷新库存。
- 不渲染读取提示、下载占位或额外进度行。
- 保留非视觉 busy、错误 alert 与空库存反馈。
- 获取按钮始终可见，获取不自动选择背景。
- 结算后一次发布新缩略图，保留已存材料。
- 系统缩略图保留精确无障碍名称，不加冗长媒体 tooltip。
- 原五张预设、系统壁纸和我的图片分组独立。
- 个人分组标题行仅一个加号；file input 归个人图库。
- 本地有效缓存或 root-owned 系统 HEIC 优先。
- 只有匹配的 local-unavailable 才下载该材料。
- 失败只携共享闭集码，不推断 TLS、代理或素材根因。
- 已知结构化证书拒绝可用 `download-certificate-failed`。
- 不按异常 prose 分类，不要求用户安装证书。
- Apple 视频只允许三段严格 206 Range。
- 头部为 64B，尾 moov 至多 2MiB，首 sync sample 至多 16MiB。
- 必须使用同一 strong ETag 和 If-Match。
- 拒绝压缩和跳转；源逻辑长度至多 1GiB。
- 实际媒体传输至多 18MiB + 64B。
- 先重建完整单 sample MOV，再交 native decode。
- 不使用可解码的截断电影或整段下载回退。
- transport 固定为 `/usr/bin/curl`，使用 `--disable` 和 `shell:false`。
- 使用系统默认 TLS，限制 headers、body 和 stderr。
- 不使用或修改 DSH 应用内 fetch/proxy dispatcher。
- 不添加 CA 环境、信任修改、提权或额外服务。
- 取消必须等待 child close 后再清理自有临时文件。
- `wallpaper-gallery-store.ts` 独占背景媒体仓。
- 使用标准 `dsh-app://app` origin 的 IndexedDB。
- 稳定与 RC 分域。偏好只存有效材料 ID。
- 保留已选系统静帧、上传图片与 PNG 透明度。
- 不存截图、源 MOV、原文件名、路径或凭据。
- 缓存命中不得重复取 helper 媒体。
- 容量遵循共享合同；满时拒绝，不静默淘汰用户图片。
- 仅显式移除自有条目。
- 关闭只释放连接、stream 和 URL，不清除已存材料。
- browser 持久化与正常 Desktop 重启必须分别验证。
- `wallpaper` Remote 是可选扩展，须纯注册握手。
- 壁纸 payload 合同独立于截图/保存基础合同。
- 基础壳 marker 不变；子 Fiber 注册本代能力面。
- 旧操作结算和子 Fiber 撤销完成后才换代。

## Testing and Review

- 修复合同须先在真实旧实现失败，再在新实现通过。
- 假 codec、Canvas、picker 和 transport 不证明真实链路。
- 测试断言必须能失败，且绑定实际生产路径。
- 不以旧 RC 或旧版本结果填入新候选。

分别核对以下门：

1. 源码、类型、unit 合同与失败码。
2. 当前生成入口、声明和原生助手。
3. 当前真实 tgz 的成员、类型、字节、权限和唯一版本。
4. 精确 Host 的官方 Manager、Loader、Settings 和 Client 图。
5. 首装、hot enable、八种功能组合及 revision 写入恢复。
6. 实际 Desktop 的主题、入口、切换、焦点和工作台。
7. 原生取像、预览/导出对位、复制、保存及取消。
8. Windows 实机、权限撤回和异常退出边界。
9. 升级、持久化、卸载 RC 和重新启用稳定包。

每份结果绑定候选版本、SHA 或 archive digest。
精确 Host 检查只拥有全新临时 profile。
禁止伪造 ACTIVE、解析成功或 Host 安装结果。
源码、归档与隔离 Host 通过不等于实机通过。
未运行、失败、取消和结果未知必须分别记录。
公开 README 描述产品，不记录逐次实验。
审查指南变更时运行 `tests/public-guides.test.ts`。
该测试守护文档结构，不能阻止任意工具绕过规则。

## Release

- RC 测试与正式发布先读项目内流程。
- 流程入口是 [.agents/skills/pdsh-release-lifecycle/SKILL.md](.agents/skills/pdsh-release-lifecycle/SKILL.md)。
- `package.json.version` 是唯一手写版本。
- 根 runtime、公开声明和包元信息必须同源生成。
- stable tag 使用 `v<version>`，旧 tag 不改、不删。
- 插件详情从稳定 tag 解析固定 SHA。
- GitHub Release 默认关闭。
- “发版”只授权 main 与稳定 tag。
- 只有另行明确授权才创建 GitHub Release。
- 公共简介与 Topics 由 `PUBLIC_METADATA` 声明。
- 比对脚本不能证明产品描述真实。
- 功能或验收边界变化时人工检查 README 和元信息。
- 先改声明，再显式执行本地与 GitHub 同步。
- 使用 `metadata:check` 和 `metadata:check-github` 回读。
- 网络或认证失败使发布门失败，不跳过。
- 稳定发布要求清洁 main 和 `release:check`。
- 发布前核对已发布壳的升级合同。
- 修复 tag 验证须有本次授权并披露已知失配。
- tag 上线不等于所有旧壳或原生门已通过。
- 发布门核对固定的 `Release` 章节。
- 当前版本留在 manifest 与两份 README，不绑定指南标题。
- 逐版本合同见 [PUBLISHING.md](PUBLISHING.md)。
- 历史合同不授予后续版本的发布或安装权限。
- 本地 pre-push hook 不能描述为服务器强制策略。
- 启用 `.githooks` 前核对用户 hooks 和 `core.hooksPath`。
- 不覆盖或遮蔽用户已有 hooks。
- 归档含 manifest allowlist 与 npm 固定附带文件。
- 固定附带文件仅为 package.json 和两份 README。
- 不归档 profile、node_modules、凭据、日志或私人研究。
- 最终归档必须保留助手 0755。
- Windows 只在打包期写入该 tar 模式。
- 所有平台都须验证归档实际模式和字节。
- 不用 bin、install hook 或运行时 chmod 修补归档。
- 发布、安装或未验门的例外须有本次明确授权。
- 单个版本的历史例外不授予后续权限。
- Git push 不会更新已安装包。
- 用户授权的临时 RC 仅在 staging 使用 `@daftai/pdsh-rc` / `pdsh-rc`。
- 不改稳定身份或既有 Config 地址。
- RC 保留独立设置和媒体仓，关闭稳定 updater。
- 测试前停用稳定包，不卸载它。
- 测试结束只卸载 RC，再重新启用稳定包。
- 未获本次稳定发布授权的 RC 保持本地。
- 未验门的发布例外只写入 PUBLISHING 与私人文档。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
