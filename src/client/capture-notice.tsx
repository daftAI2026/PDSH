/**
 * [INPUT]: 宿主 Toast/警告图标、共享 React 与 react-dom/client 的根生命周期。
 * [OUTPUT]: mountCaptureNotices 的显示、清空和卸载接口；显示周期与样式完全由官方 Toast 拥有。
 * [POS]: DOM 截图控制器到宿主 React 通知的窄适配器；同文重显使用序号重挂载，旧完成回调不清除新消息。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { Toast, IconWarningOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';

export function mountCaptureNotices(doc: Document) {
  const host = doc.createElement('div');
  host.setAttribute('data-pdsh-notice-root', '');
  doc.body.append(host);
  const root = createRoot(host);
  let sequence = 0, disposed = false;
  function show(message: string, tone?: 'success') {
    if (disposed) return;
    const current = ++sequence;
    root.render(message ? <Toast key={current} text={message} tone={tone}
      icon={tone === 'success' ? undefined : <IconWarningOutlineRegular />}
      onDone={() => { if (!disposed && sequence === current) show(''); }} /> : null);
  }
  return { show, dispose() {
    if (disposed) return;
    disposed = true; ++sequence;
    root.unmount(); host.remove();
  } };
}
