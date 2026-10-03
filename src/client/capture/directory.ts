/**
 * [INPUT]: 依赖 DSH 官方 __DSH_DIRECTORY_PICKER__ 与 shared/capture-export.ts 的跨平台绝对路径语法。
 * [OUTPUT]: 提供只读能力识别与 pick 窄端口，接受 POSIX/Windows 绝对目录，取消保持 null。
 * [POS]: 拍照保存设置的 Host 能力适配；只检查路径形状，本机是否可用由 Host native path 边界决定。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { isCaptureSaveDirectory } from '../../shared/capture-export.ts'

export function readCaptureDirectoryPicker(doc: Document): (() => Promise<string | null>) | null {
  const picker = (doc.defaultView as any)?.__DSH_DIRECTORY_PICKER__;
  if (typeof picker?.pick !== 'function') return null;
  return async () => {
    const value = await picker.pick();
    if (value === null) return null;
    if (!isCaptureSaveDirectory(value) || value === '') throw new Error('Directory selection unavailable');
    return value;
  };
}
