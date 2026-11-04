# Stage 9.4 FINAL — public rc.6 and updater migration

2026-11-04. Release publication and the one-time VDS bridge were explicitly
authorized by the final task. Previous blocked/draft reports remain historical.

## Published release and provenance

[SkyForge Helper 0.5.0-rc.6](https://github.com/Beluga8292/SkyForge-Helper/releases/tag/v0.5.0-rc.6)
is a public **prerelease**, not stable. Its source tag points exactly to
`f64ccaf83d568a53af4b534ab5428a4b38e5892e`, matching original CI receipts and
build version. Later README/test/documentation commits are not substituted for
the original binary source. Existing rc.5 assets/release were not replaced.

The validated CI application was reused. Missing macOS DMG was packaged locally
with `hdiutil create -volname 'SkyForge Helper' -srcfolder <app-and-Applications-link>
-format UDZO <output.dmg>`; no app rebuild or re-sign. Every bundled file in that
DMG matches the signed CI updater tar; native identity/version and codesign pass.
macOS remains ARM64/ad-hoc/not notarized; Windows x64 lacks Authenticode. These
limits are disclosed in bilingual RU/EN release notes.

Nine uploaded public assets:

- `SkyForge-Helper_0.5.0-rc.6_windows-x86_64-setup.exe` — per-user NSIS installer
  AND actual Tauri 2 updater payload; its `.sig` and `.receipt.json`.
- `SkyForge-Helper_0.5.0-rc.6_darwin-aarch64.app.tar.gz`, its `.sig` and `.receipt.json`.
- `SkyForge-Helper-macOS-arm64.dmg`, `latest.json`, `SHA256SUMS.txt`.

| Binary | SHA-256 |
| --- | --- |
| Windows NSIS EXE | 7cd25aebb332b98c246d5cf5df0e44bd28ffc29ad6bbc9a3710ed4e5911d1045 |
| macOS updater tar | 4602334f3d7242259dfd1b047d79f2b8ccd5643026698b3a609f4a3b3a560c90 |
| macOS DMG | be2726f690e82b317f0b959892e4f7f3b4071af7faf1d5270eaf80bbc9a4fdc6 |

All nine URLs were fetched **without authentication**: actual size, SHA-256 and
non-HTML content checked. EXE/DMG/archive formats checked. Both signatures were
verified again on the anonymously downloaded bytes, including trusted exact
version and inherited verification key. Release tag and manifest provenance pass.

## Channels and one-time VDS bridge

[Public RC feed](https://github.com/Beluga8292/SkyForge-Helper/releases/download/rc-channel/latest.json)
returns valid rc.6 JSON and immutable versioned GitHub payload URLs. Its separate
`rc-channel` prerelease is a manifest pointer, not another application/source
version. It targets the known source commit but is not an application version tag.
The stable `/releases/latest/download/latest.json` channel remains separate and
no fake stable release was created. rc.6 requires signed versions. Future RCs
update this pointer and versioned GitHub assets, without another VDS rollout.

VDS `updates/latest.json` alone was atomically replaced with the verified rc.6
manifest. It now points both platforms directly to signed GitHub assets. Before
replacement, old bytes were SHA-verified and backed up privately outside the
nginx document root. Restore was rehearsed against a scratch file and byte hash.
The public VDS bridge was then probed: both downloaded payload signatures pass.

Manifest rollback (restores only rc.5 pointer, does not alter binaries/data):

```
ssh kkmt python3 /opt/skyblock-companion/.updater-manifest-backups/20261104T144255Z-rc6/rollback.py
```

The script checks expected current/backup hashes and replaces atomically. Do not
run it casually: it is a rollback for a confirmed defect. No backend, worker,
PostgreSQL, Redis, Caddy, SSH/firewall, key, Auction/Bazaar pipeline or other project
configuration changed. All **14** running container IDs matched before/after.
`skyblock-updates`, old history and artifacts remain online and untouched.

## Real macOS updater E2E — PASS

The actual working `/Applications` app was **rc.4**, so the proven chain is
**original installed rc.4 → rc.6**, not a relabelled rc.5 test build. Its previous
verification key matched. Bundle and parent were writable; identity/data paths
are unchanged. No full separate OS isolation was claimed. Use of the working
installation followed the authorized risk check, fresh protected 1,380-file data
backup, SQLite backup API/integrity check, and a verified original-app rollback
copy. No binary patch or test endpoint override was used.

Observed through the real native UI:

1. Original app launched and automatically discovered rc.6 through the VDS bridge.
2. Actual update dialog showed rc.6 and release notes.
3. User-facing Update button downloaded the real GitHub payload.
4. Tauri reached “downloaded and verified”; signature verification was not disabled.
5. Install/restart button installed the payload and closed the original process.
6. rc.6 **automatically restarted** before any app-selection call. Process/path,
   Info.plist version, codesign and exact installed Mach-O hash matched CI payload.
7. Bound profile and real market data loaded through BackendDataProvider.
8. FurfSky import remained visible; actual Networth loaded, marked partial/fresh
   with unknown assets, rather than claiming complete account value.
9. Manual Check for updates in rc.6 returned “latest version”; no repeat dialog.
   Installed native binary contains the GitHub RC feed, not the VDS updater URL.

No ordinary user Terminal commands were involved in the updater UI flow.
Evidence remains private in ignored `.verification/stage94final/`: update-available,
verified-download, rc.6 GitHub-current and Networth screenshots, pre/post SQLite
snapshots, persistence results and anonymous-download/probe logs. Screenshots and
user databases are not uploaded with public source/release artifacts.

## Data retention

SQLite integrity PASS; all 12 existing setting rows/configurations retained,
including exact account UUID/profile binding and language. Only the expected
market-alert `lastSnapshot` evaluation marker changed; the rule itself remained.
Original watchlist and market-history tables were empty and stayed preserved.
Saved Goals/history namespaces had empty goals/history; no pre-existing Dungeon
plan existed. Nonempty real-user examples of these were not fabricated or claimed.
Their scoped storage/unit tests and prior synthetic Windows persistence evidence
remain separate from this live baseline.

The actual `sbc-textures` IndexedDB was identified using its encoded database name.
All logical records across its tables matched before/after: 2,538 item mappings,
3,638 texture-store records, 1,248 vanilla records, pack metadata retained. UI
shows the existing imported pack and 2,376 pack textures. Main SQLite integrity
is verified; WebKit's custom IDBKEY collation was not replaced to fake an integrity
check. IndexedDB preservation is established by logical-record comparison.

## Windows native updater result

**PASS — actual published rc.5 → rc.6 Tauri updater**, not install-over.
[Successful disposable Windows 2022 run](https://github.com/Beluga8292/SkyForge-Helper/actions/runs/41855764191)
used the published, checksum-pinned rc.5 installer and no rebuilt binary. It
seeded only synthetic account/settings/watchlist fixtures in an empty runner.
WebView2/CDP clicked the shipped application's actual dialog buttons; no IPC
updater mock, endpoint override, signature bypass or manual rc.6 installer launch.

Confirmed: discovery/dialog/release notes → real payload download/native signature
→ native installer → old process exit → **automatic** rc.6 restart (no harness
launch) → native version query + PE ProductVersion rc.6 + one running app process
→ fresh GitHub update check returned current/no repeat dialog → SQLite integrity
and exact synthetic account/settings/watchlist retention. Screenshots and result
JSON are Actions artifacts. Real Windows user data or a real Windows Hypixel
profile were not used; no such claim is made.

The first diagnostic run reached verified download but lost the controller after
NSIS restart; the next stopped before updating because the bootstrap SQLite file
existed before its schema was ready. Harness-only fixes persisted debugging in the
disposable user environment and waited for all four tables. The successful run
then completed the full native chain in seconds, with unchanged published bytes.
Earlier failed runs are not relabelled PASS. No further installation retries or
application/installer fixes were needed. Debugging exists only in this manual,
opt-in disposable-runner test, never in a shipped config or the user's app.


## README, checks and final status

README EN/RU buttons, version badges, release notes links and installation names
now target actual public rc.6 assets. `release/channels.json` records published
installer metadata and the README checker consumes it instead of hardcoding rc.5.
Network README checks PASS: EXE/DMG/release page/Discord/badges returned their
expected content types; binary bytes were independently fully verified above.

No native app rebuild or repeated full manual regression suite was performed.
Normal source CI retains frontend 370 tests, backend/Rust and security checks.
Only release presentation, validation harness and reports changed in source; no
Stage 8 product feature was rewritten. Private keys, personal SQLite/settings,
resource packs and screenshots remain excluded from Git and release artifacts.

**MIGRATION COMPLETE.** macOS real working installation and Windows disposable
native updater chains both proved installation, automatic restart and switching
to GitHub discovery. Known remaining limitations: macOS notarization and Windows
Authenticode absent; Networth can remain correctly partial; native real-user
nonempty Goals/Dungeon-plan/Watchlist history examples were absent and are not
claimed tested. Keep the VDS bridge/old updater online; do not decommission it in
this task. Stage 8.4 is the next feature task, not part of this release work.


Next feature task is **Stage 8.4**, not another infrastructure stage. Resume the
verified purchase-variant price/catalog coverage gap in DungeonPlannerPage and
`features/dungeons/replacements.ts`/`verified-items.json`; preserve completed
shared materials/essence budget and scoped storage. Read the later completion
section of local Stage 8 report before repeating older TODOs. Do not redo 8.1–8.3
or start 8.5/8.6 automatically. No Stage 8 feature was started here.
