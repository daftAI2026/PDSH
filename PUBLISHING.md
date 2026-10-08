<!--
[INPUT]: 依赖唯一版本、元信息、发布门和官方管理器。依赖双语说明与旧指南合同。
[OUTPUT]: 规定中文交付、升级兼容与独立验收门。互链英文版，保存历史合同原文。
[POS]: 根发布契约；区分源码、归档、实际安装和桌面行为，不将构建成功冒充实机通过
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->
# PDSH 分发与验收

[English](PUBLISHING.en.md) · 简体中文 · [README](README.md)

PDSH 通过 GitHub 仓库作为一个 Harness Bundle 安装。
普通用户在官方插件页填写项目链接。
管理器从默认分支安装。
用户不需 Git 命令、npm 账号或另装截图助手。
稳定 tag 是插件内升级的版本锚点。
GitHub Release 默认关闭。
“发版”只授权 main 与稳定 tag。
只有另行明确授权才创建 GitHub Release。

更新来源见 [update-source.ts](src/client/update-source.ts)。
它只读 GitHub tags API，不读 releases API。
更新决策见 [updater.ts](src/client/updater.ts)。
它比较稳定 SemVer，并安装 tag 对应的固定 SHA。
Release 页面与附件不是升级依赖。
`package.json.version` 是唯一手写版本。
运行产物预构建后提交，不在用户安装时编译。

DSH 宿主升级引发接口或布局变化时，使用项目内 [pdsh-host-compatibility skill](.agents/skills/pdsh-host-compatibility/SKILL.md) 先评估再适配。`pnpm compat:assess` 提供只读源码触点盘点，不操作 DSH、不认证兼容；skill 和工具都不是 PDSH 自身更新安装器，也不替代下列发布与实机验收门。

RC 测试与正式发布使用项目内 [pdsh-release-lifecycle skill](.agents/skills/pdsh-release-lifecycle/SKILL.md)。
它编排现有工具，绑定候选字节与实际运行证据。
它不授予安装、重启或发布权限，也不保存逐次进度。

## 公开元信息与 tag 守门

公开简介和 Topics 的唯一源是 `tools/release-metadata.ts` 的 `PUBLIC_METADATA`。
工具只同步两份 README 标记内的单行简介。
产品、安装、兼容和未验门须双语同步。
正文与展示图仍由人工审查。
机器比对不能证明功能或隐私承诺属实。

```sh
pnpm metadata:sync          # 同步双语 README、包简介和插件元信息；不改版本
pnpm metadata:check         # 本地只读校验
pnpm metadata:sync-github   # 显式同步 About、主页和 Topics，并读回核对
pnpm metadata:check-github  # 远端只读校验，网络/鉴权失败即失败
pnpm test
pnpm run bundle
# 审查并提交后，在干净 main 执行：
pnpm release:check
```

首次使用本仓时先检查 `git config --get core.hooksPath` 与默认 `.git/hooks/` 中的有效 hooks。未配置且没有用户自建 hooks，或已指向 `.githooks` 时，才执行 `git config --local core.hooksPath .githooks`；已有其他 hook 不覆盖。版本化 pre-push 会在创建稳定 tag 的推送前运行对应 `release:check`，About/Topics 或本地简介未同步即拒绝；旧稳定 tag 不允许改写或删除。普通分支/RC 推送不受稳定门影响。

这是本地保护，可被 `--no-verify` 或未启用 hook 的其他克隆绕过，不是 GitHub 服务器规则。校验只读，不自动修补、提交、发布或操作 DSH。发布之后才发现插件简介漏改，需随下一版本交付，不移动已发布的旧 tag。

发布门核对 AGENTS 的固定 `Release` 章节。
当前版本由 manifest 与两份 README 核对。
指南不绑定逐版本标题。

## 单包和原生产物

保留一个 `@daftai/pdsh` Bundle、一个 `pdsh` Host 和一个 root Client。身份、标题遮挡、截图是内部功能，不拆成依赖包。包内 macOS 和 Windows 助手仅由 Host 在用户点击截图后启动，完成后退出；不增加安装器、常驻服务、本地服务器或 Main 调试桥。

macOS helper 经 `native/build.sh` 构建为最低 macOS 14 的 arm64/x86_64 universal 文件。`pnpm run bundle` 用 npm 选择成员并验真实 tar 0755；POSIX 源文件与归档独立核对执行位，Windows 的 stat 不证明 POSIX 模式。不用安装 hook 或运行时 chmod 修补包装错误。

Windows 可构建稳定包或 RC。
本机 SDK 重建 Windows 助手。
Mac 助手及全部编译输入须匹配固定基线。
任一输入变化时，要求 macOS SDK 重建。
复用不代表本次运行了 Mac 编译或实机验收。
Windows 打包器用 Node 调用 npm CLI。
正式归档留在已验 ACL 的私有临时目录。
Windows 构建工作区不视为私有目录。
其 tar 在打包期写入助手 0755。
归档门独立验成员、字节、架构和模式。

