/**
 * [INPUT]: 依赖拍照 ConfigForm、Host Input/Button 与纯导出偏好合同。
 * [OUTPUT]: 提供保存方式、目录、格式/文件名模板和独立截图身份遮挡开关；所有写入只使用 Host revision。
 * [POS]: 官方 Plugins 拍照设置边界；截图身份遮挡与常驻身份替换、工作台标题预遮挡分别持有独立偏好。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button, Input, Switch, Tooltip, IconEditOutlineRegular, IconCheckOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { CAPTURE_SAVE_BEHAVIORS, CAPTURE_SAVE_FORMATS, CAPTURE_FILE_NAME_PATTERN, resolveCaptureExportPreferences } from '../shared/capture-export.ts';
export function CaptureSettingsCard({ form, t, view, chooseDirectory = null }) {
  const accepted = useSyncExternalStore(fn => form.subscribe(fn), () => form.getSnapshot());
  const preferences = resolveCaptureExportPreferences(accepted.value);
  const captureEnabled = accepted.value?.captureEnabled !== false;
  const captureMaskIdentity = accepted.value?.captureMaskIdentity !== false;
  const [pending, setPending] = useState(false), [failed, setFailed] = useState(false), [draft, setDraft] = useState<string | null>(null);
  const templateRow = useRef(null), returnFocus = useRef(null);
  const alive = useRef(true), busy = useRef(false), base = useRef<string | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (pending || !returnFocus.current) return;
    const { origin, template } = returnFocus.current; returnFocus.current = null;
    const doc = origin.ownerDocument;
    if (doc.activeElement !== doc.body && doc.activeElement !== origin) return;
    const target = template ? templateRow.current?.querySelector('input, button') : origin;
    if (target?.isConnected && !target.disabled) target.focus();
  }, [pending, draft]);
  function rememberFocus(origin, template = false) {
    returnFocus.current = origin && origin.ownerDocument.activeElement === origin ? { origin, template } : null;
  }
  if (view === 'summary') return t('capture');
  const writable = accepted.status === 'ready' && accepted.writable && !pending;
  async function save(key, value, origin?) {
    const current = form.getSnapshot(); if (busy.current || current.status !== 'ready' || !current.writable) return;
    rememberFocus(origin, key === 'fileNamePattern');
    const currentValue = key in (current.value ?? {}) ? current.value?.[key] : resolveCaptureExportPreferences(current.value)[key];
    if (currentValue === value) { if (key === 'fileNamePattern') { setDraft(null); base.current = null; } return; }
    if (key === 'fileNamePattern' && (!CAPTURE_FILE_NAME_PATTERN.test(value) || base.current !== resolveCaptureExportPreferences(current.value).fileNamePattern)) { setFailed(true); return; }
    busy.current = true; setPending(true); setFailed(false);
    try {
      const saved = await form.mutate([{ op: 'set', path: [key], value }], current.revision);
      if (alive.current) { setFailed(!saved); if (saved && key === 'fileNamePattern') { setDraft(null); base.current = null; } }
    } catch { if (alive.current) setFailed(true); }
    finally { busy.current = false; if (alive.current) setPending(false); }
  }
  function cancel(origin?) { if (!busy.current) { rememberFocus(origin, true); setDraft(null); base.current = null; setFailed(false); } }
  async function selectDirectory(origin?) {
    const current = form.getSnapshot();
    if (!chooseDirectory || busy.current || current.status !== 'ready' || !current.writable) return;
    rememberFocus(origin); busy.current = true; setPending(true); setFailed(false);
    try {
      const selected = await chooseDirectory();
      if (!alive.current || selected === null) return;
      const latest = form.getSnapshot();
      if (latest.status !== 'ready' || !latest.writable || resolveCaptureExportPreferences(latest.value).saveDirectory !== resolveCaptureExportPreferences(current.value).saveDirectory) { setFailed(true); return; }
      const accepted = await form.mutate([{ op: 'set', path: ['saveDirectory'], value: selected }], latest.revision);
      if (alive.current) setFailed(!accepted);
    } catch { if (alive.current) setFailed(true); }
    finally { busy.current = false; if (alive.current) setPending(false); }
  }
  const hint = (label, children) => <Tooltip label={label} side="bottom" delayMs={500} focusDelayMs={0} portal>{children}</Tooltip>;
  const begin = () => { if (writable) { base.current = preferences.fileNamePattern; setDraft(preferences.fileNamePattern); setFailed(false); } };
  const invalid = draft !== null && !CAPTURE_FILE_NAME_PATTERN.test(draft);
  return <section className="pdsh-settings" data-pdsh-settings><section className="pdsh-group pdsh-fields-group" role="group" aria-labelledby="pdsh-capture-title">
    <div className="pdsh-row pdsh-group-header" aria-busy={pending || undefined}><h4 id="pdsh-capture-title">{t('capture')}</h4>
      <Tooltip label={t('captureEnabled')} side="bottom" delayMs={500} focusDelayMs={0} portal><span className="pdsh-switch-tooltip">
        <Switch checked={captureEnabled} disabled={!writable} label={t('captureEnabled')} onChange={() => void save('captureEnabled', !captureEnabled)} />
      </span></Tooltip>
    </div>
    <div className="pdsh-detail-row pdsh-row" aria-busy={pending || undefined}>
      <span className="pdsh-label" id="pdsh-capture-mask-identity">{t('captureMaskIdentity')}</span>
      <Tooltip label={t('captureMaskIdentity')} side="bottom" delayMs={500} focusDelayMs={0} portal><span className="pdsh-switch-tooltip">
        <Switch checked={captureMaskIdentity} disabled={!writable} label={t('captureMaskIdentity')} onChange={() => void save('captureMaskIdentity', !captureMaskIdentity)} />
      </span></Tooltip>
    </div>
    <div className="pdsh-detail-row"><span className="pdsh-label" id="pdsh-save-behavior">{t('saveLocation')}</span>
      <div className="pdsh-avatar-actions" role="group" aria-labelledby="pdsh-save-behavior">{CAPTURE_SAVE_BEHAVIORS.map(behavior =>
        <Button key={behavior} variant={preferences.saveBehavior === behavior ? 'outline' : 'ghost'} aria-pressed={preferences.saveBehavior === behavior} disabled={!writable || (behavior === 'direct' && (!chooseDirectory || !preferences.saveDirectory))} onClick={event => void save('saveBehavior', behavior, event.currentTarget)}>{t(behavior === 'ask' ? 'saveAsk' : 'saveDirect')}</Button>)}</div>
    </div>
    <div className="pdsh-detail-row"><span className="pdsh-label">{t('saveDirectory')}</span><div className="pdsh-value-action">
      <span>{preferences.saveDirectory || t('directoryUnavailable')}</span>
      <Button variant="ghost" disabled={!writable || !chooseDirectory} onClick={event => void selectDirectory(event.currentTarget)}>{t('chooseDirectory')}</Button>
    </div></div>
    <div className="pdsh-detail-row"><span className="pdsh-label" id="pdsh-save-format">{t('saveFormat')}</span>
      <div className="pdsh-avatar-actions" role="group" aria-labelledby="pdsh-save-format">{CAPTURE_SAVE_FORMATS.map(format =>
        <Button key={format} variant={preferences.saveFormat === format ? 'outline' : 'ghost'} aria-pressed={preferences.saveFormat === format} disabled={!writable} onClick={event => void save('saveFormat', format, event.currentTarget)}>{format === 'webp' ? 'WebP' : format.toUpperCase()}</Button>)}</div>
    </div>
    <div className="pdsh-detail-row" ref={templateRow}><span className="pdsh-label" id="pdsh-file-name-label">{t('fileNamePattern')}</span>
      {draft === null ? <div className="pdsh-value-action"><span>{preferences.fileNamePattern}</span>
        {hint(t('editFileName'), <Button className="pdsh-nickname-action" variant="ghost" aria-label={t('editFileName')} onClick={begin} disabled={!writable}><IconEditOutlineRegular /></Button>)}
      </div> : <div className="pdsh-field pdsh-nickname-editor"><div className="pdsh-inline-editor">
        {hint(t('templateTokens'), <Input id="pdsh-file-name" aria-label={t('fileNamePattern')} aria-labelledby="pdsh-file-name-label" aria-invalid={invalid} autoFocus value={draft} disabled={!writable} onChange={event => { setDraft(event.target.value); setFailed(false); }} onKeyDown={event => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === 'Enter') { event.preventDefault(); void save('fileNamePattern', draft, event.currentTarget); }
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(event.currentTarget); }
        }} />)}
        {hint(t('doneFileName'), <Button className="pdsh-nickname-action" variant="ghost" aria-label={t('doneFileName')} disabled={!writable || invalid} onClick={event => void save('fileNamePattern', draft, event.currentTarget)}><IconCheckOutlineRegular /></Button>)}
      </div></div>}
    </div>
    {failed && <p className="pdsh-error" role="alert">{t('exportSaveFailed')}</p>}
  </section></section>;
}
