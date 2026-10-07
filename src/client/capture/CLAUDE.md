# capture/
> L2 | 父级: ../CLAUDE.md

失败文案来自 copy 的全部公开码双语映射；旧后台本地码不扩展 Host wire。失败观测沿用官方 logger：controller 只输出共享白名单中的失败码，通用取像通知附同码；不输出异常正文或截图内容。

截图工作台的窗口采样、编辑状态、渲染与导出独立于侧栏入口；相机入口只调用控制器，不持有像素数据。工作台外壳只使用 DSH 语义 token，照片、渐变和选色光谱属于用户编辑内容。系统壁纸活动目录由Host按Apple元数据顺序/代表关联选两主题各两项，不永久固定Golden Gate/Tahoe或伪造OS版本API。一个显式Get动作后台串行取本机/补缺并持久化，不自动选图；挂载只恢复本地，Tab重入不下载/重读。后台不逐项重建缩略图或插进度行，失败保留；cached旧素材仍在仓。Windows无provider不伪造入口。

图像来源必须分账：五张固定随包 JPEG 只在选中时作为预设背景解码；用户明确导入 PNG/JPEG/WebP 与系统/缓存 JPEG 则经 Gallery 校验/缩略图，再成为预览背景。它们复用可取消 Image loader，但固定五张不是新素材增长的证据；长期 Blob 入库、临时解码引用归选择/工作台 owner，取消不清持久图库。

Host 的 Remote 取消终态可能先于 Client 配置撤权；批获取收到取消立即停止后续 ID，保留已入库项并回到可操作状态，不把普通取消显示成下载错误。

