/**
 * [INPUT]: 依赖宿主共享 React/primitives 与 ConfigForm；model.js 限定显示偏好。
 * [OUTPUT]: 提供三字段profile草稿与原子保存、独立文本/铅笔/确认勾、Host单路径即时开关、局部取消和可取消头像读取。
 * [POS]: PDSH 交互层；Host 是唯一持久化源，profile冲突不自动合并，开关不污染草稿，迟到图片不复活已取消草稿。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Input, Switch, Button, IconUserOutlineMedium, IconEditOutlineRegular, IconCheckOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { DEFAULTS, MAX_AVATAR_CHARS, MAX_NAME_CHARS, NICKNAME_PATTERN, resolvePreferences } from './model.js';

const PROFILE_FIELDS = ['nickname', 'avatar', 'useAccountAvatar'];

function profileValues(value) {
  return Object.fromEntries(PROFILE_FIELDS.map(field => [field, value?.[field] ?? DEFAULTS[field]]));
}

function sameProfile(left, right) {
  return Boolean(left && PROFILE_FIELDS.every(field => left[field] === right[field]));
}

function ToggleRow({ field, label, hint, checked, onChange, disabled, pending, error, returnFocus }) {
  const row = useRef(null);
  useEffect(() => {
    if (pending || returnFocus.current?.field !== field) return;
    const origin = returnFocus.current.node;
    returnFocus.current = null;
    const doc = origin.ownerDocument;
    if (doc.activeElement === doc.body || doc.activeElement === origin) {
      const control = row.current?.querySelector('[role="switch"]');
      if (control && !control.disabled) control.focus();
    }
  }, [field, pending, returnFocus]);
  function handleChange() {
    const control = row.current?.querySelector('[role="switch"]');
    onChange(control?.ownerDocument.activeElement === control ? control : null);
  }
  return <div className="pdsh-row" aria-busy={pending || undefined} ref={row}><div className="pdsh-copy"><span className="pdsh-label">{label}</span>{hint && <span className="pdsh-hint">{hint}</span>}{error && <span className="pdsh-error" role="alert">{error}</span>}</div>
    <Switch checked={checked} onChange={handleChange} label={label} disabled={disabled} />
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
  const [readingAvatar, setReadingAvatar] = useState(false);
  const [togglePending, setTogglePending] = useState(null);
  const [toggleFailure, setToggleFailure] = useState('');
  const nicknameRow = useRef(null);
  const returnNicknameFocus = useRef(false);
  const returnActionFocus = useRef(null);
  const profileBase = useRef(null);
  const draftRef = useRef(null);
  const togglePendingRef = useRef(null);
  const toggleFocus = useRef(null);
  const pendingFile = useRef(0);
  const avatarRequest = useRef(null);
  const avatarReader = useRef(null);
  const nicknameBeforeEdit = useRef('');
  const fileInput = useRef(null);
  function invalidateAvatarRead() {
    ++pendingFile.current; avatarRequest.current = null;
    const reader = avatarReader.current; avatarReader.current = null; reader?.abort();
  }
  function cancelAvatarRead() { invalidateAvatarRead(); setReadingAvatar(false); }
  useEffect(() => () => invalidateAvatarRead(), []);
  useEffect(() => {
    if (snapshot.status !== 'ready' || !snapshot.writable) cancelAvatarRead();
  }, [snapshot.status, snapshot.writable]);
  useEffect(() => {
    if (!editingNickname && returnNicknameFocus.current) { nicknameRow.current?.querySelector('button')?.focus(); returnNicknameFocus.current = false; }
  }, [editingNickname]);
  useEffect(() => {
    const origin = returnActionFocus.current;
    if (saving || !origin) return;
    returnActionFocus.current = null;
    const doc = origin.ownerDocument;
    // 只修复本次按钮禁用后的焦点空洞，不抢回用户已移走的焦点。
    if (doc.activeElement === doc.body || doc.activeElement === origin) {
      (origin.disabled ? nicknameRow.current?.querySelector('button, input') : origin)?.focus();
    }
  }, [saving, draft, readingAvatar]);
  if (view === 'summary') return t('description');
  const ready = snapshot.status === 'ready';
  const writable = ready && snapshot.writable && !saving;
  const values = draft ?? profileValues(snapshot.value);
  const conflicted = draft !== null && ready && !sameProfile(profileBase.current, profileValues(snapshot.value));
  const nicknameInvalid = typeof values.nickname !== 'string' || values.nickname.length > MAX_NAME_CHARS || !NICKNAME_PATTERN.test(values.nickname);
  const avatarSource = values.useAccountAvatar ? 'account' : values.avatar ? 'local' : 'generated';
  let resolved;
  try { resolved = resolvePreferences(values); } catch { /* 非法草稿只阻止保存。 */ }
  let previewAvatar = resolved?.avatar;
  if (!previewAvatar) {
    try { previewAvatar = resolvePreferences({ ...values, nickname: (snapshot.value ?? DEFAULTS).nickname }).avatar; } catch { /* 未知配置不渲染任意图片。 */ }
  }
  function editChanges(changes) {
    const current = form.getSnapshot();
    if (current.status !== 'ready' || !current.writable || saving) return;
    const currentProfile = profileValues(current.value);
    const previous = draftRef.current;
    const next = { ...(previous ?? currentProfile), ...changes };
    const unchanged = PROFILE_FIELDS.every(field => next[field] === currentProfile[field]);
    if (unchanged) {
      draftRef.current = null; profileBase.current = null; setDraft(null);
    } else {
      if (!previous || !profileBase.current) profileBase.current = currentProfile;
      draftRef.current = next; setDraft(next);
    }
    setError('');
  }
  function edit(field, value) { editChanges({ [field]: value }); }
  async function toggle(field, origin) {
    const current = form.getSnapshot();
    if (togglePendingRef.current || saving || current.status !== 'ready' || !current.writable) return;
    const acceptedValue = current.value?.[field] ?? DEFAULTS[field];
    if (typeof acceptedValue !== 'boolean') return;
    toggleFocus.current = origin ? { field, node: origin } : null;
    togglePendingRef.current = field; setTogglePending(field); setToggleFailure('');
    try {
      const accepted = await form.mutate([{ op: 'set', path: [field], value: !acceptedValue }], current.revision);
      if (!accepted) setToggleFailure(field);
    } catch { setToggleFailure(field); }
    finally { togglePendingRef.current = null; setTogglePending(null); }
  }
  function finishNicknameEdit() { returnNicknameFocus.current = true; setEditingNickname(false); }
  function cancelNicknameEdit() {
    const previous = draftRef.current;
    if (previous !== null) {
      const currentProfile = profileValues(form.getSnapshot().value);
      const restored = { ...previous, nickname: nicknameBeforeEdit.current };
      if (PROFILE_FIELDS.every(field => restored[field] === currentProfile[field])) {
        draftRef.current = null; profileBase.current = null; setDraft(null);
      } else { draftRef.current = restored; setDraft(restored); }
    }
    finishNicknameEdit();
  }
  function preserveActionFocus(event) {
    const origin = event.currentTarget;
    if (origin.ownerDocument.activeElement === origin) returnActionFocus.current = origin;
  }
  async function save(event) {
    const current = form.getSnapshot();
    const currentDraft = draftRef.current;
    if (!writable || !resolved || currentDraft === null || conflicted || avatarRequest.current !== null ||
        togglePendingRef.current !== null || current.status !== 'ready' || !current.writable ||
        !sameProfile(profileBase.current, profileValues(current.value))) return;
    preserveActionFocus(event);
    setSaving(true); setError('');
    try {
      const latest = form.getSnapshot();
      if (latest.status !== 'ready' || !latest.writable || !sameProfile(profileBase.current, profileValues(latest.value))) return;
      const latestProfile = profileValues(latest.value);
      const changed = new Set(PROFILE_FIELDS.filter(field => currentDraft[field] !== latestProfile[field]));
      // 两个头像字段共同定义来源，必须在同一事务中写；其余继承值不物化。
      if (changed.has('avatar') || changed.has('useAccountAvatar')) { changed.add('avatar'); changed.add('useAccountAvatar'); }
      if (!changed.size) { draftRef.current = null; profileBase.current = null; setDraft(null); return; }
      const accepted = await form.mutate([...changed].map(field => ({ op: 'set', path: [field], value: currentDraft[field] })), latest.revision);
      if (accepted) { draftRef.current = null; profileBase.current = null; setDraft(null); setEditingNickname(false); setAvatarOptionsOpen(false); } else setError('saveFailed');
    } catch { setError('saveFailed'); }
    finally { setSaving(false); }
  }
  async function chooseAvatar(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file || !writable) return;
    cancelAvatarRead();
    const request = ++pendingFile.current;
    avatarRequest.current = request; setReadingAvatar(true); setError('');
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > MAX_AVATAR_CHARS * 3 / 4) throw new Error('avatar');
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader(); avatarReader.current = reader;
        reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.onabort = reject; reader.readAsDataURL(file);
      });
      if (request !== pendingFile.current) return;
      avatarReader.current = null;
      // 图片验证不依赖尚未完成的昵称草稿。
      resolvePreferences({ avatar: data });
      const image = new Image(); image.src = data; await image.decode();
      if (request === pendingFile.current) editChanges({ avatar: data, useAccountAvatar: false });
    } catch { if (request === pendingFile.current) setError('avatarFailed'); }
    finally {
      if (request === pendingFile.current) { avatarRequest.current = null; avatarReader.current = null; setReadingAvatar(false); }
    }
  }
  return <section className="pdsh-settings" data-pdsh-settings>
    {snapshot.status === 'loading' && <p role="status">{t('loading')}</p>}
    {snapshot.status === 'unavailable' && <p role="status">{t('unavailable')}</p>}
    {ready && !snapshot.writable && <p role="status">{t('readOnly')}</p>}
    <section className="pdsh-group" role="group" aria-labelledby="pdsh-display-title">
      <h4 id="pdsh-display-title">{t('displayGroup')}</h4>
      <ToggleRow field="maskTitles" label={t('maskTitles')} hint={t('titlesHint')} checked={snapshot.value?.maskTitles ?? DEFAULTS.maskTitles} onChange={origin => toggle('maskTitles', origin)} disabled={!writable || togglePending !== null} pending={togglePending === 'maskTitles'} error={toggleFailure === 'maskTitles' ? t('toggleFailed') : ''} returnFocus={toggleFocus} />
    </section>
    <section className="pdsh-group" role="group" aria-labelledby="pdsh-identity-title">
      <h4 id="pdsh-identity-title">{t('identityGroup')}</h4>
      <ToggleRow field="maskIdentity" label={t('maskIdentity')} hint={t('identityHint')} checked={snapshot.value?.maskIdentity ?? DEFAULTS.maskIdentity} onChange={origin => toggle('maskIdentity', origin)} disabled={!writable || togglePending !== null} pending={togglePending === 'maskIdentity'} error={toggleFailure === 'maskIdentity' ? t('toggleFailed') : ''} returnFocus={toggleFocus} />
      <div className="pdsh-identity" aria-label={t('identityPreview')}>
        {avatarSource === 'account' && !accountAvatar
          ? <span className="pdsh-avatar-preview pdsh-avatar-fallback" role="img" aria-label={t('accountAvatar')}><IconUserOutlineMedium /></span>
          : previewAvatar && <img className="pdsh-avatar-preview" src={avatarSource === 'account' ? accountAvatar : previewAvatar} alt={t(avatarSource === 'account' ? 'accountAvatar' : 'preview')} referrerPolicy="no-referrer" />}
        <div className="pdsh-copy pdsh-profile-copy"><strong className="pdsh-profile-name">{values.nickname}</strong></div>
        <Button variant="outline" aria-expanded={avatarOptionsOpen} aria-controls="pdsh-avatar-options" onClick={() => setAvatarOptionsOpen(open => !open)} disabled={!writable}>{t('changeAvatar')}</Button>
      </div>
      <div className="pdsh-detail-row" ref={nicknameRow}>
        <span className="pdsh-label" id="pdsh-nickname-label">{t('nickname')}</span>
        {editingNickname ? <div className="pdsh-field pdsh-nickname-editor"><div className="pdsh-inline-editor">
          <Input id="pdsh-nickname" aria-labelledby="pdsh-nickname-label" aria-invalid={nicknameInvalid} aria-describedby={nicknameInvalid ? 'pdsh-invalid' : undefined} autoFocus value={values.nickname} maxLength={MAX_NAME_CHARS} onChange={event => edit('nickname', event.target.value)} onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Enter') { event.preventDefault(); if (!nicknameInvalid) finishNicknameEdit(); }
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelNicknameEdit(); }
          }} disabled={!writable} />
          <Button className="pdsh-nickname-action" variant="ghost" aria-label={t('doneEditing')} title={t('doneEditing')} onClick={finishNicknameEdit} disabled={!writable || nicknameInvalid}><IconCheckOutlineRegular /></Button>
        </div>{nicknameInvalid && <p role="alert" id="pdsh-invalid" className="pdsh-error">{t('invalidNickname')}</p>}</div>
          : <div className="pdsh-value-action"><span>{values.nickname}</span><Button className="pdsh-nickname-action" variant="ghost" aria-label={`${t('editNickname')}: ${values.nickname}`} title={t('editNickname')} onClick={() => { nicknameBeforeEdit.current = values.nickname; setEditingNickname(true); }} disabled={!writable}><IconEditOutlineRegular /></Button></div>}
      </div>
      <div className="pdsh-detail-row">
        <span className="pdsh-label">{t('avatarLabel')}</span><span className="pdsh-source-value">{t(`source.${avatarSource}`)}</span>
      </div>
      <div className="pdsh-avatar-options" id="pdsh-avatar-options" hidden={!avatarOptionsOpen}>
        <div className="pdsh-actions" role="group" aria-label={t('avatarLabel')}>
          <Button variant={avatarSource === 'generated' ? "outline" : "ghost"} aria-pressed={avatarSource === 'generated'} onClick={() => { cancelAvatarRead(); editChanges({ avatar: '', useAccountAvatar: false }); }} disabled={!writable}>{t('generated')}</Button>
          <Button variant={avatarSource === 'local' ? "outline" : "ghost"} aria-pressed={avatarSource === 'local'} onClick={() => { cancelAvatarRead(); fileInput.current?.click(); }} disabled={!writable}>{t('avatar')}</Button>
          <Button variant={avatarSource === 'account' ? "outline" : "ghost"} aria-pressed={avatarSource === 'account'} onClick={() => { cancelAvatarRead(); edit('useAccountAvatar', true); }} disabled={!writable}>{t('accountAvatar')}</Button>
        </div>
        <p className="pdsh-hint">{t(avatarSource === 'account' ? 'accountAvatarHint' : 'avatarHint')}</p>
      </div>
      <input ref={fileInput} id="pdsh-avatar-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} disabled={!writable} hidden aria-label={t('avatar')} />
      {readingAvatar && <p role="status" className="pdsh-hint" data-pdsh-avatar-loading>{t('avatarLoading')}</p>}
      {error === 'avatarFailed' && <p role="alert" className="pdsh-error">{t(error)}</p>}
      {['signed-out', 'unsupported'].includes(status) && <p role="status" className="pdsh-hint">{t(`status.${status}`)}</p>}
      {!saving && conflicted && <p role="alert" className="pdsh-error">{t('saveConflict')}</p>}
      {error && error !== 'avatarFailed' && !conflicted && <p role="alert" className="pdsh-error">{t(error)}</p>}
      {draft !== null && !resolved && !(editingNickname && nicknameInvalid) && <p role="alert" className="pdsh-error">{t('invalid')}</p>}
      <footer className="pdsh-footer"><div className="pdsh-actions">
        <Button variant="primary" onClick={save} disabled={!writable || draft === null || !resolved || conflicted || readingAvatar || togglePending !== null}>{t(saving ? 'saving' : 'save')}</Button>
        <Button onClick={event => { preserveActionFocus(event); cancelAvatarRead(); draftRef.current = null; profileBase.current = null; setDraft(null); setError(''); setEditingNickname(false); setAvatarOptionsOpen(false); }} disabled={saving || (draft === null && !readingAvatar)}>{t(conflicted ? 'reloadDiscard' : 'discard')}</Button>
      </div>{draft !== null && <span className="pdsh-hint" role="status">{t('unsaved')}</span>}</footer>
    </section>
  </section>;
}
