# src/client/
> L2 | 父级: ../CLAUDE.md

- `client-entry.tsx`: 同一薄入口由构建常量选择身份、标题或拍照角色；独立 namespace 驱动启停，资源所有权下放 component-runtime。
- `component-runtime.tsx`: 三个官方运行时组件的独立启停与同一页面共享资源；共享的是样式/入口/Bundle 设置注册，不是功能启用状态；拍照只注入 connection 服务，rpc 是它的属性而非另一个服务。
- `native-style-view.tsx`: 唯一真实原生控件探针视图；布局测量与 React 生命周期绑定，不持有功能配置。
- `title-settings.tsx`: 独立标题命名空间的即时开关；复用帽子控制器和官方控件，不读身份组件的活跃配置。
- `capture-settings.tsx`: 询问/直接保存、完整目录、格式/Kiri 五类模板设置，只走 Host revision 围栏；询问开关不删除目录，复用昵称留白/编辑/Tooltip，首字段不贴标题画线。
- `capture-notice.tsx`: DOM 控制器到官方 React Toast 的适配边界；宿主拥有样式、portal 和默认消失周期，序号重挂载与完成围栏防止同文重显或旧回调干扰。
- `native-style-probe.ts`: 原生样式效果边界；测量真实 Input/Button/Switch/字段/Tooltip，监听主题、DOM、资源加载和尺寸变化，未变不写、来源消失撤销旧值、控件重建转移局部观察权，停用精确恢复变量与观察器。
- `native-icon.ts`: 原生 SVG 描边密度与图稿坐标换算；非等比、缺失或未知几何拒绝猜测，供入口和控件探针共用。
- `settings-card.tsx`: React 偏好交互；来源标签与三个按钮归属右侧同一操作组，标签到首个轮廓的可见间距匹配 ghost 来源按钮的文字间距；昵称行独占对称留白，Host 接受值拥有开关/头像来源，昵称仅持有局部草稿。
- `update-badge.tsx`: 只为自身已安装 Bundle 在官方版本标签后渲染成功色细线更新提示；详情挂载才探测，展开来源提示后显式确认安装。
- `presentation.ts`: 身份组件的唯一账号结构识别与视觉覆盖；拍照复用 recognizeSidebarIdentity，不另猜账号选择器，保留原生节点/菜单。
- `sidebar-redaction.ts`: rc.2 侧栏文本叶适配器；识别工作区、普通/空白会话与搜索标题，窄约束关联 HoverCard。
- `search-entry.ts`: 搜索邻接帽子与右侧相机的版本相关 DOM 适配；从原生 SVG 实时换算 viewBox/描边/尺寸/根透明度，未知几何退让，不替换搜索。
- `dom-tooltip.css`: 非 React 提示泡消费真实 Host Tooltip 的实时计算参数与主题变量。
- `dom-tooltip.ts`: 为侧栏和工作台的非 React 按钮提供单例委托提示；参数/视觉跟随 DSH Tooltip，React 控件直接用原生组件。
- `camera-icon.svg`: 截图入口的 Lucide 线条图形；交互几何与整体透明度由原生搜索同步。
- `capture/`: 截图工作台独立模块；仅通过明确识别的 current-page PNG 桥读取冻结像素，以 DSH token 渲染编辑器；装配层选择正式宿主桥或明确接受后启用的内部桥候选实现，不回退 DOM 重绘。
- `title-toggle.ts`: 通过单一路径提交 Host `maskTitles`，处理 pending、失败和版本围栏。
- `updater.ts`: 详情驱动的探测与显式安装状态机；解开官方 Remote 结果封套、校验唯一已安装自身和稳定版本，只安装固定提交。
- `update-source.ts`: GitHub 公共 tag 读取边界；不带凭据，网络失败不影响既有设置与遮挡。
- `styles.css`: 自有呈现与唯一标题灰条绘制；常驻遮挡和拍照临时标记共用同一选择器组，宿主变量与上游来源由 style-sources.json 记录。
- `entry-icon.svg`: 透明底单复合路径的 Lucide/InCodex 图形；运行线宽由原生搜索换算，整体透明度在根合成，构建复用为透明包图标。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
