/**
 * [INPUT]: 依赖 DSH 官方 __DSH_DIRECTORY_PICKER__ 的原生目录选择流程。
 * [OUTPUT]: 提供只读能力识别与 pick 窄端口，取消保持 null，不回退伪路径输入或浏览器文件句柄。
 * [POS]: 拍照保存设置的 Host 能力适配；目录经官方 ConfigForm 接受，不保存到另一个状态仓。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export function readCaptureDirectoryPicker(doc: Document): (() => Promise<string | null>) | null {
  const picker = (doc.defaultView as any)?.__DSH_DIRECTORY_PICKER__;
  if (typeof picker?.pick !== 'function') return null;
  return async () => {
    const value = await picker.pick();
    if (value === null) return null;
    if (typeof value !== 'string' || !/^\/(?!.*[\u0000-\u001f\u007f]).{0,4095}$/u.test(value)) throw new Error('Directory selection unavailable');
    return value;
  };
}
