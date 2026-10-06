/**
 * [INPUT]: 依赖调用方传入的 locale、shared 封闭壁纸 ID，并遵循截图编辑器已经确认的产品术语
 * [OUTPUT]: 对外提供 CaptureWindowCopy 双语文案/版本壁纸名称、系统图片与我的图片来源标题、图库动作和固定失败码提示选择器
 * [POS]: 唯一文案边界；本机优先/缺失自动下载，后台与图库读取不插提示行，失败保留；系统缩略图不重复媒体说明，语言归 Host
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import type { SystemWallpaperId, LegacySystemWallpaperId } from '../../shared/system-wallpaper-protocol.ts';

export type CaptureWindowCopy = {
  backgroundTabs: { none: string; color: string; gradient: string; image: string };
  background: string;
  backgroundGradients: string;
  backgroundNone: string;
  backgroundPlainColor: string;
  backgroundWallpapers: string;
  blur: string;
  close: string;
  captureFailed: string;
  clipboardUnavailable: string;
  copied: string;
  copy: string;
  custom: string;
  systemWallpapersError: string;
  systemWallpapersLoading: string;
  systemWallpapersProgress: string;
  systemWallpapersPartial: string;
  systemWallpapersUnavailable: string;
  systemWallpaperLoadError: string;
  systemWallpaperNames: Record<LegacySystemWallpaperId, string> & Partial<Record<SystemWallpaperId, string>>;
  addImage: string;
  systemImages: string;
  myImages: string;
  myImage: string;
  removeImage: string;
  galleryEmpty: string;
  galleryError: string;
  galleryFull: string;
  galleryUnavailable: string;
  loadWallpapers: string;
  retryWallpapers: string;
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
  runtimeOutdated: string;
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
  close: "Close capture window",
  captureFailed: "Unable to capture the window.",
  clipboardUnavailable: "Clipboard access is unavailable in this desktop window.",
  copied: "Copied to clipboard",
  copy: "Copy",
  custom: "Color",
  systemWallpapersError: "Unable to get system wallpapers",
  systemWallpapersLoading: "Reading saved wallpapers",
  systemWallpapersProgress: "Getting system wallpapers ({completed}/{total})",
  systemWallpapersPartial: "Some system wallpapers could not be acquired. Saved images are kept.",
  systemWallpapersUnavailable: "No supported system wallpapers are available",
  systemWallpaperLoadError: "Unable to load this system wallpaper",
  systemWallpaperNames: {
    'system-wallpaper-golden-gate': 'macOS 27 · Golden Gate',
    'system-wallpaper-golden-gate-sunset': 'macOS 27 · Golden Gate Sunset',
    'system-wallpaper-tahoe': 'macOS 26 · Tahoe',
    'system-wallpaper-tahoe-day': 'macOS 26 · Tahoe Day',
  },
  addImage: "Add image",
  systemImages: "System images",
  myImages: "My images",
  myImage: "Image",
  removeImage: "Remove",
  galleryEmpty: "No saved images yet.",
  galleryError: "Unable to read the saved image library",
  galleryFull: "The image library is full. Remove an image before adding another.",
  galleryUnavailable: "The image library is unavailable. This image was not applied or saved.",
  loadWallpapers: "Get system wallpapers",
  retryWallpapers: "Retry missing wallpapers",
  retryWallpaper: "Click to retry",
  wallpaperDownloadHint: "Uses local wallpapers first; downloads missing ones.",
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
  runtimeOutdated: "The capture backend does not match this plugin version. Save unfinished work, then quit and reopen DSH before capturing or saving.",
  saveFailed: "Could not export the image. Keep your edits, then check the save folder and plugin status before retrying.",
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
  close: "关闭截取窗口",
  captureFailed: "无法截取窗口。",
  clipboardUnavailable: "当前桌面窗口无法写入剪贴板。",
  copied: "已复制到剪贴板",
  copy: "复制",
  custom: "颜色",
  systemWallpapersError: "无法获取系统壁纸",
  systemWallpapersLoading: "正在读取已存壁纸",
  systemWallpapersProgress: "正在获取系统壁纸（{completed}/{total}）",
  systemWallpapersPartial: "部分系统壁纸获取失败，已存图片不受影响。",
  systemWallpapersUnavailable: "本机没有可识别的系统壁纸",
  systemWallpaperLoadError: "无法获取这张系统壁纸",
  systemWallpaperNames: {
    'system-wallpaper-golden-gate': 'macOS 27 · Golden Gate（金门）',
    'system-wallpaper-golden-gate-sunset': 'macOS 27 · Golden Gate Sunset（金门日落）',
    'system-wallpaper-tahoe': 'macOS 26 · Tahoe（太浩湖）',
    'system-wallpaper-tahoe-day': 'macOS 26 · Tahoe Day（太浩湖日间）',
  },
  addImage: "添加图片",
  systemImages: "系统图片",
  myImages: "我的图片",
  myImage: "图片",
  removeImage: "移除",
  galleryEmpty: "还没有保存的图片。",
  galleryError: "无法读取本地图片图库",
  galleryFull: "图片图库已满。请先移除一张图片，再添加新图片。",
  galleryUnavailable: "本地图片图库不可用；这张图片未应用或保存。",
  loadWallpapers: "获取系统壁纸",
  retryWallpapers: "补取缺失壁纸",
  retryWallpaper: "点击重试",
  wallpaperDownloadHint: "优先使用本机素材，缺失时自动下载。",
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
  runtimeOutdated: "截图后台尚未匹配当前插件版本。请保留工作，退出并重新打开 DSH 后再截图或保存。",
  saveFailed: "无法导出图片。请保留当前编辑，检查保存目录和插件状态后重试。",
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


/** 只解释已校验结果码；未知异常正文不进入用户提示。 */
export function captureFailureMessage(code: string | undefined, locale: string): string | undefined {
  const zh = locale.startsWith('zh')
  if (code === 'runtime-not-current') return captureWindowCopy(locale).runtimeOutdated
  if (['native-size-invalid-or-over-budget', 'byte-budget-exceeded', 'encoded-byte-budget-exceeded'].includes(code ?? '')) {
    return zh ? '截图尺寸或数据超过限制，请缩小 DSH 窗口后重试。' : 'Capture dimensions or data exceed the limit. Make the DSH window smaller and retry.'
  }
  if (['invalid-png', 'metadata-mismatch', 'invalid-capture'].includes(code ?? '')) {
    return zh ? '截图数据未通过校验，请重试；再次失败时检查插件版本。' : 'Capture data validation failed. Retry; check the plugin version if it happens again.'
  }
  const messages: Record<string, readonly [string, string]> = {
    'permission-not-granted': ['DSH 尚未获得屏幕录制权限，请在系统设置中允许后再截图。', 'DSH has not received screen recording permission. Allow it in system settings, then capture again.'],
    cancelled: ['截图已取消，可重新点击相机。', 'Capture was cancelled. You can click the camera again.'],
    'helper-failed': ['原生截图助手未能完成取像，请重试；再次失败时检查插件状态。', 'The native helper could not complete capture. Retry; check plugin status if it happens again.'],
    busy: ['上一张截图还在处理，请稍后再试。', 'The previous capture is still processing. Try again shortly.'],
    disposed: ['拍照组件已关闭或正在更新，请确认插件和拍照功能已启用后重试。', 'Capture is disabled or updating. Check that the plugin and capture are enabled, then retry.'],
    'capture-timeout': ['截图处理超时，请重试。', 'Capture processing timed out. Please retry.'],
    'helper-start-timeout': ['截图助手启动超时，请重试；再次失败时检查插件安装。', 'The capture helper took too long to start. Retry; check the plugin installation if it happens again.'],
    'helper-start-failed': ['截图助手未能启动，请在官方插件页检查安装状态。', 'The capture helper could not start. Check the installation on the official Plugins page.'],
    'requires-macos-14': ['原生截图需要 macOS 14 或更新版本。', 'Native capture requires macOS 14 or later.'],
    'api-unavailable': ['当前系统未提供所需截图接口，请检查系统版本。', 'The required capture API is unavailable. Check the system version.'],
    'no-ordinary-window-for-main-pid': ['未找到可截取的普通 DSH 窗口，请打开主窗口后重试。', 'No ordinary DSH window is available. Open the main window and retry.'],
    'ambiguous-multiple-windows-refuse': ['找到多个普通 DSH 窗口，无法确定截图目标。请保留一个后重试。', 'Multiple ordinary DSH windows were found. Keep one open and retry.'],
    'process-changed': ['DSH 进程已变化，请重新截图。', 'The DSH process changed. Capture again.'],
    'window-changed': ['DSH 窗口在截图期间发生变化，请重新截图。', 'The DSH window changed during capture. Capture again.'],
    'stream-failed': ['与截图后台的连接未完成，请检查插件状态后重试。', 'The capture backend connection did not complete. Check plugin status and retry.'],
  }
  const message = code && messages[code]
  return message ? message[zh ? 0 : 1] : undefined
}
