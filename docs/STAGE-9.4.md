# Stage 9.4 — GitHub updater migration preparation

Candidate source version: **0.5.0-rc.6**, not published. Published rc.5 and
`v0.5.0-rc.5-installers` remain unchanged. Developer: Beluga_8292.

## Architecture and scope

Installed rc.5 reads the VDS manifest. Future source uses GitHub Releases for
updates; backend API/data remain on the VDS. Source `productName`, identifier,
SQLite/settings/keyring/Goals/Watchlist/FurfSky paths and updater public key are
preserved. The existing updater plugin, store and dialog are reused.

Stable source uses `https://github.com/Beluga8292/SkyForge-Helper/releases/latest/download/latest.json`.
RC source uses `https://github.com/Beluga8292/SkyForge-Helper/releases/download/rc-channel/latest.json`.
The exact `rc-channel` prerelease is only an explicitly promoted manifest pointer;
actual binaries belong to version-specific source tags. It is not a fabricated
application source tag. GitHub latest currently has no stable release; the
installer prerelease is never treated as stable or an updater release.

Neither channel is published/promoted in this preparation. A missing RC feed is
an error rather than a false up-to-date result. Native signature verification stays
mandatory; new source also requires a trusted signed version comment. The full
manifest generator verifies payload, trusted minisign comment, key identity,
version, platform, source receipt, SHA-256 and repository/version-specific URLs.

## Pipeline and signing

`SkyForge Helper updater preparation (no signing secrets or publication)` is
manual, main/repository restricted, contents:read. It reuses existing validation,
Tauri builds and source-path remapping; no private signing key is uploaded to
GitHub. Ordinary PR workflows receive no signing secret. Existing installer
workflow remains distinct from updater preparation, not a competing publisher.

Local signing uses the existing private files with permission 600; values are
never logged or passed in argv. Receipts bind assets to a full approved source
SHA and candidate version. The optional draft tool only creates a private draft
and refuses overwrites. No code path publishes/promotes a release or changes VDS.

Tauri 2 Windows payload is the NSIS `.exe` itself plus `.exe.sig`, not a v1 zip.
macOS payload is `.app.tar.gz` rooted at the actual legacy `.app`, plus `.sig`.
Only genuinely verified platforms enter the manifest. No fictitious signatures,
URLs or platform entries. New files are collected privately, not old rc.5 assets.

## Changes

- release/channels.json and release/README.md: minimal channel/migration policy.
- scripts/updater-manifest.mjs and tests: generator and full signature validator.
- scripts/sign-updater-local.mjs: existing-key local signing gate.
- scripts/collect-updater-assets.py: platform/provenance/hash collection.
- scripts/create-updater-draft.mjs: optional private-draft-only gate.
- scripts/probe-updater-manifest.mjs: real HTTPS manifest/payload validation.
- .github/workflows/release-preparation.yml; manifest tests added to normal CI.
- Version synchronized in npm/Tauri/Cargo and lockfiles; branding guard updated.
- Existing updater service no longer swallows invalid manifest/network errors;
  stale pending handles close before recheck. Store protects downloaded/available
  updates from background checks. Existing RU/EN dialog displays friendly errors
  and retry; no second updater UI or stack traces.

## Gates at implementation checkpoint

Local frontend: **369 tests PASS**. Manifest/signature tools: **11 tests PASS**.
TypeScript and Vite build PASS. Negative cases include corrupt/wrong signatures,
wrong trusted version/comment, missing/invalid manifests, unsupported platforms,
network errors and no-update state. Fixture crypto keys exist only in unit-test
memory and never replace the real app trust identity.

Build, real existing-key signatures, downloads and isolated tests are being
validated separately; build success will not be presented as UPDATE E2E.
No backend change; normal CI retains backend regressions. Windows/MSI constraints
remain as documented in Stage 9.3. macOS remains ad-hoc, no notarization.

## Data and publication gates

No updater is installed over the real user's app. Real user data are untouched;
backup/restore and live rc.5→rc.6→next GitHub update need separate isolated E2E.
Use SQLite backup API and preserve the full WebKit/IndexedDB/FurfSky state before
any real update. No permission to publish binaries or change the VDS bridge has
been exercised. Existing downloads/README buttons/Discord remain unchanged.

Before authorizing migration: verified candidates → private draft review →
isolated E2E → explicit public release/feed approval → anonymous download/signature
probe → separately approved VDS bridge → real backed-up install → next-update
check. Do not remove the old updater service/volumes or modify API/Caddy routes.

Missing docs/STAGE-9.2.md was searched for locally; Stage 9.3 and current source/
GitHub release metadata supply the existing installer evidence. No claim that the
missing report was read.

**Checkpoint status: PARTIAL — preparation implemented, real artifact/E2E gates
are reported at the completion checkpoint below.**


## Final preparation results — 2026-11-04

