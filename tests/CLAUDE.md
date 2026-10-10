# tests/
> L2 | 父级: ../CLAUDE.md

- `capture-color-popover.test.ts`: 生产选色浮层的色域回归。白、灰与黑端点保留无色像素无法表达的 HSV 分量；外部同步使用同一状态。不证明 Desktop 绘制。

- `capture-geometry.test.ts`: 闭集 DTO、PNG 内整数矩形、比例与摘要语法。验证查询时限常量；不证明原生对位或 Host 链路。

- `native-baseline.test.ts`: 固定 Mac 原生闭包的复用合同。逐项改动输入和助手，验证 Windows RC 拒绝异源产物。
- `windows-temp-ownership.test.ts`: 真实文件和目录 ACL 合同。拒绝叶写权限、继承写权限和祖先 Delete/DeleteChild；非空目录拒绝后 ACL 不变。
- `windows-rc-archive.test.ts`: 真实 Windows npm/tar 的权限红绿合同。验实际归档 0755，拒绝模式漂移并保留成员和字节门。
- `typert-generator-platform.test.ts`: 在临时副本运行真实官方生成器。Windows junction 与 Node 驱动 tsc；LF/CRLF 同源通过，内容漂移和裸 CR 拒绝。
- `windows-capture-fixture.cpp`: 自有 PMv2 Main→Host→helper 链。WGC/WIC 验 DWM 相对 viewport JSON、四角标记、客户区边线与 PNG 像素对位；保持尺寸差异、关闭和异常终止合同。真实 EOF 和 Job 归零证明结算。
- `windows-wallpaper-contract.ps1`: 固定 Windows/img0,img19、ThemeA-D代表材料及Theme1/Theme2代表材料序，最多五项；核内容 ID、顺序、真实 JPEG 解码与字节边界。输出中途取消等待 helper 实际退出；不枚举目录或访问 Desktop profile。
- `windows-capture-contract.ps1`: 将助手重建到带所有权标记的自有临时 staging；运行 viewport/像素、目标关闭和启动取消合同。可对 SHA 固定 RC5 产物验证缺 viewport 红结果；不冒充 WGC 中途撤权。

- `capture-failure-observation.test.ts`: 公开失败码双语提示与旧后台/连接未知分账，从控制器到通知/logger的红绿回归，拒绝未知code泄漏；不替代实机链路验收。

这些 TypeScript 合同运行在 Node/jsdom；只能证明源码和生成产物，不替代 Desktop 实窗验收。

- `system-wallpaper-acquisition-view.test.ts`: 双语获取/刷新与静默后台；系统空态和个人末尾plus不参与选择，空库存不重复正文；使用四项Mac legacy样本验完整缓存仍可显式刷新，持久名称保留精确ARIA标签且无长tooltip，失败alert/固定码仍保留；不把样本数当共享上限或冒充Desktop绘制。
- `system-wallpaper-download.test.ts`: 三Range/强ETag、预算/单sample重建和body取消；仅结构化证书码分类，未知码/异常正文不能伪造诊断，不自动重试或换信任；人工fixture不代表native或Desktop网络。
- `system-wallpaper-acquisition.test.ts`: 双入口共用真实wiring与活动catalog串行批次、available或downloadable缺项、完整旧缓存也可发现未来roster、真实完成数与缓存保留；内部loading进度静默，错误/取消/销毁join真实结算。
- `system-wallpaper-acquisition-editor.test.ts`: 生产Editor真实点击个人图后往返none/color/gradient，核背景ID、个人/系统唯一选中ARIA、四面板hidden/inert/label关系与DOM/Tabs/本地读取稳定；另验首开个人ID异步恢复；生命周期取消仍join真实I/O，无迟到Host媒体/通知；jsdom不冒充Desktop绘制。

- `host-compatibility-assessment.test.ts`: 临时源码仓的只读触点/imports、原生几何与历史路径提示、遍历预算及敏感路径/CLI/导入副作用合同；始终未验证兼容，不联网、不启动宿主或原生助手。

