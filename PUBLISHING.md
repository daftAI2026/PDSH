<!--
[INPUT]: 依赖 package.json 唯一版本、可复现构建与 Harness 官方 bundle 安装合同
[OUTPUT]: 提供稳定 Git tag 与固定 SHA 的 RC 分发顺序、验收门与 npm 非默认渠道边界
[POS]: PDSH 维护者发布规则；不把 tag、GitHub Release、npm 包或 Desktop 兼容混为一谈
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->

# 发布

PDSH 的默认分发是 **GitHub 仓库中的 Harness bundle**。`package.json.version` 是唯一手写版本号；`build.ts` 把它注入 `client.js`，包元信息也从同一清单读取。`v<version>` Git tag 是不可变的发布锚点，供安装和插件内更新发现。GitHub Release 是可选的发布说明页面，**不是 Harness 安装要求**。npm 仍为 `private: true`，没有 npm 发布流程。

## 无 tag 的 RC 验证渠道

`rc/native-capture` 是显式选择的实验分支，不是正式版本更新源。RC 可以在已披露 Desktop 验收缺口的前提下提交并推送，用来验证真实远端安装；不能据此宣称取像桥已经可用，也不放宽稳定版的验收门。当前 Main 首次入口受预设调试端口冲突限制，远端安装不会消除该限制。不得要求每次拍照或每次正常启动都额外重启。

1. 完成源码/生成物审查、`pnpm test`、`pnpm run bundle` 和归档/依赖许可检查；提交包括三个生成入口与包内 `main.cjs`，不依赖安装时编译。
2. 仅推送 RC 分支，核对远端提交 SHA；不推 main、不打 tag、不建正式 Release、不发布 npm。保留实验提交后，本地正式工作目录可回到 main；继续实验使用 RC 工作树。
3. 在 DSH 官方插件页关闭当前本地测试 Bundle，再通过“添加插件”安装 `github:daftAI2026/PDSH#<40位提交SHA>`。不卸载或重置配置。`#rc/native-capture` 可定位分支，但验收采用固定 SHA，避免测试过程中分支移动。
4. 若官方管理器提示下次启动加载，保留未保存工作后正常退出并打开 DSH；这是安装替换已有包的加载要求，不是拍照步骤。核对实际安装来源/SHA、版本和生成物，保留昵称、头像、标题及导出偏好，然后验收三组件启停和截图工作台。
5. 每次代码更新都重新测试、生成、提交并推送，再手动安装新的 SHA。Git push 不会替换正在运行的插件，也不新增自动更新按钮。RC 不参与稳定 tag 探测；完整验收后才另行决定正式发布。

`pnpm release:check` 是稳定 tag 的闸门，故意拒绝 RC；不得为预览分支取消稳定版本约束。

## 每个版本

`v0.2.0` 引入的已知验收缺口：安装后的 Desktop 工作台完整交互仍待验证；当前证据覆盖源码合同、独立 Web profile 的 Host route 和归档原生探针执行。`v0.2.1` 修正升级箭头、来源标签位置、昵称垂直对齐与错误归因；系统截图路线已退休，改为整个可见页面的 DOM 栅格化；本次按明确批准打 tag，并披露安装后 Desktop 验收未完成的限制。tag 不构成 Desktop 兼容证明；0.2.1 的单次发布例外不豁免后续版本的正常验收门。

1. 修改 `package.json.version`，完成代码、翻译、文档和测试；不要手改生成的版本常量。
2. `pnpm install --frozen-lockfile`、`pnpm test`、`pnpm run bundle`；审查 `.tgz` 成员，确认没有凭据、profile、日志或私有研究资料；确认旧 native helper 和已退休的 DOM 栅格化依赖不再进入归档，实际分发依赖的许可完整。
3. 在目标 Harness 版本的**独立 profile** 用官方插件管理器安装同一 Git 提交/归档，检查新会话标题、搜索与折叠、设置字段、更新入口、停用撤回；含截图的版本还须检查全视口侧栏展开/收起、原生像素与 DPR 保真、独立 webview/Platform 视图覆盖及失败恢复、相机位置、明暗主题、重拍/复制/保存与临时像素清理。DOM fixture、临时 Electron 窄桥和成功打包都不算安装件 Desktop 验收。
4. 提交源码及预构建 `index.js`、`client.js`、`client.js.map`、`plugin-icon.svg`，以及 `components/` 内两个包内入口、就近 manifest、元信息和拍照 `main.cjs`。不提交 node_modules，不把内部组件声明成另行安装的依赖；同时验证 Git 固定 SHA 和 tarball：profile 只安装根 Bundle，三个 patch 行仍能从真正的 Host 加载入口解析，并分别发现 Client manifest；离线 locale 文件存在不等于官方行元信息发现。rc.2 的文件入口会回退到 module URL，须单独验收展示，不冒充本地化行名称。相对插入路径由 DSH 锚定在 Bundle patch 旁；仅从 Bundle 内解析子包不算通过。工作树清洁后运行 `pnpm release:check`，再用 `v$(node -p "require('./package.json').version")` 打带注释的 Git tag。脚本拒绝版本不符、文档未同步、旧 tag 指向其他提交、缺少嵌入版本或脏工作树。
5. 推送提交与 **明确的 tag**；不要只推 `main` 并假设已安装插件会自动更新。发布说明可以写在 tag 信息或另建 GitHub Release，但不重复维护版本号。

插件详情的 `plugins.detail.badge` 槽位挂载时自动探测 GitHub 稳定 `vX.Y.Z` tag，并校验目标提交 SHA；没有更高版本就不显示入口。点击版本旁上箭头只展开来源提示，用户再次确认才经 Harness 官方 `pluginManager.installBundle` 安装固定提交。不会常驻轮询、自行重启或写偏好。安装成功是否立即应用由宿主返回值决定；若提示需重启，用户自行选时机。**从本地目录/npm 安装的用户确认更新后会切换为 GitHub 来源**，展开确认区必须明示。

包安装、bundle 选择和构建脚本批准由 Harness 宿主管理；用户主 `desktop` profile 不作为打包冒烟环境。网络失败、权限不足或运行中宿主状态变化时，以官方插件页显示的最终状态为准，不宣称原状态一定未改变。

### 未发布原生取像的额外门槛

当前源码已删除 DOM 重绘路线，消费 current-page PNG 窄契约；正式 `dshDesktop.pageCapture` 尚非已安装 rc.2 的 API。内部桥候选实现在拍照组件启用后的首次点击，通过短暂 Main inspector 加载包内模块，确认关闭后保留私有控制连接。发布须验证正式宿主实现或此插件桥的启动/端口冲突/取消/停用/失败关闭；未确认接口关闭时明确报错，不自行重启。还须验证 sender/main-frame/导航代次、取消后原生单飞配额、hide/销毁清理与实际像素上限，再完成上述安装件验收。不得用补丁化或重签用户 app、系统抓屏或 DOM 回退绕过这道门槛；已有 `v0.2.1` tag 不修改、不覆盖。

## npm 不是默认发布

只有明确决定支持 npm 渠道并确认 `@daftai` scope 权限后，才单独审阅 `private: true` 的解除、公开许可和归档内容，再建立可信发布工作流。Git tag 和 GitHub 安装不要求 npm 包或 npm token。
