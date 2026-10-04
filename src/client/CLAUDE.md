# src/client/
> L2 | 父级: ../CLAUDE.md

- `client-entry.tsx`: 当前 staging manifest 对应的唯一 Client 入口；相对导入本包生成 Remote，不解析已装正式包；先注册真实生成 Remote 描述，不触发取像/权限；必需 Cordis 服务只声明一次，身份/标题/拍照为共享 Bundle 内的独立设置而非运行时子入口。
- `component-runtime.tsx`: 唯一 Bundle Fiber 的原生背景 Tabs 注入、样式、原生探针、Tooltip、设置与更新生命周期；临时 RC 绑定独立 ConfigForm/locale/slot 身份并省去正式更新 slot；详情按身份/标题打码/截图排列，初拍/重拍均读取 Host accepted `captureMaskIdentity`；相机要求 Mac/Win Navigator 与实际可选 Remote provider 同时存在，Host 未注册的 Windows ARM64 不显示入口。
- `native-style-view.tsx`: 唯一真实原生控件探针视图；布局测量与 React 生命周期绑定，不持有功能配置。
- `title-settings.tsx`: 共享唯一 `pdsh` ConfigForm 的标题即时开关；复用帽子控制器和官方控件，不建立独立 namespace，也不读身份偏好。
- `capture-settings.tsx`: Plugins 截图区提供独立身份遮挡开关与询问/直接保存、完整目录、格式/文件名模板；只走同一 Host revision 围栏，身份开关不改常驻 maskIdentity 或工作台标题偏好。
- `capture-notice.tsx`: DOM 控制器到官方 React Toast 的适配边界；宿主拥有样式、portal 和默认消失周期，序号重挂载与完成围栏防止同文重显或旧回调干扰。
- `native-style-probe.ts`: 原生样式效果边界；测量真实 Input/Button/Switch/字段/Tooltip，监听主题、DOM、资源加载和尺寸变化，未变不写、来源消失撤销旧值、控件重建转移局部观察权，停用精确恢复变量与观察器。
- `native-icon.ts`: 原生 SVG 描边密度与图稿坐标换算；非等比、缺失或未知几何拒绝猜测，供入口和控件探针共用。
- `settings-card.tsx`: React 偏好交互；来源标签与三个按钮归属右侧同一操作组，标签到首个轮廓的可见间距匹配 ghost 来源按钮的文字间距；昵称行独占对称留白，Host 接受值拥有开关/头像来源，昵称仅持有局部草稿。
- `update-badge.tsx`: 仅正式包为自身已安装 Bundle 在官方版本标签后渲染成功色细线更新提示；详情挂载才探测，展开来源提示后显式确认安装。
- `presentation.ts`: 身份组件的唯一账号结构识别与视觉覆盖；拍照复用 recognizeSidebarIdentity，不另猜账号选择器，保留原生节点/菜单。
- `sidebar-redaction.ts`: rc.2 侧栏文本叶适配器；识别工作区、普通/空白会话与搜索标题，窄约束关联 HoverCard。
- `search-entry.ts`: 搜索邻接帽子与右侧相机的版本相关 DOM 适配；从原生 SVG 实时换算 viewBox/描边/尺寸/根透明度，未知几何退让，不替换搜索，初拍/重拍保留两个入口。
- `dom-tooltip.css`: 非 React 提示泡消费真实 Host Tooltip 的实时计算参数与主题变量。
- `dom-tooltip.ts`: 为侧栏和工作台的非 React 按钮提供单例委托提示；参数/视觉跟随 DSH Tooltip，React 控件直接用原生组件。
- `camera-icon.svg`: 截图入口的 Lucide 线条图形；交互几何与整体透明度由原生搜索同步。
- `capture/`: 截图工作台独立模块；仅通过官方 Remote 接收原生 owned-window 冻结像素与保存回执，以 DSH token 渲染编辑器；装配层不调用旧 Main/Inspector 桥，不回退 DOM 重绘。
- `title-toggle.ts`: 通过单一路径提交 Host `maskTitles`，处理 pending、失败和版本围栏。
- `updater.ts`: 详情驱动的探测与显式安装状态机；解开官方 Remote 结果封套、校验唯一已安装自身和稳定版本，只安装固定提交；临时 RC 直接调用也拒绝探测与安装。
- `update-source.ts`: GitHub 公共 tag 读取边界；不带凭据，网络失败不影响既有设置与遮挡。
- `styles.css`: 开关字段复用原生按钮等高槽与统一留白；自有呈现与唯一标题灰条绘制；常驻遮挡和拍照临时标记共用同一选择器组，宿主变量与上游来源由 style-sources.json 记录。
- `entry-icon.svg`: 透明底单复合路径的 Lucide/InCodex 图形；运行线宽由原生搜索换算，整体透明度在根合成，构建复用为透明包图标。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