Build source: `f64ccaf83d568a53af4b534ab5428a4b38e5892e` on public main.
Initial transient GitHub push HTTP 500 resolved; remote source SHA verified.

- [Preparation workflow](https://github.com/Beluga8292/SkyForge-Helper/actions/runs/41810475029):
  validation, Windows x64 and macOS ARM64 **PASS**.
- [Normal CI](https://github.com/Beluga8292/SkyForge-Helper/actions/runs/41810461174):
  frontend, backend and Rust **PASS**. Frontend: 369 tests; manifest: 11 tests.
  Rust: 2 tests on each native runner. TypeScript and Vite PASS.
- Windows rc.6 **BUILD / INSTALL / RELAUNCH / SQLITE PASS** on disposable runner.
  This is installation and state retention across relaunch, not install-over or
  updater E2E. Authenticode remains absent.
- macOS rc.6 **BUILD PASS** locally and in CI; downloaded CI archive extracted
  privately and `codesign --verify --deep --strict` PASS. Ad-hoc; not notarized.
- Both CI payloads signed locally with the existing production updater key.
  Full signatures, trusted exact version, source receipts and SHA-256 **PASS**.
  Actual modified payload bytes rejected on both platforms. Keys stayed local.
- Cross-platform manifest generated privately with real signature contents and
  version-specific GitHub URLs; no unverified platforms included.
- Private GitHub draft `v0.5.0-rc.6` created with target fixed to the build SHA.
  Draft contains two payloads, signatures, receipts, latest.json and SHA256SUMS.
  Authenticated re-download of all draft files: **DOWNLOAD / SHA256 / SIGNATURE
  PASS** for both platforms. This is not anonymous public download validation.
- Final source audit: 456 files, zero findings. Gitleaks: no leaks. Signing files,
  downloaded assets, private manifests and verification logs remain ignored.

| CI payload | SHA-256 |
| --- | --- |
| SkyForge-Helper_0.5.0-rc.6_darwin-aarch64.app.tar.gz | 4602334f3d7242259dfd1b047d79f2b8ccd5643026698b3a609f4a3b3a560c90 |
| SkyForge-Helper_0.5.0-rc.6_windows-x86_64-setup.exe | 7cd25aebb332b98c246d5cf5df0e44bd28ffc29ad6bbc9a3710ed4e5911d1045 |

## Remaining gates and handoff

**Status: PARTIAL — signed cross-platform draft ready; migration not executed.**

- Public GitHub manifest/asset delivery is NOT VERIFIED. Neither rc-channel nor
  the binary draft has been published; anonymous URLs intentionally remain 404.
- macOS install-over and signed native update E2E on either platform are NOT
  VERIFIED. Windows clean install/relaunch does not establish updater E2E.
- Actual rc.5 → rc.6 → subsequent GitHub update, interrupted native installation,
  and real user data backup/restore comparison remain untested. No updater was
  installed over the real user's app. SQLite, UUID, profiles, settings, Goals,
  Watchlist, Dungeon builds and FurfSky were untouched; preservation after an
  actual update is not claimed.
- VDS manifest checked against the prior read: unchanged rc.5. No backend,
  container, Caddy, database, API key or old updater service changed.
- README keeps existing real rc.5 downloads. No stable release, RC feed promotion,
  public binary release or VDS bridge publication occurred.

Private local input: `.verification/stage94-cross-platform-input.json`.
Private downloaded draft: `.verification/stage94-draft-download/`.
Review draft using authenticated `gh release view v0.5.0-rc.6` (not a public URL).
Build provenance stays at f64ccaf even if documentation adds a later main commit.

Next: back up/isolate SQLite and full settings/WebKit/FurfSky state; perform native
update E2E with verified artifacts. Public release/feed and VDS bridge need
separate explicit owner approval. After publication, run
`node scripts/probe-updater-manifest.mjs <published-feed-url>` for anonymous HTTP,
JSON/content, downloaded signatures and hashes. Then verify backed-up rc.5 update,
data retention and subsequent GitHub discovery. Do not retire VDS updater yet.


## Stage 9.4.1 follow-up

See [STAGE-9.4.1.md](STAGE-9.4.1.md) for the verified data backup, actual installed
rc.4/rc.2 preflight, Windows rc.5→rc.6 **installer** compatibility PASS, RU/EN
private draft notes, independent production profile checks and publication/E2E
blockers. This does not upgrade the earlier native updater E2E status to PASS.
Documentation and validation changes use `validation/stage-9-4-1` and a PR;
main protection/rules were not bypassed or changed.


## Final authorized publication/migration

The final task explicitly authorized rc.6 publication and the backed-up one-time
VDS bridge. See [STAGE-9.4-FINAL.md](STAGE-9.4-FINAL.md) for current public assets,
actual macOS installed rc.4→rc.6 updater evidence, GitHub subsequent checks,
Windows results and exact remaining limits. Earlier draft/blocked checkpoints
above are historical and do not describe the final delivery state.