Windows helper 经 `native/windows/build.ps1` 在 Windows SDK/MSVC 上编译。`native-windows.yml` 运行真实 Windows 保存目录合同，上传短期 x64 构建物，不执行截图或自动发布。按构建提交核对 CI 与下载摘要，再将真实 PE 提交到 `native/windows/window-capture-x64.exe`。发布门校验 x64、控制台 PE 与 `asInvoker` manifest；缺失或伪造产物不得发包。编译、目录合同和 PE 检查都不是 Windows Desktop 实机验收。

## 升级兼容

0.3.2 及更早版本首次升级需正常加载一次。已有 v1 业务壳可沿插件内同一 tag 路径换载截图、保存及新增业务接口；根 Config、基础 Remote 协议或固定壳变更仍是独立加载边界。

0.5.2 保留 v1 截图/保存合同，并随当前业务装配独立壁纸接口。入口须核对实际后台版本与能力；旧图库仍可离线浏览。同进程官方 tag 升级须分别验证截图和壁纸，不以安装成功代替功能就绪。

此修复 tag 不是已运行 0.5.0 v2 壳的免重启迁移包。该壳不接受恢复的 v1 payload；不要把这一代壳的升级写成已兼容。官方正常加载与旧截图业务换载是不同边界。

## 临时 RC 共存测试包

RC 复用上述平台构建和归档门。

`pnpm bundle:rc 1` 从当前公开源码建立独立临时 staging，以同一构建器生成 `@daftai/pdsh-rc` / `pdsh-rc` 和编号候选版本（基础版本取正式 manifest）；正式包名、版本及已有发布归档不改。界面元数据标明 RC，配置和浏览器编辑偏好隔离，不提供正式更新安装。输出放在 `output/rc/`，同一候选不覆盖；收据记录源码脏状态与摘要，不把未提交代码冒充稳定 tag。

安装仍走官方插件管理器：先停用正式包，再安装并启用 RC；通过后卸载 RC、重新启用正式包，不卸载正式包。两个包不能同时启用，Remote 服务和视觉适配器仍是同一能力；包准备成功不等于实际共存、卸载或 Desktop UI 已验收。此工具不安装到用户 profile、不重启 Host，也不自动发布 RC 或稳定版。

合并时不做反向改名或恢复备份：正式 manifest/locale/patch 始终保留正式身份，RC 转换只作用于临时 staging。只提交同源功能和打包工具，`output/rc/` 归档不入 Git；正常 `pnpm test` 验证正式身份兼容，`pnpm build` 仍生成正式运行产物。不得把 staging 中的 RC manifest、入口或生成文件复制回正式源码树。

## 必须分开的检查

### 系统壁纸与本地图库

稳定版 0.5.4 仅在 macOS 提供系统壁纸获取；其 Windows 端不提供此能力。
未发布源码增加 Windows x64 本机系统壁纸获取。
它从已安装的默认与主题壁纸中选择，最多五张。
不足五项时显示实际数量，不读取用户当前壁纸，也不联网下载。
macOS 活动目录仍最多四项。

macOS 适配器从 Apple 本机目录选择代表材料。
目标为最近两代系统各两项，不固定四个名称。
Apple metadata 没有逐材料 OS release 字段。
按 Landscape 子组的唯一 preferredOrder 选择两组。
以 representativeAssetID 关联动态组或 root-owned 扩展。
陈列关联不是通用系统版本 API。
未知或歧义格式拒绝新增，保留旧缓存。
UUID 或源摘要是材料身份，不复用版本角色槽。

本地有效缓存或 root-owned HEIC 优先。
只有显式“获取系统壁纸”才读来源并补缺下载。
挂载、Tab 重入和普通选择只读取本地图库。
获取不自动选择背景，不显示下载占位或进度行。
结算后一次发布缩略图；失败保留已存材料与固定码。
固定码不证明 TLS、代理或素材根因。
不反射异常原文、路径或像素。

五张预设、系统壁纸和我的图片独立分组。
个人分组标题行只有一个加号。
图片 Tab 复用就绪或在途库存，不重复重建缓存 DOM。
读取失败保留 alert，空库存保留反馈。
所选系统静帧和上传图片存入 IndexedDB 媒体仓。
稳定与 RC 分域，偏好只保存有效材料 ID。
不保存截图、源视频、原文件名、路径或凭据。
上传 PNG 保留透明度；容量满时拒绝导入。
只允许显式删除，不静默淘汰用户图片。
浏览器持久化与 Desktop 重启分别验收。

