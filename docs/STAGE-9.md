# SkyForge Helper — Stage 9 preparation

Author/developer: **Beluga_8292**. Copyright (c) **2026 Beluga_8292**. MIT.
Intended public repository name: **SkyForge-Helper**.

## Status

- **GIT READY** locally on `main`, initial commit after index/content review and scans.
- **PUBLICATION REVIEW REQUIRED**. No remote, public repository, push, release or tag.
- **CI NOT TESTED** on GitHub; workflows prepared and YAML parsed locally.
- **MACOS BUILD READY — compatibility-test only**: real ARM64 APP/DMG built locally.
- **WINDOWS BUILD BLOCKED / NOT TESTED**: workflow prepared, no Windows runner executed.
- **DISTRIBUTION BLOCKED**: native rename migration, signing/notarization, target
  dependency-license review and installer/update E2E remain unverified.

GitHub CLI is not installed; no GitHub account/organization was verified through
available tools. Beluga_8292 is the supplied author, not an assumed GitHub account.
The local initial commit uses an explicit non-contact placeholder email
`author@skyforge-helper.invalid`; choose an approved commit email before publication.
No private email or guessed GitHub noreply identity was invented.

## Rebranding and compatibility

User-facing app/window titles, sidebar, welcome/About/error/update messages,
README and new development docs now use SkyForge Helper. About visibly includes
© 2026 Beluga_8292. Cargo/package author metadata and Tauri copyright use the
supplied author. MIT's canonical text is unchanged apart from its holder/year.
BRANDING.md distinguishes official/derivative builds without inventing extra MIT
restrictions or claiming trademark registration. Historical published rc.5 notes
and downloads retain SkyBlock Companion.

Native `productName` deliberately remains **SkyBlock Companion**, because Tauri
uses it in .app naming, Windows install/registry paths and default WiX upgrade
identity. Full native/installer display-name rename is BLOCKED until isolated
manual-install-over and updater tests pass. New compatibility-test archive/DMG
filenames use SkyForge-Helper; inner native identity stays legacy. See
[REBRANDING.md](REBRANDING.md). This is a planned compatibility exception, not a
claim that the full native rename already passed E2E.

Unchanged: `com.skyblock.companion`, SQLite filename/path resolution, stable Cargo/
npm names, cache/settings/keyring namespaces, updater endpoint and public key.
`scripts/verify-branding.mjs` checks these invariants. No signing private key was
read for the new packaging, no new key introduced, and no production configuration
or updater manifest was written.

## Publication security review

The exact indexed file list is [PUBLICATION-FILES.txt](PUBLICATION-FILES.txt).
Only that tree is a publication candidate; do not push the entire local folder.

Excluded, retained locally: actual .env files, private signing/certificate material,
SQLite/runtime databases, backups/dumps, imported ZIP/CATS packs, node_modules,
Python environments/caches, Rust target directories, dist/build/release outputs,
.verification screenshots/logs/profile data, generated endpoint permissions and
internal operational/historical reports. Their contents were not printed. Local
Stage 8 historical docs are intentionally outside the public Git index because
of account/internal verification details; all current Stage 8 source remains.

- Exact-index heuristic content/path audit: PASS, zero unresolved findings.
- Official **Gitleaks 8.30.1** archive checksum verified before use; exported index
  scan with full redaction: PASS, zero findings after fixture cleanup.
- Five exact-match hashed exceptions retain reviewed synthetic config/redaction
  fixtures; changed values do not automatically inherit that exception.
- Gitleaks initially identified one credential-like UUID literal in a redaction
  test. It was replaced by an unmistakably synthetic UUID and its targeted test
  passed. No key value is reproduced here and no public push preceded the fix.
- Built web assets, extracted native-binary strings, artifact directory and the
  actual unpacked macOS APP scanned: zero findings. These are scanner results,
  not a proof that every possible encoding/secret has been detected.
- User-owned FurfSky pack assets are not staged/bundled. Included artwork is the
  existing project app icon, not imported pack textures.

During the first isolated native build, Tauri's default beforeBuildCommand cleared
local dist, including its updater preparation directory. Original signed rc.5
package/DMG in the original Rust target directory were untouched. The canonical
local rc.5 updater package, checksum and manifest were restored from the original
package/read-only published metadata; SHA-256 and signature matched the published
rc.5 exactly. The packaging overlay now uses `--emptyOutDir false`. Former
noncanonical dist staging contents were not independently inventoried; no claim
is made that an unknown prior staging directory was reconstructed. This incident
never changed the server, user databases, installed app or source.

## Attribution and dependencies

THIRD_PARTY_NOTICES.md, the pinned NEU MIT license, dependency inventory and
retained license texts are included. Inventory: **769 records**, **359 unique
license texts**, **212 unknown license metadata records**, principally unavailable
platform-specific Rust packages. Unknowns remain a distribution-review gate.
Fonts retain OFL notices; MPL/LGPL build-component metadata is called out rather
than silently relabelled MIT. Notices/licenses are bundled in the new test APP.
FurfSky is All Rights Reserved; only local importer support is included.

