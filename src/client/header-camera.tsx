/**
 * [INPUT]: 依赖只读侧栏状态、既有截图控制器和 Host 控件。
 * [OUTPUT]: 导出收起侧栏时的会话相机视图。
 * [POS]: utilities 插槽视图。不拥有取像或工作台。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React, { useSyncExternalStore } from 'react';
import { Button, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives';
import type { SidebarState } from './sidebar-state.ts';
import type { mountCaptureController } from './capture/controller.ts';
import cameraIcon from './camera-icon.svg';

type CaptureControl = Pick<ReturnType<typeof mountCaptureController>, 'state' | 'activate'>;
interface HeaderCameraProps {
  sidebar: SidebarState;
  readCapture(): CaptureControl | undefined;
  subscribe(listener: () => void): () => void;
  snapshot(): string;
  t(key: string): string;
}

export function HeaderCamera({ sidebar, readCapture, subscribe, snapshot, t }: HeaderCameraProps) {
  const collapsed = useSyncExternalStore(sidebar.subscribe, sidebar.getSnapshot);
  useSyncExternalStore(subscribe, snapshot);
  const capture = readCapture();
  if (collapsed !== true || !capture) return null;
  const state = capture.state();
  const activate = () => {
    // +--- 点击时重读所有权；旧 render 不保留已撤回的 controller ---+
    const current = readCapture();
    if (sidebar.getSnapshot() === true && current && !current.state().disabled && !current.state().busy) void current.activate();
  };
  return <Tooltip label={t('capture')} side="bottom" delayMs={500} focusDelayMs={0} portal>
    <Button variant="ghost" size="sm" data-pdsh-header-capture-entry="" className="pdsh-header-camera"
      aria-label={t('capture')} aria-busy={state.busy} disabled={state.disabled || state.busy} onClick={activate}>
      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: cameraIcon }} />
    </Button>
  </Tooltip>;
}
