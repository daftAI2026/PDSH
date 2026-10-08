<!--
[INPUT]: 依赖产品边界、双语发布说明、公开简介和用户授权展示图
[OUTPUT]: 提供完整英文产品入口并互链中文版。保留用户动作、兼容提醒和头像致谢。
[POS]: PDSH 英文公开入口；与中文版共享事实，不将设置页展示图当作实机验收
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->
# DSH Private Mode

English · [简体中文](README.md)

<!-- pdsh:description:start -->
Mask sidebar titles, customize display aliases, and capture and redact this window. No session isolation.
<!-- pdsh:description:end -->

DeepSeek Harness Desktop plugin · **Version 0.5.4** · [`v0.5.4`](https://github.com/daftAI2026/PDSH/tree/v0.5.4)

![Plugin settings and sidebar preview](https://raw.githubusercontent.com/daftAI2026/PDSH/main/docs/preview.jpg)

## Features

- **Title masking:** Toggle gray bars over workspace and session titles with the hat button.
- **Local identity:** Set a display name, generate or upload an avatar, or keep the account avatar.
- **Screenshot editing:** Capture the current DSH window. Redact suggested regions or draw manually, adjust the background and margins, then copy or save the image. Switching to manual drawing hides suggestions but keeps existing redactions. When the sidebar is collapsed, use the camera in the top-right corner of the session to open the workbench.
- **Background gallery:** Keep five presets, cached system stills, and uploaded images. On macOS, explicitly fetch representative wallpapers from the latest two system generations.
- **Plugin updates:** Check for stable versions on the plugin details page. Confirm installation through the official manager. PDSH does not install silently or restart Desktop itself.

## Installation

In Harness, open **Plugins → Add Plugin → GitHub repository URL** and enter:

```text
https://github.com/daftAI2026/PDSH
```

Choose the fixed version `v0.5.4`. Existing users can confirm an upgrade on the plugin details page.

**Upgrade note:** Versions `0.3.2` and earlier need one normal load during their first upgrade. A running `0.5.0` installation does not support a no-restart upgrade to the repaired payload. See [Upgrade Compatibility](PUBLISHING.en.md#upgrade-compatibility).

## Environment and Limits

- Target host: **DeepSeek Harness Desktop 0.2.0-rc.2**. Screenshot targets are macOS 14+ (Apple Silicon or Intel) and Windows 10 1903+ x64. The helper ships in the package; do not install or launch it separately.
- Save as PNG, JPEG, or WebP; copy as PNG. The default directory is `Downloads` under the user's home directory. Users can choose another directory. Duplicate names receive a number; existing files are never overwritten. If the save result is unknown, inspect the directory before retrying.
- System wallpaper retrieval uses Apple's local catalog. Its grouping is not a system-version API. Unknown or ambiguous formats do not add replacements; saved images remain available. Only an explicit fetch reads the system source or downloads missing media. Normal browsing can use the cache. In stable v0.5.4, Windows does not provide system wallpaper retrieval.
- Background media and editing preferences use a local browser store. It does not store screenshots, source videos, or original filenames. A full store rejects imports instead of silently evicting user images.
- Suggestions apply only to the studied Mac full-window layout. They do not detect sensitive content. Native candidate-to-final-PNG alignment and complete Desktop rendering remain unverified. Warm-switch pixel consistency, dark themes, and the English Desktop UI also remain unverified. Windows cancellation during active capture and complete pixel alignment remain unverified. Check the image before copying or saving.
- Visual masking does not change account data, original text, history, logs, or model requests. PDSH does not provide session isolation, credential migration, or forensic privacy guarantees.

## Development

The unreleased source supports replacing the signed-out “More” display with a local identity. This is off by default, and the host still owns the menu. The account avatar is unavailable while signed out. Signing out temporarily shows a generated avatar; signing in restores the selected account source.

The replacement identity matches the host's signed-in avatar and layout. The detail heading trims font whitespace; the version badge keeps the host's typography. The workbench title is “Edit screenshot”, and the system material group uses “System wallpapers”.

The unreleased source adds Windows x64 system wallpapers. It selects up to five installed default and theme images; if fewer are available, it shows the actual count. It does not read the user's current wallpaper or download from the network. macOS keeps its existing four-image selection rule. The workbench's “Private titles” redacts sidebar session titles, while “Private identity” redacts the sidebar avatar and nickname. The switches are independent. Toggling either retakes the image and updates the image and switch only on success; failure keeps the existing image. The identity override lasts for the current editing session.

Windows suggestions use the same recognizer and map to the PNG using native client-area offsets bound to that image. Unknown or inconsistent geometry keeps manual drawing available. This source capability has not passed final RC Desktop acceptance.

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm run bundle
```

[Architecture and collaboration](AGENTS.md) · [Distribution and acceptance](PUBLISHING.en.md) · [Style sources](style-sources.json)

## Acknowledgements

The default avatar is generated locally by [blobatar](https://github.com/Alain00/blobatar), under the MIT License. See [Third-Party Notices](THIRD_PARTY_NOTICES.md) for the full license.

## License

[MIT](LICENSE) · [Third-Party Notices](THIRD_PARTY_NOTICES.md). This is not an official DeepSeek plugin. `@daftai/pdsh` is not published to npm.