- `component-host.test.ts`: 生成唯一Config、root owner captureEnabled observer、配置不触发旧连接与Mac/Windows helper包内相对路径；新代码的单航班/结算另列专门合同，不冒充真实Loader或实机。
- `client-injection.test.ts`: Cordis 4.0.4 真注册器运行唯一生成 Client；两入口只追加既有 Bundle 的 UI 注册。旧 ready Host 缺少截图字段时身份/标题照常而相机撤回，完整 snapshot 可恢复；另验平台/Remote provider、旧桥隔离与 namespace 生命周期，不冒充实机像素验收。
- `client.test.ts`: 生成 Client 的八组合、取消、回滚和页脚。会话相机追加 utilities，不覆盖 corner。内存编译真实组合根，验证同 proxy 握手世代；两个 mutant 须失败。spy 不证明像素、Host 或 Desktop。
- `header-camera.test.ts`: 真实 JSX 与侧栏 DOM 适配合同。验证收起态、语义失配、点击重读、忙碌、语言及卸载。歧义锚点改名后必须恢复。聊天增删不得触发全局锚点查询。控件外观桩不证明 Desktop 排版或取像。
- `capture-bootstrap.test.ts`: 副作用适配下的真实启动编排，拒绝身份/端口、ACK 失败、关闭 unknown 与取消，系统临时根内私有目录独占创建/分别归还，只读真实 macOS ps 路径格式；不操作真实 Main。
- `capture-control.test.ts`: 生成 Main 与真实 Host socket transport 的畸形帧、握手、控制 ACK、取消与资源归还；新增系统临时根内真实 Unix socket 两端握手及目录边界/权限/符号链接拒绝及根别名接受；不打开真实应用调试端口。
- `capture-route.test.ts`: 官方 RPC 控制封套、owner 世代与迟到 release 围栏；Host 自己撤回 consent 即刻取消，不依赖 Renderer 消息；确认归还后的断连不永久缓存；Main/control 关闭未知不随新 owner/排队/release/重装清除。
- `capture-settings.test.ts`: 完整 accepted capture 字段就绪门、旧 Host ready 只读提示/无写入无 picker且隐藏 fallback 目录文案、loading 不误报与后续完整快照恢复；完整但空目录沿用原目录状态；另验导出 revision/路径围栏，不改变常驻身份开关。
- `inspector-ownership.test.ts`: 隔离 VM 的 PID/nonce/原调试地址围栏与 watchdog 归还，不打开真实 Main 调试端口。
- `capture-controller.test.ts`: 新工作台初拍读取 accepted 身份遮罩，当前重拍沿用会话值并同时遮挡头像与名称；标题独立，下一工作台重读配置。另验壁纸能力重读、失败与卸载，不臆断系统权限。
- `capture-notice.test.ts`: 官方 Toast 参数和默认生命周期委托、同文重显、旧完成围栏及 React 根回收；不另模拟宿主计时器。
- `capture-material.test.ts`: 当前 macOS sidebar 配方、仅背景模糊与临时画布释放合同；不冒充原生窗口覆盖证明。
- `capture-pixels.test.ts`: 宿主/显式 PNG 桥的能力、目标范围与关联 ID；预算/DPR/130% 缩放量化、冻结解码及取消/视口变化；固定 Main 错误和 Electron invoke 包装保持分类，未知通道不冒充、忙碌不误报端口；桩桥不是安装件能力证据。
- `capture-privacy.test.ts`: 标题与截图身份独立；唯一识别后遮挡自有名牌/原生名称/头像，未知结构及账号编辑退让，属性按所有权归还并守候选比例。
- `capture-styles.test.ts`: 五列统一圆角色块、固定240px检查器与设置开关等高槽；检查器选中环安全边距与圆形拾色图标局部约束， 工作台Host token来源/实时几何消费及自有色谱28px白环及内层圆形隔离、浮层单一elevation描边；禁Codex主题、数值回退与宿主拾色器样式污染。
- `capture-editor-keyboard.test.ts`: 背景面板Tab围栏跳过hidden/inert/CSS隐藏、disabled与负tabindex；不替代原生键盘验收。
- `capture-view.test.ts`: 生产布局锁住标题下留白、图标顶沿与滑轨刻度。私密标题/私密身份使用双语短文案，编辑器独立关联标题。检测区域保留可访问名称与共享点击命令。标题遮罩独立于单一身份遮罩；无系统壁纸 adapter 时不伪造入口。
- `host.test.ts`: 真实 Schemastery Config/路径边界与平台provider分流；默认 Downloads 使用宿主 `homedir()` 与 `path.join` 精确比较，覆盖 POSIX/Windows drive-root/UNC 并拒绝相对、非canonical及device namespace；缺 helper/不支持架构仍保留设置。
- `localization.test.ts`: 单 Bundle 离线品牌元信息与内部三功能 zh/en 文案；透明底单路径图标响应 Host color-scheme。
- `model.test.ts`: 昵称、头像和旧字段投影验证。
- `presentation.test.ts`: 视觉身份的唯一归属与卸载。未登录借用官方头像和身份行；收起及停用恢复原样。样式缺失、重复和错属拒绝覆盖。菜单、临时头像和登录恢复独立于配置写入。
- `plugin-detail-typography.test.ts`: 自身大标题标记、版本胶囊不变、未知结构及外部接管合同。原生 CSS 的实际字形另在浏览器验收。
- `search-entry.test.ts`: 初拍/重拍CSS阶段保留两入口并隐藏工作台；原生搜索邻接、折叠/展开、实时 SVG strokeWidth 按 viewBox 尺寸匹配、两入口同笔画与不可靠几何退让；保留根透明度/颜色/class/点击和卸载合同。
- `settings-card.test.ts`: React 字段写入、取消、冲突与焦点合同。真实 MutationObserver 驱动退出与登录恢复，不写配置。未登录禁用账号来源；默认 SVG 账号仍可选。来源标签归右侧操作组。
- `sidebar-redaction.test.ts`: 普通/空白会话、搜索与 HoverCard 标记和恢复。
- `native-style-probe.test.ts`: 原生 Input/Button/Switch/设置字段/Tooltip 几何与动效采样，SVG 笔画比例/透明度/尺寸及主题/DOM/resize 重采；合法零长度保真、无效值或探针节点缺席时撤销旧值，节点重建后重采，root 脱离后清空且卸载恢复原值。
- `styles.test.ts`: 视觉规则与上游 token 来源；整排页脚紧凑靠右，正文同字号，GitHub 图稿不带内联基线空白。保留间距、主题与焦点。入口只合成根透明度；原生探针独占测量并隐藏绘制。验证来源文本间距和昵称留白，不抢焦点。
- `title-toggle.test.ts`: Host 单路径切换及失败状态。
- `updater.test.ts`: 首次清单等待卸载不安装、重试通知卸载围栏、第二次 PNPM 超时不误报 GitHub；稳定 tag、固定 Git 提交、官方 Remote 回包封套、显式安装、预检查超时最多重试一次与失败原因白名单；第四参 activation hook 仅以 `true` 确认升格 `restart-required`，false/throw 保留 restart，旧三参兼容且 dispose 拒绝迟到成功；安装失败保留目标版本，不假定 Manager 回滚磁盘清单，提示覆盖全部已知结果白名单。
- `update-badge.test.ts`: 官方详情安装等待委托 Host StateDot；重试和磁盘前移保留 loading，成功/失败/重启立即移除。保留当前 Client 探测、失败重挂及官方 Modal 合同；不代替 Desktop 绘制。
- `update-source.test.ts`: 公共 GitHub tag 请求的无凭据网络边界；不冒充 Desktop CSP 证明。
- `dom-tooltip.test.ts`: 非 React 控件跟随宿主 Tooltip 延时与方位参数，卸载彻底清理。
- `release-check.test.ts`: 隔离 Git 验发布门。长期 Release 章节与双语 README 当前版本分离。拒绝缺章、漂移、脏树及异位 tag。假 gh 拒绝写请求，不创建 tag。
- `release-metadata.test.ts`: 双语 README 与 package/locale 文案同源。英文缺失或结构错误时拒绝全部写入，保留块外正文。另验 GitHub 集合与请求边界；不联网。
- `release-push.test.ts`: 稳定 tag pre-push 发布门、同名 ref、不可改删旧 tag 与多记录 stdin 隔离；普通分支/RC 排除，假 pnpm 不触及真实远端。
- `profile-loading.test.ts`: 隔离 profile 根包链接结构桩验证唯一 Host/Client/locale 解析与缺包负例；不冒充官方安装。
- `source-layout.test.ts`: 手写 TypeScript 与宿主所需生成 JavaScript 的边界。

