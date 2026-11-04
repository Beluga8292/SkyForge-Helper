# Stage 10 — functional repair checkpoint

2026-11-04. This checkpoint completes **10.1 locally**, not all of Stage 10.
No production deployment or new binary release was authorized/performed.

| Substage | Status |
| --- | --- |
| 10.1 Auction House search | **DONE locally / production rollout pending permission** |
| 10.2 Accessory and upgrade prices | NOT STARTED |
| 10.3 Progression repair | NOT STARTED |
| 10.4 Automatic language and API Help | NOT STARTED |
| 10.5 Textures/design system | NOT STARTED |
| 10.6 Full UI redesign | NOT STARTED |
| 10.7 Cross-platform final QA | NOT STARTED |

## Actual cause and data path

There was **no 1,000-row backend snapshot cap**. Official Hypixel pages contain
up to 1,000 listings; the Direct provider returned one such page. Backend mode
already returned 50 rows. AuctionPage nevertheless filtered/searched/sorted only
that returned array, reset its search on page navigation, and showed obsolete
“search the loaded page / 1,000 items” text. The backend's existing global basic
search, filtered total and sorting were not connected to this UI. useAuctions
also unconditionally re-sorted returned rows by ending time, overriding server
price order.

Current path remains Hypixel → worker → complete atomic Redis snapshot with a
bounded API memory copy → API filter/sort → 50-row response → frontend.
PostgreSQL stores market history, not a SQL-limited Auction search index. There
was no SQL LIMIT-before-search bug on this path. The worker's existing same
lastUpdated/totalPages/totalAuctions checks, UUID deduplication, missing-page
rejection and retain-previous-complete-on-failure behavior are preserved.

Initial read-only measurements: production reported 42,510 raw listings and the
contemporary official first page reported 42,504 over 43 pages (different live
generations, not an expected equality). One pinned Redis generation was copied
read-only, in existing small chunks, without fetching another full Hypixel feed:
**42,484 unique listings, 43 pages, 103,913,611 serialized bytes**. No production
cache keys/config/data were changed.

## Implemented

- Worker adds a small normalized search key to each row before atomic publish.
  Reuses immutable auction-UUID metadata between generations, prunes removed UUIDs.
  NBT gzip/base64/parsing is bounded; malformed identity remains searchable by
  name/auction UUID and lowers identity coverage. No NBT decode in HTTP search.
- Search: case/formatting/apostrophe/whitespace normalization; token matching of
  names, reforge prefix, decoded item ID, item UUID, enchantment names, scroll IDs;
  explicit AOTV/AOTE aliases. Broad search matching is NOT pricing equivalence.
- All filters and sort operate before slicing: All/BIN/Auction, rarity, category,
  finite non-negative min/max current price, ending window; price asc/desc,
  ending soon and newest, UUID tie-breaker. Bidding prices are not labelled BIN.
- Response preserves global filtered count and adds capability, completeness,
  page-count, identity-coverage and whole-snapshot category metadata. Internal
  search keys are excluded from list/detail responses. Unknown completeness is
  explicit for a legacy worker; failed refresh serves the previous full stale
  snapshot, not a silently truncated new one.
- Separate optional DataProvider search method leaves old getAuctions consumers
  and Smart Flip Finder contracts intact. Full query/scope/page keys, AbortSignal,
  300ms debounce, Enter, clear, URL/bookmark/Back support; new filters reset page.
- Backend results are not filtered or re-sorted in the page. Filtered totals,
  bounded 50 rows, snapshot time, explicit stale/identity/incomplete notices,
  loading/empty/error states and invalid-price feedback. Out-of-range page is
  corrected after refreshed totals shrink. Advanced filters are collapsed.
- Server-query pages use short in-memory query caches, no per-search SQLite
  persistence; visible-page refresh every 45 seconds, no background-tab polling.
- Older production API's basic global search remains usable; unsupported advanced
  filters fail with an explicit backend-update message instead of silently
  ignoring them. Direct/Demo are labelled limited previews (at most 50 displayed
  rows), with global controls disabled. No provider/account binding is changed.