Apple 视频只允许三段严格 206 Range。
头部为 64B，尾 moov 至多 2MiB，首 sync sample 至多 16MiB。
同一 strong ETag 与 If-Match 绑定三段。
拒绝压缩和跳转，源逻辑长度至多 1GiB。
实际传输至多 18MiB + 64B。
先重建完整单 sample MOV，再交原生助手解码。
不使用截断电影或整段下载回退。
transport 固定为 /usr/bin/curl，使用 --disable 和 shell:false。
使用系统默认 TLS，不改变 Host dispatcher、CA 或代理。
取消等待 child close，再清理自有临时文件。

新增业务接口由当前实现注册官方内部能力面。
内部反射包与根 Bundle 使用同一归档。
包名和版本由根 manifest 派生，不增加安装依赖。
基础壳继续保留截图/保存合同。
初始 thenable 等官方子 Fiber，不改变原实例身份。
Client 在基础版本回复后独立核对能力版本。
壁纸还须纯注册握手，不用本地代理证明 Host 就绪。
同合同业务换载仍须等旧操作实际结算。
真实材料、预览、导出、取消和恢复分别验收。
源码、归档或隔离 Host 通过不等于 Desktop 通过。

### 常规分层门

1. 运行 `pnpm install --frozen-lockfile`、`pnpm test`、`pnpm build` 和 `pnpm run bundle`。检查当前版本真实 tgz 的成员、字节、权限、版本与依赖许可，不复用旧包冒充当前结果。归档包含 manifest allowlist、package.json 和两份 README，不包含 node_modules、profile、凭据、日志或私有研究。
2. 通过 `verify-host.ts` 在当前用户拥有的全新临时 profile 中运行目标 DSH 的实际 PluginManager、Typert Loader 和自带 PNPM。绑定被装版本、运行字节和来源摘要，检查单 root 行/Client、八组合功能设置、revision 写入与恢复、停用与重新启用。不得关闭 `blockExoticSubdeps`、替换解析器或伪造活动状态。此检查不拍摄像素，也不代替 Desktop UI。
3. 实际 Desktop 验收独立记录：目标安装件的主题、入口、搜索展开/折叠、三个开关、截图覆盖/比例、重拍、复制、选目录/直接保存及取消/停用。旧版到新版的官方管理器升级也单独验证；实验重装不是升级证据。普通功能开关无需重启，替换包仅遵从宿主明确的加载/重启提示并保护未保存工作。

## 0.5.4 发布决定：修复 Windows 截图

帧内容允许小于采集缓冲区。
移除错误的尺寸相等约束。
保留归属、窗口稳定、纹理边界和预算校验。
Config、Remote 合同和媒体身份不变。

用户授权推送 main 与 v0.5.4。
随后通过官方固定 SHA 更新测试 0.5.3 升级。
不创建 GitHub Release，不发布 npm。
Mac 输入与助手字节均匹配冻结基线。
用户免做本轮 Mac 实机测试。

RC 实机检查覆盖初拍、重拍和 PNG 复制。
它们也覆盖 PNG、JPEG、WebP 文件提交。
另验目录选择取消和重名编号。
插件停用后归还相机入口和助手进程。
原生夹具覆盖目标关闭和启动异常终止。
采集中途取消与完整像素对位仍未验。
用户允许保留这两项未验，先推修复 tag 验证。
正式归档、原生和隔离 Host 结果分别绑定。
稳定升级检查在 tag 发布后执行。
RC 首装不能代替稳定升级检查。
遵守官方 restart-required 结果。
重启须另获授权。

## 0.5.3 发布决定：收起侧栏的会话相机

侧栏收起时，会话右上角提供相机入口。
两个入口复用同一截图、重拍与卸载生命周期。
不改 Config、基础 Remote 合同或媒体仓身份。
发布前须验实际显示、取像、重拍和稳定包恢复。
同进程官方 tag 升级另验，不由 RC 首装代替。
本次仅推 main 与 v0.5.3，不创建 Release。
RC 验收后，正式升级由用户自行点击。
代理不安装正式新版，不把升级门记为通过。
Windows 实机、导出对位与撤权仍分别未验。
深色主题及英文 Desktop 仍分别未验。

## 0.5.2 发布决定：同路径新增业务能力修复

本版让官方生成能力面随版本化业务装配。
不改根 Config、基础 Remote 身份或安装路径。
同一 tag 升级须验证截图和壁纸，不以基础恢复代替整体升级。
仍运行 v1 壳的同进程链路是本次实测目标。
已发布 v0.5.0 immutable v2 壳仍拒绝 v1，不能声称已兼容。
用户明确授权以 0.5.1、0.5.2 等正式 patch tag 逐版验证。
本次仅推 main 与 v0.5.2，不创建 Release 或 npm 包。
不重启，不切开关；保护用户未保存的工作台。
源码、严格装配合同、当前归档和精确 Host 门仍须通过。
正式 tag 上线后再验实际官方 Git 升级及新增业务动作。
最终像素对位、导出、Windows 实机与重启持久化仍分别未验。
原话、红绿结果和实机回执只进入私人文档。

