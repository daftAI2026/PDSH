# capture/
> L2 | 父级: ../CLAUDE.md

截图工作台的窗口采样、编辑状态、渲染与导出独立于侧栏入口；相机入口只调用控制器，不持有像素数据。工作台外壳只使用 DSH 语义 token，照片、渐变和选色光谱属于用户编辑内容。

- `controller.ts`: 将认证 Host PNG route、拍摄时序、隐私占位与编辑器生命周期串成一次操作；重拍走同一边界。
- `capture-lifecycle.ts`: 串行拍摄和双帧等待；异常、超时后撤销临时隐藏标记。
- `privacy.ts`: 复用侧栏严格识别器，临时占位并映射可确认区域；比例不符不猜坐标。
- `editor.ts`: 工作台交互编排、重拍、撤销/重做、复制/保存及卸载；隐私开关仅在重拍成功后提交，不访问 Host 配置。
- `model.ts`: 编辑器唯一状态及命令演算；图片、背景、遮挡和视口不另设并行状态。
- `view.ts`: 工作台 DOM 模板和焦点/滚动恢复；无 DSH adapter 时不展示系统壁纸伪操作。
- `copy.ts`: 工作台中英文文案；语言由 Host 页面传入，不创建第二语言偏好。
- `icons.ts`: 编辑器 SVG 图形源；只贡献路径，不固定主题颜色。
- `geometry.ts`: 缩放、平移及区域换算的纯几何；与 DOM 生命周期分离。
- `regions.ts`: 画框与候选区域交互；只作用于截图编辑状态，提示文案交给统一的 DSH 参数提示层。
- `redactions.ts`: 选中区域解析；像素遮挡在导出管线实施，不改原截图。
- `compositor.ts`: 截图、背景、遮挡、圆角、阴影的最终画布合成。
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
- `capture-window.css`: DSH token 驱动的模态框、工具栏、画布、检查器、控件及拍摄态。
- `background-picker.css`: 背景色板与交互态；只将色板预览当作内容颜色。
- `color-popover.css`: DSH 表面/边框上的色谱；黑白和色相是颜色空间端点。
- `image.d.ts`: JPEG data URL 构建器的 TypeScript 静态声明。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