- Category metadata covers the whole snapshot, not only categories on one page.
  Structured attribute filtering is not advertised: the new index does not
  expose a verified structured attribute contract. No invented fuzzy aliases.

## Real full-snapshot validation

An isolated local API indexed the copied real generation once, with upstream
requests disabled. All **42,484** item identities were decoded; search text used
7,519,544 UTF-8 bytes; initial preparation took 1.974 seconds on this Mac. This is
one observed preparation, not a VDS performance/peak-memory guarantee. The original
upstream timestamp was preserved; the offline generation correctly displays stale.

Independent whole-array oracle and real HTTP checks passed:

- Exact UUID from raw index position **1,000** was found on search page zero.
- Global lowest-price first 50 and next 50 matched the independent sorted set.
- BIN + category + rarity + min/max matched **3,035** records globally.
- Active count at test time was **42,277**, below raw count because expired/claimed
  rows are excluded; counts naturally change as listings expire.
- Hyperion **87**, Necron's Chestplate **292**, Juju **97**, Terminator **699**,
  Aspect of the Void **134**, Ender Artifact **44**, Wither Shield **33**, Divan
  **296**. These are results in the copied generation, not promises of live stock.

Browser smoke used a separate localhost origin and this real snapshot, with no
user binding/import/cache touched. Verified search, Juju page 1→2 preserving query,
Enter/new search returning to page 1, BIN (**94** Juju), Lowest Price, Back restoring
query/filters, explicit stale warning, and HTTP error distinct from empty results.
A controlled Hyperion response delay plus rapid Juju replacement exercised the
last-query UI; obsolete request cancellation is also covered at transport level.
Screenshot and raw evidence stay ignored under `.verification/stage10/`.

## Checks and scope

Frontend **380 tests PASS**; TypeScript PASS; Vite build PASS, with existing chunk
warning only. Full backend regression **175 tests PASS**, including the **56** targeted API/Auction/Market cases. Ruff PASS. New cases cover >1,000
rows, global counts/order/windows/filters, malformed/identity search, decoder reuse
and pruning, missing-generation rows preserving old snapshot, HTTP bounds,
legacy-server capability guard, AbortSignal, source order, partial/error/preview
rendering. Smart Flip and existing market regressions pass. Rust/native application
build was not rerun: no Rust/Tauri/updater changes, and this is not a shipped build.
Vite used `--emptyOutDir false` to preserve existing updater artifacts.

No accessory price resolver, upgrade basket or progression rule was changed.
No API-settings instruction is guessed/added here. Language remains the existing
manual RU/EN system; automatic language is 10.4. No FurfSky assets were bundled,
no texture import/cache was reset, no UI-wide redesign attempted.

## Deployment gate and next handoff

Requires explicit approval before deploying **only SkyForge backend API + worker**
from the same reviewed source. Additive snapshot fields, no DB migration, new
ports, .env/key changes, global Redis/PostgreSQL changes or new services. API
first tolerates old snapshot metadata; worker then publishes the complete indexed
generation. Retain Redis data and old images for rollback; API/worker rollback can
read the additive format. Do not alter the rc.6 updater/manifest or replace rc.6
binaries; the desktop fix needs a separately authorized future app release.

Read-only container sample before changes: API 740 MiB / 1.25 GiB; worker 775.8 MiB
/ 1 GiB; Redis 223 MiB / 512 MiB. New search text adds about 7.5 MB plus Python/key
and serialization overhead, possibly in two generations. VDS peak RSS/CPU and a
first/steady worker refresh must be checked within existing budgets during an
approved rollout. The local timing does not authorize raising RAM or changing
other projects. Keep old full snapshot available; stop/revert only this rollout
if resource limits/health are threatened. No production deployment was done.

Next: **10.2**, diagnose actual accessory/upgrade resolver identities, variants,
BIN comparables versus Bazaar sides, unknown/stale sources and family/MP rules.
Reuse the existing basket. Do not treat the broad search key as an exact-market
variant match. 10.3–10.7 remain unstarted; do not declare Stage 10 DONE.
