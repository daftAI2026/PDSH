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
    displayGroup: '侧栏隐私', identityGroup: '显示身份', titlesHint: '工作区与会话名称',
    identityHint: '仅替换当前侧栏的昵称和头像，不修改真实账户。',
    identityPreview: '显示身份摘要', identityPreviewHint: '本地显示身份，保存后应用', changeAvatar: '更换头像', editNickname: '编辑显示昵称', doneEditing: '完成编辑',
    'source.generated': '按昵称生成', 'source.local': '本地图片', 'source.account': '账号原始头像',
    avatarLabel: '头像来源', accountAvatar: '使用账号头像', accountAvatarHint: '保留账号原始头像，包括宿主默认头像；显示昵称仍可独立修改。原始头像可能暴露你的身份。',
    unsaved: '有未保存的修改', savedHint: '修改后点击保存，才会应用到当前窗口。',
    title: 'DSH 私密模式设置', description: '遮挡侧栏标题，自定义显示昵称与头像。仅改变本地显示。',
    maskTitles: '遮挡侧栏标题', maskIdentity: '替换侧栏显示身份', nickname: '显示昵称', avatar: '选择本地头像',
    avatarHint: '默认按昵称离线生成头像。也可选 PNG / JPEG / WebP；不会上传图片或请求头像服务。',
    generated: '按昵称生成', preview: '显示头像预览', save: '保存', saving: '保存中…', discard: '放弃修改',
    loading: '正在读取插件设置…', unavailable: '当前连接无法编辑插件设置。', readOnly: '当前设置只读。', avatarLoading: '正在读取头像…',
    saveFailed: '保存失败，草稿已保留，可重试。', saveConflict: '设置已在别处更新。草稿保留，可放弃草稿后使用最新设置。', reloadDiscard: '放弃草稿，使用最新设置',
    avatarFailed: '头像格式、内容或大小不合法，请选择较小的 PNG / JPEG / WebP 图片。', invalid: '昵称不能空白、过长或包含控制字符；头像必须是本地光栅图片。',
    invalidNickname: '昵称不能为空、过长或含控制字符。',
    'status.disabled': '显示身份替换未启用。', 'status.masked': '当前侧栏身份已替换显示。',
    'status.signed-out': '当前未登录，保留原生“更多”入口；登录后才替换显示身份。',
    'status.unsupported': '未识别唯一的原生侧栏身份，本次不替换。',
  },
  en: {
    entry: 'Mask sidebar titles', entryOn: 'Show sidebar titles', toggleFailed: 'Toggle was not saved. Try again',
    languageHint: 'Language follows Harness. Switch in Settings → General → Language: 中文 / English.',
    displayGroup: 'Sidebar privacy', identityGroup: 'Display identity', titlesHint: 'Workspace and session names',
    identityHint: 'Replace the local sidebar nickname and avatar only. Your account remains unchanged.',
    identityPreview: 'Display identity summary', identityPreviewHint: 'Local display identity, applied after saving', changeAvatar: 'Change avatar', editNickname: 'Edit display nickname', doneEditing: 'Done editing',
    'source.generated': 'Generated from nickname', 'source.local': 'Local image', 'source.account': 'Original account avatar',
    avatarLabel: 'Avatar source', accountAvatar: 'Use account avatar', accountAvatarHint: 'Keep the native account picture, including its default icon. Display nickname remains independent. Your original picture may identify you.',
    unsaved: 'Unsaved changes', savedHint: 'Save your changes to apply them to the current window.',
    title: 'DSH Private Mode settings', description: 'Mask sidebar titles and customize your display nickname and avatar. Local display only.',
    maskTitles: 'Mask sidebar titles', maskIdentity: 'Replace sidebar display identity', nickname: 'Display nickname', avatar: 'Choose a local avatar',
    avatarHint: 'An offline avatar is generated from the nickname. Or choose PNG / JPEG / WebP. No uploads or avatar-service requests.',
    generated: 'Generate from nickname', preview: 'Display avatar preview', save: 'Save', saving: 'Saving…', discard: 'Discard changes',
    loading: 'Loading plugin settings…', unavailable: 'Plugin settings cannot be edited in this connection.', readOnly: 'Settings are read-only.', avatarLoading: 'Reading avatar…',
    saveFailed: 'Save failed. Your draft is kept; you can retry.', saveConflict: 'Settings changed elsewhere. Your draft is kept; discard it to use the latest settings.', reloadDiscard: 'Discard draft and use latest',
    avatarFailed: 'Invalid or oversized avatar. Choose a smaller PNG / JPEG / WebP image.', invalid: 'Nickname must be non-empty, bounded and control-free. Avatar must be a local raster image.',
    invalidNickname: 'Nickname must be non-empty, within the length limit and control-free.',
    'status.disabled': 'Display identity replacement is disabled.', 'status.masked': 'Sidebar identity display is replaced.',
    'status.signed-out': 'Signed out: the native More control stays unchanged. Identity replacement applies after sign-in.',
    'status.unsupported': 'No unique native sidebar identity recognized; replacement skipped.',
  },
};
