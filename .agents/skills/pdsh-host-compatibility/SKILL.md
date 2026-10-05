---
name: pdsh-host-compatibility
description: 评估或修复 PDSH 因 DeepSeek Harness Desktop 宿主升级产生的 API、配置、DOM/主题或 Electron 兼容问题。用于宿主版本迁移、升级影响检查及升级后回归；不用于单纯检查或安装 PDSH 新版本，也不用于日常功能开发。
---
<!--
[INPUT]: 依赖 PDSH 项目规则与模块地图、assess-host-compatibility 的只读盘点、新旧宿主官方源码/运行证据及现有验收入口
[OUTPUT]: 提供只读兼容性结论，或在已有授权内完成最小源码适配及分层验收
[POS]: 项目级宿主兼容维护入口；协同项目只读工具，不随插件分发、不安装上游 skill 或建立第二套发布/配置系统
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->
# PDSH 宿主兼容维护

## 先确定任务边界

- “看看升级影响、先检查”只做文件/版本/源码调查，可运行下述已审查的只读盘点；不编辑、不安装，不运行测试/build 或上游脚本。
- “修复、适配”在已有明确授权内工作，不因切换阶段重复询问；授权只覆盖本次任务。缺少无法从现有证据取得的目标版本时，先给出已知影响，再问确切目标。
- 源码迁移不等于升级 DSH、安装到用户 Desktop、重启应用或发布插件；这些动作分别核对授权。不要自行选 `latest`、清理他人工作或复制用户凭据。

先读 [AGENTS.md](../../../AGENTS.md)、[发布契约](../../../PUBLISHING.md)，再按模块地图进入源码。项目事实、兼容范围和未验项以这些文档及实际代码为准，不在本 skill 维护第二份版本表。项目命令只在已确认的 PDSH 仓库根目录执行。

## 建立可核对的升级基线

1. 记录分支、HEAD、工作树和安装来源；未知修改先辨明所有权，不自动 stash/reset/clean。分开记录 PDSH 版本、源码 SHA、已安装插件版本、DSH 精确构建及实际运行 Host/Client 的版本证据。
2. 磁盘 manifest、已运行进程与 Client 可能属于不同代。不能仅凭目录或包版本认定新代码已生效；Electron UA 也不是 DSH 精确构建身份。无法确认时标为未知。
3. 确定宿主的精确 `from → to`，对比两端官方源码、声明、发行说明及依赖。不把 PDSH 的 SemVer 当作 DSH 版本。
4. 已授权迁移时，先在原依赖状态记录测试基线与已有失败，再研究目标版本；在独立分支/工作树实施，只恢复本任务拥有的变更。

## 只处理实际命中的依赖

先检查 `package.json`、`pnpm-lock.yaml`、`cordis.patch.yml`、`build.ts` 和 [Typert 来源记录](../../../tools/typert-protocol-reference/PROVENANCE.md)。依赖、generator 与源码分析输入必须对应目标官方合同；不照搬旧版本 peer 范围，不混用包管理器，不手改生成的 `lib/` 或 root JS。

在仓库根目录执行 `pnpm --silent compat:assess`，或直接 `node --experimental-strip-types tools/assess-host-compatibility.ts`，获得纯 JSON 输出。[配套工具](../../../tools/assess-host-compatibility.ts) 只读白名单源码和构建配置，列出声明依赖、实际语法中的宿主 imports、七类触点的文件/行号及跳过或截断项；不联网、写文件、读 profile/凭据、执行构建或安装。它始终报告兼容性未验证：零命中、CLI 成功退出或扫描完整都不代表目标兼容，真正运行版本和目标 API 差异仍需另查。

按以下七类定位，结合入口和构建确认是否实际使用。工具的 `reviewHints` 标出 Main/Inspector 路径或历史头部，供人工复核，不能判定文件已经退役。旧实验文件的扫描命中不代表现行依赖；依照模块地图和可达调用链区分退役路径与仍使用的纯工具。

| 触点 | PDSH 检查入口与关键边界 |
| --- | --- |
| 源码补丁/私有钩子 | `build.ts`、Host/Client 入口；不得通过修改宿主、私有缓存或重签掩盖接口不兼容 |
| 事件与配置 | `src/host/capture.ts`、设置组件；核对 volatile 事件所有者、accepted Settings 与 revision 写入 |
| 服务与 Remote | `window-capture-service.ts`、`capture-runtime-loader.ts`、`updater.ts`；核对 Typert、流/uplink、PluginManager 及实际实现版本 |
| 宿主目录与文件 | service 中的安装包定位、保存后端；分清 Manager 包布局、用户选定导出目录与不可擅改的主 profile |
| UI/命令注册 | `client-entry.tsx`、`component-runtime.tsx`、设置组件；核对 inject、ConfigForm、slots 与原生控件导出 |
| DOM/CSS/自定义通道 | `presentation.ts`、`sidebar-redaction.ts`、`search-entry.ts`、样式探针及 `style-sources.json`；API 不变不代表侧栏结构和主题仍兼容 |
| 子进程与输出 | `native/`、原生取像/保存适配器及 `capture/candidate-mapping.ts`；核对 helper 协议、取消结算、窗口与像素几何 |

