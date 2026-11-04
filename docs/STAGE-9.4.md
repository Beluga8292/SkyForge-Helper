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

Local frontend: **362 tests PASS**. Manifest/signature tools: **11 tests PASS**.
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
