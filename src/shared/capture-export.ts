/**
 * [INPUT]: 依赖 Host 已接受的保存方式/目录/格式/文件名模板与本地 Date；不读取账号或截图。
 * [OUTPUT]: 提供询问/直接保存合同、独立导出预算与尺寸纯校验、PDSH 默认命名和仅含 basename 的文件名生成。
 * [POS]: 拍照设置到编辑器的纯数据合同；格式只作用保存，剪贴板保持 PNG。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export const CAPTURE_SAVE_FORMATS = ['png', 'jpeg', 'webp'] as const;
export type CaptureSaveFormat = typeof CAPTURE_SAVE_FORMATS[number];
export const CAPTURE_SAVE_BEHAVIORS = ['ask', 'direct'] as const;
export type CaptureSaveBehavior = typeof CAPTURE_SAVE_BEHAVIORS[number];
export const CAPTURE_FILE_NAME_TOKENS = ['date', 'time', 'title', 'width', 'height'] as const;
export const CAPTURE_FILE_NAME_MAX_BYTES = 220;
// +--- 编辑后输出与16MP原生采样分别计额；32MP容纳5K默认边距，编码最多128MB ---+
export const CAPTURE_EXPORT_MAX_PIXELS = 32_000_000;
export const CAPTURE_EXPORT_MAX_BYTES = 128_000_000;
export function isCaptureExportSizeAllowed(width: number, height: number): boolean {
  return Number.isSafeInteger(width) && Number.isSafeInteger(height) && width > 0 && height > 0
    && width * height <= CAPTURE_EXPORT_MAX_PIXELS;
}
export function assertCaptureExportSize(width: number, height: number): void {
  if (!isCaptureExportSizeAllowed(width, height)) throw Object.assign(new Error('Capture export budget exceeded'), { code: 'export-oversize' });
}
export const CAPTURE_FILE_NAME_PATTERN = /^(?=.{1,160}$)(?![\s.]+$)(?:[^{}\\/:*?"<>|\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u206f]|\{(?:date|time|title|width|height)\})+$/u;
export const DEFAULT_CAPTURE_EXPORT = { saveBehavior: 'ask' as CaptureSaveBehavior, saveFormat: 'png' as CaptureSaveFormat, fileNamePattern: 'PDSH-screenshot-{date}-{time}', saveDirectory: '' };
export type CaptureExportPreferences = typeof DEFAULT_CAPTURE_EXPORT;
export function resolveCaptureExportPreferences(value): CaptureExportPreferences {
  return {
    saveBehavior: CAPTURE_SAVE_BEHAVIORS.includes(value?.saveBehavior) ? value.saveBehavior : DEFAULT_CAPTURE_EXPORT.saveBehavior,
    saveFormat: CAPTURE_SAVE_FORMATS.includes(value?.saveFormat) ? value.saveFormat : DEFAULT_CAPTURE_EXPORT.saveFormat,
    saveDirectory: typeof value?.saveDirectory === 'string' && (value.saveDirectory === '' || /^\/(?!.*[\u0000-\u001f\u007f]).{0,4095}$/u.test(value.saveDirectory)) ? value.saveDirectory : '',
    fileNamePattern: typeof value?.fileNamePattern === 'string' && CAPTURE_FILE_NAME_PATTERN.test(value.fileNamePattern)
      ? value.fileNamePattern : DEFAULT_CAPTURE_EXPORT.fileNamePattern,
  };
}
export function captureExportFileName(value, date = new Date(), context: { title?: string; width?: number; height?: number } = {}): string {
  if (!Number.isFinite(date.getTime())) date = new Date(0);
  const preferences = resolveCaptureExportPreferences(value), pad = n => String(n).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
  const clean = value => String(value ?? '').normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u206f<>:"/\\|?*]+/gu, '-').trim().replace(/[. ]+$/gu, '');
  const dimension = value => String(Math.max(0, Number.isFinite(value) ? Math.round(value) : 0));
  const tokens = { date: day, time, title: clean(context.title) || 'PDSH', width: dimension(context.width), height: dimension(context.height) };
  let base = clean(preferences.fileNamePattern.replace(/\{(date|time|title|width|height)\}/gu, (_match, token) => tokens[token])).replace(/\.(?:png|jpe?g|webp|gif|avif|bmp|tiff?|pdf)$/iu, '').replace(/[. ]+$/gu, '');
  if (!base || /^\.+$/u.test(base)) base = 'PDSH';
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(base)) base = `PDSH-${base}`;
  let bytes = 0, limited = '';
  for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(base)) {
    const size = new TextEncoder().encode(segment).byteLength;
    if (bytes + size > CAPTURE_FILE_NAME_MAX_BYTES) break;
    limited += segment; bytes += size;
  }
  return `${limited.replace(/[. ]+$/gu, '') || 'PDSH'}.${preferences.saveFormat === 'jpeg' ? 'jpg' : preferences.saveFormat}`;
}
