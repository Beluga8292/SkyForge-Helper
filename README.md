<p align="center"><a href="README.md"><b>English</b></a> · <a href="README.ru.md">Русский</a></p>

<p align="center">
  <img src="docs/assets/brand-banner.png" alt="SkyForge Helper — Your Hypixel SkyBlock Companion" width="100%">
</p>

<h1 align="center">SkyForge Helper</h1>
<p align="center"><b>Your Hypixel SkyBlock Companion</b></p>
<p align="center">
  Profiles, Networth, Bazaar, Auction House, equipment planning and inventory intelligence — in one clean desktop app.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-0.5.0--rc.5-f2b84b?style=flat-square" alt="Version 0.5.0-rc.5">
  <img src="https://img.shields.io/badge/platform-Windows%20x64%20%7C%20macOS%20ARM64-8b5cf6?style=flat-square" alt="Windows x64 and macOS ARM64">
  <img src="https://img.shields.io/badge/license-MIT-22d3ee?style=flat-square" alt="MIT License">
  <img src="https://img.shields.io/badge/status-pre--release-eab308?style=flat-square" alt="Pre-release">
</p>

<p align="center">
  <a href="#downloads"><img src="https://img.shields.io/badge/Download-status%20%26%20installers-8b5cf6?style=for-the-badge" alt="Download status and installers"></a>
  &nbsp;
  <a href="https://discord.gg/bX3md4uepp"><img src="https://img.shields.io/badge/Discord-Join%20the%20community-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Join the SkyForge Helper Discord"></a>
</p>

> **Installer status:** the signed `0.5.0-rc.5` build is live on the existing update channel under its former name, **SkyBlock Companion**. Fresh **SkyForge Helper** installers for Windows and macOS are being validated in CI and are **not published as GitHub Releases yet**. This page does not link to files that do not exist.

---

## Download