- `controller.ts`: 已知 Mac rc.2 同范围合同中，拍摄前后复核候选与窗口/PNG 尺寸才按零原点假设映射，原生内容原点仍待实机验收，未知范围候选为空；初拍与每次重拍实时读取 Host accepted `captureMaskIdentity`，与本地 `privacyEnabled` 标题预遮挡独立；每次打开工作台重读可选壁纸能力，迟到握手不重建当前工作台；固定失败提示与 request UUID 阶段交给官方 logger/Toast，资源按拍摄时序归还。
- `window-capture.ts`: 冻结 PNG 等尺寸解码至编辑器画布；WeakMap 留存原生比例，不猜 renderer 原点或页面 DPR，不重绘 DOM。
- `window-capture-stream.ts`: 官方 Remote 的一次性 PNG 流消费；严格帧序/CRC/预算/解码与本地 URL 释放，保留整窗原生比例，无重连、路径或持久化。
- `viewport.ts`: 已退出装配的旧 current-page PNG 桥消费者与错误分类；旧合同回归仍使用它，当前 controller 从 window-capture 获取原生整窗，不回退此路线。
- `window-save.ts`: 仅完整有效且 `captureEnabled` 明确为 true 的 Host accepted 配置可进入目录保存；picker 前、等待后与 mutate 回执后均重新围栏，避免旧 Host 投影默认值成为可写目录；保存仍用同一 Remote uplink/ACK/Host 独占回执。
- `save-port.ts`: 已退出装配的 Main 固定接收器导出实验；保留历史回执/取消回归，现行保存仅用 window-save 的官方 Remote uplink。
- `plugin-port.ts`: 已退出装配的 Renderer/connection.rpc 调试控制实验；保留历史 owner/nonce 回归，不是现行能力 provider 或备用像素通道。
- `page-capture-port.ts`: 取像桥的版本、current-page 范围与 capturePng/cancel 窄契约及唯一运行时验证；装配层选择桥提供方，viewport 只消费接口，不把进程连接塞进拍照/编辑器。协议声明不是已安装 Host 的能力证明。
- `capture-lifecycle.ts`: 串行拍摄、双帧等待与可选机器取像预算，整窗授权由原生阶段治理而非页面计时器；采样之前只隐藏工作台/浮层，保留帽子与相机入口，成功、失败或超时后归还临时状态，不删除布局盒。
- `privacy.ts`: 标题与身份临时标记分别受控；身份仅对唯一识别的侧栏 launcher 同时标记头像、原生 label 与自有 `[data-pdsh-name]`，不碰设置页账号/昵称编辑，恢复只归还本次仍拥有的属性。
- `editor-keyboard.ts`: 工作台可见tab stop焦点/Escape/导出/历史快捷键输入适配，隐藏/inert面板与负tabindex不入循环；忙碌阶段只允许取消与焦点移动，不绕过串行导出。
- `editor.ts`: 原生Tabs/交互/重拍/导出总协调；图片首次访问或失败重试读本地库存，Tab复用就绪/在途Gallery，系统缓存仅挂载恢复；导入/删除/批获取后独立刷新且获取不改背景；关闭同步撤权、等待自有I/O后关仓并立即归还DOM，不能以Promise冒充解码线程/RSS回收；保存须回执，通知归Host。
- `wallpaper-gallery-actions.ts`: 单一Gallery UI action/revision/signal owner；目录与媒体分离，选择/恢复/导入信号传到背景解码，迟到不启下一步；destroy先撤权再等待自己拥有的仓储/媒体Promise，防止编辑器关仓早于读写结算，不访问DOM/Host。
- `wallpaper-gallery.ts`: 媒体仓语义层；显式requireSource目录只覆合同ID缓存，不把旧缓存扩为当前目标；纯local恢复保留动态/legacy/user素材；无缓存选择不偷发Host媒体，原PNG/持久JPEG/取消结算与配额独立。
- `wallpaper-gallery-store.ts`: root身份隔离的 IndexedDB 媒体仓；只实现 list/get/put/remove/close 与共享容量/契约验证，事务错误以固定 Gallery error映射；关闭连接保留资产，不写 Settings或Host路径。
- `editor-viewport.ts`: 独立视口控制器；按模型工具/来源区分检测点击与手绘，模式或阶段切换可取消旧手势；模型是 zoom 唯一真源、控制器独占 pan，归一化并限幅滚轮输入，按帧合并 transform 且 dispose 取消待办，不触发像素合成。
- `model.ts`: 编辑器唯一状态及命令演算；图片、背景、遮挡和视口不另设并行状态，渐变目录始终展开，不保留折叠命令。
- `view.ts`: 四模式/三来源DOM；Get动作完整缓存后仍可刷新，当前材料至多四项、旧缓存可离线；后台/库存不插加载进度行，按钮busy、失败固定码与个人plus焦点仍保留，系统缩略图无长提示。
- `copy.ts`: Host语言的双语动作/错误与legacy名；Get说明本机优先/缺失自动下载，不要求证书设置，未知未来素材名不编造版本；图库/后台读取静默，失败保留。
- `icons.ts`: 锁定Lucide 1.51.0的29个官方SVG图形源；只贡献路径与24单位坐标，运行尺寸、描边与根透明度由实时 Host 图标探针提供。
- `geometry.ts`: 缩放、平移及区域换算的纯几何；与 DOM 生命周期分离。
- `regions.ts`: 画框与候选区域交互；手绘隐藏未选候选，保留已打码区域/候选数据，切回检测恢复；只作用于截图编辑状态，提示文案交给统一的 DSH 参数提示层。
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
- `system-wallpaper-remote.ts`: 同一Remote的最多四项活动目录/媒体边界；校验动态/legacy材料语法与语义名，knownCatalog才授权load；保留available/downloadable，拒路径URL和超预算/错序/迟到JPEG，Gallery持久化。
- `system-wallpapers.ts`: 显式串行批获取owner；每次读取当前catalog、仅补活动缺项，不计旧cache为新进度；内部进度静默、settle后发布持久缩略图，不自动选背景，取消/卸载join真实I/O；选中环不在此分源管理。
- `preferences.ts`: 按稳定/RC root 身份隔离非敏感浏览器偏好；复用唯一预设目录并恢复闭集系统/用户 Gallery ID；媒体字节只在独立 IndexedDB，Prefs不存像素、Blob或路径。
- `color-popover.ts`: 可显式关闭的选色弹层事件与属性转义，切类/重建不残留浮层；不承担背景状态源。
- `padding-slider.ts`: 原生 range 的离散边距交互与刻度同步。
- `inspector-scroll.ts`: 检查器滚动渐隐表现；不持有编辑业务。
- `capture-window.css`: 右侧固定240px、左侧剩余宽度，与Host间距解耦；DSH Modal/主题 token 与实时原生 Button/Switch/图标测量驱动的编辑器外壳；控件运动跟随 Provider，编辑合成像素不受主题接管。
- `background-picker.css`: 原生四模式Tabs窄栏布局、预设与系统/个人图库独立五列；等高标题行右侧承载获取或plus动作，复用实时Host控件高度/图标/焦点参数，选中双环不扩大键盘焦点；缩略图/色板是内容颜色，无统一Host加载周期时使用静态占位。
- `color-popover.css`: 自有浮层限定的DSH表面/Input与色谱；28px白环指示器及填色内层显式圆形，隔离Host全局曲率；浮层只用含描边的elevation、不叠边，黑白和色相不受主题反转。
- `image.d.ts`: JPEG data URL 构建器的 TypeScript 静态声明。

- `export.ts`: 编码前尺寸预算/编码后128MB字节预算约束PNG/JPEG/WebP，JPEG临时白底分配同样受限；下载交接不报告磁盘成功。

- `directory.ts`: DSH 原生目录选择窄端口；复用 shared POSIX/Windows 绝对目录语法，取消保持 null，不引入路径输入或第二偏好仓。

- `runtime-readiness.ts`: 基础/内部能力分别核实际版本。壁纸注册握手不代替版本；旧版与连接未知分账，扩展失败不阻断基础。不取像、不写设置。

- `candidate-mapping.ts`: Mac Electron 44 的 rc.2 hiddenInset 满窗零原点条件映射，原生 PNG 内容原点仍待实机验收；内/外尺寸、页面/原生比例、PNG 尺寸和拍摄前后几何一致才做 CSS→像素缩放；未知、窗口变动、页面缩放或移动候选退让，不用 alpha bbox 猜偏移。

- `candidates.ts`: 合并严格识别的侧栏标题/唯一身份与有限语义 DOM 节点；检查隐藏状态、视口/滚动祖先裁切和150项早停，遇变换裁切祖先退让，WeakMap ID 绑定当前文档节点，不推断原生整窗原点。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
