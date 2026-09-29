# PDSH Agent Guide

This is the project constitution for PDSH; root `CLAUDE.md` links here. Module `CLAUDE.md` files map the TypeScript source and tests. Private research evidence belongs in the private `daftAI-project-docs/pdsh/` repository.

## Project

Public code repository: `https://github.com/daftAI2026/PDSH` (uppercase repository name). The npm package identifier remains lowercase `@daftai/pdsh`; it is not published to npm.

PDSH means Private DeepSeek Harness; public display names are `DSH 私密模式` / `DSH Private Mode`. The brand does not imply that isolation is implemented.

PDSH is the DeepSeek Harness Desktop adaptation of InCodex's presentation and eventual incognito experience. The official Harness app is the host; PDSH is an out-of-tree Cordis plugin bundle. The **0.2.1 development candidate** replaces 0.2.0's OS capture route with renderer-local whole-viewport DOM rasterization while retaining the editor and makes the update affordance a thinner, semantic-success-color arrow. Source labels stay beside the nickname; the nickname row owns symmetric bottom-area padding. Capture and workbench failures are distinct, and generic failure must not infer Screen Recording denial. Full installed Desktop workbench acceptance remains outstanding and must not be claimed from the tag alone. PDSH does not isolate sessions, open another DeepSeek instance, transfer credentials, erase history, or provide a privacy guarantee.

The InCodex repository at `../incodex` is the reference for product behavior and safety invariants, not a template to copy wholesale. Its `AGENTS.md` was used as the starting convention for this guide; Codex-specific commands and assumptions do not apply here.

## Product direction

- Keep the official DeepSeek Harness app and normal launch path. Prefer its documented plugin interfaces; do not patch or re-sign the app for the standard PDSH installation.
- Stay in the existing window. A screenshot workbench is now in scope; no CLI product, second app instance or session/burn module is needed.
- UI language follows Harness Settings → General → Language through `ctx.locale`; metadata comes from exported `locale/*.json`. Never translate the user's configured nickname or add a second language store.
- Use the official Plugins page for settings and the Host settings document for persistence. Switches and avatar source actions persist immediately; nickname owns a local draft committed by check/Enter; avatar/source always persist atomically; do not persist credentials or real account data.
- Trace every visual rule to the upstream file, selector and variable in `style-sources.json`. Use semantic `--dsw-*` colors/radii, native React primitives, and runtime-computed native stroke geometry. No numeric color/geometry fallback or copied CSS Modules hash.
- The avatar-source control has a visible label. React settings and update controls use Host `Tooltip` with the Desktop icon parameters; the DOM-only sidebar/workbench controls use one disposable adapter with the same delay, placement, gap and theme tokens. Do not fall back to browser `title` bubbles.
- Identity replacement is only a visual overlay (or preserve the native account avatar when explicitly selected) on a uniquely recognized rc.2 sidebar launcher. Keep its native button, account nodes, menus and sign-in/out semantics. Do not mask signed-out More, full settings, account data, model payloads or logs. Unknown/multiple identities skip replacement; this is not a fail-closed privacy system.
- The hat entry toggles accepted Host `maskTitles` directly, without a menu or settings navigation. The exact search-icon-adjacent location has no supported child slot; do not claim it does. Settings stay in the official Plugins page. Retire legacy `frames`; do not reinterpret old values as title masking.
- The camera snapshots the entire currently visible DSH page in its existing renderer, including the sidebar in its current fold state, before opening the local editor. DOM-to-Canvas is not Electron compositor capture and does not include native macOS chrome; radius and shadow are editor additions as in the reference experiment. No Screen Recording, CDP startup parameter, Host pixel route or native helper is used. Visible embedded iframe/webview/video content is currently rejected instead of silently omitted; resource errors and unstable viewport geometry reject the snapshot. Screenshot pixels never become settings data.
- The workbench UI inherits DSH semantic `--dsw-*` theme, typography, radius, shadow and motion tokens. Editor-produced gradients, wallpaper pixels, color spectrum and transparency checkerboard are content, not theme chrome. No inherited Codex theme classes or numeric fallback theme colors; trace DSH tokens to `style-sources.json`.
- Prove an isolated DSH home **and** Electron user-data root before claiming a private window. The app has a single-instance lock; a second independent instance is a hypothesis until tested against the exact build.
- Never modify or delete the user's primary `~/.dsh` profile, sessions, credentials, or Chromium data while prototyping isolation.
- Do not claim forensic privacy. Define which histories, requests, tool outputs, logs, and files the privacy contract covers, then test those paths separately.

## Reuse boundary

Preserve the behavior and tested invariants from InCodex: private session directories, exclusive creation, symlink and path-escape rejection, owner/PID identity checks, uncertain-state retention, close-time cleanup, icon assets, localized copy, and the relevant regression tests. Reuse one Host-language implementation after the Harness lifecycle is known; do not port both Rust and Electron copies by default.

