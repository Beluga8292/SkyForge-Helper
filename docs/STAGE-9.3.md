# SkyForge Helper — Stage 9.3 public product page and installers

Author/developer: **Beluga_8292**. Copyright (c) **2026 Beluga_8292**. MIT.

## Status

- **README READY**: bilingual product pages with real download URLs, real
  workflow badges and local screenshots.
- **GITHUB PRESENTATION READY**: description, topics, issue templates, security
  policy, contribution guide and release notes are present. Social preview image
  is generated in `docs/assets/social-preview.png`; uploading it through the
  GitHub REST API is not supported, so it remains a manual repository setting.
- **WINDOWS INSTALLER READY (unsigned)**: NSIS x64 per-user installer built and
  clean-install/launch/uninstall tested on a GitHub-hosted Windows runner.
- **MACOS INSTALLER READY (ad-hoc)**: ARM64 DMG built and bundle-verified on a
  GitHub-hosted macOS runner. Not Developer ID signed or notarized.
- **DISTRIBUTION READY as pre-release**: files are publicly downloadable from
  `v0.5.0-rc.5-installers`. Signed production distribution remains blocked.

This stage did not change application source, version, backend, containers,
Caddy, Redis, PostgreSQL, the snapshot pipeline, the updater key or either
updater endpoint. The existing signed updater artifact and `latest.json` were not
replaced or republished.

## Public release

- Release: <https://github.com/Beluga8292/SkyForge-Helper/releases/tag/v0.5.0-rc.5-installers>
- Type: **pre-release**, target commit
  `1f5da783c15bac414c338ff5c786d3dec47e30e6`
- Published after explicit user authorization in this stage.

| Asset | Size (bytes) | SHA-256 |
| --- | ---: | --- |
| `SkyForge-Helper-Setup-x64.exe` | 5,824,414 | `07ec526a7b2ae37dd60a7a9eaafc579344c3831d8283977bc5e32f6c18fb892d` |
| `SkyForge-Helper-macOS-arm64.dmg` | 8,798,460 | `85096421be34f9134a994ef78bb1adc6269ad1f58e0b9ec6f59a2fe27f1cdb4b` |
| `SHA256SUMS.txt` | 194 | combined checksum file |

Direct asset URLs used by both READMEs:

- `https://github.com/Beluga8292/SkyForge-Helper/releases/download/v0.5.0-rc.5-installers/SkyForge-Helper-Setup-x64.exe`
- `https://github.com/Beluga8292/SkyForge-Helper/releases/download/v0.5.0-rc.5-installers/SkyForge-Helper-macOS-arm64.dmg`

Anonymous `curl` checks returned `302` followed by `200` with
`content-type: application/octet-stream` and the exact sizes above for both
binaries; `SHA256SUMS.txt` returned 194 bytes. Local downloads matched the
published checksums. The `SHA256SUMS.txt` asset is written with LF line endings
so it can be checked by both Git Bash and `shasum -c`.

## Validation evidence

Installer workflow run (both jobs success):
<https://github.com/Beluga8292/SkyForge-Helper/actions/runs/41733762529>

### Windows — PASS

GitHub-hosted `windows-2022`, `x86_64-pc-windows-msvc`:

- NSIS `SkyForge-Helper-Setup-x64.exe` produced with `installMode: currentUser`.
- Silent install into `%LOCALAPPDATA%\SkyBlock Companion`; install path was
  asserted to be under `%LOCALAPPDATA%`.
- Application launched and stayed running.
- SQLite created at
  `%APPDATA%\com.skyblock.companion\skyblock-companion.sqlite3`.
- A real row was written to `settings` before uninstall and read back afterwards.
- Start Menu shortcut created.
- Silent uninstall removed the install directory while preserving the user
  database and the settings row.

Not tested on Windows:

- Authenticode signature (none exists; workflow logs the unsigned status).
- WebView2 **absence** path. The installer uses Tauri's silent
  `downloadBootstrapper`, but the runner already had WebView2 installed.
- Install-over of a previous release and updater E2E.
- Real Minecraft/Hypixel account binding, live backend calls from the installed
  binary, and long-running gameplay use.

### macOS — PASS with limits

GitHub-hosted `macos-14`, `aarch64-apple-darwin`:

- ARM64 `.app` and `.dmg` produced; DMG opens with an **Applications** symlink.
- `CFBundleIdentifier` = `com.skyblock.companion`.
- `CFBundleShortVersionString` = `0.5.0-rc.5`.
- `LSMinimumSystemVersion` = `12.0`.
- Binary architecture = `arm64`; `codesign --verify --deep --strict` passed for
  the ad-hoc signature.
