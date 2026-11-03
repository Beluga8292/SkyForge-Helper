# SkyForge Helper compatibility migration

Developer: Beluga_8292. Copyright (c) 2026 Beluga_8292. MIT.

The new UI/window/documentation brand is **SkyForge Helper**. Published
**SkyBlock Companion 0.5.0-rc.5** artifacts and notes are historical and are not
renamed, repackaged or tagged from this newer development tree.

## Identity retained

- Tauri productName: `SkyBlock Companion` (compatibility blocker below).
- Bundle identifier: `com.skyblock.companion`.
- Cargo/npm internal names and executable/library identity remain stable.
- SQLite filename: `skyblock-companion.sqlite3`; settings/cache/keyring namespaces
  and app_data_dir resolution are unchanged.
- Existing updater HTTPS endpoint and public verification key are unchanged.
- No new private signing key, VDS manifest, production backend or data migration.

## Why full native rename is blocked

Tauri documents productName as a platform/install identity: on macOS it names the
.app bundle; on Windows it names installers, install directory, Start Menu and
registry paths, and participates in the default WiX upgrade code. Preserving only
the bundle identifier is insufficient proof of upgrade compatibility.

Sources: [Tauri configuration](https://v2.tauri.app/reference/config/#productname),
[NSIS template](https://github.com/tauri-apps/tauri/blob/dev/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi),
[updater source](https://github.com/tauri-apps/plugins-workspace/blob/v2/plugins/updater/src/updater.rs).
The locally installed updater 2.14.1 also derives the existing macOS bundle path
from its executable. This is source inspection, not an upgrade E2E PASS.

Current builds therefore retain the old inner .app/install identity. New test
artifact archives/checksum files may use the SkyForge-Helper prefix and clearly
state `compat-dev`. This does not rename old rc.5 downloads. Full native productName
and installer display-name migration is **BLOCKED pending isolated upgrade tests**.

## Required migration verification before a future release

1. Capture old NSIS registry/manufacturer/install-directory and MSI UpgradeCode,
   executable identity and user data paths from the actual old installers.
2. In disposable macOS and Windows environments, install the exact signed old
   rc.5 build; seed test-only settings, binding, Goals, Watchlist and texture pack.
3. Try a separately versioned migration candidate, retaining identifier, keyring,
   database paths and updater public key. Pin compatible Windows upgrade identity
   and installer detection explicitly if a rename requires it.
4. Verify manual install-over and signed updater flow independently. On macOS
   verify existing bundle replacement/relaunch; on Windows verify one uninstall
   entry, shortcuts, WebView2, launch, update and uninstall semantics.
5. Verify test data survives an update and supported rollback. Never test by
   overwriting the user's real installation or resetting real data.
6. Only after evidence and explicit release approval change productName for an
   authorized future version. Do not put a v0.5.0-rc.5 tag on this development tree.
