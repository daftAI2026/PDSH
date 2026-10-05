/**
 * [INPUT]: 依赖冻结 PNG/原生整窗比例、候选原点/稳定几何验证、编辑器与原生 Tabs 挂载端口、分离的标题与 Host 身份遮挡偏好、导出偏好及宿主通知。
 * [OUTPUT]: 提供相机点击→隐藏自有 UI→截图→工作台、重拍、固定码对应可执行提示、分层失败反馈及异常/停用释放的单一控制器。
 * [POS]: capture Client 编排边界；截图像素不进入设置或会话持久化，编辑器只持有本地像素。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import { capturePreparedWindow, waitForCaptureFrame } from './capture-lifecycle.ts';
import type { CaptureBackgroundTabsMount } from "./background-tabs.tsx";
import { mountCaptureWindowEditor } from './editor.ts';
import { loadCapturePreferences } from './preferences.ts';
import { markDSHPrivacyPlaceholders, collectDSHCandidates, mapCandidatesToPng } from './privacy.ts';
import { readCandidateWindowViewport, mapWindowCandidatesToPng } from './candidate-mapping.ts';
import { configureCapturePresetAssets } from './presets.ts';

import { CaptureViewportError } from './viewport.ts';
import { captureFailureMessage } from './copy.ts';
import { CaptureClientError } from './window-capture-stream.ts';
import { DEFAULT_CAPTURE_EXPORT } from '../../shared/capture-export.ts';
import type { CaptureTrace } from '../../shared/capture-trace.ts';
import { captureTraceFailureCode } from '../../shared/capture-trace.ts';

export function mountCaptureController(doc: Document, { locale = () => doc.documentElement.lang || doc.defaultView.navigator.language, onState = () => {}, notify = (_message: string, _tone?: 'success') => {}, capture = async (_doc, _options): Promise<HTMLCanvasElement> => { throw new CaptureViewportError('host-unavailable'); }, openEditor = mountCaptureWindowEditor, waitFrame = waitForCaptureFrame, presetAssets = {}, onSave = undefined, exportPreferences = () => DEFAULT_CAPTURE_EXPORT, captureMaskIdentity = (): boolean => true, trace = (() => {}) as CaptureTrace, captureScope = 'current-page', sourceScale = (_source) => doc.defaultView.devicePixelRatio, mountBackgroundTabs = undefined as CaptureBackgroundTabsMount | undefined } = {}) {
  configureCapturePresetAssets(presetAssets);
  let busy = false, disposed = false, editor = null, host: HTMLElement | null = null, abort: AbortController | null = null;
  const state = () => ({ busy, disabled: busy || disposed || !!editor });
  function publish() { onState(); }
  function report(message: string, tone?: 'success') { notify(message, tone); }
  async function snapshot(privacyEnabled: boolean, requestId = doc.defaultView.crypto.randomUUID()) {
    // +--- 原生 Toast 在下一帧清空，重拍不把自己的通知截进去 ---+
    report('');
    const maskIdentity = captureMaskIdentity() !== false;
    const hasPrivacyMasks = privacyEnabled || maskIdentity;
    const restore = hasPrivacyMasks ? markDSHPrivacyPlaceholders(doc, { maskTitles: privacyEnabled, maskIdentity }) : () => {};
    abort = new AbortController();
    const request = abort;
    const materialAppearance = doc.querySelector('[data-ds-dark-theme]') ? 'dark' as const : 'light' as const;
    const pageScale = doc.defaultView.devicePixelRatio, fileMetadata = { title: doc.title, capturedAt: new Date() };
    let candidateViewport: ReturnType<typeof readCandidateWindowViewport> = null;
    try {
      trace('pixels-start', requestId);
      const result = await capturePreparedWindow({
        capture: () => capture(doc, { signal: request.signal, requestId }),
        collectCandidates: () => {
          if (captureScope === 'owned-window') {
            candidateViewport = readCandidateWindowViewport(doc);
            if (!candidateViewport) return [];
          }
          return collectDSHCandidates(doc);
        },
        timeoutMs: captureScope === 'owned-window' ? null : undefined,
        // Lifecycle 的同一灰条类覆盖任一开启的遮挡层，标题与身份配置仍各自独立。
        privacyEnabled: hasPrivacyMasks, root: doc.documentElement,
        waitForFrame: waitFrame,
      });
      const sourceScaleFactor = sourceScale(result.source);
      if (!Number.isFinite(sourceScaleFactor) || sourceScaleFactor <= 0) throw new CaptureViewportError('capture-failed');
      if ((captureScope !== 'owned-window' && pageScale !== doc.defaultView.devicePixelRatio) || materialAppearance !== (doc.querySelector('[data-ds-dark-theme]') ? 'dark' : 'light')) throw new CaptureViewportError('capture-failed');
      trace('pixels-ready', requestId);
      let automaticRegions = [];
      try {
        automaticRegions = captureScope === 'owned-window'
          ? mapWindowCandidatesToPng(result.candidates, candidateViewport ? collectDSHCandidates(doc) : [], result.source, sourceScaleFactor, candidateViewport, readCandidateWindowViewport(doc))
          : mapCandidatesToPng(result.candidates, result.source, { width: doc.defaultView.innerWidth, height: doc.defaultView.innerHeight });
      } catch {
        // +--- 建议层不是取像前置条件；失去 DOM 几何时保留有效照片与手动编辑。 ---+
      }
      return { source: result.source, fileMetadata, materialAppearance, sourceScaleFactor, automaticRegions };
    } finally {
      abort = null; restore();
    }
  }
  async function activate() {
    if (busy || disposed || editor) return;
    const requestId = doc.defaultView.crypto.randomUUID();
    trace('capture-click', requestId);
    busy = true; report(''); publish();
    let captured = false;
    try {
      const privacy = loadCapturePreferences({ getItem: key => doc.defaultView.localStorage.getItem(key), setItem: (key, value) => doc.defaultView.localStorage.setItem(key, value) }).privacyEnabled;
      const first = await snapshot(privacy, requestId);
      captured = true;
      if (disposed) return;
      host = doc.createElement('div'); host.setAttribute('data-pdsh-capture-host', ''); doc.body.append(host);
      editor = openEditor(host, {
        mountBackgroundTabs, source: first.source, fileMetadata: first.fileMetadata, onSave, sourceScaleFactor: first.sourceScaleFactor, materialAppearance: first.materialAppearance, automaticRegions: first.automaticRegions, locale: locale(), exportPreferences: exportPreferences(),
        onRetake: (_revision, enabled) => snapshot(enabled),
        onClose: () => { editor = null; host?.remove(); host = null; publish(); },
        onNotify: (message, tone) => report(message, tone),
      });
      trace('editor-ready', requestId);
    } catch (error) {
      const failureCode = error instanceof CaptureClientError ? captureTraceFailureCode(error.code) : undefined;
      trace('capture-failed', requestId, failureCode);
      host?.remove(); host = null; editor = null;
      // +--- 不把取像或挂载失败臆断为系统权限问题 ---+
      if (!disposed && !captured && error instanceof CaptureClientError && error.code === 'permission-not-granted') {
        report(locale().startsWith('zh') ? '系统取像权限尚未授予；请由你确认屏幕录制权限后再点击拍照。' : 'Screen capture permission was not granted. Confirm it yourself, then click capture again.');
      } else if (!disposed && !captured && error instanceof CaptureViewportError && error.code === 'host-unavailable') {
        report(locale().startsWith('zh') ? '当前 DSH 尚未提供页面像素采集接口，不能进行所见即所得截图。' : 'This DSH build does not expose current-page pixel capture. A faithful screenshot is unavailable.');
      } else if (!disposed && error instanceof CaptureViewportError && error.code === 'bridge-port-busy') {
        report(locale().startsWith('zh') ? '取像桥启动失败：DSH Main 的预设调试端口被占用。插件未开启调试接口，也未关闭其他程序。' : 'Capture bridge startup failed: the DSH Main inspector port is occupied. No inspector was opened and no other app was stopped.');
      } else if (!disposed && error instanceof CaptureViewportError && error.code === 'control-cleanup-unconfirmed') {
        report(locale().startsWith('zh') ? '无法确认取像连接已释放。已暂停拍照；请保留工作后重启 DSH，不会自动重连或重启。' : 'Capture connection release is unconfirmed. Preserve your work and restart DSH; no automatic reconnect or restart.');
      } else if (!disposed && error instanceof CaptureViewportError && error.code === 'bridge-cleanup-unconfirmed') {
        report(locale().startsWith('zh') ? '无法确认插件调试接口已关闭。请停用拍照，保留工作后确认重启 DSH；不会自动重启。' : 'Could not confirm closing the plugin inspector. Disable capture, preserve your work and confirm a DSH restart; no automatic restart.');
      } else if (!disposed) report((!captured && captureFailureMessage(failureCode, locale()) || (locale().startsWith('zh')
        ? captured ? '截图工作台未能打开，请重试。' : '无法截取当前 DSH 窗口，请重试。'
        : captured ? 'Could not open the capture workbench. Try again.' : 'Could not capture this DSH window. Try again.'))
        + (failureCode ? ` (${failureCode})` : ''));
    } finally {
      busy = false; publish();
    }
  }
  return {
    activate, state,
    dispose() {
      if (disposed) return;
      disposed = true; abort?.abort(); editor?.destroy(); editor = null; host?.remove(); report(''); publish();
    },
  };
}
