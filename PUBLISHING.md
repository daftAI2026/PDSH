# PDSH 分发与验收

PDSH 从 GitHub 仓库作为一个 Harness Bundle 安装。项目链接直接安装默认分支，不需要 tag、Git 命令或 npm 账号。tag 为稳定版本固定锚点与插件内更新服务，GitHub Release 页面可选。package.json.version 是唯一手写版本；运行 JavaScript 由 build.ts 预构建提交，不在用户安装时编译。

## RC 渠道

仅保留 rc/native-capture 一个实验分支。RC11 回到单一 @daftai/pdsh 包、pdsh Host 和 root Client；身份、标题遮挡、拍照是内部模块，使用独立设置开关，不是三个子依赖或用户分别安装的 Bundle。RC10 的 Git 子依赖被目标 PNPM 11.7.0 拒绝，旧冷启动/图谱测试不能替代真正安装。

1. 运行 pnpm install --frozen-lockfile、pnpm test、pnpm run bundle，检查归档和依赖许可；archive:check 自动核对明确当前版本的真实 tgz 成员/类型/字节和 SHA，不靠 output 中的旧包。归档含根 index.js、client.js/map、main.cjs、patch、图标和 locale，不含 components/、node_modules、profile、凭据、日志或私有研究。
2. 用 verify-host.ts 在独立临时 profile，明确提供并核对目标安装的工具路径/指纹，通过目标 Host 实际 PluginManager 和自带 PNPM 验证首装/热启用、单根元信息/Client、八组合功能设置、配置 revision 与停用/恢复。不关闭 blockExoticSubdeps，不接管全局解析器。HMR 排队适配不证明 Desktop UI。
3. 审查后提交、只推 RC；不推 main、不打稳定 tag、不发布 npm。GitHub 分支来源为 github:daftAI2026/PDSH#rc/native-capture。维护者固定 SHA 是复核步骤，不是普通用户安装前提；新远端 SHA 要重新通过官方 Manager，验收器核对被测版本/运行字节和锁文件解析 SHA。
4. 在实际 DSH 官方插件页装同一远端产物，核对来源/版本、即时启用、三个功能开关、原账号/标题恢复、搜索展开、折叠、主题、原生 Tooltip/Toast 和卸载清理。不打开或编辑用户配置文件。安装替换若由 Host 提示下次启动加载，先保留工作再正常退出；普通功能开关和拍照不能要求重启。
5. 原生拍照首次 Main 入口仍未通过。调试注入截到图片不是普通安装成功；不得宣称打通、用 DOM/系统抓屏回退、应用补丁/重签或反复启动绕过。取像后还要验收像素/DPR、独立嵌入视图覆盖、透明材质模拟边界、重拍/复制/保存/取消/停用及接口归还。

Git push 不会更新正在运行的插件。RC 不触发稳定 tag 更新提示；每次变动须重新生成、测试、推送，再经官方管理器安装。实验重装不是旧用户升级兼容证据。稳定 root name/id 不变；历史拆包/name-qualified 覆盖是否残留须用官方机制查证，不假设卸载等于清空配置。

## 稳定发布

正常稳定门是上述完整 Desktop 与原生拍照验收。v0.2.1 曾获明确允许带 Desktop 验收缺口发布；那是单版本例外，不适用于 RC11。旧 tag 不覆盖。

完成验收、同步 README/AGENTS 当前稳定版本、提交且工作树清洁后，运行 pnpm release:check，再明确创建并推送 v<version> tag；该命令故意拒绝 RC。插件详情徽标只查稳定 tag，安装需要第二次确认，经官方 Manager 固定 SHA，不自动重启、不写偏好或轮询。来源切换须明示。

npm 不是当前渠道；无发布账号不阻碍 GitHub 单包交付。不得引入未发布 npm 组件依赖。普通用户只安装 PDSH 一次，包内功能完整；任何升级失败以官方 application/error、Fiber/Client 和实际页面为准，不能伪造 ACTIVE。
