# capture/
> L2 | 父级: ../CLAUDE.md

失败文案来自 copy 的全部公开码双语映射；旧后台本地码不扩展 Host wire。失败观测沿用官方 logger：controller 只输出共享白名单中的失败码，通用取像通知附同码；不输出异常正文或截图内容。

截图工作台的窗口采样、编辑状态、渲染与导出独立于侧栏入口；相机入口只调用控制器，不持有像素数据。工作台外壳只使用 DSH 语义 token，照片、渐变和选色光谱属于用户编辑内容。系统壁纸活动目录由Host按Apple元数据顺序/代表关联选两主题各两项，不永久固定Golden Gate/Tahoe或伪造OS版本API。一个显式Get动作后台串行取本机/补缺并持久化，不自动选图；挂载只恢复本地，Tab重入不下载/重读。后台不逐项重建缩略图或插进度行，失败保留；cached旧素材仍在仓。Windows x64 从同包 helper 读取已安装的默认与主题图片，最多五项。两平台均须真实能力握手，不伪造入口。

图像来源必须分账：五张固定随包 JPEG 只在选中时作为预设背景解码；用户明确导入 PNG/JPEG/WebP 与系统/缓存 JPEG 则经 Gallery 校验/缩略图，再成为预览背景。它们复用可取消 Image loader，但固定五张不是新素材增长的证据；长期 Blob 入库、临时解码引用归选择/工作台 owner，取消不清持久图库。

Host 的 Remote 取消终态可能先于 Client 配置撤权；批获取收到取消立即停止后续 ID，保留已入库项并回到可操作状态，不把普通取消显示成下载错误。

