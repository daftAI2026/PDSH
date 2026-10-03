/**
 * [INPUT]: 依赖调用方传入的 locale，并遵循截图编辑器已经确认的产品术语
 * [OUTPUT]: 对外提供 CaptureWindowCopy 双语文案与 captureWindowCopy 本地化选择器
 * [POS]: capture-window 的唯一文案边界，让背景层级、标题遮罩与编辑动作同义，身份遮挡引导至官方设置
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export type CaptureWindowCopy = {
  backgroundTabs: { none: string; color: string; gradient: string; image: string };
  background: string;
  backgroundGradients: string;
  backgroundNone: string;
  backgroundPlainColor: string;
  backgroundWallpapers: string;
  blur: string;
  changeImage: string;
  close: string;
  captureFailed: string;
  clipboardUnavailable: string;
  copied: string;
  copy: string;
  custom: string;
  currentWallpaperError: string;
  currentWallpaperLoading: string;
  currentWallpaperUnavailable: string;
  getCurrentWallpaper: string;
  currentDesktop: string;
  retryWallpaper: string;
  wallpaperDownloadHint: string;
  maskColor: string;
  mosaic: string;
  move: string;
  padding: string;
  privacy: string;
  privacyDescription: string;
  preview: string;
  redact: string;
  regionHint: string;
  regionHintDraw: string;
  regionRemove: string;
  regionSuggestion: string;
  redo: string;
  retake: string;
  retakeFailed: string;
  save: string;
  saveFailed: string;
  saveUnconfirmed: string;
  exportTooLarge: string;
  saved: string;
  saveStarted: string;
  shadow: string;
  solid: string;
  sourceAuto: string;
  sourceAutoHint: string;
  sourceDraw: string;
  sourceDrawHint: string;
  title: string;
  tools: string;
  transparent: string;
  undo: string;
  wallpaper: string;
  wallpaperUnreadable: string;
  wallpaperTooLarge: string;
  zoomIn: string;
  zoomOut: string;
  zoomReset: string;
};

const ENGLISH: CaptureWindowCopy = {
  backgroundTabs: { none: "None", color: "Color", gradient: "Gradient", image: "Image" },
  background: "Background",
  backgroundGradients: "Gradients",
  backgroundNone: "No background",
  backgroundPlainColor: "Plain color",
  backgroundWallpapers: "Wallpapers",
  blur: "Blur",
  changeImage: "Change image",
  close: "Close capture window",
  captureFailed: "Unable to capture the window.",
  clipboardUnavailable: "Clipboard access is unavailable in this desktop window.",
  copied: "Copied to clipboard",
  copy: "Copy",
  custom: "Color",
  currentWallpaperError: "Unable to load the system wallpaper",
  currentWallpaperLoading: "Loading system wallpapers",
  currentWallpaperUnavailable: "System wallpapers are unavailable on this macOS version",
  getCurrentWallpaper: "Use current wallpaper",
  currentDesktop: "Current desktop",
  retryWallpaper: "Click to retry",
  wallpaperDownloadHint: "Missing wallpapers download from Apple; video sources may be large",
  maskColor: "Mask color",
  mosaic: "Mosaic",
  move: "Move",
  padding: "Padding",
  privacy: "Mask titles",
  privacyDescription: "Mask recognized titles before capture. Avatar and name masking is controlled in plugin settings.",
  preview: "Preview",
  redact: "Redact",
  regionHint: "Click detected areas to redact them",
  regionHintDraw: "Drag over any area to redact it",
  regionRemove: "Remove redaction",
  regionSuggestion: "Detected area",
  redo: "Redo",
  retake: "Retake",
  retakeFailed: "Unable to capture the window again.",
  save: "Save",
  saveFailed: "Could not export the image.",
  saveUnconfirmed: "Could not confirm saving. Check the selected folder before retrying.",
  exportTooLarge: "Image size exceeds the export limit. Reduce the padding.",
  saved: "Image saved",
    saveStarted: "Export started. Confirm in the system save flow.",
  shadow: "Shadow",
  solid: "Solid",
  sourceAuto: "Detected areas",
  sourceAutoHint: "Select detected areas",
  sourceDraw: "Draw areas",
  sourceDrawHint: "Draw custom areas",
  title: "Capture window",
  tools: "Tools",
  transparent: "Transparent",
  undo: "Undo",
  wallpaper: "Wallpaper",
  wallpaperUnreadable: "Unable to read this wallpaper.",
  wallpaperTooLarge: "Wallpaper must be PNG, JPEG, or WebP and no larger than 32 MiB.",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  zoomReset: "Reset view",
};

const CHINESE: CaptureWindowCopy = {
  backgroundTabs: { none: "无背景", color: "纯色", gradient: "渐变", image: "图片" },
  background: "背景",
  backgroundGradients: "渐变",
  backgroundNone: "无背景",
  backgroundPlainColor: "纯色",
  backgroundWallpapers: "壁纸",
  blur: "模糊",
  changeImage: "更换图片",
  close: "关闭截取窗口",
  captureFailed: "无法截取窗口。",
  clipboardUnavailable: "当前桌面窗口无法写入剪贴板。",
  copied: "已复制到剪贴板",
  copy: "复制",
  custom: "颜色",
  currentWallpaperError: "无法获取系统壁纸",
  currentWallpaperLoading: "正在获取系统壁纸",
  currentWallpaperUnavailable: "当前 macOS 的系统壁纸暂不可用",
  getCurrentWallpaper: "获取系统壁纸",
  currentDesktop: "当前桌面",
  retryWallpaper: "点击重试",
  wallpaperDownloadHint: "缺失壁纸将从 Apple 下载，视频源文件可能较大",
  maskColor: "遮罩颜色",
  mosaic: "马赛克",
  move: "移动",
  padding: "边距",
  privacy: "标题遮罩",
  privacyDescription: "截取前遮挡已识别的标题；头像和名称遮挡由插件设置单独控制。",
  preview: "预览",
  redact: "区域打码",
  regionHint: "点击检测到的区域进行打码",
  regionHintDraw: "拖动画出要打码的区域",
  regionRemove: "移除打码",
  regionSuggestion: "检测到的区域",
  redo: "重做",
  retake: "重拍",
  retakeFailed: "无法重新截取窗口。",
  save: "保存",
  saveFailed: "无法导出图片。",
  saveUnconfirmed: "无法确认保存结果，请先检查所选目录再重试。",
  exportTooLarge: "图片超出导出尺寸限制，请减小边距。",
  saved: "图片已保存",
    saveStarted: "已发起导出，请在系统保存流程中确认。",
  shadow: "阴影",
  solid: "纯色",
  sourceAuto: "检测区域",
  sourceAutoHint: "选择检测到的区域",
  sourceDraw: "手动画框",
  sourceDrawHint: "手动画出区域",
  title: "截取窗口",
  tools: "工具",
  transparent: "透明",
  undo: "撤销",
  wallpaper: "壁纸",
  wallpaperUnreadable: "无法读取这张壁纸。",
  wallpaperTooLarge: "壁纸必须是 PNG、JPEG 或 WebP，且不超过 32 MiB。",
  zoomIn: "放大",
  zoomOut: "缩小",
  zoomReset: "复位视图",
};

export function captureWindowCopy(locale: string): CaptureWindowCopy {
  return locale.toLowerCase().startsWith("zh") ? CHINESE : ENGLISH;
}