| Platform | Package | Status |
| --- | --- | --- |
| **Windows 10/11 x64** | `SkyForge-Helper-Setup-x64.exe` (NSIS, per-user) | Installer build and clean-install checks are prepared in [GitHub Actions](https://github.com/Beluga8292/SkyForge-Helper/actions/workflows/installers.yml). **Not publicly released.** |
| **macOS 12+ ARM64** | `SkyForge-Helper-macOS-arm64.dmg` | DMG build is prepared in [GitHub Actions](https://github.com/Beluga8292/SkyForge-Helper/actions/workflows/installers.yml). **Not publicly released.** Ad-hoc signing; not notarized. |

The current public `0.5.0-rc.5` update continues to use the legacy **SkyBlock Companion** install identity so existing users keep their settings, account binding, watchlist and update path. A full native rename without a tested migration would risk duplicate installs or lost data. See [the rebranding note](docs/REBRANDING.md).

**No terminal, Python, Node.js, Rust, PostgreSQL or Redis is required for end users.** The desktop app uses the hosted production backend. Source builds are documented below for contributors only.

---

## What makes it useful

### Player intelligence
Profiles, skills, Catacombs, Slayers, pets, collections and progression — with missing API fields shown as unknown instead of zero.

<img src="docs/assets/screenshots/profile.jpg" alt="SkyForge Helper player profile with demo data" width="100%">

### Networth that tells the truth
Known value, estimated additional value, unpriced assets and coverage. A broken item never fails the whole calculation, and unknown prices are never reported as real value. Co-op bank is excluded from personal Networth.

<img src="docs/assets/screenshots/networth.jpg" alt="SkyForge Helper Networth breakdown with partial valuation" width="100%">

### Bazaar intelligence
Live prices, spreads, volume and potential after-tax estimates, with explicit warnings that spread is not guaranteed profit.

<img src="docs/assets/screenshots/bazaar.jpg" alt="SkyForge Helper Bazaar intelligence table" width="100%">

### Auction House
BIN listings, filters, NBT-aware matching, valuations and real item textures in table and grid views.

<img src="docs/assets/screenshots/auction.jpg" alt="SkyForge Helper Auction House with real item textures" width="100%">

### Equipment Advisor
Upgrade alternatives for owned gear with known material costs, essence, reforges, enchantments and honest unknown states. It does not promise DPS or floor clears.

<img src="docs/assets/screenshots/equipment.jpg" alt="SkyForge Helper Equipment Advisor" width="100%">

### Inventory
Minecraft-style slots, item textures, tooltips and optional stack-value ribbons. Incomplete containers stay visible as incomplete.

<img src="docs/assets/screenshots/inventory.jpg" alt="SkyForge Helper inventory grid with item values" width="100%">

### Dungeon Build Planner
Class and floor templates, requirement checks, owned-gear retention and a shared build budget with explicit partial results.

<img src="docs/assets/screenshots/dungeons.jpg" alt="SkyForge Helper Dungeon Build Planner" width="100%">

### Dashboard, Goals and Watchlist
A single overview for market movement, alerts, linked profile and saved goals. Personal data stays local; market data comes from the hosted backend.

<img src="docs/assets/screenshots/dashboard.jpg" alt="SkyForge Helper dashboard with demo data" width="100%">

### Automatic updates
Signed Tauri updates over HTTPS. The updater verifies the embedded public key and offers new builds inside the app; it never silently installs from an unverified source.

---

## Feature status

| Capability | Signed rc.5 | Development tree |
| --- | --- | --- |
| Player profile, skills, pets, Slayers, dungeons | **Available** | Available |
| Honest partial Networth | **Available** | Available |
| Bazaar analytics and smart alerts | **Available** | Available |
| Auction House with NBT-aware visuals | **Available** | Available |
| Equipment Advisor | **Available** | Available |
| Inventory value overlay | **Available** | Available |
| Dungeon Build Planner | **Available** | Available |
| Goals and Watchlist | **Available** | Available |
| SkyForge Helper rebrand and new installer packaging | Not in the published binary | **Source only** |
| Native product-name migration | Not released | **Blocked pending upgrade tests** |
| Windows/macOS installer publication | Not published | **CI validation** |

The signed `0.5.0-rc.5` artifact was built from this tree and includes the Stage 8 feature set; the rebrand and new installer files are newer distribution work. There are no hidden "experimental" features advertised here.

---

## Installation

### When the public installers are released

**Windows**
1. Download `SkyForge-Helper-Setup-x64.exe`.
2. Run it. The installer is per-user and does not require an administrator account.
3. Launch the app from the Start Menu. Until the tested native migration lands, the installed shortcut and app bundle still use the legacy **SkyBlock Companion** name; the window and UI are branded **SkyForge Helper**.
4. WebView2 is installed automatically if it is missing; this requires an internet connection.

**macOS**
1. Download `SkyForge-Helper-macOS-arm64.dmg`.
2. Open the DMG and drag the app to **Applications**.
3. Launch it. Current test builds are ad-hoc signed and not notarized, so Gatekeeper may warn. Do not disable security features globally.

The inner native app name remains **SkyBlock Companion** until the migration in [docs/REBRANDING.md](docs/REBRANDING.md) passes install-over and updater tests. This preserves existing user data and the update path.

### Build from source

Requirements: Node **24**, Rust stable, Tauri 2 platform prerequisites, and Python **3.12** only for the optional backend.

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run tauri:dev
```

See [docs/BUILDING.md](docs/BUILDING.md) for full build and backend instructions. Never put a Hypixel API key in `VITE_*`, Git or a client binary.

---

## FAQ

<details>
<summary><b>What is SkyForge Helper?</b></summary>
A standalone desktop companion for Hypixel SkyBlock. It reads public/profile data through a hosted backend and presents profiles, Networth, markets, auctions and planning tools.
</details>

<details>
<summary><b>Is it free?</b></summary>
Yes. SkyForge Helper is free to use and the source is available under the MIT License. There is no paid tier or subscription.
</details>

<details>
<summary><b>Is it safe?</b></summary>
It is open source, does not inject code into Minecraft, and does not require your Hypixel API key for normal use. Open source is not a security guarantee; review the code and use the official release files. The hosted backend keeps its own API key server-side.
</details>

<details>
<summary><b>Is it a Minecraft mod?</b></summary>
No. It is a separate desktop app. It does not modify Minecraft, install mod loaders or change game files.
</details>

<details>
<summary><b>Does it require a Hypixel API key?</b></summary>
No for normal use. Advanced users may choose a direct/BYOK mode, where a key is stored in the operating-system credential vault. Never share a key in an issue, screenshot or Discord message.
</details>

<details>
<summary><b>Do I need Minecraft installed?</b></summary>
No. Minecraft is not required to run the app. You need a Hypixel SkyBlock account/profile to use personal profile features; market pages work without linking an account.
</details>

<details>
<summary><b>Does it support Windows?</b></summary>
Windows 10/11 x64 is a target. The NSIS/MSI build pipeline is being validated on GitHub Actions. Until the installer is published, there is no official Windows download.
</details>

<details>
<summary><b>Does it support macOS?</b></summary>
macOS ARM64 is a target. The current signed update is still distributed under the former SkyBlock Companion name. A rebranded DMG is in CI validation. Intel Macs and Linux are not release targets.
</details>

<details>
<summary><b>How do updates work?</b></summary>
The app checks a signed Tauri update manifest over HTTPS, verifies the artifact signature against the embedded public key, then offers the update. Existing installs keep their data and install identity.
</details>

<details>
<summary><b>Are my settings saved?</b></summary>
Yes. Settings, account binding, goals and watchlist are stored locally in SQLite. Updates preserve them. Uninstalling normally leaves user data in place; remove the app data folder manually only if you intend to reset it.
</details>

<details>
<summary><b>How do I report a bug?</b></summary>
Open a GitHub issue with the app version, operating system, steps to reproduce and a screenshot if safe. Remove API keys, tokens, full UUIDs and private profile details. Use the bug report template.
</details>

<details>
<summary><b>Where can I get help?</b></summary>
Join the [Discord community](https://discord.gg/bX3md4uepp) or open a GitHub issue. Do not post secrets or private account data.
</details>

---

## Troubleshooting

- **Windows SmartScreen warning:** CI test installers are unsigned. Only trust files from this repository's official Releases or Actions artifacts. A future production release needs an Authenticode certificate.
- **macOS Gatekeeper warning:** test builds use ad-hoc signing and are not notarized. Right-click → Open is a local workaround, but do not disable Gatekeeper globally.
- **No profile data:** link a Minecraft account, check the connection status, and remember that stale or partial API data is shown honestly rather than replaced with fake values.
- **Backend unavailable:** market pages may show the last cached snapshot with a warning. Retry later; the app does not hide stale data.
- **Wrong platform:** Windows builds are x64; macOS builds are ARM64 only. There is no Linux or Intel Mac release.

---

## Project status and support

- **Version:** `0.5.0-rc.5`
- **Developer:** [Beluga_8292](https://github.com/Beluga8292)
- **Discord:** https://discord.gg/bX3md4uepp
- **Issues:** https://github.com/Beluga8292/SkyForge-Helper/issues
- **CI installers:** https://github.com/Beluga8292/SkyForge-Helper/actions/workflows/installers.yml

Screenshots use the app's isolated **demo mode** (fictional profile and market data) except the Auction House image, which shows public listings without a linked account. No private UUID, balance or API key is shown.

---

## Development

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Backend:

```sh
python3.12 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements-ci.lock
backend/.venv/bin/python -m pip install --no-deps -e backend
backend/.venv/bin/python -m pytest backend/tests -q
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Security reports belong in [SECURITY.md](SECURITY.md), not public issues.

---

## License and attribution

Copyright © **2026 Beluga_8292**. Licensed under the [MIT License](LICENSE). You may study, fork, modify and redistribute the code under MIT; keep the copyright and license notices. MIT does not prohibit forks or derivative builds.

FurfSky Reborn is **All Rights Reserved** and is not bundled. Users may import a pack they have legitimately obtained. Minecraft, Hypixel and related marks belong to their respective owners. See [BRANDING.md](BRANDING.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

**SkyForge Helper is an unofficial fan project and is not affiliated with or endorsed by Hypixel Inc., Mojang Studios or Microsoft.**
