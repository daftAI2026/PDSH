# capture/
> L2 | 父级: ../CLAUDE.md

截图工作台的窗口采样、编辑状态、渲染与导出独立于侧栏入口；相机入口只调用控制器，不持有像素数据。工作台外壳只使用 DSH 语义 token，照片、渐变和选色光谱属于用户编辑内容。

- `controller.ts`: 截图/工作台失败分层反馈与共同 request UUID 阶段交给官方 logger/上级 Toast 适配器，不自造常驻通知或臆断系统权限；将主进程冻结 PNG、拍摄时序、隐私占位与编辑器生命周期串成一次操作；重拍前清空自有通知，不另设更早的取消预算。
- `viewport.ts`: 消费装配层注入的 current-page 原生 PNG 桥；只发送关联 ID，验证 PNG/像素预算与当前 DPR 的整数 CSS 视口量化区间，等尺寸解码冻结像素，不克隆 DOM、读取样式或请求资源；端口冲突与关闭未知保留归因；取消、超时、布局/视觉视口的滚动或尺寸变化拒绝迟到结果，归还全部监听。显式桥与宿主桥都验证契约，缺失时不回退重绘。
- `save-port.ts`: 导出 Blob/保存方式/目录/名称冻结后经单次固定接收器交付、明确保存回执和编辑器级取消/停用；关闭工作台只取消本次请求、不卸载共享桥，HTTP 只发控制，不发路径或图片。
- `plugin-port.ts`: 插件自带 Renderer 接收器与官方 connection.rpc 控制适配；独立 ID/document nonce 拒绝迟到，像素不进入 HTTP 或配置，停用精确撤回接收器；未证明覆盖的可见 iframe/webview 拒绝捕获，调试接口关闭未知保留独立错误归因。
- `page-capture-port.ts`: 取像桥的版本、current-page 范围与 capturePng/cancel 窄契约及唯一运行时验证；装配层选择桥提供方，viewport 只消费接口，不把进程连接塞进拍照/编辑器。协议声明不是已安装 Host 的能力证明。
- `capture-lifecycle.ts`: 串行拍摄、双帧等待与 30 秒取像预算；采样之前隐藏自有 UI，成功、失败或超时后归还临时状态，不删除布局盒。
- `privacy.ts`: 复用标题/身份组件的严格识别与共用灰条样式；临时标记与常驻开关独立，归还只恢复仍属于本次拍摄的属性，比例不符不猜坐标。
- `editor-keyboard.ts`: 工作台焦点/Escape/导出/历史快捷键输入适配；忙碌阶段只允许取消与焦点移动，不绕过串行导出。
- `editor.ts`: 工作台交互/重拍/导出/卸载编排；标题/时间和保存方式冻结，尺寸来自合成；超预算边距拒绝并反馈，恢复旧偏好或重拍按本帧预算调整；本机保存须有回执，缺 provider 不假装直接写目录；关闭取消所属保存，通知交给 Host Toast。
- `model.ts`: 编辑器唯一状态及命令演算；图片、背景、遮挡和视口不另设并行状态。
- `view.ts`: 工作台 DOM 模板和焦点/滚动恢复；无 DSH adapter 时不展示系统壁纸伪操作。
- `copy.ts`: 工作台中英文文案；语言由 Host 页面传入，不创建第二语言偏好。
- `icons.ts`: 编辑器 SVG 图形源；只贡献路径与24单位坐标，运行尺寸、描边与根透明度由实时 Host 图标探针提供。
- `geometry.ts`: 缩放、平移及区域换算的纯几何；与 DOM 生命周期分离。
- `regions.ts`: 画框与候选区域交互；只作用于截图编辑状态，提示文案交给统一的 DSH 参数提示层。
- `redactions.ts`: 选中区域解析；像素遮挡在导出管线实施，不改原截图。
- `compositor.ts`: 预览/导出共用合成，画布分配前按共享32MP输出预算拒绝越界；材质在原图下方，原图无滤镜，窗口外透明保持。
- `material.ts`: macOS 27.0.1 sidebar 实测 blur/saturation/fill/tone 的编辑近似；只模糊用户选择背景，临时画布按逻辑分辨率计算并释放，不读取桌面或调用私有 API。
- `background-controls.ts`: 背景分组与图片选择事件；编辑器只调度。
- `backgrounds.ts`: 按 URL 去重的预设/本地图片解码缓存，供预览与导出共享。
- `presets.ts`: 静态渐变、纯色、壁纸目录；色值是编辑内容而非 DSH UI 主题。
- `assets.ts`: 五张离线壁纸的构建期 data URL 映射。
- `assets/`: 壁纸原图与独立资产清单；不请求外网。
- `wallpaper.ts`: 用户本地光栅图片的类型、大小和解码验证。
- `system-wallpapers.ts`: 可选系统壁纸接口；当前 DSH 不注入，因此相关控制隐藏。
- `preferences.ts`: 仅存非敏感编辑偏好；不持久化截图或本地路径。
- `color-popover.ts`: 选色弹层事件与属性转义；不承担背景状态源。
- `padding-slider.ts`: 原生 range 的离散边距交互与刻度同步。
- `inspector-scroll.ts`: 检查器滚动渐隐表现；不持有编辑业务。
- `capture-window.css`: DSH Modal/主题 token 与实时原生 Button/Switch/图标测量驱动的编辑器外壳；控件运动跟随 Provider，编辑合成像素不受主题接管。
- `background-picker.css`: 背景色板与交互态；只将色板预览当作内容颜色，无统一 Host 加载周期时使用静态占位。
- `color-popover.css`: DSH 表面/原生 Input 边框上的色谱；圆角跟随 Host，黑白和色相是颜色空间端点。
- `image.d.ts`: JPEG data URL 构建器的 TypeScript 静态声明。

- `export.ts`: 编码前尺寸预算/编码后128MB字节预算约束PNG/JPEG/WebP，JPEG临时白底分配同样受限；下载交接不报告磁盘成功。

- `directory.ts`: DSH 原生目录选择窄端口；取消保持 null，无手写路径或第二偏好仓。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