- `plugin-port.test.ts`: 请求级保存取消不卸载桥、下次请求可继续； 官方 rpc 仅发控制、Main 像素接收 nonce/重放/取消围栏和 Renderer 唯一 owner 归还。
- `page-capture-main.test.ts`: 原 mainFrame 交付、同 URL reload、取消锁保留、独立可见视图及 DPR/PNG 声明拒绝、卸载监听归还；getter 异常不泄漏共享锁，重新装配仍串行，每次采样重新验证允许页面。

- `capture-export.test.ts`: 5K默认边距、合成/JPEG分配前32MP和编码后128MB预算、basename/MIME/白底归还及日志脱敏；不读用户截图。

- `capture-diagnosis.test.ts`: 真实 Client→Host 编排的端口冲突错误传播与统一 UUID；模拟 Main 拒绝副作用，不声称 Desktop 成功。

- `page-save-webp.test.ts`: 静态尺寸/分块/动画与5K默认边距的32MP导出预算；头部校验不冒充像素解码。
- `page-save-file.test.ts`: 独立临时目录的磁盘替换、并发直接保存独占自动编号、取消保护旧文件与临时清理，不访问用户目录。
- `page-save-main.test.ts`: 面板/直接保存回执、5K默认边距的PNG/JPEG输出预算、真实文件提交前取消/导航/停用及跨装配串行锁；不冒充实机验收。