Do **not** import InCodex's `CODEX_HOME`, Codex `auth.json`/`config.toml`, ChatGPT bundle paths, ASAR patching/signing, Codex DOM selectors, IPC channels, or profile-masking assumptions. DeepSeek account state and configuration require their own explicit, reviewed adapter.

## Repository map

- `src/host/`: Cordis configuration and official settings wiring; `build.ts` emits root `index.js`.
- `src/shared/`: validated display preferences and Host-language dictionaries shared by both runtimes.
- `src/client/`: TypeScript React settings, detail-badge updater, lifecycle assembly, sidebar adapters, capture workbench, CSS and artwork. `build.ts` emits root `client.js` and map in lazy-CJS format.
- `tests/`: TypeScript contracts for configuration, DOM recognition, lifecycle, settings, localization, style provenance and generated entries.
- `locale/`: exported zh/en package metadata, available even when disabled.
- `README.md`: public product contract and installation; `PUBLISHING.md`: channel/release gates; `style-sources.json`: upstream visual rule provenance.
- `check-release.ts`: rejects tag/version/generated-artifact drift and dirty release trees; `package.json.version` is the sole authored version.
- `package.json`/`pnpm-lock.yaml`: bundle manifest and reproducible dependencies; `cordis.patch.yml`: the sole Cordis insertion layer.
- `build.ts`/`tsconfig.json`: TypeScript-to-Host build and source typecheck; runtime JavaScript is generated, not separately authored.
- `plugin-icon.svg`: generated manifest artwork; `THIRD_PARTY_NOTICES.md` and `LICENSE`: distribution notices.
- `AGENTS.md`/root `CLAUDE.md`: one project constitution; module `CLAUDE.md` files are navigational maps, not competing policy sources.
- `output/` and `node_modules/` are generated/ignored. Generated runtime JavaScript is committed for Git/local installs; hand-authored behavior stays in TypeScript.

## Component composition

- Distinguish three boundaries: an installable bundle, a Cordis runtime plugin entry, and a React component. The plugin page's component count describes runtime entries, not the number of React components or features in the bundle.
- Keep the current single bundle/Host entry. `src/host/index.ts` owns the configuration contract, `src/shared/model.ts` owns pure validation, `src/client/client-entry.tsx` owns assembly and resource lifetime, `settings-card.tsx` owns field-local editing and immediate mutations, `presentation.ts` owns the account DOM adapter, `sidebar-redaction.ts` owns title markers, and `title-toggle.ts` owns the hat mutation. No message outlines remain.
- `src/client/update-badge.tsx` uses the supported `plugins.detail.badge` slot immediately after the Host version tag; only the own Bundle starts a network probe when its detail page mounts. No update card, manual check button or background polling remains. `updater.ts` owns check/install state and `update-source.ts` is its only public GitHub HTTP boundary. Installation requires a second explicit action, pins a SHA through the official Host manager, never auto-restarts, and states source migration on expansion. Do not add a second installer or write update state into preferences.
- `src/client/capture/controller.ts` is the camera effect boundary; `src/client/capture/viewport.ts` alone acquires the visible page canvas and `src/client/capture/editor.ts` alone coordinates editing. The camera sits right of the hat, inherits native search geometry and whole-SVG opacity, hides during search expansion and disposes with the Bundle. Only non-sensitive workbench preferences are stored locally; no screenshot pixels in configuration or logs.
- Split a UI component when it owns meaningful rendering or interaction; split a controller when it owns an independent effect and disposer. Do not create a Cordis plugin per button, a second settings store, or speculative service/provider packages. Use separate runtime entries only for independently enabled capabilities or actual service dependencies.
- The search-adjacent entry is a version-specific DOM adapter, not a supported child slot. It remains separate from account presentation and toggles one Host `maskTitles` path with pending/read-only guards. Preserve native search, copy only its live style class/geometry, place hat then camera immediately left of search using owned auto spacing and a visibility-scoped adjacent slot margin rule, hide added controls during expanded search, and skip unknown/ambiguous structures. Never replace/copy the full browser merely to add buttons, or label a display-only entry as an active private session.
- Every future entry must retain native search behavior, trace its visual dependencies to upstream providers, and dispose only its own nodes/registrations. Test sidebar fold state, search expansion, remount and bundle disable before claiming Desktop compatibility.

## Workflow and safety