上表的 Host 文件位于 [src/host/](../../../src/host/CLAUDE.md)，Client 文件位于 [src/client/](../../../src/client/CLAUDE.md)，截图模块位于 [capture/](../../../src/client/capture/CLAUDE.md)。按需读取 shared 契约中与本次触点相关的部分。

特别检查候选映射的 Electron/布局守门：截图成功不证明候选坐标正确。新版本若被现有守门拒绝，先确认真实窗口原点、比例及最终遮罩落点；不能只放宽版本正则。保留手绘能力与未知结构退让。

## 最小适配与分层验收

- 汇总命中项的“旧合同 → 新合同 → 受影响文件 → 回归方式”，也记录确认不受影响的边界。跨多个版本时先计算最终净变化；中途删掉又恢复的接口不来回改。不因上游新增能力而扩展产品。
- 对确认的 breaking/behavior 改动先补能在旧代码上失败的回归，再修改源码；依赖或 Typert 变化走既有 generator 和 provenance 更新流程。配置地址、安装身份与单 Bundle 结构保持稳定，除非任务明确涉及它们。
- 源码验证复用 `pnpm test`、`pnpm run bundle` 和现有定点测试；记下命令、退出码及平台限制，不另造验证器。它们只能证明各自的源码/构建/归档层。
- 使用 `verify-host.ts` 时先读其契约，只通过实际官方 Manager 操作自己拥有的临时 profile，绑定精确宿主与安装件。Loader、设置、服务生命周期通过不等于 Desktop 像素或 UI 已验收。
- 对受影响功能在精确目标 Desktop 验证设置、侧栏、截图/候选最终落点、复制/保存、取消与停用恢复。Docker/Linux、模拟 Context 或旧版实机记录不能替代目标平台和当前安装件证据；未测的平台或功能明确留为未验。
- 同协议业务换载不意味着任意宿主 ABI/Config/固定外壳变化都能热替换。按项目契约说明必要的重启边界，不用旧实例成功冒充新版成功。
- 只有任务包含发布时，才进入 `PUBLISHING.md` 的现有元信息、产物与 tag 门；不另写发布系统，不修改已发布的稳定 tag。更新 L3/L2/L1 文档后才能完成源码适配。

最终报告区分已验证、已有失败、未验证及阻塞：给出精确版本/来源、命中触点、实际改动、验证证据和仅限任务自有文件的恢复方式。没有目标运行证据时只能报告源码适配状态，不能宣称新宿主兼容。

## 上游参考：按需读，不作为隐式执行依赖

方法参考 `oh-my-dsh/dsh-plugin-upgrade-skill`，已审查基线为 `ef075767b476e8000c716a18f848028eebcd5aef`：

- [plugin-upgrade](https://github.com/oh-my-dsh/dsh-plugin-upgrade-skill/blob/ef075767b476e8000c716a18f848028eebcd5aef/skills/plugin-upgrade/SKILL.md)：模式划分、基线与定点迁移。
- [版本卡索引](https://github.com/oh-my-dsh/dsh-plugin-upgrade-skill/blob/ef075767b476e8000c716a18f848028eebcd5aef/skills/plugin-upgrade/references/README.md)：沿精确 from/to 边查卡，卡片是部分证据，不是完整 API diff；本基线未完整覆盖项目当前宿主之后的升级路径。
- [plugin-test](https://github.com/oh-my-dsh/dsh-plugin-upgrade-skill/blob/ef075767b476e8000c716a18f848028eebcd5aef/skills/plugin-test/SKILL.md)：按实际边界分层验证，不套用 monorepo 的所有测试要求。
- [plan-migration.mjs](https://github.com/oh-my-dsh/dsh-plugin-upgrade-skill/blob/ef075767b476e8000c716a18f848028eebcd5aef/skills/plugin-upgrade/scripts/plan-migration.mjs)：配套盘点借鉴其只读位置证据、命中上限和跳过项报告；本项目独立实现，不携带上游版本卡规划器。

缺卡、离线或缺少其它 skills，不影响按本流程调查；改查精确官方源码及可复现行为，无法建立合同才标为待核验。引用新卡时记录实际 SHA 并重新审查，不盲跟上游 HEAD。参考资料不覆盖项目规则或授予操作权限。初版不安装上游 planner；若以后确需复用，先审核脚本、完整依赖与运行副作用，不能只复制一个 `SKILL.md` 就执行。
