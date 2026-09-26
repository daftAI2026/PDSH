/**
 * [INPUT]: 依赖宿主共享 React/primitives 与 configForms；model.js 限定显示偏好。
 * [OUTPUT]: 提供插件设置页：开关、昵称、离线头像选择与原子保存。
 * [POS]: PDSH 交互层；未保存草稿不作用于账号，失败或修订冲突保留草稿。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Input, Switch, Button } from '@deepseek-ai/dsh-client-ui-primitives';
import { DEFAULTS, MAX_AVATAR_CHARS, MAX_NAME_CHARS, resolvePreferences } from './model.js';

export function SettingsCard({ view, preferencesForm: form, presentation, t }) {
  const snapshot = useSyncExternalStore(fn => form.subscribe(fn), () => form.getSnapshot());
  const status = useSyncExternalStore(fn => presentation.subscribe(fn), () => presentation.status());
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const revision = useRef();
  const pendingFile = useRef(0);
  useEffect(() => () => { ++pendingFile.current; }, []);
  if (view === 'summary') return t('description');
  const ready = snapshot.status === 'ready';
  const writable = ready && snapshot.writable && !saving;
  const values = draft ?? snapshot.value ?? DEFAULTS;
  let resolved;
  try { resolved = resolvePreferences(values); } catch { /* 非法草稿只阻止保存。 */ }
  function edit(field, value) {
    if (draft === null) revision.current = snapshot.revision;
    setDraft(previous => ({ ...(previous ?? snapshot.value ?? DEFAULTS), [field]: value })); setError('');
  }
  async function save() {
    if (!writable || !resolved || draft === null) return;
    setSaving(true); setError('');
    try {
      const accepted = await form.mutate(Object.entries(draft).map(([field, value]) => ({ op: 'set', path: [field], value })), revision.current);
      if (accepted) setDraft(null); else setError(t('saveFailed'));
    } catch { setError(t('saveFailed')); }
    finally { setSaving(false); }
  }
  async function chooseAvatar(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    const request = ++pendingFile.current;
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > MAX_AVATAR_CHARS * 3 / 4) throw new Error('avatar');
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file);
      });
      resolvePreferences({ ...values, avatar: data });
      const image = new Image(); image.src = data; await image.decode();
      if (request === pendingFile.current) edit('avatar', data);
    } catch { if (request === pendingFile.current) setError(t('avatarFailed')); }
  }
  return <section className="pdsh-settings" data-pdsh-settings>
    <p className="pdsh-hint">{t('description')}</p>
    {!ready && <p role="status">{t('loading')}</p>}
    {ready && !snapshot.writable && <p role="status">{t('readOnly')}</p>}
    <p className="pdsh-row"><span>{t('frames')}</span><Switch checked={values.frames} onChange={value => edit('frames', value)} label={t('frames')} disabled={!writable} /></p>
    <p className="pdsh-row"><span>{t('maskIdentity')}</span><Switch checked={values.maskIdentity} onChange={value => edit('maskIdentity', value)} label={t('maskIdentity')} disabled={!writable} /></p>
    <p><label htmlFor="pdsh-nickname">{t('nickname')}</label></p>
    <Input id="pdsh-nickname" value={values.nickname} maxLength={MAX_NAME_CHARS} onChange={event => edit('nickname', event.target.value)} disabled={!writable} />
    <p className="pdsh-hint">{t('avatarHint')}</p>
    {resolved && <img className="pdsh-avatar-preview" src={resolved.avatar} alt={t('preview')} />}
    <p><label htmlFor="pdsh-avatar-file">{t('avatar')}</label> <input id="pdsh-avatar-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} disabled={!writable} /></p>
    <Button onClick={() => { ++pendingFile.current; edit('avatar', ''); }} disabled={!writable}>{t('generated')}</Button>
    <p role="status" className="pdsh-hint">{t(`status.${status}`)}</p>
    {error && <p role="alert">{error}</p>}
    {draft !== null && !resolved && <p role="alert">{t('invalid')}</p>}
    <p className="pdsh-row">
      <Button variant="primary" onClick={save} disabled={!writable || draft === null || !resolved}>{t(saving ? 'saving' : 'save')}</Button>
      <Button onClick={() => { ++pendingFile.current; setDraft(null); setError(''); }} disabled={saving || draft === null}>{t('discard')}</Button>
    </p>
  </section>;
}
