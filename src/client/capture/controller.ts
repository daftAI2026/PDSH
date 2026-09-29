/**
 * [INPUT]: 依赖全视口 DOM 取像、InCodex Shot 编辑器、DSH 隐私标记及同源背景资产。
 * [OUTPUT]: 提供相机点击→隐藏自有 UI→截图→工作台、重拍、分层失败反馈及异常/停用释放的单一控制器。
 * [POS]: capture Client 编排边界；截图像素不进入设置或会话持久化，编辑器只持有本地像素。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { capturePreparedWindow, waitForCaptureFrame } from './capture-lifecycle.ts';
import { mountCaptureWindowEditor } from './editor.ts';
import { loadCapturePreferences } from './preferences.ts';
import { markDSHPrivacyPlaceholders, collectDSHCandidates, mapCandidatesToPng } from './privacy.ts';
import { configureCapturePresetAssets } from './presets.ts';

import { captureViewport, CaptureViewportError } from './viewport.ts';

export function mountCaptureController(doc: Document, { locale = () => doc.documentElement.lang || doc.defaultView.navigator.language, onState = () => {}, capture = captureViewport, openEditor = mountCaptureWindowEditor, waitFrame = waitForCaptureFrame, presetAssets = {} } = {}) {
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
        capture: () => capture(doc, { signal: request.signal }),
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
    let captured = false;
    try {
      const privacy = loadCapturePreferences({ getItem: key => doc.defaultView.localStorage.getItem(key), setItem: (key, value) => doc.defaultView.localStorage.setItem(key, value) }).privacyEnabled;
      const first = await snapshot(privacy);
      captured = true;
      if (disposed) return;
      host = doc.createElement('div'); host.setAttribute('data-pdsh-capture-host', ''); doc.body.append(host);
      editor = openEditor(host, {
        source: first.source, automaticRegions: first.automaticRegions, locale: locale(),
        onRetake: (_revision, enabled) => snapshot(enabled),
        onClose: () => { editor = null; host?.remove(); host = null; publish(); },
        onNotify: message => report(message),
      });
    } catch (error) {
      host?.remove(); host = null; editor = null;
      // +--- 不把取像或挂载失败臆断为系统权限问题 ---+
      if (!disposed && !captured && error instanceof CaptureViewportError && error.code === 'embedded-content') {
        report(locale().startsWith('zh') ? '当前界面含嵌入网页或视频，暂不能完整取像。请关闭该区域后重试。' : 'This page contains an embedded webpage or video that cannot be captured completely. Close that area and try again.');
      } else if (!disposed && !captured && error instanceof CaptureViewportError && error.code === 'resource-warning') {
        report(locale().startsWith('zh') ? '页面资源无法完整读取，请稍后重试。' : 'Page resources could not be read completely. Try again.');
      } else if (!disposed) report(locale().startsWith('zh')
        ? captured ? '截图工作台未能打开，请重试。' : '无法截取当前 DSH 窗口，请重试。'
        : captured ? 'Could not open the capture workbench. Try again.' : 'Could not capture this DSH window. Try again.');
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