- `hdiutil verify` passed; SHA-256 matched after publishing.
- DMG volume and inner app are still labelled **SkyBlock Companion** (legacy
  native identity). The window and all UI copy use **SkyForge Helper**.

Not tested on macOS:

- Developer ID signature and notarization.
- Gatekeeper first-launch on a clean machine without the quarantine override.
- Intel Mac and macOS versions below 12.
- Install-over and updater E2E.

### CI — PASS

Latest main-branch runs:

- `41735310811` — this report and final product page.
- `41730146185` — product page and installer packaging.
- `41731320943` — NSIS validation on Windows, MSI optional.
- `41732527916` — Windows uninstall settings preservation.

All completed with `conclusion: success`. Main CI covers TypeScript, the frontend
test suite, production Vite build, backend tests, Rust library tests, publication
audit and secret scans.

Windows PASS is not inferred from macOS or vice versa; each result comes from its
own runner log.

## README and repository presentation

`README.md` and `README.ru.md` have the same section order and the same factual
claims:

1. Hero banner, product positioning, direct download buttons and community link.
2. Real CI and installer workflow badges, MIT/version/platform badges.
3. Screenshot walkthrough: dashboard, profile, Networth, Bazaar, Auction House,
   equipment, inventory and dungeons.
4. Feature summary table.
5. Installation for Windows and macOS, including the legacy-identity note.
6. FAQ, troubleshooting, community/support, development and license/credits.

Public pages contain no internal stage identifiers, blocked/partial language,
local paths, hostnames, environment variable names or infrastructure details.
Those remain in `docs/`.

Screenshots are 1440x900 JPEGs generated from the app in isolated demo mode with
a fictional player and market data. The Auction House image uses public live
listings without a linked account. No private UUID, balance, API key or token is
shown.

`scripts/check-readme.mjs` verifies:

- both languages and all required sections;
- local image and relative link existence;
- anchors, Discord/issues/release links and current version;
- absence of internal status/host/path language;
- that both READMEs reference the same two validated release assets;
- with `--network`, HTTP status, content type and that download URLs do not
  return an HTML page.

The local `--network` run could not connect from this workstation
(`UND_ERR_CONNECT_TIMEOUT` to the Shields/GitHub edge). The same URLs were
verified with `curl`, including anonymous downloads and checksum matching.

## Compatibility constraints preserved

- `productName` remains `SkyBlock Companion`.
- Bundle identifier remains `com.skyblock.companion`.
- SQLite filename and path resolution are unchanged.
- Updater public key, endpoints and signed artifact are unchanged.
- FurfSky cache, account binding, Goals and Watchlist storage are unchanged.
- `scripts/package-ci-artifacts.py` asserts the legacy product name and bundle
  identifier, so packaging fails if the migration gate is bypassed.

The native product-name rename remains **BLOCKED** until install-over and updater
E2E pass on both platforms. See [REBRANDING.md](REBRANDING.md).

Windows MSI remains optional. WiX rejects the non-numeric `rc.5` version, so NSIS
is the validated Windows package for this pre-release line.

## Changed in this stage

- `README.md`, `README.ru.md` — bilingual product pages.
- `scripts/check-readme.mjs` — offline/network README checks.
- `docs/assets/brand-banner.png`, `docs/assets/social-preview.png` — regenerated
  banner copy.
- `scripts/make-brand-assets.mjs` — banner wording.
- `scripts/make-dmg-background.mjs`, `src-tauri/icons/dmg-background.png` — DMG
  layout artwork.
- `src-tauri/tauri.conf.json` — macOS minimum version, DMG layout, NSIS
  current-user install, EN/RU languages, WebView2 bootstrapper.
- `scripts/build-compat-native.mjs` — `app,dmg` and `nsis` bundle selection.
- `scripts/package-ci-artifacts.py` — product names, optional MSI, LF checksums.
- `.github/workflows/installers.yml` — installer build and smoke tests.
- `scripts/windows-smoke-sqlite.py` — uninstall data-preservation check.
- `.github/ISSUE_TEMPLATE/`, `.github/RELEASE_TEMPLATE.md` — GitHub presentation.
- `CONTRIBUTING.md`, `SECURITY.md` — public project policies.
- `.gitignore` — allow this report.

## Remaining distribution gates

1. Authenticode signing for Windows and Developer ID signing plus notarization
   for macOS.
2. Install-over and updater E2E on both platforms before renaming the native
   product or changing the updater identity.
3. Manual upload of `docs/assets/social-preview.png` as the repository social
   preview (no REST API support).
4. A production release only after the above, with explicit authorization and a
   new version/tag; this pre-release must not be treated as a replacement for the
   signed rc.5 updater artifact.
