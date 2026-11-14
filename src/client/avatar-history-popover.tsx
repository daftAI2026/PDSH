/**
 * [INPUT]: 依赖 AvatarImage、Host MenuSurface/外点 hook 与浏览器 CSS 锚点；父层提供 accepted 历史与提交动作。
 * [OUTPUT]: 提供圆形历史头像的非模态面板、加载占位与键盘焦点归还。
 * [POS]: 身份设置的瞬时视图。这里只持有展开与加载状态，不写配置、不读取文件。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { AvatarImage } from './avatar-image.tsx';
import { createPortal } from 'react-dom';
import { Button, Tooltip, MenuSurface, IconUserOutlineMedium, useDismissOnOutsidePointer } from '@deepseek-ai/dsh-client-ui-primitives';

function HistoryImage({ src, label, unavailable, disabled, onSelect }) {
  const image = useRef<HTMLImageElement>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  useLayoutEffect(() => {
    if (image.current?.complete) setStatus(image.current.naturalWidth > 0 ? 'loaded' : 'error');
  }, []);
  return <Button variant="ghost" className="pdsh-history-image" aria-label={status === 'error' ? unavailable : label}
    disabled={disabled || status !== 'loaded'} onClick={onSelect}>
    <AvatarImage ref={image} src={src} alt="" hidden={status !== 'loaded'}
      onLoad={() => setStatus('loaded')} onError={() => setStatus('error')} />
    {status !== 'loaded' && <span aria-hidden="true"><IconUserOutlineMedium /></span>}
  </Button>;
}

export function AvatarHistoryPopover({ history, active, disabled, t, onChooseNew, onSelect, onClear }) {
  const [expanded, setExpanded] = useState(false);
  const root = useRef<HTMLSpanElement>(null), panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const anchorName = `--pdsh-avatar-history-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const open = expanded && !disabled && history.length > 0;
  const dismiss = useCallback(() => setExpanded(false), []);
  useDismissOnOutsidePointer(root, open, dismiss, panel);
  const trigger = () => root.current?.querySelector('button');
  function closeAndReturn() {
    dismiss();
    const button = trigger();
    if (button?.isConnected && !button.disabled) button.focus();
  }
  useEffect(() => { if (!open) setExpanded(false); }, [open]);
  useLayoutEffect(() => { if (open) panel.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const doc = root.current.ownerDocument;
    const focusOutside = (event: FocusEvent) => {
      if (event.target instanceof doc.defaultView.Node && !root.current?.contains(event.target as Node) && !panel.current?.contains(event.target as Node)) dismiss();
    };
    doc.addEventListener('focusin', focusOutside);
    doc.defaultView.addEventListener('blur', dismiss);
    return () => { doc.removeEventListener('focusin', focusOutside); doc.defaultView.removeEventListener('blur', dismiss); };
  }, [open, dismiss]);
  return <><Tooltip label={t('avatarHint')} side="bottom" delayMs={500} focusDelayMs={0} portal disabled={open}>
    <span ref={root} className="pdsh-history-anchor" style={{ anchorName }}><Button variant={active ? 'outline' : 'ghost'} aria-pressed={active}
      aria-haspopup={history.length ? 'dialog' : undefined} aria-expanded={history.length ? open : undefined}
      aria-controls={open ? id : undefined} disabled={disabled} onClick={event => {
        if (!history.length) onChooseNew(event.currentTarget);
        else setExpanded(value => !value);
      }}>{t('avatar')}</Button></span>
  </Tooltip>{open && createPortal(<MenuSurface ref={panel} id={id} role="dialog" aria-labelledby={`${id}-title`} tabIndex={-1}
    className="pdsh-history-popover" style={{ position: 'fixed', positionAnchor: anchorName }}
    onKeyDown={event => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeAndReturn(); }
      if (event.key !== 'Tab') return;
      const buttons = [...panel.current.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      if (event.shiftKey && (event.target === panel.current || event.target === buttons[0])) {
        event.preventDefault(); closeAndReturn();
      } else if (!event.shiftKey && event.target === buttons.at(-1)) {
        // +--- 默认 Tab 从触发按钮继续；不把焦点送到 body 末尾 ---+
        closeAndReturn();
      }
    }}>
    <div className="pdsh-history-heading"><strong id={`${id}-title`}>{t('avatarHistory')}</strong>
      <Button variant="ghost" size="sm" className="pdsh-history-clear" onClick={() => { closeAndReturn(); onClear(trigger()); }}>{t('clearAvatarHistory')}</Button></div>
    <div className="pdsh-history-grid">{history.map((src, index) => <HistoryImage key={src} src={src}
      label={`${t('reuseAvatar')} ${index + 1}`} unavailable={`${t('avatarHistoryUnavailable')} ${index + 1}`} disabled={disabled}
      onSelect={() => { closeAndReturn(); onSelect(src, trigger()); }} />)}</div>
    <Button variant="outline" className="pdsh-history-new" onClick={() => { closeAndReturn(); onChooseNew(trigger()); }}>{t('chooseNewAvatar')}</Button>
  </MenuSurface>, root.current.ownerDocument.body)}</>;
}
