# Stage 9.4.1 — updater migration validation

Date: 2026-11-04. **Status: PARTIAL. No public binary release or production change.**

## Preflight and immutable candidate

The actual installed app in `/Applications` is **0.5.0-rc.4**, not rc.5.
An additional per-user Applications copy is rc.2. Neither was launched, replaced
or updated in this task. The local rc.5 build exists separately; its binary
contains the VDS updater endpoint. The extracted CI rc.6 binary contains the
GitHub `rc-channel` endpoint instead. Both are ARM64 and embed the same public
verification key. Native productName remains `SkyBlock Companion`; bundle
identifier remains `com.skyblock.companion`. macOS remains ad-hoc signed and
not notarized; Windows is not Authenticode signed.

Prepared rc.6 source is `f64ccaf83d568a53af4b534ab5428a4b38e5892e`.
Its [preparation run](https://github.com/Beluga8292/SkyForge-Helper/actions/runs/41810475029)
and [normal CI](https://github.com/Beluga8292/SkyForge-Helper/actions/runs/41810461174)
previously passed. Those binaries were reused, not rebuilt. GitHub draft target
still equals the build SHA, independent of later validation/documentation commits.

The two actual payloads, adjacent signatures and source receipts remain in the
unpublished `v0.5.0-rc.6` draft (8 assets). Full signatures bind the existing key,
actual bytes and exact version. SHA-256 remains:

| Platform / payload | SHA-256 |
| --- | --- |
| darwin-aarch64 `.app.tar.gz` | 4602334f3d7242259dfd1b047d79f2b8ccd5643026698b3a609f4a3b3a560c90 |
| windows-x86_64 NSIS `.exe` | 7cd25aebb332b98c246d5cf5df0e44bd28ffc29ad6bbc9a3710ed4e5911d1045 |

The manifest was regenerated from those verified bytes with bilingual RU/EN notes.
Only draft body and `latest.json` metadata were updated; no binary/signature was
replaced, no key rotated, no version/tag changed. The downloaded draft manifest
exactly matches the verified local manifest. Draft remains private/prerelease;
GitHub's authenticated draft download is not public updater delivery.

## Private backup and original data

Before any prospective update, a private owner-only backup outside Git/source
was created, including Application Support, WebKit, caches and preferences for
both legacy names. It covers **1,380 files**. Original file hashes match before
and after backup/checks. All backup directories are mode 700, files mode 600.
A consistent SQLite backup was made with SQLite's backup API; source and backup
`PRAGMA integrity_check` both returned `ok`. Row counts and per-table content
hashes are recorded privately. Current source has 12 settings, 15 cache rows,
zero watchlist rows and zero market_history rows. Real account binding is present;
its values are neither published nor included in public CI fixtures.

The backup includes storage used for account/profile, Goals, Dungeon plans,
Networth history and FurfSky IndexedDB/cache where present. A successful FurfSky
import or real-data retention after an update is NOT claimed. Keychain was not
read/exported or modified. The private backup locator and hash inventory are in
ignored `.verification/stage941/backup-location.json` and the protected backup.
Original data and working app bundles remain untouched.

## Isolation decision and macOS E2E

A copied `.app` is not adequate isolation. Tauri SQLite resolves under the home
Application Support directory; WKWebView data storage is separate, and Keychain
service/account are fixed to the legacy identity. Changing HOME or copying the
bundle does not prove isolation of all three. No unverified same-user launch was
attempted. A dedicated macOS user/VM with isolated Keychain/WebKit is the required
next environment; clone the verified data backup there and use a separate app.

There is also a delivery blocker: the unchanged published rc.5 is compiled to
read the production VDS manifest, which still advertises rc.5. The new GitHub
RC feed and rc.6 draft are intentionally not public. Redirecting production,
patching a binary or pretending a test-endpoint rebuild is the published app
would not establish the requested E2E. No such substitution was made.

Therefore **macOS native updater rc.5→rc.6 E2E: BLOCKED / NOT RUN**. Discovery,
GUI release notes, native download/install/restart and post-update data comparison
have no PASS claim or screenshots. Technical evidence consists of binary
preflight, backup hashes, signatures, manifests and runner logs, not fake GUI
screenshots. Also reconcile the user's actual installed rc.4 before a real migration.

## Windows compatibility, not updater E2E

[Windows install-over run](https://github.com/Beluga8292/SkyForge-Helper/actions/runs/41815292129)
**PASS**, with the package build matrix deliberately skipped. A disposable
Windows 2022 runner refused pre-existing app/data, downloaded the public rc.5
NSIS installer and the exact rc.6 CI artifact, and verified both pinned hashes.
It installed and launched rc.5, checked its PE product version, stopped that test
process, seeded synthetic account/profile/settings/watchlist rows, installed
rc.6 over it, checked rc.6 version and startup, and verified SQLite integrity and
fixture retention. Silent uninstall removed the executable and retained the
same fixture data. No real user's data or credentials were uploaded.

**INSTALL-OVER / RESTART / SQLITE / SYNTHETIC ACCOUNT-SETTINGS-WATCHLIST /
UNINSTALL PASS. Windows native updater E2E remains NOT VERIFIED.** This run did
not discover an update, use updater GUI, invoke the native signature/install path,
or verify FurfSky/WebView2 state. Detached signatures were verified separately;
they are not Authenticode and are not checked by simply executing the installer.

## GitHub channel and release gate

RC: `https://github.com/Beluga8292/SkyForge-Helper/releases/download/rc-channel/latest.json`.
Stable: `https://github.com/Beluga8292/SkyForge-Helper/releases/latest/download/latest.json`.
Both anonymous checks returned HTTP 404; no feed/stable release was published.
The future separate prerelease pointer avoids using GitHub latest for RCs.
No old installer release was reclassified. The rc.6 native config requires a
trusted signed version and uses GitHub RC; actual post-install request/discovery
and subsequent-update/no-loop behavior remain unverified.

Private draft URLs require authorization and cannot serve ordinary app users.
Existing manifest URLs refer to the future versioned release assets; they are not
represented as already available public URLs. Publication is a distinct owner gate.
VDS manifest was compared with the earlier snapshot and remains unchanged rc.5.
No production backend/container/Caddy/database/secret configuration was touched.

## Production and UX checks

Independent, read-only production HTTP checks: health/status 200; bound Player
and Profiles 200 with success and nonempty data; Intelligence overview 200,
`demo=false`, `stale=false`, recommendations present. Networth contains known and
unknown assets and correctly reports `complete=false`; no complete valuation
claim. These checks are not post-update application/BackendDataProvider E2E.
Private response bodies remain ignored and are not public test artifacts.

Existing RU/EN update UI uses translated labels/errors; the dialog does not
render native exception messages, endpoints, HTTP codes or raw JSON. Existing
UI was reused. Targeted updater tests **17 PASS**, TypeScript PASS. An added
partial-download AbortError case verifies no install/relaunch and safe discovery
retry. [Validation-branch CI](https://github.com/Beluga8292/SkyForge-Helper/actions/runs/41815278767)
passed frontend, backend and Rust at validation code commit `9d7c17d`; frontend
now has 370 tests. Source audit and Gitleaks passed without secret findings. Prior tests cover missing/HTML/offline manifests, signature failure,
unsupported runtime/platform, no newer version and install failure. Native
interrupted install and data preservation after such failure remain NOT VERIFIED.

## commit_refs_rules and publication path

Read-only GitHub checks found: repository/active main rulesets empty; main branch
protection API reports `Branch not protected`; authenticated owner has admin/push
permissions and OAuth repo/workflow scopes. Default Actions token is read-only,
which does not restrict the user's authenticated source push. CLI OAuth scopes
were verified; Git uses a configured credential helper, so a separate GitHub App
grant for that helper cannot be inferred from CLI OAuth state. No App permission
denial was observed. Remote main remains at the prepared build SHA;
local docs were one ordinary descendant commit ahead, without divergence/conflict.

Earlier pushes returned HTTP 500 and `fatal error in commit_refs_rules`. Exact
server-internal cause is **not established** by available API evidence; it is not
proven to be a required-check/protection rejection. No rule or permission was
changed, no force push used. The normal validation branch push succeeded. A PR
is used for documentation and this validation workflow/test extension; main and
binary build provenance are not rewritten. If server errors recur on merge,
retain the PR and contact GitHub with the saved request IDs instead of bypassing
repository protection.

## Changed files and next steps

- docs/STAGE-9.4.md, docs/STAGE-9.4.1.md, publication list and ignore allowlist.
- Existing installers workflow: optional Windows existing-binary compatibility
  path, no rebuild/signing/publication and no production access.
- Windows smoke helper: runner-only synthetic upgrade fixtures.
- Updater store test: interrupted partial download/retry; no product code change.
- Private draft notes and manifest metadata: synchronized RU/EN, same binaries.

Do not publish or change VDS from this task. Next authorized migration requires
an isolated OS environment, data backup/restore verification, approved public
candidate/feed delivery and separately approved VDS bridge. Validate anonymous
manifest/content/signatures and the actual GUI/native update chain, then compare
all preserved state and GitHub subsequent discovery. Keep old updater online.

**PARTIAL: signed candidate and Windows installer compatibility ready; real
updater migration, real-user account/data retention and public delivery blocked.**

## Stage 9.4.2 closeout — 2026-11-04

**PARTIAL — E2E BLOCKED. Not READY FOR RELEASE APPROVAL.**

[PR #1](https://github.com/Beluga8292/SkyForge-Helper/pull/1) was **MERGED** by a
normal merge after all frontend/backend/Rust and security checks passed; it was
conflict-free. Merge SHA: `0825e71d7faa55983f85e8d7ed6316ca2084aea4`. Local main was
fast-forwarded to it. No force push, admin override or branch-rule change. The
successful PR route resolves delivery of the documentation; it does not establish
the internal cause of the earlier Git push `commit_refs_rules` errors.

### Safe data preparation and real E2E result

The previous protected 1,380-file backup was rechecked against the originals:
unchanged. No redundant backup or real-app update was needed. A private restore
seed was prepared under ignored `.verification/stage942/isolated-user-seed/`,
including Application Support, WebKit, caches and preferences. Its SQLite was
restored from the consistent backup and passed integrity plus every table-content
hash comparison. Original data and both installed rc.4/rc.2 apps remain untouched.
Keychain was neither exported nor modified. This seed is **data preparation,
not a complete OS-isolated environment**; it must be restored in a separate macOS
user/VM with separate WebKit/Keychain before launching a test app. No launch was
made under an unproven same-user HOME override.

**macOS original rc.5→rc.6 updater E2E: NOT RUN / BLOCKED.** The verified public
rc.5 binary reads the unchanged production VDS manifest and cannot discover rc.6
there. The shipped frontend/native check command exposes no endpoint override;
changing its timeout/headers/target/proxy does not change the configured URL.
No modified binary, TLS interception or test-endpoint rebuild was substituted as
original published-app E2E. No native dialog/download/install/restart/data-retention
PASS is claimed.

**Windows Tauri updater flow: NOT RUN / BLOCKED** by the same unchanged VDS
manifest and unpublished delivery. The prior disposable-runner install-over and
fixture persistence PASS remains valid; it was not repeated or upgraded into a
native-updater claim. Real SQLite/account preservation after updater installation
remains unverified on both platforms.

### Release and channels

The existing rc.6 draft remains private/prerelease, targets build SHA
`f64ccaf83d568a53af4b534ab5428a4b38e5892e`, and still contains 8 assets. All remote
asset digests match the previously signature-verified local files; bilingual
release notes match `latest.json`. Previous artifact/signature/checksum results
are reused because the bytes are unchanged; no rebuild, re-sign or asset overwrite
was performed in 9.4.2. Source validation/merge commits are not substituted for
the original binary build target.

Anonymous checks returned **404** for the RC feed, stable latest manifest and
versioned rc.6 manifest. Authenticated draft access does not make these public.
The RC config uses the dedicated `rc-channel` prerelease pointer; stable uses
GitHub latest. No endpoint correction was necessary. Local installed native
updater source uses strict SemVer `remote > current` and this app does not override
that comparator: equal/older versions are not updates. This is code verification,
not a live no-loop or subsequent-update test; those remain blocked by delivery.

VDS manifest was rechecked against its prior snapshot: still unchanged rc.5.
No production API/worker, database, Redis, Caddy, API key, Auction pipeline, old
updater or unrelated VDS service was modified. No new binary or channel release
was published. Backend availability evidence remains the live 9.4.1 checks above;
there was no post-update application session to validate in 9.4.2.

To unblock: provision a verified separate OS user/VM and restore the private seed;
obtain separate approval for publishing the already verified versioned candidate
and RC pointer; verify anonymous JSON/content/bytes/signatures; obtain separate
approval for the VDS bridge if testing the unchanged published rc.5. Then run the
actual GUI/native rc.5→rc.6 chain in isolation, compare account, SQLite, settings,
Goals, Watchlist, FurfSky, history and Dungeon plans, verify backend and subsequent
GitHub discovery, and only then consider the real backed-up installation. Keep the
old updater online. A test-endpoint compatibility build must be labelled separately.

### Stage 8.4 handoff — no implementation started here

Per the current task, overall **8.4 remains PARTIAL**. The later completion section
of local `docs/STAGE-8.md` documents a narrower completed catalog/budget scope;
do not repeat the older continuation list as though those pieces were absent.
8.1 is DONE; 8.2/8.3 are DONE locally; 8.5/8.6 remain NOT STARTED.

Resume at the **verified purchase-variant pricing and catalog-coverage gap**:
`src/pages/DungeonPlannerPage.tsx` price resolver and
`src/features/dungeons/replacements.ts` `replacementCandidates`, together with
`verified-items.json`. Reuse existing market valuation to price only a confirmed
variant; otherwise keep Unknown. Add only source/version-backed lower-floor
alternatives, and verify unresolved F5/F6/Master Mode requirements before changing
gates. Pets comparison, exact dungeonization effects/cost and native imported
FurfSky remain separate unsupported/unverified surfaces.

Preserve the completed shared-material/essence basket in `budget.ts`, actual
owned-instance upgrades, v1/v2 scoped plan storage, and existing 8.1–8.3 modules.
Start with focused replacement/planner/page tests and existing UUID/profile
isolation cases; do not rebuild infrastructure or start 8.5. This is a continuation
plan only; no feature file was changed by Stage 9.4.2.