## 0.5.1 发布决定：正式修复 tag 验证

本版保留 v1 截图/保存兼容面。
壁纸扩展使用独立合同和 Host 注册握手。
该包用于恢复仍运行 v1 壳的升级链路。
它不是所有已发布壳的免重启迁移包。

已发布 v0.5.0 v2 壳仍拒绝此 v1 payload。
两代旧壳读取同一路径并比较互斥字符串。
该失配是已知代码限制，不标为兼容通过。
用户在披露后明确要求用正式 patch tag 逐版验证。
本次发布 v0.5.1，再走官方 Git 安装链路。
本地归档安装不冒充 tag 升级。
仅发布 main 与 tag，不创建 Release 或 npm 包。
本次不重启 Desktop，不以递增版本号代替修复。
最终绘制、导出和 Windows 实机仍未验。
默认并发测试的图库超时不改写为通过。
有界全量、产物和精确 Host 门仍须通过。
旧 v0.5.0 tag 保留，不移动或删除。
本次授权、升级与失败证据归入私人文档。
不以本机成功声称全量旧壳兼容。

## 0.5.0 发布决定

本版交付 macOS 系统壁纸获取与本地背景图库。
用户在知悉未验门后，本次明确要求直接发版。
本次允许保留以下未验门，不将它们写成已通过：

- 精确最终 Desktop 安装件与当前深色主题。
- 暖切换的选中环、预览与状态一致性。
- 原生候选到最终 PNG 的对位、复制、保存与取消。
- 完整四项与用户图片的 Desktop 重启持久化。
- Windows 实机、撤权与异常退出。
- 最终 RC 卸载与稳定包重新启用。

源码、类型、全部合同、生成物与真实归档仍须通过。
精确 rc.2 Host 的新临时 profile 安装门仍须通过。
首次载入与重新启用都须核对实际业务版本。
在清洁 main 通过 release:check 后，推送 main 与 v0.5.0。
不移动旧 tag，不发布 npm，不修改 live Desktop。
新增 v2 Remote ABI 必须正常加载，不能承诺免重启升级。
本次授权只适用于 0.5.0，不延伸至下一版本。
原话、逐次实验与发布回执仍存入私人文档。

## 0.4.0 稳定 tag 发布决定

功能分支已合并，过期的已合并分支与工作树在证据归档后已清理。用户在知悉未验项目后明确要求发布 `v0.4.0`，使插件详情能够发现升级；不在本地点击更新、不安装或重启 DSH。0.4.0 保留 0.3.5 的固定 SHA 更新、有限重试、配置就绪与后台实际版本围栏。RC 转换仅作用于临时 staging，不把独立 RC 身份写回正式 manifest 或设置。

RC9 已有 macOS 明亮主题的候选点击、手绘切换、遮罩保留、撤销/重做、工具高亮和统一内边距证据。当前生产映射、状态、合成与 PNG 编码已另做 DPR 1/2 浏览器像素检查：选中区域按含边距坐标遮挡，未选区域不变，切手绘保留遮挡，解码 PNG 与预览逐像素相同。两者都不能证明原生整窗 PNG 的内容原点。精确最终 Desktop 安装件、原生打码落点、Windows 实机和当前深色主题仍待验收；不得写成已通过。

源码、类型、当前归档和精确 Host 隔离检查仍需通过；同步当前发布说明，在清洁 main 运行 `pnpm release:check` 后，将提交与 `v0.4.0` 一并推送，核对远端 tag 和官方 tags API。此次明确授权只适用于 0.4.0，不把原生对位、最终安装件或 Windows 实机写成已验，也不免除后续版本的独立验收。本次不触碰用户的 DSH 安装或设置。

## 0.3.5 首次更新失败修复

精确 rc.2 Manager 源码和实机日志确认：Git 来源在 PNPM 前另做一次 5 秒 GitHub 连接检查，本轮两次失败都发生在这里；插件此前丢掉 kind/failedAt，把已知失败显示成“未确认”。用户选择最多一次自动重试。0.3.5 保留固定 Git SHA 来源，只有官方明确 changed=false、application=failed、failedAt=spec-host、kind=timeout 时才再试同一 SHA；重试前复核当前安装自身并尊重 Client 卸载。第二次失败即停止，未知结果、PNPM 阶段、磁盘前移、取消不得自动重装。提示明确首次超时正在重试与再次超时停止；已知失败不再误报“结果未确认”。安装完整性、磁盘、权限和脚本阻止等只用官方白名单结果，不展示原始路径/输出。Client 本地版本不匹配与连接未知分开，取像/保存提示保留工作后正常加载；不改变 Host wire 或强行推断录屏授权。