- `capture-editor-export.test.ts`: 身份开关失败时保留旧图和旧值，成功重拍统一更新头像与名称且不持久化；标题仍独立。另验背景 Tabs、取消、保存与导出共用新源；Canvas 桩不证明视觉或本机文件面板。
- `capture-editor-viewport.test.ts`: 真实编辑器设色器显隐、纯色同源投影与工具切换恢复。初始 Image 面板仅读本地元数据，不调用 Host 目录/媒体；异步库存结算保留首笔舞台与捕获。覆盖滚轮 deltaMode/限幅、统一缩放源、无像素重合成、帧合并与越界裁剪。另验忙碌、失捕获、失焦、重复指针、终态重入和 dispose；不冒充 Desktop 动效实测。

- `host-acceptance.test.ts`: 集成 CLI 安全前置；自有临时目录验证 owner/路径/符号链接/凭据、stable/RC候选身份和精确PNPM版本门，不启动DSH或替代安装件验收。

- `bundle-artifacts.test.ts`: 双语 README 与内部能力面的真实 tgz 闭包。核 Mac universal、Windows x64/asInvoker、执行位和字节。POSIX先改隔离文件模式，Windows改归档mode，确保坏权限样本真实变坏。拒绝子依赖、宽泛 files 与安装 hook，不执行安装。
- `capture-defaults.test.ts`: 旧导出默认只通过根 pdsh revision 修正；自定义值、已移除子域与迟到卸载不覆盖偏好。

- `window-capture-controller.test.ts`: 真实画布的 Mac 零偏移与 Windows 客户区映射。尺寸沿用原型访问器，避免普通对象桩掩盖生产缺陷。拒绝缺失、错尺寸、错比例与移动几何；照片保留手绘。不冒充实机证据。

- `window-capture-client-stream.test.ts`: PNG 帧序、CRC 与解码边界。可选几何绑定同图 SHA；超时保留照片，取消释放资源。不证明实机像素。

- `window-save-client.test.ts`: ACK 背压、finish 半关闭、真实保存回执和完整截图配置的目录 revision 围栏；旧 Host 不开 picker/不 mutate，等待期间 schema 回退不接受 fallback，不冒充实机保存。

- `window-save-backend.test.ts`: 纯 Host 有界 uplink、真实 Chromium Canvas sRGB ICC字节保留/未知metadata拒绝、accepted POSIX/Windows native-path双边界、UNC share-root规范化、配置/生命周期围栏与临时目录真实独占提交/不覆盖合同；仅非Windows断言 POSIX 0600 mode，Windows 文件 mode 不代表 ACL，Windows专项路径用例须在Windows runner运行。
- `window-save-roundtrip.test.ts`: 实际 Client↔Host 双向状态机和两块PNG落盘/重复basename编号；内存carrier不是DSH实机Gateway。

