/**
 * [INPUT]: 依赖已验证的主窗口/frame、页面导出接收器、共享导出预算、Electron dialog/nativeImage 与窄文件写入能力。
 * [OUTPUT]: 提供 createNativePageSave；询问时使用原生面板，直接保存到接受目录并自动编号不覆盖；落盘后才返回 saved。
 * [POS]: Main 的保存效果边界，与取像锁独立；提交前再次检查取消/导航/停用，不把内容或路径传入 HTTP/日志。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { join, isAbsolute } from 'node:path';
import { readWebPDimensions } from './page-save-webp.ts';
import { writeConfirmedImage, writeUniqueImage } from './page-save-file.ts';
import { CAPTURE_RECEIVER, isCaptureId } from '../shared/capture-bridge.ts';
import { assertCaptureExportSize, CAPTURE_EXPORT_MAX_BYTES } from '../shared/capture-export.ts';
const LOCK = Symbol.for('@daftai/pdsh.native-save-locks.v1');
export function createNativePageSave(win, dialog, nativeImage, write = writeConfirmedImage, writeUnique = writeUniqueImage) {
  const contents = win.webContents;
  const locks: WeakMap<object, object> = (globalThis as any)[LOCK] ?? ((globalThis as any)[LOCK] = new WeakMap());
  let disposed = false, epoch = 0, current = null, settlement = Promise.resolve();
  const changed = () => { ++epoch; if (current) current.cancelled = true; };
  const events = ['did-start-navigation', 'render-process-gone', 'destroyed'];
  for (const event of events) contents.on(event, changed);
  win.on('closed', changed);
  function valid(frame, generation, request) {
    if (disposed || request.cancelled || generation !== epoch || win.isDestroyed() || contents.isDestroyed() || frame.isDestroyed() || contents.mainFrame !== frame) throw new Error('save unavailable');
    const url = new URL(contents.getURL());
    if (url.protocol !== 'dsh-app:' || url.hostname !== 'app' || !['/', '/index.html'].includes(url.pathname)) throw new Error('save unavailable');
  }
  return {
    cancel(id) { if (current?.id === id) current.cancelled = true; },
    settled: () => settlement,
    dispose() {
      if (disposed) return; disposed = true; changed();
      for (const event of events) contents.removeListener(event, changed);
      win.removeListener('closed', changed);
    },
    async save(id, owner) {
      if (disposed || current || locks.has(contents) || !isCaptureId(id) || !isCaptureId(owner)) throw new Error('save unavailable');
      const request = { id, cancelled: false }, frame = contents.mainFrame, generation = epoch;
      current = request; locks.set(contents, request);
      let settled; settlement = new Promise<void>(resolve => { settled = resolve; });
      try {
        valid(frame, generation, request);
        const data = await frame.executeJavaScript(`globalThis[Symbol.for(${JSON.stringify(CAPTURE_RECEIVER)})]?.exportData(${JSON.stringify(id)},${JSON.stringify(owner)}) ?? null`, false);
        valid(frame, generation, request);
        const extensions = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }, extension = extensions[data?.mime];
        const behavior = data?.saveBehavior ?? 'ask';
        if (!data || data.nonce !== owner || !extension || typeof data.fileName !== 'string' || Buffer.byteLength(data.fileName) > 240
          || !['ask', 'direct'].includes(behavior) || (behavior === 'direct' && !data.directory)
          || !data.fileName.endsWith(`.${extension}`) || /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u206f/\\<>:"|?*]/u.test(data.fileName)
          || /^\.+$/u.test(data.fileName) || typeof data.directory !== 'string' || (data.directory && !isAbsolute(data.directory))
          || /[\u0000-\u001f\u007f]/u.test(data.directory) || data.directory.length > 4096
          || typeof data.base64 !== 'string' || !data.base64.length || data.base64.length > Math.ceil(CAPTURE_EXPORT_MAX_BYTES / 3) * 4
          || data.base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data.base64)) throw new Error('invalid export');
        const bytes = Buffer.from(data.base64, 'base64');
        if (bytes.length > CAPTURE_EXPORT_MAX_BYTES) throw new Error('export budget');
        const signature = extension === 'png' ? bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
          : extension === 'jpg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
        if (!signature) throw new Error('invalid export');
        // Electron 44 只承诺 nativeImage 的 PNG/JPEG；WebP 来自本页 Canvas，按静态封装/尺寸验预算。
        const image = extension === 'webp' ? null : nativeImage.createFromBuffer(bytes);
        const size = image ? image.getSize() : readWebPDimensions(bytes);
        if (image?.isEmpty()) throw new Error('invalid export');
        assertCaptureExportSize(size.width, size.height);
        if (behavior === 'direct') {
          valid(frame, generation, request);
          await writeUnique(join(data.directory, data.fileName), bytes, () => valid(frame, generation, request));
          return { outcome: 'saved' as const };
        }
        const answer = await dialog.showSaveDialog(win, { defaultPath: data.directory ? join(data.directory,data.fileName) : data.fileName,
          filters: [{ name: extension.toUpperCase(), extensions: [extension] }], properties: ['createDirectory'] });
        valid(frame, generation, request);
        if (answer.canceled) return { outcome: 'cancelled' as const };
        if (typeof answer.filePath !== 'string' || !isAbsolute(answer.filePath) || /[\u0000-\u001f\u007f]/u.test(answer.filePath)) throw new Error('invalid save target');
        // 系统面板拥有路径和覆盖确认；只有写入真正完成才允许编辑器报 saved。
        await write(answer.filePath, bytes, () => valid(frame, generation, request));
        return { outcome: 'saved' as const };
      } finally {
        if (current === request) current = null;
        if (locks.get(contents) === request) locks.delete(contents);
        settled();
      }
    },
  };
}