固定提交归档的替代路径已通过精确官方 Manager/PNPM 线上下载实验，但用户选择的重试方案不同时叠加它，不改变宿主全局超时。新增合同先在旧 updater 失败；当前全量类型/测试/归档与精确 Remote 失败封套、受控重试通过后发布。旧版更新按钮仍是旧行为，不能用采用补丁那一轮直接宣称新版重试钩子已执行。

## 0.3.4 后台实现更新验收

用户要求通过远端版本与插件自己的更新按钮测试。0.3.4 在实际版本化截图方法内增加实例版本一致性围栏；不是只改版本号或前端。Config、Remote、固定壳源码、原生助手与运行依赖保持 0.3.3 边界。新增回归已在旧闭包失败；当前源码/全量测试/归档/exact Host 门通过后发布，再记录真实远端升级与截图。

实机已完成远端 0.3.2 → 0.3.3 的插件内安装并核对固定 SHA 与三份运行文件，但旧后台无新桥仍需正常重启一次。此次准备不计入 0.3.3 → 0.3.4 的免重启测量。后者必须保持 Main/Host PID 和启动时间、未点 Bundle/相机开关、更新后直接截图；成功安装不能替代实际后台和工作台验收。

0.3.3 → 0.3.4 的真实远端插件内更新已通过：相同 Main/Host PID 与启动时间、无启用/拍照开关操作、设置字节不变；更新后原生截图工作台和实际 JPEG 保存均成功。新版 Client 在两项操作前都要求实际 Host implementationVersion 为 0.3.4，因此不是仅清单或前端换新。用户独立手测也确认直接截图成功；Windows 实机与完整打码/PNG 对位验收不由此推出。

## 0.3.3 远端升级实验

用户明确要求使用远端版本与插件内更新按钮进行真实升级测试。本版引入稳定 Remote 外壳、版本业务闭包与实际后台版本确认；先通过源码、归档和精确 Host 检查，再发布稳定 tag 供官方更新入口验收。不把本地 tgz 覆盖安装替代远端更新证据。

从旧版首次采用新外壳需要正常加载一次；后续测试必须记录更新前后相同 Main/Host PID 与启动时间、确认新版业务方法实际载入、设置未变、未点启用/相机开关，并在更新后直接截图。兼容的业务实现变化和 Config/Remote/外壳变化必须分账；不承诺任意 Host 热替换。Windows 实机与完整工作台验收不由此次更新实验推出。

## 0.3.2 重新启用修复验证

用户明确允许通过官方更新入口安装 0.3.2 并继续验证 DSH。此小版本修改 Host 在截图/保存调用开始时的 accepted 设置核对，修复 Config owner 尚未 ACTIVE 时空 Settings 投影把新服务锁为关闭；不添加加载器，不复活已卸载服务，原生助手与运行依赖不变。

新截图/保存回归必须在未修复版本实际失败、修复后通过；完成全量测试、当前归档与精确 Host 隔离官方安装后，在清洁 main 发布 `v0.3.2`。实机升级后先正常重启以加载改变的 Host，再单独验证插件关闭/重新启用后无需再次重启即可截图，并保留设置。安装清单版本、运行代码与进程 PID 分别记录；不将此实验宣称为任意 Host 热替换或完整 Desktop/Windows 验收。

## 0.3.1 升级验证补丁

用户明确允许在 main 发布小版本，用官方更新入口验证升级。0.3.1 只改变 Client 的完整截图配置就绪门、旧配置提示及安装结果展示；Host 源码、原生助手和运行依赖不变。仍需完成上述源码、归档和精确 Host 隔离安装检查；此测试授权不代表完整 Desktop/Windows 验收或 Host 热替换已经通过。

在清洁 main 上同步唯一版本与生成物，核对 `v0.3.1` 和当前提交，再推送 main 与新 tag；不移动旧 tag。实机测试必须分别记录安装清单、运行 Client、Host 进程与设置状态，不将“立即启用”或新版本号直接当成新 Host 代码的证明。正常升级只用官方管理器，保留用户设置与未保存工作。

## 0.3.0 发布决定

用户明确批准先交付 Windows 接入及编译好的包，Windows DSH 实机留待后续验收；拒绝/撤销 macOS 录屏授权与保存中异常退出不作为本版本发布阻碍。它们必须标为未实测，不描述为已发现故障或已经通过。正常取消、真实提交回执和不覆盖已有文件仍需保留。

已有 macOS 候选的常规截图与工作台交互证据，不等于精确最终安装件完整验收。用户将本次交付明确收口为合并发版，更新标及 `0.2.1 → 0.3.0` 实际升级由用户后续检查，README 保留未验边界。本版本批准不延伸至以后版本，也不免除真实 helper、源码测试、归档或精确 Host 安装检查。历史 0.2.1 的例外不是当前版本的依据。

