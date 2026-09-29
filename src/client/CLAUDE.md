# src/client/
> L2 | 父级: ../CLAUDE.md

- `client-entry.tsx`: 装配设置与详情徽标 slot、视觉控制器和更新控制器；Host 停用时统一归还资源。
- `settings-card.tsx`: React 偏好交互；Host 接受值拥有开关/头像来源，昵称仅持有局部草稿，不承载更新入口。
- `update-badge.tsx`: 只为自身已安装 Bundle 在官方版本标签后渲染更新提示；详情挂载才探测，展开来源提示后显式确认安装。
- `presentation.ts`: 唯一账号启动器的视觉身份覆盖；保留原生账户节点和菜单语义。
- `sidebar-redaction.ts`: rc.2 侧栏文本叶适配器；识别工作区、普通/空白会话与搜索标题，窄约束关联 HoverCard。
- `search-entry.ts`: 搜索邻接帽子入口的版本相关 DOM 适配；从原生 SVG 取尺寸/根透明度，不替换或导航搜索。
- `title-toggle.ts`: 通过单一路径提交 Host `maskTitles`，处理 pending、失败和版本围栏。
- `updater.ts`: 详情驱动的探测与显式安装状态机；解开官方 Remote 结果封套、校验唯一已安装自身和稳定版本，只安装固定提交。
- `update-source.ts`: GitHub 公共 tag 读取边界；不带凭据，网络失败不影响既有设置与遮挡。
- `styles.css`: 所有自有呈现规则；宿主变量及上游来源由根目录 `style-sources.json` 逐条记录。
- `entry-icon.svg`: 可调线宽的 Lucide/InCodex 线条图形；整体透明度在入口根 SVG 合成，构建时复用为包图标。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
