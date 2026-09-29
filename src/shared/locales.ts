/**
 * [INPUT]: 依赖宿主 locale 命名空间字典协议；不读取或持久化独立语言偏好。
 * [OUTPUT]: 提供 pdsh 的 NS 与齐全 zh/en 运行文案，供框架 t 和原生 DOM 入口翻译。
 * [POS]: PDSH 文案归属层；界面语言由 Harness 拥有，包展示元信息由 locale/*.json 离线提供。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export const NS = 'pdsh';
export const dictionaries = {
  zh: {
    entry: '遮挡侧栏标题', entryOn: '显示侧栏标题', toggleFailed: '未能保存切换，请重试',
    languageHint: '界面语言跟随 Harness。可在“设置 → 通用设置 → 语言”切换中文 / English。',
    titlesHint: '工作区与会话名称',
    identityPreview: '显示身份摘要', editNickname: '编辑显示昵称', doneEditing: '保存昵称',
    avatarLabel: '头像来源', accountAvatar: '账号头像', accountAvatarHint: '保留账号原始头像，包括宿主默认头像；显示昵称仍可独立修改。原始头像可能暴露你的身份。',
    nicknameSaveFailed: '昵称未能保存，点击勾重试。', nicknameConflict: '昵称已在别处更新，按 Esc 撤回后重新编辑。',
    avatarSaveFailed: '头像未能保存，原头像保持不变。', avatarConflict: '头像已在别处更新，请重新选择。', retryAvatar: '重试',
    title: 'DSH 私密模式设置', description: '遮挡侧栏标题，自定义显示昵称与头像。仅改变本地显示。',
    maskTitles: '遮挡侧栏标题', maskIdentity: '替换侧栏身份', nickname: '显示昵称', avatar: '选择图片',
    avatarHint: '默认按昵称离线生成头像。也可选 PNG / JPEG / WebP；不会上传图片或请求头像服务。',
    generated: '按昵称生成', preview: '显示头像预览',
    loading: '正在读取插件设置…', unavailable: '当前连接无法编辑插件设置。', readOnly: '当前设置只读。', avatarLoading: '正在读取头像…',
    avatarFailed: '头像格式、内容或大小不合法，请选择较小的 PNG / JPEG / WebP 图片。',
    invalidNickname: '昵称不能为空、过长或含控制字符。',
    'status.signed-out': '当前未登录，保留原生“更多”入口；登录后才替换显示身份。',
    'status.unsupported': '未识别唯一的原生侧栏身份，本次不替换。',
    updateTitle: '插件更新', installSourceHint: '从 GitHub 的固定提交安装；若当前不是 GitHub 来源，将切换来源。不会自动重启。',
    checkUpdate: '检查更新', installUpdate: '安装版本',
    'update.checking': '正在检查版本…', 'update.current': '已是最新版本。', 'update.available': '有新版本可安装。',
    'update.installing': '正在通过宿主安装…', 'update.installed': '宿主已应用版本', 'update.restart': '安装完成；请在合适时机重启 Harness，启用版本',
    'update.checkFailed': '检查更新失败，请稍后重试。', 'update.installFailed': '安装结果未确认；请在官方插件页核对状态后重试。',
  },
  en: {
    entry: 'Mask sidebar titles', entryOn: 'Show sidebar titles', toggleFailed: 'Toggle was not saved. Try again',
    languageHint: 'Language follows Harness. Switch in Settings → General → Language: 中文 / English.',
    titlesHint: 'Workspace and session names',
    identityPreview: 'Display identity summary', editNickname: 'Edit display nickname', doneEditing: 'Save nickname',
    avatarLabel: 'Avatar source', accountAvatar: 'Account avatar', accountAvatarHint: 'Keep the native account picture, including its default icon. Display nickname remains independent. Your original picture may identify you.',
    nicknameSaveFailed: 'Nickname was not saved. Click the check to retry.', nicknameConflict: 'Nickname changed elsewhere. Press Esc, then edit again.',
    avatarSaveFailed: 'Avatar was not saved. Your previous avatar is unchanged.', avatarConflict: 'Avatar changed elsewhere. Choose again.', retryAvatar: 'Retry',
    title: 'DSH Private Mode settings', description: 'Mask sidebar titles and customize your display nickname and avatar. Local display only.',
    maskTitles: 'Mask sidebar titles', maskIdentity: 'Replace sidebar identity', nickname: 'Display nickname', avatar: 'Choose image',
    avatarHint: 'An offline avatar is generated from the nickname. Or choose PNG / JPEG / WebP. No uploads or avatar-service requests.',
    generated: 'Generate', preview: 'Display avatar preview',
    loading: 'Loading plugin settings…', unavailable: 'Plugin settings cannot be edited in this connection.', readOnly: 'Settings are read-only.', avatarLoading: 'Reading avatar…',
    avatarFailed: 'Invalid or oversized avatar. Choose a smaller PNG / JPEG / WebP image.',
    invalidNickname: 'Nickname must be non-empty, within the length limit and control-free.',
    'status.signed-out': 'Signed out: the native More control stays unchanged. Identity replacement applies after sign-in.',
    'status.unsupported': 'No unique native sidebar identity recognized; replacement skipped.',
    updateTitle: 'Plugin updates', installSourceHint: 'Install a pinned GitHub commit. This changes non-GitHub install sources. No automatic restart.',
    checkUpdate: 'Check for updates', installUpdate: 'Install version',
    'update.checking': 'Checking versions…', 'update.current': 'Already up to date.', 'update.available': 'A newer version is available.',
    'update.installing': 'Installing through the host…', 'update.installed': 'The host applied version', 'update.restart': 'Installed; restart Harness when convenient to activate version',
    'update.checkFailed': 'Could not check for updates. Try again later.', 'update.installFailed': 'Installation was not confirmed. Verify the official Plugins page before retrying.',
  },
};
