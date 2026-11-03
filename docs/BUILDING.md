# SkyForge Helper builds

Use Node 24, Rust stable and the Tauri 2 platform prerequisites. Frontend uses
`npm ci` / package-lock.json; Rust uses Cargo.lock and `--locked`; Python 3.12
uses `backend/requirements-ci.lock`. The Python lock reflects the installed
backend/test resolution and still needs clean Linux-runner verification.

CI runs on push/PR/manual dispatch without production secrets or deployment.
Manual `installers.yml` uses real macOS ARM64 and Windows x64 runners, creates
compatibility-test artifacts and SHA256SUMS.txt, and never creates a GitHub Release,
latest.json or updater upload. Actions are pinned to immutable commit SHAs.
GitHub Actions have not yet executed: do not equate workflow preparation with PASS.

Packaging runs `scripts/prepare-ci-build.mjs`, then `scripts/build-compat-native.mjs` (Rust path remapping), then Tauri with a generated overlay
that disables updater artifacts. The production public verification key/endpoint
in the source are unchanged. No signing private key is staged into these jobs.
macOS ad-hoc signing is not Developer ID/notarization; Windows Authenticode is
not configured. NSIS WebView2 bootstrapper/default installation requirements need
real Windows installation testing. MSI/NSIS compilation alone is not E2E.

macOS DMG creation uses hdiutil after app bundling, avoiding Finder automation.
Version, architecture and bundle identifier are checked against the existing
compatibility identity. Archives use SkyForge-Helper + version + compat-dev +
platform names; the inner native identity remains legacy until the migration gate.

Before any distribution: verify installer signatures/status, scan the actual
unpacked bundles for secrets/proprietary packs, review bundled dependency notices,
verify checksums, then install/launch/backend-connect/update/uninstall in isolated
Windows/macOS environments. Seed test-only Goals/Watchlist/binding/SQLite and pack
state to verify preservation. Never use the user's live installation as a fixture.
No installer E2E or signing success is inferred from static YAML validation.

The inherited rc.5 package version is development source newer than the original
release. Do not overwrite/tag original rc.5 artifacts with these builds. A future
version change, native rename and release require separate authorization.
