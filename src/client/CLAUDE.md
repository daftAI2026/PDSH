# src/client/
> L2 | 父级: ../CLAUDE.md

- `client-entry.tsx`: 唯一 `@daftai/pdsh` Client 入口；顺序挂载真实基础/内部能力 Remote 面，不触发取像/权限；必需 Cordis 服务只声明一次，身份/标题/拍照为共享 Bundle 内的独立设置而非运行时子入口。
- `component-runtime.tsx`: 唯一 Bundle 装配、设置与语言订阅。两相机共用截图控制器。基础版本与壁纸、几何分别握手；几何读取绑定捕获时的两个代理世代。迟到扩展不重建工作台。更新阶段订阅归 updater，随 Bundle 释放。
- `sidebar-state.ts`: 只读 rc.2 AppFrame 语义属性。root/main/sidebar 唯一归属成立才返回收起态；未知或歧义布局退让。观察器先过滤边界变化，聊天增删不触发全局查询。订阅跟随 Bundle 释放，不读取搜索展开态。
- `header-camera.tsx`: 官方 utilities 会话相机视图。仅侧栏收起且截图控制器存在时呈现。复用 Host Button/Tooltip，点击重读当前控制器，不创建取像链路。
- `native-style-view.tsx`: 唯一真实原生控件探针视图；布局测量与 React 生命周期绑定，不持有功能配置。
- `title-settings.tsx`: 共享唯一 `pdsh` ConfigForm 的标题即时开关；复用帽子控制器和官方控件，不建立独立 namespace，也不读身份偏好。
- `capture-settings.tsx`: Plugins 截图区提供独立身份遮挡开关与询问/直接保存、完整目录、格式/文件名模板；旧/无效 ready 配置显示中英重启提示并锁住全部字段与目录 picker，目录位不泄漏 fallback/不误报目录故障；loading 不误报，完整后续快照恢复原 revision 写入；身份开关不改常驻 maskIdentity 或工作台标题偏好。
- `capture-notice.tsx`: DOM 控制器到官方 React Toast 的适配边界；宿主拥有样式、portal 和默认消失周期，序号重挂载与完成围栏防止同文重显或旧回调干扰。
- `native-style-probe.ts`: 原生样式效果边界；测量真实 Input/Button/Switch/字段/Tooltip，监听主题、DOM、资源加载和尺寸变化，未变不写、来源消失撤销旧值、控件重建转移局部观察权，停用精确恢复变量与观察器。
- `native-icon.ts`: 原生 SVG 描边密度与图稿坐标换算；非等比、缺失或未知几何拒绝猜测，供入口和控件探针共用。
- `settings-card.tsx`: React 身份设置消费独立账号状态。未登录禁用账号来源，退出临时生成预览，不写配置。来源标签归右侧操作组，保留原生文字间距。Host 拥有开关与来源；昵称只持有局部草稿。
- `project-footer.tsx`: 设置详情的 Star 提示与 GitHub 图标成组，整排紧凑靠右，固定作者外链位于末端。显示名独立于 URL 用户名。组合根拥有语言订阅；本层不读取配置、不请求网络、不改变账号或 Star 状态。
- `update-badge.tsx`: 自身详情更新状态；更新、取消与应用等待委托 Host StateDot。仅可撤回阶段显示取消；未知取消独立告警，终态移除 loading。磁盘前移保留本控制器结果，失配不提供旧 Client 重试。失败原因用白名单，重试明示一次；restart 使用官方 Modal，不持有跨 Fiber 结果。
- `presentation.ts`: 唯一账号结构识别与视觉覆盖。独立发布账号状态。未登录头像借用官方 AccountMenu 样式。身份行复用登录布局，保留原按钮和菜单。未知样式撤销覆盖。退出后临时生成头像，不改配置。拍照复用可见身份边界。
- `plugin-detail-typography.ts`: 唯一自身详情标题的排版标记。CSS text-box 裁去标题字体留白；不改变版本胶囊。未知结构撤销标记，卸载归还自有属性。
- `sidebar-redaction.ts`: rc.2 侧栏文本叶适配器；识别工作区、普通/空白会话与搜索标题，窄约束关联 HoverCard。
- `search-entry.ts`: 搜索邻接帽子与右侧相机的版本相关 DOM 适配；从原生 SVG 实时换算 viewBox/描边/尺寸/根透明度，未知几何退让，不替换搜索，初拍/重拍保留两个入口。
- `dom-tooltip.css`: 非 React 提示泡消费真实 Host Tooltip 的实时计算参数与主题变量。
- `dom-tooltip.ts`: 为侧栏和工作台的非 React 按钮提供单例委托提示；参数/视觉跟随 DSH Tooltip，React 控件直接用原生组件。
- `camera-icon.svg`: 截图入口的 Lucide 线条图形；交互几何与整体透明度由原生搜索同步。
- `capture/`: 官方 Remote 的截图、保存与系统壁纸工作台。Mac 与 Windows 仅在实际能力握手后装配壁纸；不传路径或 URL，不回退 DOM 取像。
- `title-toggle.ts`: 通过单一路径提交 Host `maskTitles`，处理 pending、失败和版本围栏。
- `updater.ts`: 临时 RC 禁用探测和安装。详情驱动更新与 requestId 取消状态机；官方阶段事件只认当前请求。注册抢跑最多补发一次取消，应用阶段不可撤回；取消意图阻止安装重试。缺少取消或事件能力保留旧参数；解开官方 Remote 结果封套、校验唯一已安装自身和稳定版本，只安装固定 Git 提交，仅官方明确未安装的 spec-host timeout 重试同一目标一次；可选 activation hook 仅能在确认目标实现运行后将 `restart-required` 升为 `installed`，缺失/失败仍保留重启提示；不重装未知结果、不切功能设置，状态仅属当前 Client Fiber。
- `update-source.ts`: GitHub 公共 tag 读取边界；不带凭据，网络失败不影响既有设置与遮挡。
- `styles.css`: 设置、页脚、更新状态与相机复用 Host 语义色及控件几何。更新状态只排列 StateDot 和文字，不覆写 Host 动画。未登录头像保留官方样式；页脚靠右换行，图稿无基线空白，标题共用灰条。来源由 style-sources.json 记录。
- `entry-icon.svg`: 透明底单复合路径的 Lucide/InCodex 图形；运行线宽由原生搜索换算，整体透明度在根合成，构建复用为透明包图标。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
