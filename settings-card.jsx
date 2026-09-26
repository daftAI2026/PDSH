/**
 * [INPUT]: 依赖宿主共享 React/primitives 与 configForms；model.js 限定显示偏好。
 * [OUTPUT]: 提供按对话/身份分组的设置页、资料摘要与独立昵称编辑行、生成/本地/原生账号头像来源与原子保存。
 * [POS]: PDSH 交互层；布局遵循宿主字号/卡片，未保存草稿不作用于账号，失败或冲突保留草稿。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Input, Switch, Button, IconUserOutlineMedium, IconEditOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { DEFAULTS, MAX_AVATAR_CHARS, MAX_NAME_CHARS, resolvePreferences } from './model.js';

function ToggleRow({ label, hint, checked, onChange, disabled }) {
  return <div className="pdsh-row"><div className="pdsh-copy"><span className="pdsh-label">{label}</span><span className="pdsh-hint">{hint}</span></div>
    <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />
  </div>;
}

export function SettingsCard({ view, preferencesForm: form, presentation, t }) {
  const snapshot = useSyncExternalStore(fn => form.subscribe(fn), () => form.getSnapshot());
  const status = useSyncExternalStore(fn => presentation.subscribe(fn), () => presentation.status());
  const accountAvatar = useSyncExternalStore(fn => presentation.subscribe(fn), () => presentation.accountAvatar());
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingNickname, setEditingNickname] = useState(false);
  const [avatarOptionsOpen, setAvatarOptionsOpen] = useState(false);
  const nicknameRow = useRef(null);
  const returnNicknameFocus = useRef(false);
  const revision = useRef();
  const pendingFile = useRef(0);
  const fileInput = useRef(null);
  useEffect(() => () => { ++pendingFile.current; }, []);
  useEffect(() => {
    if (!editingNickname && returnNicknameFocus.current) { nicknameRow.current?.querySelector('button')?.focus(); returnNicknameFocus.current = false; }
  }, [editingNickname]);
  if (view === 'summary') return t('description');
  const ready = snapshot.status === 'ready';
  const writable = ready && snapshot.writable && !saving;
  const values = draft ?? snapshot.value ?? DEFAULTS;
  const avatarSource = values.useAccountAvatar ? 'account' : values.avatar ? 'local' : 'generated';
  let resolved;
  try { resolved = resolvePreferences(values); } catch { /* 非法草稿只阻止保存。 */ }
  function editChanges(changes) {
    if (draft === null) revision.current = snapshot.revision;
    setDraft(previous => ({ ...(previous ?? snapshot.value ?? DEFAULTS), ...changes })); setError('');
  }
  function edit(field, value) { editChanges({ [field]: value }); }
  function finishNicknameEdit() { returnNicknameFocus.current = true; setEditingNickname(false); }
  async function save() {
    if (!writable || !resolved || draft === null) return;
    setSaving(true); setError('');
    try {
      const accepted = await form.mutate(Object.entries(draft).map(([field, value]) => ({ op: 'set', path: [field], value })), revision.current);
      if (accepted) { setDraft(null); setEditingNickname(false); setAvatarOptionsOpen(false); } else setError(t('saveFailed'));
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
      if (request === pendingFile.current) editChanges({ avatar: data, useAccountAvatar: false });
    } catch { if (request === pendingFile.current) setError(t('avatarFailed')); }
  }
  return <section className="pdsh-settings" data-pdsh-settings>
    <p className="pdsh-hint">{t('description')}</p>
    <p className="pdsh-hint">{t('languageHint')}</p>
    {!ready && <p role="status">{t('loading')}</p>}
    {ready && !snapshot.writable && <p role="status">{t('readOnly')}</p>}
    <section className="pdsh-group" role="group" aria-labelledby="pdsh-display-title">
      <h4 id="pdsh-display-title">{t('displayGroup')}</h4>
      <ToggleRow label={t('frames')} hint={t('framesHint')} checked={values.frames} onChange={value => edit('frames', value)} disabled={!writable} />
    </section>
    <section className="pdsh-group" role="group" aria-labelledby="pdsh-identity-title">
      <h4 id="pdsh-identity-title">{t('identityGroup')}</h4>
      <ToggleRow label={t('maskIdentity')} hint={t('identityHint')} checked={values.maskIdentity} onChange={value => edit('maskIdentity', value)} disabled={!writable} />
      <div className="pdsh-identity" aria-label={t('identityPreview')}>
        {avatarSource === 'account' && !accountAvatar
          ? <span className="pdsh-avatar-preview pdsh-avatar-fallback" role="img" aria-label={t('accountAvatar')}><IconUserOutlineMedium /></span>
          : resolved && <img className="pdsh-avatar-preview" src={avatarSource === 'account' ? accountAvatar : resolved.avatar} alt={t(avatarSource === 'account' ? 'accountAvatar' : 'preview')} referrerPolicy="no-referrer" />}
        <div className="pdsh-copy pdsh-profile-copy"><strong className="pdsh-profile-name">{values.nickname}</strong><span className="pdsh-hint">{t('identityPreviewHint')}</span></div>
        <Button variant="outline" aria-expanded={avatarOptionsOpen} aria-controls="pdsh-avatar-options" onClick={() => setAvatarOptionsOpen(open => !open)} disabled={!writable}>{t('changeAvatar')}</Button>
      </div>
      <div className="pdsh-detail-row" ref={nicknameRow}>
        <span className="pdsh-label" id="pdsh-nickname-label">{t('nickname')}</span>
        {editingNickname ? <div className="pdsh-inline-editor">
          <Input id="pdsh-nickname" aria-labelledby="pdsh-nickname-label" autoFocus value={values.nickname} maxLength={MAX_NAME_CHARS} onChange={event => edit('nickname', event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) finishNicknameEdit(); }} disabled={!writable} />
          <Button size="sm" onClick={finishNicknameEdit} disabled={!writable}>{t('doneEditing')}</Button>
        </div> : <Button className="pdsh-value-action" aria-label={t('editNickname')} onClick={() => setEditingNickname(true)} disabled={!writable}><span>{values.nickname}</span><IconEditOutlineRegular /></Button>}
      </div>
      <div className="pdsh-detail-row">
        <span className="pdsh-label">{t('avatarLabel')}</span><span className="pdsh-source-value">{t(`source.${avatarSource}`)}</span>
      </div>
      <div className="pdsh-avatar-options" id="pdsh-avatar-options" hidden={!avatarOptionsOpen}>
        <div className="pdsh-actions" role="group" aria-label={t('avatarLabel')}>
          <Button variant={avatarSource === 'generated' ? "outline" : "ghost"} aria-pressed={avatarSource === 'generated'} onClick={() => { ++pendingFile.current; editChanges({ avatar: '', useAccountAvatar: false }); }} disabled={!writable}>{t('generated')}</Button>
          <Button variant={avatarSource === 'local' ? "outline" : "ghost"} aria-pressed={avatarSource === 'local'} onClick={() => fileInput.current?.click()} disabled={!writable}>{t('avatar')}</Button>
          <Button variant={avatarSource === 'account' ? "outline" : "ghost"} aria-pressed={avatarSource === 'account'} onClick={() => { ++pendingFile.current; edit('useAccountAvatar', true); }} disabled={!writable}>{t('accountAvatar')}</Button>
        </div>
        <p className="pdsh-hint">{t(avatarSource === 'account' ? 'accountAvatarHint' : 'avatarHint')}</p>
      </div>
      <input ref={fileInput} id="pdsh-avatar-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} disabled={!writable} hidden aria-label={t('avatar')} />
      <p role="status" className="pdsh-hint">{t(`status.${status}`)}</p>
    </section>
    {error && <p role="alert" className="pdsh-error">{error}</p>}
    {draft !== null && !resolved && <p role="alert" className="pdsh-error">{t('invalid')}</p>}
    <footer className="pdsh-footer"><div className="pdsh-actions">
      <Button variant="primary" onClick={save} disabled={!writable || draft === null || !resolved}>{t(saving ? 'saving' : 'save')}</Button>
      <Button onClick={() => { ++pendingFile.current; setDraft(null); setError(''); setEditingNickname(false); setAvatarOptionsOpen(false); }} disabled={saving || draft === null}>{t('discard')}</Button>
    </div><span className="pdsh-hint" role="status">{draft !== null ? t('unsaved') : t('savedHint')}</span></footer>
  </section>;
}
