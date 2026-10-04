# capture/
> L2 | 父级: ../CLAUDE.md

失败观测沿用官方 logger：controller 只输出共享白名单中的失败码，通用取像通知附同码；不输出异常正文或截图内容。

截图工作台的窗口采样、编辑状态、渲染与导出独立于侧栏入口；相机入口只调用控制器，不持有像素数据。工作台外壳只使用 DSH 语义 token，照片、渐变和选色光谱属于用户编辑内容。

- `controller.ts`: 原生整窗不猜页面候选坐标；初拍与每次重拍实时读取 Host accepted `captureMaskIdentity`，与本地 `privacyEnabled` 标题预遮挡独立；失败分层反馈与 request UUID 阶段交给官方 logger/Toast，资源按拍摄时序归还。
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
- `editor.ts`: 工作台受控原生 Tabs/交互/重拍/导出/卸载编排；切类立即应用各类最近素材、本地选图迟到拒绝覆盖；标题/时间和保存方式冻结，尺寸来自合成；超预算边距拒绝并反馈，恢复旧偏好或重拍按本帧预算调整；本机保存须有回执，缺 provider 不假装直接写目录；关闭取消所属保存，通知交给 Host Toast。
- `editor-viewport.ts`: 独立视口控制器；模型是 zoom 唯一真源、控制器独占 pan，归一化并限幅滚轮输入，按帧合并 transform 且 dispose 取消待办，不触发像素合成。
- `model.ts`: 编辑器唯一状态及命令演算；图片、背景、遮挡和视口不另设并行状态，渐变目录始终展开，不保留折叠命令。
- `view.ts`: 工作台 DOM 模板和焦点/滚动恢复；无重复类别标题、渐变完整展示；无背景空面板不制造不可见焦点，自选颜色入口不随选中隐藏；无 DSH adapter 时不展示系统壁纸伪操作。
- `copy.ts`: 工作台中英文文案（标题预遮挡与官方身份设置分界、保存结果未知提示）；语言由 Host 页面传入，不创建第二语言偏好。
- `icons.ts`: 锁定Lucide 1.51.0的29个官方SVG图形源；只贡献路径与24单位坐标，运行尺寸、描边与根透明度由实时 Host 图标探针提供。
- `geometry.ts`: 缩放、平移及区域换算的纯几何；与 DOM 生命周期分离。
- `regions.ts`: 画框与候选区域交互；只作用于截图编辑状态，提示文案交给统一的 DSH 参数提示层。
- `redactions.ts`: 选中区域解析；像素遮挡在导出管线实施，不改原截图。
- `compositor.ts`: 预览/导出共用合成，画布分配前按共享32MP输出预算拒绝越界；材质在原图下方，原图无滤镜，窗口外透明保持。
- `material.ts`: macOS 27.0.1 sidebar 实测 blur/saturation/fill/tone 的编辑近似；只模糊用户选择背景，临时画布按逻辑分辨率计算并释放，不读取桌面或调用私有 API。
- `background-modes.ts`: 四模式由实际背景派生，各类最近素材只留在本次工作台，隐藏面板保留 ARIA 关系并退出焦点。
- `background-tabs.tsx`: DSH 原生 SegmentedControl 的 React/DOM 生命周期适配；Host 拥有键盘和指示器，不另存模式。
- `background-controls.ts`: 当前模式面板同步与图片选择事件；编辑器只调度。
- `backgrounds.ts`: 按 URL 去重的预设/本地图片解码缓存，供预览与导出共享。
- `presets.ts`: 静态渐变、纯色、壁纸目录；色值是编辑内容而非 DSH UI 主题。
- `assets.ts`: 五张离线壁纸的构建期 data URL 映射。
- `assets/`: 壁纸原图与独立资产清单；不请求外网。
- `wallpaper.ts`: 用户本地光栅图片的类型、大小和解码验证。
- `system-wallpapers.ts`: 可选系统壁纸接口；当前 DSH 不注入，因此相关控制隐藏。
- `preferences.ts`: 复用唯一预设目录恢复所有渐变；仅存非敏感编辑偏好；不持久化截图或本地路径。
- `color-popover.ts`: 可显式关闭的选色弹层事件与属性转义，切类/重建不残留浮层；不承担背景状态源。
- `padding-slider.ts`: 原生 range 的离散边距交互与刻度同步。
- `inspector-scroll.ts`: 检查器滚动渐隐表现；不持有编辑业务。
- `capture-window.css`: 右侧固定240px、左侧剩余宽度，与Host间距解耦；DSH Modal/主题 token 与实时原生 Button/Switch/图标测量驱动的编辑器外壳；控件运动跟随 Provider，编辑合成像素不受主题接管。
- `background-picker.css`: 原生四模式 Tabs 窄栏布局、五列圆角方框与收细选中双环，键盘焦点环不缩小；以双层Host焦点环预算保护滚动边界，拾色图标适配统一方框色块而非硬塞原生尺寸；只将色板预览当作内容颜色，无统一 Host 加载周期时使用静态占位。
- `color-popover.css`: 自有浮层限定的DSH表面/Input与色谱；28px白环指示器及填色内层显式圆形，隔离Host全局曲率；浮层只用含描边的elevation、不叠边，黑白和色相不受主题反转。
- `image.d.ts`: JPEG data URL 构建器的 TypeScript 静态声明。

- `export.ts`: 编码前尺寸预算/编码后128MB字节预算约束PNG/JPEG/WebP，JPEG临时白底分配同样受限；下载交接不报告磁盘成功。

- `directory.ts`: DSH 原生目录选择窄端口；复用 shared POSIX/Windows 绝对目录语法，取消保持 null，不引入路径输入或第二偏好仓。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
