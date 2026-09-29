/**
 * [INPUT]: 依赖浏览器 File/Image API 与尺寸上限。
 * [OUTPUT]: 提供本地壁纸格式校验、解码和 data URL 读取。
 * [POS]: capture 的用户图片输入边界；不访问远端或写入配置。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const MAX_WALLPAPER_BYTES = 32 * 1024 * 1024;
const WALLPAPER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isCaptureWallpaperFile(file: File): boolean {
  return WALLPAPER_TYPES.has(file.type) && file.size <= MAX_WALLPAPER_BYTES;
}

export function readCaptureWallpaperFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

export function loadCaptureImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("Unable to load image")));
    image.src = source;
  });
}