- `window-capture-stream.test.ts`: Host 惰性取像、固定基础帧与单航班结算。几何不进入基础帧；自然完成才提交记录，晚错和提前归还拒绝。不执行 helper。

- `window-capture-typert.test.ts`: 官方基础/内部能力面分域、真实内部 owner、自引用 DTO、流与纯握手。静态证据不冒充实际 Host。
- `native-window-capture.test.ts`: fake子进程/时钟的原生包装器、CRC/PNG封套、真实close/单航班结算合同；覆盖Mac universal 与 Win x64 路由、包内 exe provider gate、hidden/non-shell argv、ARM64 拒绝及取消强杀等待；只读Mach-O验证Mac双架构，不运行真实helper。
- `system-wallpaper-native.test.ts`: 源码锁定缓存桥/动态UUID和root-owned系统HEIC命令；macOS临时ObjC++ harness只开私有fixture fd，验证Aerial路径拒绝符号链接；不触用户缓存、解码或代替SDK/媒体/Desktop。
- `system-wallpaper-mov-fixture.ts`: 共用人工单轨QuickTime Range源，模拟tapt/双hdlr/自包含alis/hvc1+nclc与已知辅助表，暴露64B头、moov、首sample和逻辑总长；可表示大源而不分配整片媒体，不代表Apple素材/native证据。
- `system-wallpaper-mov.test.ts`: 固定MOV边界、单描述与自包含引用、codec/辅助atom拒绝、两种已确认csgm长度、首sync sample索引重建及v0/v1时长；人工fixture仅证明合同，不代表固定Apple源/native首帧验收。
- `system-wallpaper-protocol.test.ts`: 旧缓存与未来材料语法、五项共享活动目录预算/名称控制字符与终态；不把语法当来源授权，不读系统或网络。
- `wallpaper-gallery-protocol.test.ts`: 本地持久素材的稳定/RC身份、closed ID、固定36项总预算、Blob/缩略图/像素预算、系统语义名闭集与用户/额外私有字段拒绝；不访问浏览器或文件系统。
- `wallpaper-gallery-store.test.ts`: IndexedDB仓的原子容量/去重/删除、系统名v1往返与旧记录读取、File去名、有界重读、versionchange换连接与close中止在途写入合同；FakeIDB不替代真实浏览器或Desktop持久化验收。
- `wallpaper-gallery-client.test.ts`: 真实Gallery包装验证活动目录与旧仓分账、动态系统名新存/旧缓存补写和纯本地重开、未来ID入库/旧图保留、失败保真、原PNG/去重/配额及取消settle；实际IDB/Desktop重启另验。
- `capture-background-image-store.test.ts`: 完成图LRU/current pin、共享消费者独立取消/最后退出中止、同URL重试拒绝旧回填、dispose及时settle及hydrate换图取消/同图去重；不取系统素材或测RSS。
- `capture-image-loader.test.ts`: 可控Image验证预取消、load/error/abort监听归还、移除src及无需load事件的取消结算；成功保留渲染源，不测真实浏览器解码线程或RSS。

- `bundle-fixture.ts`: 共用合成单包与双语 README 归档闭包；可解析的双架构 Mach-O 与 x64 PE 无可运行指令。不执行假 helper。

- `window-capture-host-gate.test.ts`: 真实 Cordis owner-filter 与构建 Host service 连线，假 helper/uplink 验证撤权同时中止和实际 settle；已取消调用覆盖 Settings 迟到就绪、撤权与终态卸载，防止挂载时的空投影永久锁死；不取像；版本闭包在相机调用前拒绝异版本实例。

- `window-capture-host-observation.test.ts`: fake child 的固定Host mount/逐调用enabled核对/phase/native/terminal日志和懒启动合同；不启动原生 helper或读取用户资料。

- `capture-icons.test.ts`: 锁定官方Lucide路径摘要与相机同源，保证Host运行几何及ISC告知不变。

- `capture-background-modes.test.ts`: 四模式从真实背景派生、素材记忆与隐藏面板 ARIA/焦点合同、无重复标题、渐变完整展开/全预设恢复与拾色图标常显，保留内置和上传入口。

- `capture-background-tabs.test.ts`: 原生 SegmentedControl 参数/受控更新/忙碌与卸载围栏，根桩不模拟 Host 键盘或视觉。