同步 README/AGENTS 当前版本、审查并提交所有分发产物，在清洁的 `main` 上运行 `pnpm release:check`，再创建并推送 `v0.3.0`。旧 tag 不移动。RC 分支仅用于候选构建，不触发稳定更新提示；稳定发布需本次明确授权。

插件详情只在打开自身页面时查稳定 tag，展开来源说明后还需一次明确安装确认，经官方 Manager 固定 SHA，不自动重启、不轮询或写入更新偏好。Git 推送不会更新已安装插件；不能通过外部 CLI 修改被 Desktop 独占的用户 profile。

npm 不是当前发布渠道。升级或加载状态以官方 `application/error`、Fiber/Client 和实际页面为准，不因源码、tag 或归档成功而宣称安装完成。

## 历史发布合同原文

本节保存旧 AGENTS 中九份逐版本发布合同。
它也保留相邻的产品边界和升级边界。
原文取自本次指南重写前的工作树。
版本、渠道和技术路线以当时状态为准。
历史合同不授予当前发布或安装权限。
本节不替代本文件的现行验收门。
后续合同另行追加，不改写以下原文。

旧指南 SHA256：`91ba6c5732dd8d58757cf4da626c391a188a6c1479b19b7dfa495229b6443ed0`。
原文区块 SHA256：`ec54f919761a79bd2be1323f216de27aa56d6a757a8d9a29e0a9bd34db0ea784`。

<!-- pdsh:legacy-release-contracts:start -->
## 0.4.0 release contract

The feature work is merged and obsolete merged branches/worktrees are removed after preserving ignored evidence. The user explicitly requested the stable v0.4.0 tag, after native alignment and final Desktop gaps were disclosed, because the own detail badge discovers stable tags rather than main commits. Publish this version with those gaps visible; do not locally install, click update or restart DSH. This is a 0.4.0-only exception, not evidence of passed Desktop or Windows acceptance and not a waiver for future releases.

Preserve 0.3.5 fixed-SHA updater/limited retry, accepted-Settings readiness and versioned Host fences. RC identity transforms only temporary staging; stable Config/Remote addresses remain compatible. Source/type tests, generated entries, the current archive and exact Host isolated installation/versioned runtime checks remain required. Existing RC9 UI and browser production-compositor PNG checks are separate evidence; native candidate-to-final-PNG alignment, exact final Desktop artifact, current dark theme and Windows real-machine acceptance remain outstanding. Keep README/PUBLISHING and L3 honest about the zero-origin assumption. On clean main run release:check, then push the reviewed commit and v0.4.0 together; never move old tags or delete user profile data.

## 0.3.0 active product boundaries

Native helper 分发使用保留执行位的 `npm pack --ignore-scripts`，由 `pnpm run bundle` 统一调用；归档必须验证 helper 为 0755，而非只比源文件权限和字节摘要。不用 bin、安装脚本或运行时 chmod 修补包装错误。

截取失败需沿用官方 logger 与固定结果码白名单，通用取像提示附同码，方便区分 Host 撤权、Remote 失败和像素拒绝；不得记录像素、路径或原始异常。诊断候选不是已修复或实机验收通过的声明。

Version 0.3.0 replaces retired DOM/Inspector/Main routes with native owned-window capture over the official Remote. Native `pointPixelScale` controls editor geometry; page DPR and `innerHeight` do not prove whole-window size. Targets are macOS 14+ arm64/x64 and Windows 10 1903+ x64; other platforms expose no capture provider. The Windows helper must be a real MSVC-built executable in the package. A successful helper build or archive check does not prove installed Windows behavior. The helper runs out of process; it does not patch or re-sign Harness.

Installation and enablement do not start capture or request permission. The first explicit capture lets the operating system handle any required authorization. Permission rejection/revocation, macOS signing continuity and abrupt process exit during save remain unverified edge cases. The user approved leaving those cases outside the 0.3.0 release gate; this is not evidence that they passed. A normal user cancellation must not report success or overwrite an existing file. If the connection ends after commit may have started but before receipt, report the result as unknown and ask the user to inspect the directory, not to retry automatically.

Save retains `saveBehavior` ask/direct, accepted full `saveDirectory`, PNG/JPEG/WebP and basename template. Ask uses the official directory picker then revision-fenced Settings acceptance; it is a folder chooser, not a native filename Save dialog. Direct uses the accepted directory without a new prompt. Both send bounded ordered bytes via the same namespace uplink with per-chunk ACK, finish/hash and half-close; Host derives the basename and uses fsync/close/exclusive commit with automatic numbering and no overwrite. Only a verified commit receipt followed by natural stream end reports saved. PNG clipboard stays independent. Do not add another installer, settings store, local server or bridge to export bytes.

## 0.3.5 release contract