## CI and packaging

- `ci.yml`: push/PR/manual, Node 24, frontend tests/TypeScript/build, locked npm/
  Cargo checks, exact-index audit + pinned Gitleaks, Python 3.12 backend tests and
  Rust/Tauri unit tests. No production secrets or deployment.
- `installers.yml`: manual macOS target ARM64 and real Windows-2022 x64 MSVC
  matrix. macOS APP + DMG; Windows NSIS EXE + MSI; versioned compatibility-test
  artifacts and SHA256SUMS. No GitHub Release, updater upload or latest.json.
- Old `windows-rc.yml` no longer stages the production updater private key; it
  points to compatibility packaging. Signing a future updater is a separate gate.
- Explicit read-only content permissions, checkout credentials not persisted,
  Actions pinned by commit. Local YAML parsing is not GitHub Actions PASS.
- Exact Python installed/test resolution recorded in requirements-ci.lock;
  clean Linux-runner resolution still requires actual GitHub execution.

## Local validation and artifacts

- Full frontend: **353 tests PASS**; TypeScript and Vite PASS (existing chunk warning).
- Backend: **170 tests PASS**, one existing Starlette/httpx deprecation warning;
  after synthetic fixture replacement, its targeted regression file also PASS.
- Rust: **2 tests PASS**, including temp-database migration preservation.
- Branding/updater/data identity guard PASS; current installed pip dependencies
  pass `pip check`.
- Actual macOS ARM64 build PASS in a separate copied target/cache directory;
  original published bundle output was not overwritten. App version, architecture,
  bundle identifier and strict/deep ad-hoc code-sign verification PASS.
- DMG created without Finder automation; hdiutil verification PASS. hdiutil emitted
  a deprecation warning, not a Finder timeout. Developer ID and notarization are
  unavailable. Test APP was not launched against real user data or installed over
  the existing app. Gatekeeper compatibility/upgrade E2E NOT TESTED.
- Browser on a fresh unbound preview origin confirmed SkyForge Helper title,
  sidebar/welcome and About author. README screenshot contains no account/profile
  binding or real user balance; cached public Bazaar data is labelled.
- Windows compilation, MSI metadata/runtime, WebView2 installation, launch,
  backend connection, install/update/uninstall and data preservation: NOT TESTED.
  No Authenticode certificate/signature or Windows updater E2E is claimed.

Local outputs (excluded from Git):

- `.verification/stage9-artifacts/SkyForge-Helper_0.5.0-rc.5_compat-dev_macos-arm64.dmg`
- `.verification/stage9-artifacts/SkyForge-Helper_0.5.0-rc.5_compat-dev_macos-arm64.app.tar.gz`
- `.verification/stage9-artifacts/SHA256SUMS.txt`

Checksums below describe only these new development test artifacts, not a
replacement or re-publication of the original rc.5 release.


```text
8faf11b1945878663ed4f2b9a803b9702d5b9d0db0a1b39e50a6debb139d65af  SkyForge-Helper_0.5.0-rc.5_compat-dev_macos-arm64.app.tar.gz
3f794e38d720de9e011a7c4310ca7ac122032d6453e41d9d898374acf4a91120  SkyForge-Helper_0.5.0-rc.5_compat-dev_macos-arm64.dmg
```

Native build paths were remapped before the final rebuild; extracted binary strings no longer contain the developer home path. Tar headers also remove builder user/group names. Future packaging fails on detected personal/workspace paths.

## Remaining steps before public distribution

1. Review the exact staged file list and source/license/security results. Choose
   the GitHub owner/account and approved commit email; authorize public repository
   creation/first push separately. GitHub Visibility Public is the intended target,
   not evidence that publication has happened.
2. Run the prepared workflows on actual GitHub macOS/Windows runners. Resolve
   failures; do not declare them PASS from this local preparation.
3. Complete Windows clean install, WebView2, launch/backend-connect, update and
   uninstall tests with disposable seeded user data; verify artifacts/checksums.
4. Complete native productName/install identity migration tests documented in
   REBRANDING.md, plus target-platform attribution/signing/notarization review.
5. Only an explicitly authorized future release can change version, publish new
   installers or update the existing VDS manifest. Do not tag this newer tree as
   the original published v0.5.0-rc.5.

Stage 8 source and functionality are retained; no rollback to rc.5 source. The
latest preceding Stage 8.4 completion was DONE locally, superseding the earlier
PARTIAL checkpoint quoted by the initial Stage 9 request. Stage 8.5–8.6 not begun.
No SSH/container/firewall/Caddy/production DB/API key or third-party service writes.
