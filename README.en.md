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

DeepSeek Harness Desktop plugin · **Version 0.5.6** · [`v0.5.6`](https://github.com/daftAI2026/PDSH/tree/v0.5.6)

Supports macOS and Windows. The screenshot helper ships with the plugin and needs no separate installation.

![Plugin settings and sidebar preview](https://raw.githubusercontent.com/daftAI2026/PDSH/main/docs/preview.jpg)

## Features

- **Title masking:** Use the hat button to toggle gray bars over workspace and session titles.
- **Local identity:** Set a display name, generate or upload an avatar, or use your account avatar. Local identity replacement is off by default. While signed out, you can replace the display identity on the “More” entry while keeping its native menu.
- **Screenshot editing:** Capture the current DSH window, select detected regions or draw redactions manually, then adjust the background and margins before copying or saving. When the sidebar is collapsed, use the camera in the session's top-right corner.
- **Screenshot privacy:** “Private titles” redacts sidebar session titles; “Private identity” redacts the sidebar avatar and nickname. The switches are independent, and toggling either retakes the screenshot. The image and switch update only after a successful retake; both stay unchanged if it fails. The identity override lasts only for the current editing session.
- **Background gallery:** Choose from five presets, add your own images, or fetch up to five system wallpapers. Refreshing system wallpapers preserves saved images.
- **Plugin updates:** Check for stable versions on the details page and confirm installation through the official manager. The plugin does not install silently or restart Desktop itself.

## Installation

In Harness, open **Plugins → Add Plugin → GitHub repository URL** and enter:

```text
https://github.com/daftAI2026/PDSH
```

Choose the fixed version `v0.5.6`. Existing users can confirm an upgrade on the plugin details page.

**Upgrade note:** Versions `0.3.2` and earlier need one normal load during their first upgrade. A running `0.5.0` installation does not support a no-restart upgrade. See [Upgrade Compatibility](PUBLISHING.en.md#upgrade-compatibility).

## Environment and Limits

- Target host: **DeepSeek Harness Desktop 0.2.0-rc.2**. Screenshots are supported on macOS 14+ (Apple Silicon or Intel) and Windows 10 1903+ x64. No separate helper installation is needed. Do not launch the helper or double-click its EXE.
- Choosing an account avatar requires signing in. Signing out temporarily shows a generated avatar; signing in restores the selected avatar source without changing the source setting.
- Switching to manual drawing hides detected regions but keeps existing redactions. Drawing beyond the image keeps only the part inside it. Losing focus or cancelling does not add an unfinished redaction.
- Save as PNG, JPEG, or WebP; copy as PNG. The default directory is `Downloads` under the user's home directory, and you can choose another directory. Duplicate names receive a number; existing files are never overwritten. If the save result is unknown, inspect the directory before retrying.
- macOS fetches up to five representative wallpapers in Apple's local catalog order, without assigning fixed groups to OS versions. Unknown catalog formats or ambiguous material associations do not add materials; saved images remain available. Only an explicit fetch or refresh reads the system source or downloads missing media. Normal browsing can use the cache.
  Windows selects up to five installed default and theme images. It does not read the user's current wallpaper or download from the network. If fewer than five images are available, it shows the actual count. It does not download historical XP or Windows 7 materials.
- Use the plus at the end of “My images” to import an image. Background images and editing preferences use local browser storage. It does not store screenshots, source videos, or original filenames. A full store rejects imports instead of automatically deleting saved images to make room.
- Detected regions reuse the sidebar recognition rules; they do not detect sensitive content. macOS uses the studied full-window layout, while Windows uses native client-area offsets bound to the screenshot. Manual drawing remains available when geometry is unknown or inconsistent.
  Windows preview/export proportions were verified for a representative region; complete pixel alignment and cancellation during active capture remain unverified.
  Physical testing of this version on macOS and native candidate-to-final-PNG alignment remain unverified.
  Pixel consistency across warm switches, dark and opposite Host/OS themes, the English Desktop UI, high DPI, normal Desktop restart persistence, permission revocation, and abnormal exit remain unverified.
  Desktop installation of this version's final stable archive and the fixed-SHA upgrade remain unverified. See the [distribution and acceptance notes](PUBLISHING.en.md#056-release-decision-workbench-settlement-and-gallery). Check the image before copying or saving.
- Visual masking does not change account data, original text, history, logs, or model requests. PDSH does not provide session isolation, credential migration, or forensic privacy guarantees.

## Development

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
