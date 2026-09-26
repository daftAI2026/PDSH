/**
 * [INPUT]: 依赖宿主共享 React/primitives 与 ConfigForm；model.js 校验昵称及本地图像。
 * [OUTPUT]: 提供头像三按钮即时原子保存、昵称局部草稿/勾选保存、即时开关与可取消图片读取。
 * [POS]: PDSH 交互层；Host 接受值拥有来源选中态，字段级基线阻止覆盖外来修改，共用单次写入门。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Input, Switch, Button, IconUserOutlineMedium, IconEditOutlineRegular, IconCheckOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { DEFAULTS, MAX_AVATAR_CHARS, MAX_NAME_CHARS, NICKNAME_PATTERN, resolvePreferences } from './model.js';

function avatarValues(value) {
  return { avatar: value?.avatar ?? DEFAULTS.avatar, useAccountAvatar: value?.useAccountAvatar ?? DEFAULTS.useAccountAvatar };
}
function sameAvatar(left, right) {
  return Boolean(left && right && left.avatar === right.avatar && left.useAccountAvatar === right.useAccountAvatar);
}
function ToggleRow({ label, hint, checked, disabled, pending, error, onChange }) {
  const row = useRef(null);
  return <div className="pdsh-row" ref={row} aria-busy={pending || undefined}><div className="pdsh-copy"><span className="pdsh-label">{label}</span><span className="pdsh-hint">{hint}</span>{error && <span className="pdsh-error" role="alert">{error}</span>}</div>
    <Switch checked={checked} onChange={() => onChange(row.current?.querySelector('[role="switch"]'))} label={label} disabled={disabled} />
  </div>;
}

export function SettingsCard({ view, preferencesForm: form, presentation, t }) {
  const snapshot = useSyncExternalStore(fn => form.subscribe(fn), () => form.getSnapshot());
  const status = useSyncExternalStore(fn => presentation.subscribe(fn), () => presentation.status());
  const accountAvatar = useSyncExternalStore(fn => presentation.subscribe(fn), () => presentation.accountAvatar());
  const [nicknameDraft, setNicknameDraft] = useState(null);
  const [nicknameError, setNicknameError] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [avatarRetry, setAvatarRetry] = useState(null);
  const [readingAvatar, setReadingAvatar] = useState(false);
  const [mutation, setMutation] = useState(null);
  const [toggleFailure, setToggleFailure] = useState('');
  const nicknameBase = useRef(null);
  const nicknameRow = useRef(null);
  const pendingMutation = useRef(null);
  const returnFocus = useRef(null);
  const alive = useRef(true);
  const fileSequence = useRef(0);
  const avatarReader = useRef(null);
  const fileInput = useRef(null);
  function invalidateAvatarRead() {
    ++fileSequence.current;
    const reader = avatarReader.current; avatarReader.current = null; reader?.abort();
  }
  function cancelAvatarRead() { invalidateAvatarRead(); setReadingAvatar(false); }
  useEffect(() => { alive.current = true; return () => { alive.current = false; invalidateAvatarRead(); }; }, []);
  useEffect(() => {
    if (snapshot.status !== 'ready' || !snapshot.writable) cancelAvatarRead();
  }, [snapshot.status, snapshot.writable]);
  useEffect(() => {
    if (mutation || !returnFocus.current) return;
    const { origin, nickname } = returnFocus.current; returnFocus.current = null;
    const doc = origin.ownerDocument;
    // 只修复本次禁用/替换产生的焦点空洞，不打断已经移走的焦点。
    if (doc.activeElement === doc.body || doc.activeElement === origin) {
      const target = nickname ? nicknameRow.current?.querySelector('input, button') : origin;
      if (target?.isConnected && !target.disabled) target.focus();
    }
  }, [mutation, nicknameDraft]);
  if (view === 'summary') return t('description');
  const ready = snapshot.status === 'ready';
  const writable = ready && snapshot.writable && mutation === null;
  const acceptedNickname = snapshot.value?.nickname ?? DEFAULTS.nickname;
  const displayedNickname = nicknameDraft ?? acceptedNickname;
  const nicknameInvalid = typeof displayedNickname !== 'string' || displayedNickname.length > MAX_NAME_CHARS || !NICKNAME_PATTERN.test(displayedNickname);
  const nicknameConflict = nicknameDraft !== null && ready && nicknameBase.current !== acceptedNickname;
  const acceptedAvatar = avatarValues(snapshot.value);
  const avatarSource = acceptedAvatar.useAccountAvatar ? 'account' : acceptedAvatar.avatar ? 'local' : 'generated';
  const avatarConflict = avatarRetry && !sameAvatar(avatarRetry.base, acceptedAvatar);
  let preview;
  try { preview = resolvePreferences({ ...acceptedAvatar, nickname: nicknameInvalid ? acceptedNickname : displayedNickname }).avatar; } catch { /* 非法Host配置不渲染任意图片。 */ }
  function preserveFocus(origin, nickname = false) {
    returnFocus.current = origin?.ownerDocument.activeElement === origin ? { origin, nickname } : null;
  }
  async function mutate(kind, ops, current, origin, nickname = false) {
    if (pendingMutation.current || current.status !== 'ready' || !current.writable) return false;
    preserveFocus(origin, nickname); pendingMutation.current = kind; setMutation(kind);
    try { return await form.mutate(ops, current.revision); }
    catch { return false; }
    finally { pendingMutation.current = null; if (alive.current) setMutation(null); }
  }
  function beginNickname() {
    const current = form.getSnapshot();
    if (pendingMutation.current || current.status !== 'ready' || !current.writable) return;
    nicknameBase.current = current.value?.nickname ?? DEFAULTS.nickname;
    setNicknameDraft(nicknameBase.current); setNicknameError('');
  }
  function cancelNickname(origin) {
    if (pendingMutation.current === 'nickname') return;
    preserveFocus(origin, true); setNicknameDraft(null); setNicknameError(''); nicknameBase.current = null;
  }
  async function confirmNickname(origin) {
    const current = form.getSnapshot();
    if (nicknameDraft === null || nicknameInvalid || readingAvatar || pendingMutation.current || current.status !== 'ready' || !current.writable) return;
    const currentName = current.value?.nickname ?? DEFAULTS.nickname;
    if (nicknameBase.current !== currentName) { setNicknameError('nicknameConflict'); return; }
    if (nicknameDraft === currentName) { cancelNickname(origin); return; }
    setNicknameError('');
    const accepted = await mutate('nickname', [{ op: 'set', path: ['nickname'], value: nicknameDraft }], current, origin, true);
    if (!alive.current) return;
    if (accepted) { setNicknameDraft(null); nicknameBase.current = null; }
    else setNicknameError('nicknameSaveFailed');
  }
  async function toggle(field, origin) {
    const current = form.getSnapshot();
    if (pendingMutation.current || readingAvatar || current.status !== 'ready' || !current.writable) return;
    const value = current.value?.[field] ?? DEFAULTS[field];
    if (typeof value !== 'boolean') return;
    setToggleFailure('');
    const accepted = await mutate(field, [{ op: 'set', path: [field], value: !value }], current, origin);
    if (alive.current && !accepted) setToggleFailure(field);
  }
  async function persistAvatar(value, base, origin) {
    const current = form.getSnapshot();
    if (pendingMutation.current || current.status !== 'ready' || !current.writable) return;
    setAvatarError(''); setAvatarRetry(null);
    if (!sameAvatar(base, avatarValues(current.value))) { setAvatarError('avatarConflict'); return; }
    if (sameAvatar(value, base)) return;
    const accepted = await mutate('avatar', ['avatar', 'useAccountAvatar'].map(field => ({ op: 'set', path: [field], value: value[field] })), current, origin);
    if (alive.current && !accepted) { setAvatarError('avatarSaveFailed'); setAvatarRetry({ value, base }); }
  }
  function chooseSource(source, origin) {
    const current = form.getSnapshot();
    if (pendingMutation.current || current.status !== 'ready' || !current.writable) return;
    cancelAvatarRead(); setAvatarRetry(null); setAvatarError('');
    if (source === 'local') { fileInput.current?.click(); return; }
    const base = avatarValues(current.value);
    void persistAvatar(source === 'account' ? { ...base, useAccountAvatar: true } : { avatar: '', useAccountAvatar: false }, base, origin);
  }
  async function chooseAvatar(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    const current = form.getSnapshot();
    if (!file || pendingMutation.current || current.status !== 'ready' || !current.writable) return;
    cancelAvatarRead(); const request = ++fileSequence.current, base = avatarValues(current.value);
    setReadingAvatar(true); setAvatarRetry(null); setAvatarError('');
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > MAX_AVATAR_CHARS * 3 / 4) throw new Error('avatar');
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader(); avatarReader.current = reader;
        reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.onabort = reject; reader.readAsDataURL(file);
      });
      if (!alive.current || request !== fileSequence.current) return;
      avatarReader.current = null; resolvePreferences({ avatar: data });
      const image = new Image(); image.src = data; await image.decode();
      if (alive.current && request === fileSequence.current) await persistAvatar({ avatar: data, useAccountAvatar: false }, base, null);
    } catch { if (alive.current && request === fileSequence.current) setAvatarError('avatarFailed'); }
    finally { if (alive.current && request === fileSequence.current) { avatarReader.current = null; setReadingAvatar(false); } }
  }
  function toggleRow(field, hint) {
    return <ToggleRow label={t(field)} hint={t(hint)} checked={snapshot.value?.[field] ?? DEFAULTS[field]} disabled={!writable || readingAvatar} pending={mutation === field} error={toggleFailure === field ? t('toggleFailed') : ''} onChange={origin => toggle(field, origin)} />;
  }
  return <section className="pdsh-settings" data-pdsh-settings>
    {snapshot.status === 'loading' && <p role="status">{t('loading')}</p>}
    {snapshot.status === 'unavailable' && <p role="status">{t('unavailable')}</p>}
    {ready && !snapshot.writable && <p role="status">{t('readOnly')}</p>}
    <section className="pdsh-group" role="group" aria-labelledby="pdsh-display-title">
      <h4 id="pdsh-display-title">{t('displayGroup')}</h4>{toggleRow('maskTitles', 'titlesHint')}
    </section>
    <section className="pdsh-group" role="group" aria-labelledby="pdsh-identity-title">
      <h4 id="pdsh-identity-title">{t('identityGroup')}</h4>{toggleRow('maskIdentity', 'identityHint')}
      <div className="pdsh-identity" aria-label={t('identityPreview')}>
        {avatarSource === 'account' && !accountAvatar
          ? <span className="pdsh-avatar-preview pdsh-avatar-fallback" role="img" aria-label={t('accountAvatar')}><IconUserOutlineMedium /></span>
          : preview && <img className="pdsh-avatar-preview" src={avatarSource === 'account' ? accountAvatar : preview} alt={t(avatarSource === 'account' ? 'accountAvatar' : 'preview')} referrerPolicy="no-referrer" />}
        <div className="pdsh-copy pdsh-profile-copy"><strong className="pdsh-profile-name">{displayedNickname}</strong></div>
        <div className="pdsh-avatar-actions" role="group" aria-label={t('avatarLabel')} aria-describedby={avatarError || avatarConflict ? 'pdsh-avatar-error' : undefined} aria-busy={readingAvatar || mutation === 'avatar' || undefined}>
          <Button variant={avatarSource === 'generated' ? 'outline' : 'ghost'} aria-pressed={avatarSource === 'generated'} onClick={event => chooseSource('generated', event.currentTarget)} disabled={!writable}>{t('generated')}</Button>
          <Button variant={avatarSource === 'local' ? 'outline' : 'ghost'} aria-pressed={avatarSource === 'local'} title={t('avatarHint')} onClick={event => chooseSource('local', event.currentTarget)} disabled={!writable}>{t('avatar')}</Button>
          <Button variant={avatarSource === 'account' ? 'outline' : 'ghost'} aria-pressed={avatarSource === 'account'} title={t('accountAvatarHint')} onClick={event => chooseSource('account', event.currentTarget)} disabled={!writable}>{t('accountAvatar')}</Button>
        </div>
      </div>
      {(avatarError || avatarConflict || readingAvatar) && <div className="pdsh-avatar-feedback" data-pdsh-avatar-feedback>
        {readingAvatar && <span role="status" className="pdsh-hint" data-pdsh-avatar-loading>{t('avatarLoading')}</span>}
        {(avatarError || avatarConflict) && <span role="alert" id="pdsh-avatar-error" className="pdsh-error">{t(avatarConflict ? 'avatarConflict' : avatarError)}</span>}
        {avatarRetry && <Button onClick={event => persistAvatar(avatarRetry.value, avatarRetry.base, event.currentTarget)} disabled={!writable || avatarConflict}>{t('retryAvatar')}</Button>}
      </div>}
      <div className="pdsh-detail-row" ref={nicknameRow}>
        <span className="pdsh-label" id="pdsh-nickname-label">{t('nickname')}</span>
        {nicknameDraft !== null ? <div className="pdsh-field pdsh-nickname-editor"><div className="pdsh-inline-editor">
          <Input id="pdsh-nickname" aria-labelledby="pdsh-nickname-label" aria-invalid={nicknameInvalid} aria-describedby={nicknameInvalid || nicknameConflict || nicknameError ? 'pdsh-nickname-error' : undefined} autoFocus value={nicknameDraft} maxLength={MAX_NAME_CHARS} onChange={event => { setNicknameDraft(event.target.value); setNicknameError(''); }} onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Enter') { event.preventDefault(); void confirmNickname(event.currentTarget); }
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelNickname(event.currentTarget); }
          }} disabled={!writable} />
          <Button className="pdsh-nickname-action" variant="ghost" aria-label={t('doneEditing')} title={t('doneEditing')} onClick={event => confirmNickname(event.currentTarget)} disabled={!writable || nicknameInvalid || nicknameConflict || readingAvatar}><IconCheckOutlineRegular /></Button>
        </div>{(nicknameInvalid || nicknameConflict || nicknameError) && <p role="alert" id="pdsh-nickname-error" className="pdsh-error">{t(nicknameInvalid ? 'invalidNickname' : nicknameConflict ? 'nicknameConflict' : nicknameError)}</p>}</div>
          : <div className="pdsh-value-action"><span>{acceptedNickname}</span><Button className="pdsh-nickname-action" variant="ghost" aria-label={`${t('editNickname')}: ${acceptedNickname}`} title={t('editNickname')} onClick={beginNickname} disabled={!writable}><IconEditOutlineRegular /></Button></div>}
      </div>
      <input ref={fileInput} id="pdsh-avatar-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} disabled={!writable} hidden aria-label={t('avatar')} />
      {['signed-out', 'unsupported'].includes(status) && <p role="status" className="pdsh-hint">{t(`status.${status}`)}</p>}
    </section>
  </section>;
}
