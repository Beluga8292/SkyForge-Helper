<!--
Release page template for a future, explicitly approved SkyForge Helper build.
Do not use this to imply that an installer is already published. Only create a
GitHub Release after CI validation, signing review and separate authorization.
Replace every bracketed placeholder and delete this comment before publishing.
-->

# SkyForge Helper — Version [X.Y.Z]

[One-sentence summary of the user-visible change.]

> SkyForge Helper is an unofficial desktop companion for Hypixel SkyBlock and is
> not affiliated with or endorsed by Hypixel Inc., Mojang Studios or Microsoft.

## What's new

- [Change 1]
- [Change 2]
- [Change 3]

## Downloads

| Platform | File | Notes |
| --- | --- | --- |
| Windows 10/11 x64 | `SkyForge-Helper-Setup-x64.exe` | Per-user NSIS installer. WebView2 is installed automatically when missing (internet required). |
| Windows 10/11 x64 (optional) | `SkyForge-Helper-x64.msi` | Only attach when the MSI has passed the same clean-install checks. |
| macOS 12+ Apple silicon | `SkyForge-Helper-macOS-arm64.dmg` | Open, drag to Applications, launch. |
| All | `SHA256SUMS.txt` | Verify downloads before running them. |

## Installation

**Windows:** download the Setup file, run it, then open **SkyForge Helper** from
the Start Menu. No terminal, Python, Node.js, Rust, PostgreSQL, Redis, backend URL
or Hypixel API key is required.

**macOS:** download the DMG, open it, drag **SkyForge Helper** to **Applications**
and launch it.

## Supported operating systems

- Windows 10/11 x64
- macOS 12 or newer on Apple silicon (ARM64)

Intel Macs and Linux are not release targets.

## Known limitations

- [Unsigned / ad-hoc signed build warnings: SmartScreen or Gatekeeper may warn.]
- [Native app bundle may still use the legacy SkyBlock Companion identity until the tested migration lands.]
- [Any feature-specific limitation confirmed by CI or manual testing.]

## Upgrade and user data

Existing settings, account binding, Goals and Watchlist stay in the local SQLite
database. Install-over behavior and updater compatibility must be verified before
this release is announced.

## Release integrity

- SHA-256 checksums are provided in `SHA256SUMS.txt`.
- The updater verifies signed update artifacts against the embedded public key.
- [Signing status: Authenticode / Apple Developer ID / notarization.]

## Support

- Discord: https://discord.gg/bX3md4uepp
- Issues: https://github.com/Beluga8292/SkyForge-Helper/issues
- Security: https://github.com/Beluga8292/SkyForge-Helper/security/advisories/new