First-attempt update failures were diagnosed against the exact rc.2 Manager and live Git logs: its GitHub Git preflight times out after 5000 ms before PNPM; the old updater discarded the structured failure and displayed an unknown result. The user chose one automatic retry. Keep the fixed Git SHA source and repeat only when the official Remote confirms changed=false, application=failed, failedAt=spec-host and packageResult.kind=timeout; recheck own installed version before retry and stop on disposal. Maximum two attempts including the original. PNPM/network failures, unknown transport outcomes, changed state and cancellation must not be automatically reinstalled. Only confirmed failed unchanged results may display the typed failure whitelist; other results retain conservative messaging. The explored fixed-SHA GitHub archive alternative passed an exact official download experiment but is not combined with this selected product path.

## 0.3.4 release contract

The user explicitly authorized a new remote stable version to test the own update badge. This candidate changes the actual versioned capture implementation, retaining 0.3.3 Config, Remote descriptors, stable-shell source and runtime dependencies. Regression must fail on 0.3.3 and pass on this payload. Publish only after full source/build/archive and exact-Host gates; then measure 0.3.3 to 0.3.4 through the own badge with unchanged Main/Host process starts, no Bundle/camera toggles and direct capture. The earlier 0.3.2 to 0.3.3 remote upgrade needed one normal bootstrap load and is not a hot-upgrade pass. Live remote 0.3.3 to 0.3.4 passed direct native-window capture and actual JPEG commit with unchanged Main/Host process starts and settings; the current Client required the actual 0.3.4 implementationVersion before either operation. This is compatible payload replacement, not Config/Remote/stable-shell/dependency hot replacement or Windows/general Desktop acceptance.

## 0.3.3 release contract

The user explicitly requires remote-tag installation through the plugin's update badge for this experiment; local archive installation is supporting evidence only. This bootstrap adds a stable Remote shell, a versioned complete capture/save payload, actual implementationVersion verification, and automatic read-only activation on Client assembly/update completion. It never toggles user preferences, silently installs, captures on mount, patches Harness or changes private module caches. Compatible payload updates settle the old runtime before swapping; Config schema, Remote ABI and stable-shell changes remain normal-restart boundaries.

0.3.2 and earlier require one normal bootstrap restart to first load this shell. Do not count that preparation as a no-restart upgrade pass. Full source, current archive and exact-Host gates precede this explicitly authorized remote-update test release. The initial remote-update/capture gate was subsequently closed by the recorded 0.3.3 to 0.3.4 live run; first bootstrap is not a no-restart pass. Windows real-machine and general Desktop acceptance are not implied.

## 0.3.2 release contract

The user explicitly authorized this small official-update experiment and live installation of 0.3.2 to validate the capture repair. Settings Forms only exposes ACTIVE owner fibers; a child service can mount while its owner is still LOADING. Revalidate accepted captureEnabled before capture/save reads the generation signal, keep owner-scoped volatile cancellation for in-flight work, and never revive a disposing/disposed instance. No polling, second settings store, module-cache manipulation or new loader is added; helper bytes and runtime dependencies remain unchanged.

Require regression red/green on the actual generated Host, full tests/build/archive and exact-Host isolated official-manager installation before main/tag publication. Then separately record live official upgrade, normal restart to load changed Host code, and Bundle disable/re-enable plus capture with unchanged Main/Host PIDs. This is scoped update-path testing, not a claim of arbitrary Host HMR, full Desktop/Windows acceptance or a future release waiver.

## 0.3.1 release contract

The user explicitly authorized a small main/tag release to test the official update path. This Client-only patch gates capture activation and writes on complete accepted settings and retains received install/restart/failure feedback across installed-manifest version changes within the same controller. Native Host source, helper bytes and runtime dependencies stay unchanged. Keep the single Bundle, entry name and existing Config address; do not introduce versioned entry names or a parallel installer to evade Host caching.

Run frozen dependency installation, tests, build, archive checks and exact-Host isolated official-manager installation before publishing. This authorization is for update-path testing, not a claim of full final Desktop or Windows acceptance, arbitrary Host HMR, or a future release waiver. An old installed Client cannot retroactively display new reminder code before that Client has loaded; page/Fiber replacement can also lose a local install result. No one-click restart API is fabricated.

### Upgrade runtime boundary

The exact Desktop rc.2 manager requires restart when replacing an existing package, regardless of PDSH version numbers. Its `setBundleEnabled` / “Enable now” only reconciles configuration layers, not loaded module code. No public Desktop restart API is exposed; do not fabricate an action or use private Main/IPC to simulate one. Keep a returned `restart-required` outcome visible in the same running Client even when the installed manifest has already moved to the target version; show the official `Modal`, and dismissing it must retain the inline reminder. Controller disposal or page reload can lose its local installation result: this is not a cross-Fiber handoff and must not be claimed as one; `waitForInstall` alone cannot recover settled results. If an accepted form still lacks the capture fields, keep identity/title behavior independent, stop capture writes/activation, and explain the missing runtime configuration instead of guessing directory or OS permission failure.

