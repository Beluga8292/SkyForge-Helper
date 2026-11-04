# Update channel policy

The inherited trust key, native identity and data directories do not change.
Published rc.5 still reads the VDS. Candidate rc.6 source reads the exact GitHub
pre-release feed URL in channels.json. The `rc-channel` tag is ONLY a manifest
pointer, never an application source/version tag. Each payload uses a separate
`v<version>` release whose target must equal its receipt's build commit.

Stable source builds use `/releases/latest/download/latest.json`. GitHub excludes
prereleases from latest; the existing `v0.5.0-rc.5-installers` is not an updater
release and is never converted to stable. The RC feed is a distinct prerelease,
so publishing/promoting an RC cannot make stable clients install it.

Neither rc-channel nor rc.6 binaries are published by source pushes. Until the
owner explicitly approves publication, the new RC endpoint can return 404; that
is an update-check error, not a false "up to date" result.

## Preparation (no signing secrets in CI)

Run `SkyForge Helper updater preparation` manually on reviewed main with the exact
candidate version. It validates and builds unsigned macOS .app.tar.gz and Windows
NSIS .exe payloads plus source/identity/hash receipts. Tauri 2 reuses the NSIS EXE
itself with an adjacent .sig; a v1 .nsis.zip is not substituted. The macOS archive
has the actual legacy .app as its root. Both builds reuse the existing toolchain,
permissions and per-user setup. No release write permission or private keys.

Download the artifacts from the successful exact workflow/source SHA. Review run
provenance and receipts before signing. Locally, with private key/password files
mode 600 (never in chat), run:

```
node scripts/sign-updater-local.mjs <payload> <approved-full-source-commit>
node scripts/updater-manifest.mjs <private-input.json>
```

Input fields: version, notes, date (RFC3339), commit, entries [{file, receipt}], and
output (a fresh ignored local directory). The generator verifies actual bytes,
full minisign signatures including trusted version comments, source identity and
SHA-256. Missing platforms are excluded, never filled with fake links/signatures.
Receipt paths/keys are not signing credentials. Final manifest contains signature
CONTENT and immutable versioned release URLs. Local output remains unpublished.

An optional `create-updater-draft.mjs <input> --create-private-draft` creates only a
private draft after verification. It refuses overwrites and fixes the target to
the build commit. Publishing, stable promotion or updating the rc-channel pointer
requires separate owner authorization. Never pass signing keys into Actions.

## Owner-approved migration, later

1. Privately back up real SQLite via SQLite backup API, settings and WebKit/
   IndexedDB/FurfSky state before any real update. Do not reset or rename paths.
2. Validate both signatures/checksums, isolated install/update and state retention.
3. After explicit permission, publish the verified version-specific prerelease.
4. Verify anonymous HTTPS manifest/assets (not HTML) and signature of downloaded
   bytes; then explicitly publish/update the separate prerelease RC feed pointer.
5. Prepare one VDS bridge manifest with the SAME verified GitHub payload URLs;
   apply it only after separate authorization. Keep old artifacts/service online.
6. Verify actual rc.5→rc.6 and subsequent GitHub discovery on an isolated copy,
   then the user's backed-up install. Do not declare UPDATE E2E from build success.
7. Only after migration succeeds plan old updater-service retirement separately.

`probe-updater-manifest.mjs <https-url>` validates an actually published manifest
and downloads/verifies all its payloads. Missing endpoints, HTML or bad signatures
are errors. There is no auto-publication command in the preparation workflow.
