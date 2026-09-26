# PDSH Agent Guide

This is the shared source of truth for agents working on PDSH. `CLAUDE.md` is a symlink to this file, following the InCodex project convention. PDSH does not use a new GEB document tree; keep project guidance here and put research evidence in the private `daftAI-project-docs/pdsh/` repository.

## Project

Public code repository: `https://github.com/daftAI2026/PDSH` (uppercase repository name). The npm package identifier remains lowercase `@daftai/pdsh`; it is not published to npm.

PDSH is the DeepSeek Harness Desktop adaptation of InCodex's presentation and eventual incognito experience. The official Harness app is the host; PDSH is an out-of-tree Cordis plugin bundle. The current **display-only MVP** outlines user/assistant messages and offers a configurable local sidebar nickname/avatar. It does not isolate sessions, open another DeepSeek instance, transfer credentials, erase history, or provide a privacy guarantee.

The InCodex repository at `../incodex` is the reference for product behavior and safety invariants, not a template to copy wholesale. Its `AGENTS.md` was used as the starting convention for this guide; Codex-specific commands and assumptions do not apply here.

## Product direction

- Keep the official DeepSeek Harness app and normal launch path. Prefer its documented plugin interfaces; do not patch or re-sign the app for the standard PDSH installation.
- For this milestone, stay in the existing window. No CLI product, second app instance, screenshot editor, or session/burn module is needed.
- Use the official Plugins page for settings and the Host settings document for persistence. Save draft fields atomically; do not persist credentials or real account data.
- Trace every visual rule to the upstream file, selector and variable in `style-sources.json`. Use semantic `--dsw-*` colors/radii, native React primitives, and runtime-computed native stroke geometry. No numeric color/geometry fallback or copied CSS Modules hash.
- Identity replacement is only a visual overlay on a uniquely recognized rc.2 sidebar launcher. Keep its native button, account nodes, menus and sign-in/out semantics. Do not mask signed-out More, full settings, account data, model payloads or logs. Unknown/multiple identities skip replacement; this is not a fail-closed privacy system.
- Aim for an incognito entry in the existing sidebar extension area. The exact search-icon-adjacent location has no supported child slot in the tested build; do not claim it does.
- Prove an isolated DSH home **and** Electron user-data root before claiming a private window. The app has a single-instance lock; a second independent instance is a hypothesis until tested against the exact build.
- Never modify or delete the user's primary `~/.dsh` profile, sessions, credentials, or Chromium data while prototyping isolation.
- Do not claim forensic privacy. Define which histories, requests, tool outputs, logs, and files the privacy contract covers, then test those paths separately.

## Reuse boundary

Preserve the behavior and tested invariants from InCodex: private session directories, exclusive creation, symlink and path-escape rejection, owner/PID identity checks, uncertain-state retention, close-time cleanup, icon assets, localized copy, and the relevant regression tests. Reuse one Host-language implementation after the Harness lifecycle is known; do not port both Rust and Electron copies by default.

Do **not** import InCodex's `CODEX_HOME`, Codex `auth.json`/`config.toml`, ChatGPT bundle paths, ASAR patching/signing, Codex DOM selectors, IPC channels, or profile-masking assumptions. DeepSeek account state and configuration require their own explicit, reviewed adapter.

## Repository map

- `README.md`: public installation inputs, compatibility and display-only limitations.
- `PUBLISHING.md`: npm release gates; keep private=true until a deliberate release, then prefer a next channel and OIDC.
- `LICENSE`: MIT license for PDSH; dependency notices remain separate.
- `AGENTS.md`: this project contract; follows InCodex's single-guide convention.
- `CLAUDE.md`: symlink to `AGENTS.md`, not a second document.
- `package.json`: official installable `dsh.bundle` / `dsh.client` manifest, exact dependencies and build/test scripts.
- `cordis.patch.yml`: the bundle's single Cordis insertion layer.
- `index.js`: Host Config schema with volatile display fields; delegates persistence to Harness settings.
- `model.js`: shared display defaults, nickname/data-URL validation and pinned offline Blobatar generation.
- `client-entry.jsx`: Client lifecycle, native Input style probe, configuration projection and `plugins.bundle.config` registration; all display resources follow the Host namespace via `whileServed`.
- `settings-card.jsx`: staged settings form with atomic revision-fenced save; local avatar selection never uploads.
- `presentation.js`: current-build DOM adapter and owned-marker cleanup; does not overwrite original account text/images.
- `styles.css` / `style-sources.json`: minimal presentation rules and the upstream source trail for every rule.
- `build.mjs`: builds `client.js` / `client.js.map` in the official lazy-CJS module-loader format. React/primitives stay host externals. Commit these prebuilt artifacts for Git/local-directory installs; no install-time prepare/postinstall scripts.
- `*.test.js`: model, Host validation and actual DOM-selector/lifecycle contract tests. Add a failing test before changing behavior.
- `pnpm-lock.yaml`: reproducible dependency graph. `output/` and `node_modules/` are generated and ignored.
- `THIRD_PARTY_NOTICES.md`: bundled Blobatar's license notice; ships with the installable archive.

No additional module directory exists yet. Add one only when a verified boundary needs it; do not create a full InCodex-style CLI/install/signing tree up front.

## Workflow and safety

1. For plugin mechanics, read the [official first-plugin guide](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/) and [bundle/install guide](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish) for the target version. `dsh plugin add` installs a bundle; it is not a project generator.
2. Develop against a disposable profile first. Do not install this scaffold into the user's live `desktop` profile merely to smoke-test packaging.
3. Start behavior changes with a failing contract test; then implement and verify the exact Desktop build. A successful package archive does not prove a working UI contribution or isolation.
4. Keep `apply` lifecycle-managed. When adding subscriptions, windows, timers, or IPC, register disposal and test unload/restore. Fail closed on ambiguous ownership before cleanup.
5. Treat each external plugin as trusted executable code; inspect the bundle and explicit dependencies before installing. Never silently copy credentials into a temporary profile.
6. Ordinary private research and decisions belong in the private docs repo, published with its `private-docs-publish` skill and repository write lock. Do not place private user data here.

## Current milestone

The requested slice is same-window message outlines plus local identity display settings. Validate the exact installed runtime with a disposable profile; record which checks are real Host/UI, DOM fixtures, or still unverified. `pnpm test`, `pnpm build`, and `pnpm run bundle` are the local checks. Do not install into the live Desktop profile implicitly. Isolated sessions and InCodex session/owner/burn remain future work requiring separate proofs.
