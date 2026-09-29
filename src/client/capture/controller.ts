/**
 * [INPUT]: 依赖认证 Host PNG route、InCodex Shot 编辑器、DSH 隐私标记及同源背景资产。
 * [OUTPUT]: 提供相机点击→隐藏自有 UI→截图→工作台、重拍及异常/停用释放的单一控制器。
 * [POS]: capture Client 编排边界；截图传输不进入设置或会话持久化，编辑器只持有本地像素。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { capturePreparedWindow, waitForCaptureFrame } from './capture-lifecycle.ts';
import { mountCaptureWindowEditor } from './editor.ts';
import { loadCapturePreferences } from './preferences.ts';
import { markDSHPrivacyPlaceholders, collectDSHCandidates, mapCandidatesToPng } from './privacy.ts';
import { configureCapturePresetAssets } from './presets.ts';

const CAPTURE_URL = '/api/pdsh/capture';
const MAX_PNG_BYTES = 64 * 1024 * 1024;

async function pngCanvas(doc: Document, bytes: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(bytes);
  try {
    const image = new doc.defaultView.Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('PNG decode failed'));
      image.src = url;
    });
    const canvas = doc.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context || !canvas.width || !canvas.height) throw new Error('PNG canvas unavailable');
    context.drawImage(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function mountCaptureController(doc: Document, { locale = () => doc.documentElement.lang || doc.defaultView.navigator.language, onState = () => {}, fetchImpl = fetch, openEditor = mountCaptureWindowEditor, decode = pngCanvas, waitFrame = waitForCaptureFrame, presetAssets = {} } = {}) {
  configureCapturePresetAssets(presetAssets);
  let busy = false, disposed = false, editor = null, host: HTMLElement | null = null, abort: AbortController | null = null;
  const notice = doc.createElement('div');
  notice.setAttribute('data-pdsh-capture-notice', ''); notice.setAttribute('role', 'alert');
  notice.hidden = true; doc.body.append(notice);
  const state = () => ({ busy, disabled: busy || disposed || !!editor, failed: !notice.hidden });
  function publish() { onState(); }
  function report(message: string) { notice.textContent = message; notice.hidden = !message; publish(); }
  async function snapshot(privacyEnabled: boolean) {
    const restore = privacyEnabled ? markDSHPrivacyPlaceholders(doc) : () => {};
    abort = new AbortController();
    const request = abort;
    const timeout = setTimeout(() => request.abort(), 10_000);
    try {
      const result = await capturePreparedWindow({
        capture: async () => {
          const response = await fetchImpl(CAPTURE_URL, { method: 'POST', cache: 'no-store', signal: request.signal });
          if (!response.ok) throw new Error(`capture HTTP ${response.status}`);
          const bytes = await response.blob();
          if (bytes.type !== 'image/png' || bytes.size > MAX_PNG_BYTES) throw new Error('invalid PNG response');
          return decode(doc, bytes);
        },
        collectCandidates: () => collectDSHCandidates(doc),
        privacyEnabled, root: doc.documentElement,
        waitForFrame: waitFrame,
      });
      return { source: result.source, automaticRegions: mapCandidatesToPng(result.candidates, result.source, { width: doc.defaultView.innerWidth, height: doc.defaultView.innerHeight }) };
    } finally {
      clearTimeout(timeout); abort = null; restore();
    }
  }
  async function activate() {
    if (busy || disposed || editor) return;
    busy = true; report(''); publish();
    try {
      const privacy = loadCapturePreferences({ getItem: key => doc.defaultView.localStorage.getItem(key), setItem: (key, value) => doc.defaultView.localStorage.setItem(key, value) }).privacyEnabled;
      const first = await snapshot(privacy);
      if (disposed) return;
      host = doc.createElement('div'); host.setAttribute('data-pdsh-capture-host', ''); doc.body.append(host);
      editor = openEditor(host, {
        source: first.source, automaticRegions: first.automaticRegions, locale: locale(),
        onRetake: (_revision, enabled) => snapshot(enabled),
        onClose: () => { editor = null; host?.remove(); host = null; publish(); },
        onNotify: message => report(message),
      });
    } catch {
      host?.remove(); host = null; editor = null;
      if (!disposed) report(locale().startsWith('zh') ? '无法截取当前 DSH 窗口，请检查屏幕录制权限后重试。' : 'Could not capture this DSH window. Check Screen Recording permission and try again.');
    } finally {
      busy = false; publish();
    }
  }
  return {
    activate, state,
    dispose() {
      if (disposed) return;
      disposed = true; abort?.abort(); editor?.destroy(); editor = null; host?.remove(); notice.remove(); publish();
    },
  };
}
