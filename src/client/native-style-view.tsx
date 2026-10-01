/**
 * [INPUT]: 依赖 Host 原生 React 控件及 native-style-probe 的可撤回测量。
 * [OUTPUT]: 提供 NativeStyleProbe 视图，卸载时归还探针控制器。
 * [POS]: 单一 Client 装配器管理的原生样式基础设施；不可见但保持布局，不读功能偏好。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React, { useLayoutEffect, useRef } from 'react';
import { Input, Button, Switch, SettingsValueField, Tooltip, IconCheckOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { mountNativeStyleProbe } from './native-style-probe.ts';
export function NativeStyleProbe({ doc }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const controller = mountNativeStyleProbe(doc, ref.current);
    // 原生 Tooltip 自己生成样式探针；仅自有 mouseover，不依赖键盘/指针模态，不改变 activeElement。
    ref.current.querySelector('[data-pdsh-tooltip-probe]')?.dispatchEvent(new doc.defaultView.MouseEvent('mouseover', { bubbles: true, relatedTarget: null }));
    return () => controller.dispose();
  }, [doc]);
  return <span ref={ref}><Input tabIndex={-1} aria-hidden="true" /><Button data-pdsh-button-probe disabled tabIndex={-1} aria-hidden="true"><IconCheckOutlineRegular /></Button><Switch checked={false} onChange={() => {}} label="" disabled /><span data-pdsh-field-probe>
    <SettingsValueField id="pdsh-layout-probe" label="" text="" overridden={false} invalid={false} overriddenLabel="" resetLabel="" invalidLabel="" disabled onEdit={() => {}} onReset={() => {}} />
  </span><Tooltip label=" " side="bottom" delayMs={0} focusDelayMs={0} portal={false}><span data-pdsh-tooltip-probe tabIndex={-1} /></Tooltip></span>;
}
