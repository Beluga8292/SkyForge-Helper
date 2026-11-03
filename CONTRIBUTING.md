# Contributing to SkyForge Helper

Thanks for helping improve SkyForge Helper. The project is maintained by **Beluga_8292** and is licensed under the MIT License.

## Before you start

- Use GitHub Issues for bugs and feature proposals. Use [SECURITY.md](SECURITY.md) for security reports.
- Read the [README](README.md), [build guide](docs/BUILDING.md) and [architecture notes](docs/ARCHITECTURE.md).
- Do not post API keys, tokens, passwords, full account UUIDs, private profile data or database dumps.
- Keep pull requests focused. Avoid unrelated formatting or dependency churn.

## Development

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Backend changes also require:

```sh
python3.12 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements-ci.lock
backend/.venv/bin/python -m pip install --no-deps -e backend
backend/.venv/bin/python -m pytest backend/tests -q
```

Rust changes require `cargo test --locked --manifest-path src-tauri/Cargo.toml --lib` on a supported desktop host.

## Pull requests

1. Explain the user-visible problem and the chosen fix.
2. Add or update tests for behavior changes.
3. Preserve the honest unknown/partial states; never replace missing data with zero or invented values.
4. Keep the legacy install identity (`com.skyblock.companion`, SQLite path, updater key and endpoint) unchanged unless a reviewed migration is part of the change.
5. Update user documentation when behavior, installation or platform support changes.
6. Confirm no secrets or personal data are included.

## Branding and third-party assets

Official builds are named **SkyForge Helper**. Derivative builds must clearly identify themselves and must not imply endorsement. FurfSky Reborn is All Rights Reserved and must not be bundled. See [BRANDING.md](BRANDING.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

By contributing, you agree that your contribution is licensed under the repository's MIT License. Keep existing copyright and license notices.
