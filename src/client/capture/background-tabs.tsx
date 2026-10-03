/**
 * [INPUT]: 依赖 DSH rc.2 SegmentedControl、ReactDOM 与调用方提供的模式/文案/变更回调。
 * [OUTPUT]: 提供可更新和释放的原生 Tabs 挂载端口；键盘、焦点与指示器交给 Host。
 * [POS]: React 到工作台 DOM 的窄适配层；不拥有背景或另一份选中状态。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { SegmentedControl } from '@deepseek-ai/dsh-client-ui-primitives';
import { CAPTURE_BACKGROUND_MODES, type CaptureBackgroundMode } from './background-modes.ts';

export type CaptureBackgroundTabsProps = {
  id: string;
  value: CaptureBackgroundMode;
  label: string;
  labels: Record<CaptureBackgroundMode, string>;
  disabled: boolean;
  onChange: (mode: CaptureBackgroundMode) => void;
};
export type CaptureBackgroundTabsController = {
  update: (value: CaptureBackgroundMode, disabled: boolean) => void;
  destroy: () => void;
};
export type CaptureBackgroundTabsMount = (container: HTMLElement, props: CaptureBackgroundTabsProps) => CaptureBackgroundTabsController;

export const mountCaptureBackgroundTabs: CaptureBackgroundTabsMount = (container, initial) => {
  const root = createRoot(container);
  let destroyed = false;
  let props = initial;
  const options = CAPTURE_BACKGROUND_MODES.map(value => ({ value, label: props.labels[value] }));
  // +--- 键盘走位立即反馈；指针仍沿用 Host 的短指示器运动 ---+
  const keyboard = () => container.setAttribute('data-keyboard', '');
  const pointer = () => container.removeAttribute('data-keyboard');
  container.addEventListener('keydown', keyboard, true);
  container.addEventListener('pointerdown', pointer, true);
  function render() {
    root.render(<SegmentedControl id={props.id} value={props.value} options={options}
      label={props.label} disabled={props.disabled} className="pdsh-capture-background-tabs"
      onChange={(mode: CaptureBackgroundMode) => {
        if (!destroyed && !props.disabled && CAPTURE_BACKGROUND_MODES.includes(mode)) props.onChange(mode);
      }} />);
  }
  render();
  return {
    update(value, disabled) {
      if (destroyed || (props.value === value && props.disabled === disabled)) return;
      props = { ...props, value, disabled };
      render();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      container.removeEventListener('keydown', keyboard, true);
      container.removeEventListener('pointerdown', pointer, true);
      root.unmount();
    },
  };
};