- `capture-runtime-loader.test.ts`: 基础换载与壁纸可选合同。缺失壁纸不阻断基础；旧实例结算后换代，不取像。
- `capture-runtime-legacy-upgrade.test.ts`: 固定历史壳换载真实 payload。真实能力服务检查几何 marker 与方法，严格注册独立接口；摘要记录撤权时清空。不证明 Gateway 或实机。
- `runtime-upgrade-fixtures/CLAUDE.md`: 固定Loader、身份、manifest和payload字节；测试不调用Git。

- `capture-runtime-readiness.test.ts`: 基础版本与壁纸、几何握手独立校验。扩展缺失不撤回基础；取消拒绝继续。封套桩不证明 Host 或像素。

- `capture-runtime-location.test.ts`: 稳定/RC 构建身份只接受同名 manifest；真实 realpath/ESM 换载并拒绝 foreign 包和包根外模块，非 Manager/实机验收。

- `capture-candidates.test.ts`: 候选几何、裁切、150项早停与侧栏优先。真实样式排除未登录 More；自有头像与昵称参与检测。节点移动保留 ID，替换不继承选择；不证明原生对位。

- `rc-identity.test.ts`: 以 esbuild 注入 stable/RC 名称验证根配置、locale、编辑偏好键与更新边界；实例化版本化 capture 业务闭包，以 Remote iterable 终态黑盒验证只读自身 accepted Settings、启停和迟挂载恢复，不启动 helper；不验证 Manager 共存或 Desktop UI。

- `rc-packaging.test.ts`: 独立候选身份、双语说明与含包图生成器的白名单 staging。核私有路径排除、稳定源不变、权限及拒绝覆盖。不运行 SDK GUI 或真实安装。
- `system-wallpaper-host-fixtures.ts`: 共用受控子进程、最小 JPEG 和 iterable 夹具。不作为真实原生目录或像素证据。
- `system-wallpaper-runtime-windows.test.ts`: Windows CaptureRuntime 重读 roster、陈旧 hash ID 拒绝及静图路由合同。不读取系统目录或验收像素。
- `system-wallpaper-host.test.ts`: Mac 与 Windows helper 路由、Windows五项hash roster接受/六项拒绝、固定错误码、预算、取消 close 及下载门合同。不执行真实 helper 或联网。
- `system-wallpaper-client.test.ts`: 最多五项动态/legacyRemote目录授权、名称/失败码保真、unlisted动态ID拒发媒体、严格JPEG/终态/取消与URL归还；桩不替代Browser/Desktop。
- `system-wallpaper-selection.test.ts`: 系统媒体返回后的背景解码仍归选择 signal，重选缓存/切类/销毁取消旧工作且不迟到应用或提示；不取系统素材或量RSS。

- `system-wallpaper-catalog.test.ts`: 人工当前/未来Apple schema验证原四项保留、统一候选流前五项与缺组退让、无OS字段伪装、稳定材料身份与未知/歧义/URL拒绝；纯parser不读取真实媒体，compiled/实机另验。

- `system-wallpaper-transport.test.ts`: fake-child验证系统curl参数/URL域、206/ETag/头体预算/退出码、单字节碎片与分配失败真实close结算；不联网或代替native/Desktop。

- `system-wallpaper-stream-catalog.test.ts`: 动态ID活动目录0–5项、Windows x64五项流、重复/非法ID/名称C1与unavailable边界；fake operation不读取系统或联网。

- `public-guides.test.ts`: 验证双语互链、同源版本和平台边界。两平台壁纸最多五项；Windows 不读当前壁纸、不联网。README 写产品事实并链接验收状态，PUBLISHING 保留未验门。另核 skill 同步、历史原文摘要及头像许可。不运行宿主或联网。

- `plugin-icon-theme.test.ts`: 官方标签主色快照与单路径 SVG 生成合同。深色媒体查询由 Host color-scheme 驱动；不冒充浏览器主题验收。

- `capture-pointer-release.test.ts`: jsdom 重放零按钮移动与先失捕获后 pointerup；验证生产状态机、取消与连续十笔，不模拟 Blink。
- `capture-pointer-default.test.ts`: 生产视口起点默认动作与失捕获取消合同；不冒充 Electron 原生事件。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