## 0.3.0 release contract

0.3.0 is one Bundle, one `pdsh` Host root and one Client entry. It retains existing identity/title Config addresses and adds independent capture settings. The user scoped this delivery to merge and release; checking the 0.2.1 update indicator and subsequent Desktop upgrade is handed back to the user, not claimed complete or used to block this release. RC21 has macOS normal-capture/workbench interaction evidence, but that is not acceptance of the exact final installation package.

The user explicitly approved distributing the Windows 10 1903+ x64 helper before a Windows DSH real-machine test. The archive must still contain the actual helper and pass binary/archive checks; the deferred Windows machine test is not an approval to omit it or call Windows behavior verified. For this version only, authorization rejection/revocation and abnormal exit during save are disclosed unknowns, not release blockers. Normal cancellation semantics remain required: no success result before a confirmed commit, and no overwrite.

This approval applies only to 0.3.0. For later versions, source/type/unit contracts, generated Remote faces, archive contents, exact-Host installation/configuration compatibility and installed UI/native acceptance remain separate gates unless the user explicitly grants a new version-specific exception. Passing one gate does not imply the others.

## 0.2.1 release contract

0.2.1 corrects the source-label placement, nickname-row centering and capture/workbench error attribution alongside the available-update arrow presentation: `--dsw-alias-state-success-primary` owns its green color and the SVG root shares the existing entry artwork's 1.5 stroke. Keep native Button hover/focus behavior, Tooltip parameters and explicit installation confirmation unchanged. The OS pixel-acquisition route and native probe are retired. `viewport.ts` uses modern-screenshot to rasterize `documentElement` at current viewport size and DPR, preserving nested scroll positions; webfonts and local assets are embedded through a credential-free resource boundary. It rejects incomplete resources, visible unsupported embedded content, cancellation and viewport changes. Browser fixtures and injected-engine tests do not prove the installed DSH workbench.

The released 0.2.1 camera remains gated to macOS Desktop while that target is being verified. This paragraph records the old stable implementation, not the current RC acquisition route. It snapshots the whole visible DSH webpage *before* showing the workbench, then supports local background composition, manual/recognized-region redaction, retake and PNG copy/save. Capture does not request OS recording permission or special CDP startup. Recognized-region suggestions are narrow; other pixels can contain sensitive data. The pre-capture placeholder is best-effort visual masking, not a forensic privacy promise. No system-wallpaper action appears without an adapter.

The 0.2.0 version tag is published with an explicit installed-Desktop acceptance gap. Reused 0.2.0-rc.1 evidence covers source contracts, the authenticated route in an independent Web profile and execution of the packed native helper; it does not cover the installed workbench's theme, interaction, copy/save or permission-denied behavior. Keep this limitation visible in README and do not silently replace or restart the user's live Desktop to close it.

Run `pnpm test`, `pnpm build`, `pnpm run bundle` and inspect archive membership and bundled dependency notices for each version. 0.2.1 is explicitly approved for tagging with the installed-Desktop acceptance gap disclosed: source contracts, bundle checks and browser rasterization evidence are not full Desktop acceptance. This is a version-specific release exception, not a waiver for later releases; full Desktop acceptance remains their normal gate. DOM rasterization fixtures, injected-engine contracts and installed Desktop tests are separate evidence; none alone proves the installed UI.

## 0.1.1 stable release contract

0.1.1 remains display-only: it masks recognized workspace titles, persisted session titles, the two-cell provisional New Session title, search result title/workspace leaves, and only owner-correlated HoverCard titles. The two-cell exception requires a nonempty `session:` row key, an empty leading slot and a text-only second span; malformed/ambiguous rows still skip. Original DOM text, native events, account state and profile data remain untouched.

The hat immediately toggles Host `maskTitles`. The settings card has one heading and Switch per capability; avatar source actions persist atomically, nickname owns a local draft with check/Enter and Escape, and all writes respect Host acceptance and revision fences. Do not reintroduce a global Save, separate language store or session-isolation claim.

The official version-adjacent badge slot probes updates when this Bundle's detail opens. A newer stable tag alone reveals the circular up-arrow; opening it exposes the source change and a separate install confirmation. No continuous polling or silent install occurs. `package.json.version` is the sole version source, `v<version>` is the GitHub distribution anchor, and npm remains private. A GitHub Release page is optional, not a bundle requirement.

Run `pnpm test`, `pnpm build`, and `pnpm run bundle`; run TypeScript typecheck as part of tests. Fixture coverage is not Electron evidence. Validate the exact installed artifact through the official manager on a disposable profile before claiming Desktop compatibility; preserve account/profile data and any unsaved draft. The public README is a product/user guide, not an mvp-by-mvp chronological lab notebook.

<!-- pdsh:legacy-release-contracts:end -->