1. For plugin mechanics, read the [official first-plugin guide](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/) and [bundle/install guide](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish) for the target version. `dsh plugin add` installs a bundle; it is not a project generator.
2. Develop against a disposable profile first. Do not install this scaffold into the user's live `desktop` profile merely to smoke-test packaging.
3. Git pushes do not update installed packages. Use the official manager with a new reviewed Git SHA, preserve configuration, then restart after replacing an existing package. Never bypass Electron-exclusive Desktop management through the external CLI.
4. Start behavior changes with a failing contract test; then implement and verify the exact Desktop build. A successful package archive does not prove a working UI contribution or isolation.
5. Keep `apply` lifecycle-managed. When adding subscriptions, windows, timers, or IPC, register disposal and test unload/restore. Fail closed on ambiguous ownership before cleanup.
6. Treat each external plugin as trusted executable code; inspect the bundle and explicit dependencies before installing. Never silently copy credentials into a temporary profile.
7. Ordinary private research and decisions belong in the private docs repo, published with its `private-docs-publish` skill and repository write lock. Do not place private user data here.

## Desktop debugging

Prefer an already enabled loopback CDP connection. Do not activate or steal the user's foreground window; do not silently restart Desktop just to enable CDP. A Host HTTP listener is not a CDP endpoint. If CUA is unavailable and CDP is not enabled, background inspection may establish the remaining gap, but cannot substitute for real Desktop verification.

Use the installed build-macos-apps `swiftui-patterns` skill as a desktop-interaction reference for editing, cancellation, focus and discoverability, not as a framework dependency. Harness owns the settings surface, controls, persistence and commands; do not add a SwiftUI window, AppStorage, a second settings store or global shortcuts merely to mimic native macOS.

## 0.2.1 release contract

0.2.1 corrects the source-label placement, nickname-row centering and capture/workbench error attribution alongside the available-update arrow presentation: `--dsw-alias-state-success-primary` owns its green color and the SVG root shares the existing entry artwork's 1.5 stroke. Keep native Button hover/focus behavior, Tooltip parameters and explicit installation confirmation unchanged. The OS pixel-acquisition route and native probe are retired. `viewport.ts` uses modern-screenshot to rasterize `documentElement` at current viewport size and DPR, preserving nested scroll positions; webfonts and local assets are embedded through a credential-free resource boundary. It rejects incomplete resources, visible unsupported embedded content, cancellation and viewport changes. Browser fixtures and injected-engine tests do not prove the installed DSH workbench.

The camera remains gated to macOS Desktop while that target is being verified. It snapshots the whole visible DSH webpage *before* showing the workbench, then supports local background composition, manual/recognized-region redaction, retake and PNG copy/save. Capture does not request OS recording permission or special CDP startup. Recognized-region suggestions are narrow; other pixels can contain sensitive data. The pre-capture placeholder is best-effort visual masking, not a forensic privacy promise. No system-wallpaper action appears without an adapter.

The 0.2.0 version tag is published with an explicit installed-Desktop acceptance gap. Reused 0.2.0-rc.1 evidence covers source contracts, the authenticated route in an independent Web profile and execution of the packed native helper; it does not cover the installed workbench's theme, interaction, copy/save or permission-denied behavior. Keep this limitation visible in README and do not silently replace or restart the user's live Desktop to close it.

Run `pnpm test`, `pnpm build`, `pnpm run bundle` and inspect archive membership and bundled dependency notices for each version. Full Desktop acceptance remains a normal release gate; 0.2.0's recorded exception does not waive that gate for later releases. DOM rasterization fixtures, injected-engine contracts and installed Desktop tests are separate evidence; none alone proves the installed UI.

## 0.1.1 stable release contract

0.1.1 remains display-only: it masks recognized workspace titles, persisted session titles, the two-cell provisional New Session title, search result title/workspace leaves, and only owner-correlated HoverCard titles. The two-cell exception requires a nonempty `session:` row key, an empty leading slot and a text-only second span; malformed/ambiguous rows still skip. Original DOM text, native events, account state and profile data remain untouched.

The hat immediately toggles Host `maskTitles`. The settings card has one heading and Switch per capability; avatar source actions persist atomically, nickname owns a local draft with check/Enter and Escape, and all writes respect Host acceptance and revision fences. Do not reintroduce a global Save, separate language store or session-isolation claim.

The official version-adjacent badge slot probes updates when this Bundle's detail opens. A newer stable tag alone reveals the circular up-arrow; opening it exposes the source change and a separate install confirmation. No continuous polling or silent install occurs. `package.json.version` is the sole version source, `v<version>` is the GitHub distribution anchor, and npm remains private. A GitHub Release page is optional, not a bundle requirement.

Run `pnpm test`, `pnpm build`, and `pnpm run bundle`; run TypeScript typecheck as part of tests. Fixture coverage is not Electron evidence. Validate the exact installed artifact through the official manager on a disposable profile before claiming Desktop compatibility; preserve account/profile data and any unsaved draft. The public README is a product/user guide, not an mvp-by-mvp chronological lab notebook.
