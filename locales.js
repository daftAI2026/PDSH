/**
 * [INPUT]: 依赖宿主 locale 命名空间字典协议；不读取或持久化独立语言偏好。
 * [OUTPUT]: 提供 pdsh 的 NS 与齐全 zh/en 运行文案，供框架 t 和原生 DOM 入口翻译。
 * [POS]: PDSH 文案归属层；界面语言由 Harness 拥有，包展示元信息由 locale/*.json 离线提供。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
export const NS = 'pdsh';
export const dictionaries = {
  zh: {
    entry: 'PDSH 显示设置（不隔离会话）',
    languageHint: '界面语言跟随 Harness。可在“设置 → 通用设置 → 语言”切换中文 / English。',
    displayGroup: '对话显示', identityGroup: '显示身份', framesHint: '使用宿主灰色边线区分用户与助手消息。',
    identityHint: '仅替换当前侧栏的昵称和头像，不修改真实账户。', previewNote: '显示身份预览，保存后应用',
    avatarLabel: '头像',
    unsaved: '有未保存的修改', savedHint: '修改后点击保存，才会应用到当前窗口。',
    title: 'PDSH 显示设置', description: '给每条用户/助手消息加灰框，并可替换侧栏昵称和头像。仅改变本地显示：不隔离、不删除历史，也不修改真实账户。',
    frames: '对话灰框', maskIdentity: '替换侧栏显示身份', nickname: '显示昵称', avatar: '选择本地头像',
    avatarHint: '默认按昵称离线生成头像。也可选 PNG / JPEG / WebP；不会上传图片或请求头像服务。',
    generated: '恢复生成头像', preview: '显示头像预览', save: '保存', saving: '保存中…', discard: '放弃修改',
    loading: '正在读取插件设置…', readOnly: '当前设置只读。', saveFailed: '保存失败或设置已被其他编辑更新；草稿保留，请重新读取后重试。',
    avatarFailed: '头像格式、内容或大小不合法，请选择较小的 PNG / JPEG / WebP 图片。', invalid: '昵称不能空白、过长或包含控制字符；头像必须是本地光栅图片。',
    'status.disabled': '显示身份替换未启用。', 'status.masked': '当前侧栏身份已替换显示。',
    'status.signed-out': '当前未登录，保留原生“更多”入口；登录后才替换显示身份。',
    'status.unsupported': '未识别唯一的原生侧栏身份，本次不替换。',
  },
  en: {
    entry: 'PDSH display settings (no session isolation)',
    languageHint: 'Language follows Harness. Switch in Settings → General → Language: 中文 / English.',
    displayGroup: 'Conversation display', identityGroup: 'Display identity', framesHint: 'Separate user and assistant messages using the host border style.',
    identityHint: 'Replace the local sidebar nickname and avatar only. Your account remains unchanged.', previewNote: 'Display preview, applied after saving',
    avatarLabel: 'Avatar',
    unsaved: 'Unsaved changes', savedHint: 'Save your changes to apply them to the current window.',
    title: 'PDSH display settings', description: 'Outline user/assistant messages and optionally replace the sidebar nickname and avatar. Local display only: no isolation, history deletion or account changes.',
    frames: 'Message outlines', maskIdentity: 'Replace sidebar display identity', nickname: 'Display nickname', avatar: 'Choose a local avatar',
    avatarHint: 'An offline avatar is generated from the nickname. Or choose PNG / JPEG / WebP. No uploads or avatar-service requests.',
    generated: 'Use generated avatar', preview: 'Display avatar preview', save: 'Save', saving: 'Saving…', discard: 'Discard changes',
    loading: 'Loading plugin settings…', readOnly: 'Settings are read-only.', saveFailed: 'Save failed or another editor changed the revision. Draft retained; reload before retrying.',
    avatarFailed: 'Invalid or oversized avatar. Choose a smaller PNG / JPEG / WebP image.', invalid: 'Nickname must be non-empty, bounded and control-free. Avatar must be a local raster image.',
    'status.disabled': 'Display identity replacement is disabled.', 'status.masked': 'Sidebar identity display is replaced.',
    'status.signed-out': 'Signed out: the native More control stays unchanged. Identity replacement applies after sign-in.',
    'status.unsupported': 'No unique native sidebar identity recognized; replacement skipped.',
  },
};
