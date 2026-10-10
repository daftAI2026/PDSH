/**
 * [INPUT]: 依赖 Host ConfigForm、账号状态、共用 AvatarImage 与历史面板；shared 校验图像并计算 MRU 轮换。
 * [OUTPUT]: 提供身份设置与无可见提示的可取消读取。旧合同保留换头像；历史就绪才原子轮换。
 * [POS]: PDSH 偏好交互层；账号状态只影响头像预览与来源按钮，不增加登出说明行或改写 Host 接受值。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AvatarHistoryPopover } from './avatar-history-popover.tsx';
import { AvatarImage } from './avatar-image.tsx';
import { Input, Switch, Button, Tooltip, IconUserOutlineMedium, IconEditOutlineRegular, IconCheckOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import { avatarConfigurationMode, isAvatarHistory, rotateAvatarHistory, sameAvatarHistory } from '../shared/avatar-history.ts';
import { DEFAULTS, MAX_AVATAR_CHARS, MAX_NAME_CHARS, NICKNAME_PATTERN, resolvePreferences } from '../shared/model.ts';

function avatarValues(value) {
  // +--- 保留真实字段存在性；默认值不能冒充 Host 已接受的合同 ---+
  return Object.fromEntries(['avatar', 'useAccountAvatar', 'avatarHistory']
    .filter(field => value && Object.hasOwn(value, field)).map(field => [field, value[field]]));
}
function sameAvatar(left, right) {
  const mode = avatarConfigurationMode(left);
  return mode !== 'invalid' && mode === avatarConfigurationMode(right) &&
    left.avatar === right.avatar && left.useAccountAvatar === right.useAccountAvatar &&
    (mode === 'legacy' || sameAvatarHistory(left.avatarHistory, right.avatarHistory));
}
function Hint({ label, children }) {
  return <Tooltip label={label} side="bottom" delayMs={500} focusDelayMs={0} portal>{children}</Tooltip>;
}
function ToggleHeading({ id, label, hint, checked, disabled, pending, error, onChange }) {
  const row = useRef(null);
  return <><div className="pdsh-row pdsh-group-header" ref={row} aria-busy={pending || undefined}>
    <h4 id={id}>{label}</h4>{hint
      ? <Hint label={hint}><span className="pdsh-switch-tooltip"><Switch checked={checked} onChange={() => onChange(row.current?.querySelector('[role="switch"]'))} label={label} disabled={disabled} /></span></Hint>
      : <Switch checked={checked} onChange={() => onChange(row.current?.querySelector('[role="switch"]'))} label={label} disabled={disabled} />}
  </div>{error && <p className="pdsh-error" role="alert">{error}</p>}</>;
}

export function SettingsCard({ view, preferencesForm: form, presentation, t, showTitles = true }) {
  const snapshot = useSyncExternalStore(fn => form.subscribe(fn), () => form.getSnapshot());
  const status = useSyncExternalStore(fn => presentation.subscribe(fn), () => presentation.status());
  const accountStatus = useSyncExternalStore(fn => presentation.subscribe(fn), () => presentation.accountStatus());
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
  if (view === 'summary') return t(showTitles ? 'description' : 'identityDescription');
  const ready = snapshot.status === 'ready';
  const writable = ready && snapshot.writable && mutation === null;
  const acceptedNickname = snapshot.value?.nickname ?? DEFAULTS.nickname;
  const displayedNickname = nicknameDraft ?? acceptedNickname;
  const nicknameInvalid = typeof displayedNickname !== 'string' || displayedNickname.length > MAX_NAME_CHARS || !NICKNAME_PATTERN.test(displayedNickname);
  const nicknameConflict = nicknameDraft !== null && ready && nicknameBase.current !== acceptedNickname;
  const acceptedAvatar = avatarValues(snapshot.value);
  const avatarMode = avatarConfigurationMode(acceptedAvatar);
  const avatarReady = avatarMode === 'history';
  const avatarWritable = writable && avatarMode !== 'invalid';
  const avatarSource = acceptedAvatar.useAccountAvatar ? 'account' : acceptedAvatar.avatar ? 'local' : 'generated';
  const avatarConflict = avatarRetry && !sameAvatar(avatarRetry.base, acceptedAvatar);
  const temporaryGeneratedPreview = avatarSource === 'account' && accountStatus === 'signed-out';
  const previewSource = temporaryGeneratedPreview ? 'generated' : avatarSource;
  const accountAvatarDisabled = !avatarWritable || accountStatus !== 'signed-in';
  const accountAvatarHint = accountStatus === 'signed-out' ? t('accountAvatarSignedOut')
    : accountStatus === 'unsupported' ? t('status.unsupported') : t('accountAvatarHint');
  const previewNickname = nicknameInvalid ? acceptedNickname : displayedNickname;
  let preview;
  try {
    preview = temporaryGeneratedPreview
      ? resolvePreferences({ nickname: previewNickname, avatar: '' }).avatar
      : resolvePreferences({ ...acceptedAvatar, nickname: previewNickname }).avatar;
  } catch { /* 非法Host配置不渲染任意图片。 */ }
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
    if (value.avatar === base.avatar && value.useAccountAvatar === base.useAccountAvatar) return;
    const ops = ['avatar', 'useAccountAvatar'].map(field => ({ op: 'set', path: [field], value: value[field] }));
    // +--- 新能力独立分流；旧 Host 只接收已存在的基础字段 ---+
    if (avatarConfigurationMode(base) === 'history') {
      const avatarHistory = value.avatar === base.avatar ? base.avatarHistory : rotateAvatarHistory(base.avatarHistory, base.avatar, value.avatar);
      if (!sameAvatarHistory(base.avatarHistory, avatarHistory)) ops.push({ op: 'set', path: ['avatarHistory'], value: avatarHistory });
    }
    const accepted = await mutate('avatar', ops, current, origin);
    if (alive.current && !accepted) { setAvatarError('avatarSaveFailed'); setAvatarRetry({ value, base }); }
  }
  function selectHistory(avatar, origin) {
    const current = form.getSnapshot(), base = avatarValues(current.value);
    if (!isAvatarHistory(base.avatarHistory) || !base.avatarHistory.includes(avatar)) return;
    cancelAvatarRead();
    void persistAvatar({ avatar, useAccountAvatar: false }, base, origin);
  }
  async function clearHistory(origin) {
    const current = form.getSnapshot();
    if (pendingMutation.current || current.status !== 'ready' || !current.writable || avatarConfigurationMode(current.value) !== 'history') return;
    cancelAvatarRead(); setAvatarRetry(null); setAvatarError('');
    if (!current.value.avatarHistory.length) return;
    const accepted = await mutate('avatar', [{ op: 'set', path: ['avatarHistory'], value: [] }], current, origin);
    if (alive.current && !accepted) setAvatarError('avatarHistoryClearFailed');
  }
  function chooseSource(source, origin) {
    const current = form.getSnapshot();
    if (pendingMutation.current || current.status !== 'ready' || !current.writable) return;
    if (avatarConfigurationMode(current.value) === 'invalid') return;
    if (source === 'account' && presentation.accountStatus() !== 'signed-in') return;
    cancelAvatarRead(); setAvatarRetry(null); setAvatarError('');
    if (source === 'local') { fileInput.current?.click(); return; }
    const base = avatarValues(current.value);
    void persistAvatar(source === 'account' ? { ...base, useAccountAvatar: true } : { avatar: '', useAccountAvatar: false }, base, origin);
  }
  async function chooseAvatar(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    const current = form.getSnapshot();
    if (!file || pendingMutation.current || current.status !== 'ready' || !current.writable || avatarConfigurationMode(current.value) === 'invalid') return;
    cancelAvatarRead(); const request = ++fileSequence.current, base = avatarValues(current.value);
    setReadingAvatar(true); setAvatarRetry(null); setAvatarError('');
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > MAX_AVATAR_CHARS * 3 / 4) throw new Error('avatar');
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); avatarReader.current = reader;
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('avatar'));
        reader.onerror = reject; reader.onabort = reject; reader.readAsDataURL(file);
      });
      if (!alive.current || request !== fileSequence.current) return;
      avatarReader.current = null; resolvePreferences({ avatar: data });
      const image = new Image(); image.src = data; await image.decode();
      if (alive.current && request === fileSequence.current) await persistAvatar({ avatar: data, useAccountAvatar: false }, base, null);
    } catch { if (alive.current && request === fileSequence.current) setAvatarError('avatarFailed'); }
    finally { if (alive.current && request === fileSequence.current) { avatarReader.current = null; setReadingAvatar(false); } }
  }
  function toggleHeading(field, id, hint = '') {
    return <ToggleHeading id={id} label={t(field)} hint={hint ? t(hint) : undefined} checked={snapshot.value?.[field] ?? DEFAULTS[field]} disabled={!writable || readingAvatar} pending={mutation === field} error={toggleFailure === field ? t('toggleFailed') : ''} onChange={origin => toggle(field, origin)} />;
  }
  return <section className="pdsh-settings" data-pdsh-settings>
    {snapshot.status === 'loading' && <p role="status">{t('loading')}</p>}
    {snapshot.status === 'unavailable' && <p role="status">{t('unavailable')}</p>}
    {ready && !snapshot.writable && <p role="status">{t('readOnly')}</p>}
    {showTitles && <section className="pdsh-group" role="group" aria-labelledby="pdsh-display-title">
      {toggleHeading('maskTitles', 'pdsh-display-title', 'titlesHint')}
    </section>}
    <section className="pdsh-group pdsh-identity-group" role="group" aria-labelledby="pdsh-identity-title">
      {toggleHeading('maskIdentity', 'pdsh-identity-title')}
      <div className="pdsh-identity" aria-label={t('identityPreview')}>
        {previewSource === 'account' && !accountAvatar
          ? <span className="pdsh-avatar-preview pdsh-avatar-fallback" role="img" aria-label={t('accountAvatar')}><IconUserOutlineMedium /></span>
          : preview && <AvatarImage src={previewSource === 'account' ? accountAvatar : preview} alt={t(previewSource === 'account' ? 'accountAvatar' : 'preview')} />}
        <div className="pdsh-copy pdsh-profile-copy"><strong className="pdsh-profile-name">{displayedNickname}</strong></div>
        <div className="pdsh-avatar-actions" role="group" aria-labelledby="pdsh-avatar-source-label" aria-describedby={avatarError || avatarConflict ? 'pdsh-avatar-error' : undefined} aria-busy={readingAvatar || mutation === 'avatar' || undefined}>
          <span className="pdsh-avatar-source-label pdsh-label" id="pdsh-avatar-source-label">{t('avatarLabel')}</span>
          <Button variant={avatarSource === 'generated' ? 'outline' : 'ghost'} aria-pressed={avatarSource === 'generated'} onClick={event => chooseSource('generated', event.currentTarget)} disabled={!avatarWritable}>{t('generated')}</Button>
          <AvatarHistoryPopover history={avatarReady ? acceptedAvatar.avatarHistory.filter(avatar => avatar !== acceptedAvatar.avatar) : []}
            active={avatarSource === 'local'} disabled={!avatarWritable} t={t}
            onChooseNew={origin => chooseSource('local', origin)} onSelect={selectHistory} onClear={clearHistory} />
          <Hint label={accountAvatarHint}><span className="pdsh-avatar-source-tooltip" tabIndex={accountAvatarDisabled ? 0 : undefined}><Button variant={avatarSource === 'account' ? 'outline' : 'ghost'} aria-pressed={avatarSource === 'account'} onClick={event => chooseSource('account', event.currentTarget)} disabled={accountAvatarDisabled}>{t('accountAvatar')}</Button></span></Hint>
        </div>
      </div>
      {ready && avatarMode === 'invalid' && <p role="status" className="pdsh-hint">{t('avatarConfigurationUnavailable')}</p>}
      {(avatarError || avatarConflict) && <div className="pdsh-avatar-feedback" data-pdsh-avatar-feedback>
        {(avatarError || avatarConflict) && <span role="alert" id="pdsh-avatar-error" className="pdsh-error">{t(avatarConflict ? 'avatarConflict' : avatarError)}</span>}
        {avatarRetry && <Button onClick={event => persistAvatar(avatarRetry.value, avatarRetry.base, event.currentTarget)} disabled={!avatarWritable || avatarConflict}>{t('retryAvatar')}</Button>}
      </div>}
      <div className="pdsh-detail-row" ref={nicknameRow}>
        <span className="pdsh-label" id="pdsh-nickname-label">{t('nickname')}</span>
        {nicknameDraft !== null ? <div className="pdsh-field pdsh-nickname-editor"><div className="pdsh-inline-editor">
          <Input id="pdsh-nickname" aria-labelledby="pdsh-nickname-label" aria-invalid={nicknameInvalid} aria-describedby={nicknameInvalid || nicknameConflict || nicknameError ? 'pdsh-nickname-error' : undefined} autoFocus value={nicknameDraft} maxLength={MAX_NAME_CHARS} onChange={event => { setNicknameDraft(event.target.value); setNicknameError(''); }} onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Enter') { event.preventDefault(); void confirmNickname(event.currentTarget); }
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancelNickname(event.currentTarget); }
          }} disabled={!writable} />
          <Hint label={t('doneEditing')}><Button className="pdsh-nickname-action" variant="ghost" aria-label={t('doneEditing')} onClick={event => confirmNickname(event.currentTarget)} disabled={!writable || nicknameInvalid || nicknameConflict || readingAvatar}><IconCheckOutlineRegular /></Button></Hint>
        </div>{(nicknameInvalid || nicknameConflict || nicknameError) && <p role="alert" id="pdsh-nickname-error" className="pdsh-error">{t(nicknameInvalid ? 'invalidNickname' : nicknameConflict ? 'nicknameConflict' : nicknameError)}</p>}</div>
          : <div className="pdsh-value-action"><span>{acceptedNickname}</span><Hint label={t('editNickname')}><Button className="pdsh-nickname-action" variant="ghost" aria-label={`${t('editNickname')}: ${acceptedNickname}`} onClick={beginNickname} disabled={!writable}><IconEditOutlineRegular /></Button></Hint></div>}
      </div>
      <input ref={fileInput} id="pdsh-avatar-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseAvatar} disabled={!avatarWritable} hidden aria-label={t('avatar')} />
      {status === 'unsupported' && <p role="status" className="pdsh-hint">{t('status.unsupported')}</p>}
    </section>
  </section>;
}