- `controller.ts`: 新工作台初拍读取 accepted 身份遮罩；当前工作台重拍沿用会话值，不再重读配置。标题独立，身份值同时标记头像、原生名称与自有名牌；未知整窗几何不给候选，迟到壁纸握手不重建工作台。
- `window-capture.ts`: 冻结 PNG 等尺寸解码至画布。WeakMap 留存原生比例与同图几何；不猜页面原点，不重绘 DOM。
- `window-capture-stream.ts`: 单次校验 PNG 帧序、CRC、预算与解码。可选几何绑定同图摘要且有界；扩展失败保留照片，取消释放 URL。
- `viewport.ts`: 已退出装配的旧 current-page PNG 桥消费者与错误分类；旧合同回归仍使用它，当前 controller 从 window-capture 获取原生整窗，不回退此路线。
- `window-save.ts`: 仅完整有效且 `captureEnabled` 明确为 true 的 Host accepted 配置可进入目录保存；picker 前、等待后与 mutate 回执后均重新围栏，避免旧 Host 投影默认值成为可写目录；保存仍用同一 Remote uplink/ACK/Host 独占回执。
- `save-port.ts`: 已退出装配的 Main 固定接收器导出实验；保留历史回执/取消回归，现行保存仅用 window-save 的官方 Remote uplink。
- `plugin-port.ts`: 已退出装配的 Renderer/connection.rpc 调试控制实验；保留历史 owner/nonce 回归，不是现行能力 provider 或备用像素通道。
- `page-capture-port.ts`: 取像桥的版本、current-page 范围与 capturePng/cancel 窄契约及唯一运行时验证；装配层选择桥提供方，viewport 只消费接口，不把进程连接塞进拍照/编辑器。协议声明不是已安装 Host 的能力证明。
- `capture-lifecycle.ts`: 串行拍摄、双帧等待与可选机器取像预算，整窗授权由原生阶段治理而非页面计时器；采样之前只隐藏工作台/浮层，保留帽子与相机入口，成功、失败或超时后归还临时状态，不删除布局盒。
- `privacy.ts`: 临时标题、名称与头像标记提供精确底层边界。Controller 用同一会话身份值控制名称与头像；未登录保留原生更多，恢复只归还自有属性，不写账号或 Host 偏好。
- `editor-keyboard.ts`: 工作台可见tab stop焦点/Escape/导出/历史快捷键输入适配，隐藏/inert面板与负tabindex不入循环；忙碌阶段只允许取消与焦点移动，不绕过串行导出。
- `editor.ts`: 工作台编辑、重拍与导出协调。标题与身份开关仅在重拍成功后提交来源及状态；身份覆盖只属当前工作台且不持久化。Gallery 的导入/删除/获取独立刷新，获取不选图。关闭撤权并等待自有 I/O；保存须有效回执。
- `wallpaper-gallery-actions.ts`: 单一Gallery UI action/revision/signal owner；目录与媒体分离，选择/恢复/导入信号传到背景解码，迟到不启下一步；destroy先撤权再等待自己拥有的仓储/媒体Promise，防止编辑器关仓早于读写结算，不访问DOM/Host。
- `wallpaper-gallery.ts`: 媒体仓语义层；显式requireSource目录只覆合同ID缓存并为匹配旧系统缓存补当前语义名，不发重复媒体请求；纯local恢复保留系统名及动态/legacy/user素材，用户图无名字段。
- `wallpaper-gallery-store.ts`: root身份隔离的 IndexedDB 媒体仓；只实现 list/get/put/remove/close 与共享容量/契约验证，保留系统语义名并兼容无名v1记录；关闭连接保留资产，不写 Settings或Host路径。
- `editor-viewport.ts`: 独立视口控制器；按模型工具/来源区分检测点击与手绘，模式或阶段切换可取消旧手势；模型是 zoom 唯一真源、控制器独占 pan，归一化并限幅滚轮输入，按帧合并 transform 且 dispose 取消待办，不触发像素合成。
- `model.ts`: 编辑器唯一状态及命令演算；身份遮罩状态与会话覆盖共用一个值，标题独立。图片、背景和视口不另设并行状态，渐变目录始终展开，不保留折叠命令。
- `view.ts`: 四模式与三来源DOM。编辑器标题使用独立ID，区域层保留交互语义。Get动作可刷新；当前材料至多五项，旧缓存可离线。持久系统名称驱动精确ARIA标签。
- `copy.ts`: Host 语言的双语动作、错误与 legacy 名称。私密标题描述侧边栏会话标题打码；私密身份描述头像和昵称打码。窗口标题使用编辑截图；系统分组与获取动作统一为系统壁纸，获取提示只描述当前平台可用性，不宣称统一读取或下载路径。未知素材不编造版本，后台读取静默，失败保留。
- `icons.ts`: 锁定Lucide 1.51.0的29个官方SVG图形源；只贡献路径与24单位坐标，运行尺寸、描边与根透明度由实时 Host 图标探针提供。
- `geometry.ts`: 缩放、平移及区域换算的纯几何；与 DOM 生命周期分离。
- `regions.ts`: 画框与候选区域交互。候选和已打码区域有可访问名称；手绘禁用移除语义。手绘隐藏未选候选，切回检测恢复；只修改编辑状态，提示复用统一参数层。
- `redactions.ts`: 选中区域解析；像素遮挡在导出管线实施，不改原截图。
- `compositor.ts`: 预览/导出共用合成，画布分配前按共享32MP输出预算拒绝越界；材质在原图下方，原图无滤镜，窗口外透明保持。
- `material.ts`: macOS 27.0.1 sidebar 实测 blur/saturation/fill/tone 的编辑近似；只模糊用户选择背景，临时画布按逻辑分辨率计算并释放，不读取桌面或调用私有 API。
- `background-modes.ts`: 四模式由实际背景派生，各类最近素材只留在本次工作台，持久 Gallery 在独立媒体仓，隐藏面板保留 ARIA 关系并退出焦点。
- `background-tabs.tsx`: DSH 原生 SegmentedControl 的 React/DOM 生命周期适配；Host 拥有键盘和指示器，不另存模式。
- `background-controls.ts`: 唯一背景模型到全部来源控件的增量投影；系统/个人图库共用选中环同步，异步恢复不依赖焦点/额外点击或整树重绘；标题行plus/选择/删除/Get只调度动作，不持有媒体。
- `backgrounds.ts`: 预览/导出共用两项完成图LRU/current pin；按URL共享解码、消费者分别取消，最后消费者退出中止加载；当前hydrate单一去重，换图/关闭取消，dispose拒绝待调用/迟到回填但不删持久图库。
- `presets.ts`: 静态渐变、纯色、壁纸目录；色值是编辑内容而非 DSH UI 主题。
- `assets.ts`: 五张离线壁纸的构建期 data URL 映射。
- `assets/`: 壁纸原图与独立资产清单；不请求外网。
- `wallpaper.ts`: 五张预设/data URL/图库 Blob 共用的可取消 Image loader；成功归还监听并保留渲染源，取消/错误移除 src 与监听；签名、预算和持久化归 wallpaper-gallery，不把浏览器 GC 时机当产品回执。
- `system-wallpaper-remote.ts`: 同一Remote的最多五项活动目录/媒体边界；校验动态/legacy材料语法与语义名，knownCatalog才授权load；保留available/downloadable，拒路径URL和超预算/错序/迟到JPEG，Gallery持久化。
- `system-wallpapers.ts`: 显式串行批获取owner；每次读取当前catalog、仅补活动缺项并刷新匹配旧缓存名称，不计旧cache为新进度；内部进度静默、settle后发布持久缩略图，不自动选背景，取消/卸载join真实I/O；选中环不在此分源管理。
- `preferences.ts`: 稳定/RC 分域的非敏感浏览器偏好。保存既有标题偏好与有效材料 ID，不保存会话身份覆盖。媒体只在独立 IndexedDB，不存截图或路径。
- `color-popover.ts`: 选色浮层事件与属性转义。浮层保留白、灰和黑端点丢失的 HSV 分量；只提交 HEX 到背景模型。切类或重建释放浮层，不持久化交互坐标。
- `padding-slider.ts`: 原生 range 的离散边距交互与刻度同步。
- `inspector-scroll.ts`: 检查器滚动渐隐表现；不持有编辑业务。
- `capture-window.css`: 右侧固定240px、左侧剩余宽度，与Host间距解耦；DSH Modal/主题 token 与实时原生 Button/Switch/图标测量驱动的编辑器外壳；控件运动跟随 Provider，编辑合成像素不受主题接管。
- `background-picker.css`: 原生四模式Tabs窄栏布局、预设与系统/个人图库独立五列；等高标题行右侧承载获取或plus动作，复用实时Host控件高度/图标/焦点参数，选中双环不扩大键盘焦点；缩略图/色板是内容颜色，无统一Host加载周期时使用静态占位。
- `color-popover.css`: 色板与 HEX 输入共用内容宽度，输入固有尺寸不撑大浮层。28px 白环及填色内层显式圆形；表面使用 DSH elevation，色谱不受主题反转。
- `image.d.ts`: JPEG data URL 构建器的 TypeScript 静态声明。

- `export.ts`: 编码前尺寸预算/编码后128MB字节预算约束PNG/JPEG/WebP，JPEG临时白底分配同样受限；下载交接不报告磁盘成功。

- `directory.ts`: DSH 原生目录选择窄端口；复用 shared POSIX/Windows 绝对目录语法，取消保持 null，不引入路径输入或第二偏好仓。

- `runtime-readiness.ts`: 基础与扩展独立核对实际版本。壁纸和几何各自握手；缺失扩展不撤回截图，不取像或写设置。

- `candidate-mapping.ts`: rc.2 Electron 44 的 DOM 到 PNG 映射。显式读取画布尺寸访问器。Mac 满窗使用零偏移；Windows 使用同图原生客户区偏移。比例、视口尺寸和前后快照须一致；未知几何退让，不猜边框。

- `candidates.ts`: 合并侧栏标题、唯一可见身份与语义 DOM 节点。未登录原生 More 不作为身份。检查隐藏、裁切与150项早停；变换祖先退让。WeakMap ID 绑定当前节点，不推断原生整窗原点。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
