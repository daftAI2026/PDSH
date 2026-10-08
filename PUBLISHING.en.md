<!--
[INPUT]: 依赖唯一版本、元信息、发布门和官方管理器。依赖中文发布合同的现行事实。
[OUTPUT]: 提供完整英文交付、升级兼容与验收说明。历史原文指向中文权威归档。
[POS]: 根发布契约的英文入口；与中文版共享边界，不翻译或复制不可改写的原文区块
[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
-->
# PDSH Distribution and Acceptance

English · [简体中文](PUBLISHING.md) · [README](README.en.md)

PDSH is installed from its GitHub repository as one Harness Bundle.
Users enter the repository URL on the official Plugins page.
The manager installs from the default branch.
Users do not need Git commands, an npm account, or a separate screenshot helper.
Stable tags anchor in-plugin updates.
GitHub Releases are disabled by default.
A request to publish authorizes `main` and a stable tag only.
Creating a GitHub Release requires separate explicit authorization.
npm publishing remains disabled.

[update-source.ts](src/client/update-source.ts) reads the GitHub tags API, not the releases API.
[updater.ts](src/client/updater.ts) compares stable SemVer versions and installs the fixed SHA resolved from the selected tag.
Release pages and attachments are not update dependencies.
`package.json.version` is the only hand-maintained version.
Generated runtime artifacts are committed before installation.
User installation does not compile the project.

When a DSH host upgrade changes APIs or layout, use the project-local [pdsh-host-compatibility skill](.agents/skills/pdsh-host-compatibility/SKILL.md) to assess the change before adapting the source.
`pnpm compat:assess` lists source touchpoints without operating DSH or certifying compatibility.
Neither the skill nor the tool installs PDSH updates or replaces the gates below.

Use the project-local [pdsh-release-lifecycle skill](.agents/skills/pdsh-release-lifecycle/SKILL.md) for RC testing and stable publication.
It coordinates existing tools and binds candidate bytes to actual runtime evidence.
It grants no installation, restart, or publication permissions and stores no session progress.

## Public Metadata and Tag Gate

`PUBLIC_METADATA` in `tools/release-metadata.ts` is the sole source for public descriptions and Topics.
The tool synchronizes only the marked one-line description in each README.
Keep product behavior, installation, compatibility, and unverified gates aligned in both languages.
Review body text and preview images manually.
Machine comparisons do not prove feature or privacy claims.

```sh
pnpm metadata:sync          # Sync both README descriptions, package and locale metadata; not versions
pnpm metadata:check         # Read-only local check
pnpm metadata:sync-github   # Explicitly sync About, homepage and Topics; verify the response
pnpm metadata:check-github  # Read-only remote check; network or authentication failure fails the gate
pnpm test
pnpm run bundle
# After review and commit, run on clean main:
pnpm release:check
```

Before enabling repository hooks, inspect `git config --get core.hooksPath` and active hooks in `.git/hooks/`.
Run `git config --local core.hooksPath .githooks` only when no custom hooks exist, or when the setting already points to `.githooks`.
Do not replace another hook setup.
The versioned pre-push hook runs `release:check` before pushing a new stable tag.
Unsynchronized local descriptions, About, or Topics fail the gate.
Existing stable tags cannot be rewritten or deleted.
Ordinary branch and RC pushes are outside this stable-tag gate.

This is local protection, not a GitHub server rule.
Other clones without the hook, or `--no-verify`, can bypass it.
The check does not repair files, commit, publish, or operate DSH.
If an omitted description is discovered after publication, deliver its correction with a later version; do not move the published tag.
The release gate checks the version-independent `Release` section in AGENTS.
The manifest and both READMEs declare the current version.
The guide does not use per-version section titles.

## Single Bundle and Native Artifacts

Keep one `@daftai/pdsh` Bundle, one `pdsh` Host, and one root Client.
Identity, title masking, and capture remain internal features, not dependency packages.
Host starts the packaged macOS or Windows helper only after an explicit capture action; the helper then exits.
Do not add an installer, persistent service, local server, or Main debugging bridge.

`native/build.sh` builds a macOS 14+ arm64/x86_64 universal helper.
`pnpm run bundle` uses npm to select members and checks mode 0755 in the actual archive.
On POSIX, check source and installed executable bits separately.
Check the actual archive mode on every platform.
Windows stat does not establish POSIX permissions.
Do not repair packaging errors with install hooks or runtime `chmod`.

`native/windows/build.ps1` builds the Windows helper with Windows SDK/MSVC.
`native-windows.yml` runs real Windows save-directory contracts and uploads short-lived x64 artifacts; it does not capture pixels or publish automatically.
Bind CI results and download digests to the build commit before committing the actual PE to `native/windows/window-capture-x64.exe`.
The release gate checks x64, console PE, and the `asInvoker` manifest.
Missing or fabricated artifacts cannot be distributed.
Compilation, directory contracts, and PE checks do not prove Windows Desktop behavior.

Windows can build a stable bundle or an RC.
The local SDK rebuilds the Windows helper.
The Mac helper and every native compilation input must match the pinned baseline.
Changed inputs require a rebuild with the macOS SDK.
Reuse does not establish a new Mac build or Desktop test.
Windows invokes the npm CLI through Node.
Stable archives remain in a private temporary directory with a verified ACL.
The Windows build workspace is not treated as a private directory.
Its tar implementation writes helper mode 0755 during packaging.
The archive gate independently checks members, bytes, architecture, and mode.
Windows stat does not establish POSIX permissions.
No installation hook or runtime chmod repairs the package.

## Upgrade Compatibility

Versions `0.3.2` and earlier need one normal load during their first upgrade.
An existing v1 business shell can replace capture, save, and added business payloads through the same in-plugin tag path.
Changes to root Config, the base Remote protocol, or the fixed shell remain separate load boundaries.

Version `0.5.2` preserves the v1 capture/save contract and assembles a separate wallpaper interface with the current business implementation.
Entry points must check the actual Host version and capability.
The existing gallery remains available offline.
Same-process official tag upgrades must verify capture and wallpaper separately; successful installation does not prove either feature is ready.

The repair tag is not a no-restart migration for a running `0.5.0` v2 shell.
That shell rejects the restored v1 payload; do not describe its upgrade as compatible.
A normal Host load and replacement of an older capture business payload are different boundaries.

## Temporary RC Packages

RC packages use the same platform build and archive gates described above.

`pnpm bundle:rc 1` creates isolated temporary staging from the current public source.
The same builder produces `@daftai/pdsh-rc` / `pdsh-rc` and a numbered candidate version based on the stable manifest.
The stable package name, version, and existing archives remain unchanged.
UI metadata identifies the RC; settings and browser editing preferences are isolated.
The RC does not offer stable update installation.
Archives go to `output/rc/`; an existing candidate cannot be overwritten.
Receipts record source dirtiness and its digest; uncommitted code is not a stable tag.

Installation still uses the official plugin manager.
Disable the stable package, then install and enable the RC.
After testing, uninstall only the RC and re-enable stable; do not uninstall stable.
The two packages cannot be enabled together: their Remote service and visual adapters own the same capabilities.
Successful packaging does not prove coexistence, removal, or Desktop UI acceptance.
The tool does not install into the user profile, restart Host, or publish either channel.

Merging requires no reverse rename or backup restoration.
The stable manifest, locale, and patch keep their stable identity; RC transformation occurs only in staging.
Commit the shared feature source and packaging tools, not `output/rc/` archives.
`pnpm test` checks stable identity compatibility; `pnpm build` still generates stable runtime artifacts.
Never copy RC manifests, entries, or generated files back into the stable source tree.

## Separate Verification Gates

### System Wallpapers and Local Gallery

Version 0.5.5 adds local Windows x64 retrieval of system wallpapers.
It selects up to five installed default and theme wallpapers.
If fewer than five items are available, it shows the actual count. It does not read the user's current wallpaper or download from the network.
The macOS active catalog remains capped at four items.

The macOS adapter chooses representative materials from Apple's local catalog.
The target is two items from each of the latest two system generations, not four fixed names.
Apple metadata has no per-material OS release field.
Choose two Landscape subgroups by unique `preferredOrder`.
Use `representativeAssetID` to associate a dynamic subgroup or root-owned extension.
This catalog association is not a general system-version API.
Reject additions from unknown or ambiguous formats; keep the existing cache.
UUIDs or source digests identify materials; do not reuse system-generation role slots as IDs.

Prefer valid local cache or root-owned HEIC files.
Only the explicit Fetch System Wallpapers action reads sources and downloads missing media.
Mounting, tab re-entry, and ordinary selection read only the local gallery.
Fetching does not select a background or show download placeholders or progress rows.
Publish thumbnails once the operation settles; failures retain saved materials and fixed codes.
Fixed codes do not prove a TLS, proxy, or material-source diagnosis.
Never expose raw exceptions, paths, or pixels.

Keep five presets, system wallpapers, and personal images in separate groups.
The personal group heading contains one plus button.
The Image tab reuses ready or in-flight inventory instead of rebuilding cached DOM.
Read failures retain an alert; empty inventory retains feedback.
Store selected system stills and uploaded images in IndexedDB.
Stable and RC use separate namespaces; preferences store only valid material IDs.
Do not store screenshots, source videos, original filenames, paths, or credentials.
Preserve transparency in uploaded PNGs; reject imports when capacity is full.
Delete only on an explicit action; never silently evict user images.
Verify browser persistence and Desktop restart persistence separately.

Apple video retrieval permits only three strict 206 Range responses.
Read a 64-byte header, at most 2 MiB of trailing `moov`, and at most 16 MiB for the first sync sample.
Bind all three ranges to the same strong ETag and `If-Match`.
Reject compression and redirects; source logical size is at most 1 GiB.
Actual media transfer is at most 18 MiB + 64 bytes.
Reconstruct a complete single-sample MOV before native decoding.
Do not decode truncated movies or fall back to full downloads.
Transport is `/usr/bin/curl` with `--disable` and `shell:false`.
Use system-default TLS without changing the Host dispatcher, CA, or proxy.
Cancellation waits for child close before removing owned temporary files.

The current implementation registers new business interfaces through the official internal capability surface.
The reflection package and root Bundle ship in the same archive.
Derive internal name and version from the root manifest; do not add an installation dependency.
The base shell retains the capture/save contract.
The initial thenable waits for the official child Fiber without replacing the instance identity.
After the base version reply, Client independently checks the capability version.
Wallpaper also requires a pure registration handshake; a local proxy does not prove Host readiness.
Compatible replacement waits for old operations to settle.
Verify actual materials, preview, export, cancellation, and restoration separately.
Source, archive, or isolated Host success does not prove Desktop behavior.

### Standard Layered Gates

1. Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm build`, and `pnpm run bundle`. Check the current version's actual tgz members, bytes, permissions, version, and dependency licenses. Do not substitute an older package. Include only the manifest allowlist and npm's fixed package metadata and README files; exclude node_modules, profiles, credentials, logs, and private research.
2. Use `verify-host.ts` with the target DSH's actual PluginManager, Typert Loader, and bundled PNPM in a fresh temporary profile owned by the current user. Bind installed version, runtime bytes, and source digests. Check one root row/Client, eight feature combinations, revision writes and restoration, disable, and re-enable. Do not disable `blockExoticSubdeps`, replace the resolver, or fabricate active state. This gate takes no pixels and does not replace Desktop UI testing.
3. Record actual Desktop acceptance separately: the target artifact's theme, entries, search expansion/collapse, three feature switches, capture coverage/scale, retake, copy, directory selection/direct save, cancellation, and disable. Verify official-manager upgrades separately; experimental reinstall is not upgrade evidence. Ordinary feature switches need no restart. Package replacement follows the Host's explicit load/restart result and preserves unsaved work.

## 0.5.5 Release Candidate: Identity and the Windows Workbench

Signed-out users can explicitly replace the sidebar display identity.
The native menu remains available; account avatars require signing in.
Signing out temporarily uses a generated avatar without changing the selected source.
The avatar and identity row use the host's signed-in layout.
The detail heading trims font whitespace and keeps the version badge typography.

The workbench title is “Edit screenshot”.
The system group and fetch action both use “System wallpapers”.
“Private titles” redacts sidebar session titles.
“Private identity” redacts the sidebar avatar and nickname.
The switches are independent; failure retains the original image and state.
The identity override does not write permanent identity settings.

Windows selects up to five installed default and theme wallpapers.
macOS retains four items; its native inputs and helper bytes are unchanged.
Windows suggestions reuse the shared sidebar recognizer.
Native client-area offsets bound to the image determine PNG coordinates.
Canvas dimensions are read explicitly instead of copying prototype accessors.
Unknown geometry keeps manual drawing; the client-area origin is never guessed.
Suggestions, removal buttons, and the editor title retain distinct accessibility semantics.
The color area and HEX input share a width; endpoints retain hue.

RC11 passed this round's Windows feature acceptance.
It covers short copy, detected regions, both masks, and retaking.
Color controls, five wallpapers, PNG copying, and all three save formats also passed.
Native directory cancellation and stable-package restoration passed.
Export proportions passed for a representative redaction; complete pixel alignment remains unverified.
RC results do not replace the stable archive or the same-tag upgrade gate.

The user requested main and a stable tag after physical testing passes.
The proposed tag is v0.5.5; no GitHub Release or npm publication is planned.
Every added capability requires verification through the same official tag upgrade.
Restarting or toggling features cannot fill missing interfaces after upgrade.
Mac physical testing, high DPI, and cancellation during capture remain unverified.
Permission withdrawal, Desktop abnormal exit, and restart persistence remain unverified.
Complete pixel alignment, dark themes, and English Desktop remain unverified.
Release exceptions for this version are not yet confirmed; 0.5.4 exceptions do not carry forward.

## 0.5.4 Release Decision: Windows Capture Repair

Frame content can be smaller than the capture buffer.
Remove the incorrect equality requirement.
Keep ownership, stable-window, texture-boundary and budget checks.
Config, Remote contracts and media identities remain unchanged.

The user authorized main and v0.5.4 publication.
Then test the official fixed-SHA update from 0.5.3.
Do not create a GitHub Release or publish to npm.
Mac inputs and helper bytes match the frozen baseline.
The user waived this round's Mac machine test.

RC machine checks cover capture, retake and PNG copy.
They also cover PNG, JPEG and WebP file completion.
Other checks cover picker cancellation and duplicate names.
Plugin disable releases the camera and helper processes.
Native fixtures cover target closure and startup termination.
Cancellation during active capture and full pixel alignment remain unverified.
The user accepted these two gaps for this repair-tag validation.
Bind formal archive, native and isolated Host results separately.
Run the stable update test after publishing its tag.
Do not count RC installation as the stable update test.
Respect an official restart-required result.
Restarting requires separate authorization.

## 0.5.3 Release Decision: Session Camera with a Collapsed Sidebar

When the sidebar is collapsed, the session has a camera in its top-right corner.
Both entries share capture, retake, and disposal lifecycles.
Config, the base Remote contract, and media-store identities remain unchanged.
Before publication, verify actual visibility, capture, retake, and stable-package restoration.
Verify same-process official tag upgrades separately; initial RC installation does not replace that gate.
This publication pushes only `main` and `v0.5.3`, without a GitHub Release.
After RC acceptance, the user will click the stable upgrade.
The agent does not install the new stable version or mark the upgrade gate as passed.
Windows real-machine behavior, export alignment, and permission revocation remain unverified.
Dark themes and the English Desktop UI also remain unverified.

## 0.5.2 Release Decision: Added Capabilities on the Same Upgrade Path

This version registers official generated capability surfaces with the versioned business implementation.
Root Config, base Remote identity, and the installation path remain unchanged.
Verify capture and wallpaper through the same tag upgrade; restoring the base does not prove the whole upgrade.
The measured same-process target is a still-running v1 shell.
The immutable published `v0.5.0` v2 shell still rejects v1; do not call it compatible.
The user explicitly authorized stable patch tags such as `0.5.1` and `0.5.2` for incremental verification.
Push only `main` and `v0.5.2`, without GitHub Release or npm publication.
Do not restart or toggle switches; preserve the user's unsaved workbench.
Source, strict assembly contracts, the current archive, and exact Host gates remain required.
After the tag is available, verify the actual official Git upgrade and each new business action.
Final pixel alignment, export, Windows real-machine behavior, and restart persistence remain unverified.
Original requests, red/green results, and Desktop receipts belong only in private documents.

## 0.5.1 Release Decision: Stable Repair Tag Verification

This version retains the v1 capture/save compatibility surface.
The wallpaper extension has its own contract and Host registration handshake.
It restores the upgrade path for still-running v1 shells, not every published shell.
The published `v0.5.0` v2 shell still rejects this v1 payload.
Both older shells read the same path and compare mutually exclusive strings.
This known mismatch is not a compatibility pass.
After disclosure, the user required incremental testing with stable patch tags.
Publish `v0.5.1`, then use the official Git installation path; local archive installation is not tag-upgrade evidence.
Publish only main and tag, not GitHub Release or npm.
Do not restart Desktop or substitute a version increment for a repair.
Final rendering, export, and Windows behavior remain unverified.
Do not turn the gallery timeout under default concurrent tests into a pass.
Bounded full tests, artifacts, and exact Host gates remain required.
Keep the old `v0.5.0` tag unchanged.
Store authorization, upgrade, and failure evidence privately; local success does not prove all older shells compatible.

## 0.5.0 Release Decision

This version delivers macOS system wallpaper retrieval and the local background gallery.
After disclosure, the user explicitly requested publication with these gates still unverified:

- The exact final Desktop artifact and current dark theme.
- Warm-switch selection rings, preview, and state consistency.
- Native candidate-to-final-PNG alignment, copy, save, and cancellation.
- Desktop restart persistence for all four system materials and user images.
- Windows real-machine behavior, permission revocation, and abrupt exit.
- Final RC removal and stable-package re-enablement.

Source, types, all contracts, generated artifacts, and the real archive still must pass.
The exact rc.2 Host installation gate needs a fresh temporary profile.
Check actual business versions on initial load and re-enable.
After `release:check` passes on clean main, push main and `v0.5.0`.
Do not move old tags, publish npm, or modify live Desktop.
The new v2 Remote ABI requires a normal load; do not promise a no-restart upgrade.
This authorization applies only to `0.5.0`, not a later version.
Original requests, experiments, and publication receipts remain private.

## 0.4.0 Stable Tag Decision

Feature branches were merged and obsolete merged branches/worktrees removed after preserving evidence.
The user explicitly requested `v0.4.0` with remaining gates disclosed, so plugin details could discover the update.
Do not locally click update, install, or restart DSH.
Retain `0.3.5` fixed-SHA updates, limited retry, configuration readiness, and actual backend-version checks.
RC identity transformations affect only staging, not stable manifests or settings.

RC9 has macOS light-theme evidence for candidate selection, manual drawing, retained masks, undo/redo, tool highlights, and consistent padding.
Separate DPR 1/2 browser checks cover the production mapping, state, compositor, and PNG encoder: selected padded regions are masked, unselected pixels remain unchanged, manual drawing retains masks, and decoded PNG pixels match the preview.
Neither proves the content origin in a native whole-window PNG.
The exact final Desktop artifact, native redaction placement, Windows behavior, and dark theme remain unverified.

Source, types, the current archive, and exact isolated Host gates remain required.
After `release:check` on clean main, push the reviewed commit and `v0.4.0`, then verify remote refs and the official tags API.
This version-specific authorization does not waive later gates or authorize changes to user installation/settings.

## 0.3.5 First-Attempt Update Repair

Exact rc.2 Manager source and Desktop logs showed a five-second GitHub Git preflight before PNPM; both measured failures occurred there.
The old updater discarded `kind`/`failedAt` and presented a known failure as unknown.
The user chose at most one automatic retry.
Keep the fixed Git SHA and retry only when the official result confirms `changed=false`, `application=failed`, `failedAt=spec-host`, and `packageResult.kind=timeout`.
Recheck the installed version before retrying and stop on Client disposal.
A second failure stops; unknown results, PNPM failures, advanced disk state, and cancellation never trigger automatic reinstall.
Show first-time retry and final-timeout states; classify known failures with the official whitelist, never raw paths/output.
Keep a local Client version mismatch distinct from an unknown connection; preserve work and use normal loading rather than guessing recording permission or changing Host wire contracts.

A fixed-commit archive alternative passed an exact official Manager/PNPM online experiment, but it is not added to the chosen retry path or used to change global Host timeouts.
New contracts must fail on the old updater.
Publish after current full type/tests/archive and exact Remote failure/retry checks.
The old update button still runs old logic; the update that installs the patch does not prove the new retry ran.

## 0.3.4 Backend Implementation Acceptance

The user required testing through a remote version and the plugin's own update button.
Version `0.3.4` adds an instance-version check inside the actual versioned capture method, not only the manifest or Client.
Config, Remote, fixed-shell source, helpers, and runtime dependencies retain the `0.3.3` boundary.
The regression failed on the old closure; source/full tests/archive/exact Host gates precede publication and real remote upgrade/capture measurement.

The remote `0.3.2 → 0.3.3` installation verified the fixed SHA and three runtime files, but the older backend needed one normal restart to load the bridge.
That preparation is not a `0.3.3 → 0.3.4` no-restart pass.
The latter measurement keeps Main/Host PIDs and start times unchanged, avoids Bundle/camera toggles, and captures directly after the update.
Successful installation does not replace runtime or workbench acceptance.

The real remote `0.3.3 → 0.3.4` update passed with unchanged process identities and settings bytes, no enable/capture toggles, native capture, and an actual JPEG commit.
Before both operations, the new Client required Host `implementationVersion` to be `0.3.4`.
The user's independent capture check also succeeded.
This is not Windows, complete redaction, or PNG-alignment acceptance.

## 0.3.3 Remote Upgrade Experiment

The user required remote-tag installation through the in-plugin update button.
This version adds a stable Remote shell, versioned business closure, and actual backend-version confirmation.
Source, archive, and exact Host gates precede the stable tag; local tgz replacement is not remote-upgrade evidence.
Adopting the shell for the first time needs one normal load.
Later measurements must keep Main/Host PIDs and start times unchanged, confirm new business methods loaded, preserve settings, avoid enable/camera toggles, and capture directly after update.
Compatible business replacement is separate from Config/Remote/shell changes; this is not arbitrary Host hot replacement or full Desktop/Windows acceptance.

## 0.3.2 Re-Enable Repair Verification

The user authorized the official `0.3.2` update and further Desktop checks.
This patch rechecks accepted Settings at capture/save entry so an empty projection while the Config owner is not ACTIVE does not lock the child service off.
It adds no loader, revives no disposed service, and changes no helper or runtime dependency.
The new regression must fail before the repair and pass after it.
Full tests, the current archive, and exact isolated Host installation precede the clean-main tag.
After a normal restart loads the changed Host, independently verify disable/re-enable plus capture without another restart and with retained settings.
Record installed manifest, loaded code, and process identity separately; this is not arbitrary Host hot replacement or full Desktop/Windows acceptance.

## 0.3.1 Upgrade Verification Patch

The user authorized a main/tag patch to test the official update path.
Only Client readiness, old-configuration reminders, and installation-result presentation change.
Host source, helpers, and runtime dependencies remain unchanged.
Source, archive, and exact isolated Host checks remain required; this authorization does not prove full Desktop/Windows acceptance or Host hot replacement.
On clean main, synchronize the sole version and generated artifacts, verify `v0.3.1` and the commit, then push main and the new tag without moving older tags.
Record installed manifest, running Client, Host process, and settings separately.
“Enable now” or a new version number does not prove new Host code loaded.
Use only the official manager and preserve settings and unsaved work.

## 0.3.0 Release Decision

The user approved shipping compiled Windows integration before a Windows Desktop test.
Recording-permission rejection/revocation and abrupt exit during save were excluded from this version's gate, not marked passed or known failures.
Normal cancellation, valid commit receipts, and no-overwrite semantics remain required.
Existing macOS candidate capture/workbench evidence does not prove the exact final installation package.
The user scoped delivery to merge/tag; the update indicator and actual `0.2.1 → 0.3.0` upgrade remain for the user to check, with limitations disclosed in README.
This approval and the earlier `0.2.1` exception do not waive later gates or helper/source/archive/exact Host checks.
The archived instruction to synchronize README/AGENTS versions describes the guide at that time; the current guide uses a version-independent Release section.
Review and commit artifacts, run `release:check` on clean main, and push `v0.3.0` without moving older tags.
RC branches do not generate stable update notifications; stable publication needs current authorization.

Plugin details check stable tags only when the plugin's own page opens.
Opening source details still requires a separate installation confirmation, using the official Manager and a fixed SHA.
Do not automatically restart, poll, or persist update state.
Git push does not update an installed plugin; external CLI tools cannot mutate a Desktop-owned profile.
npm is not a publication channel.
Official `application/error`, Fiber/Client state, and the actual page determine loading state; source/tag/archive success does not prove installation completed.

## Historical Contracts

The [authoritative original archive](PUBLISHING.md#历史发布合同原文) preserves nine per-version contracts and adjacent product/upgrade boundaries from the old AGENTS guide.
Their version, channel, and implementation details describe the state at that time.
Historical contracts do not authorize current publication or installation, and do not replace current verification gates.
The original mixed-language block remains byte-for-byte unchanged; this English guide does not duplicate or rewrite it.
The block SHA256 is `ec54f919761a79bd2be1323f216de27aa56d6a757a8d9a29e0a9bd34db0ea784`.
