# Security policy

SkyForge Helper is an unofficial desktop companion for Hypixel SkyBlock. We take reports about the app, its update channel and its hosted backend seriously.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub's private vulnerability reporting:

https://github.com/Beluga8292/SkyForge-Helper/security/advisories/new

If private reporting is unavailable, contact the maintainer through the Discord server and ask for a private channel. Do not post exploit details, keys or personal data publicly.

Include:

- affected version and platform;
- a short impact description;
- reproduction steps or a proof of concept with secrets removed;
- whether the issue affects the desktop app, updater, backend or documentation.

## Scope

In scope: the Tauri desktop app, updater configuration and release artifacts, the FastAPI backend code in this repository, authentication/credential handling, local SQLite storage, and bundled dependencies.

Out of scope: Hypixel/Mojang service outages, game-account bans, social engineering, and vulnerabilities in third-party services outside this repository. Please report those to the relevant provider.

## Secrets

Never commit or publish:

- `HYPIXEL_API_KEY` or any backend environment file;
- Tauri updater private keys or passwords;
- Apple/Microsoft signing certificates;
- GitHub tokens, database dumps or user data.

The app does not require a Hypixel API key for normal use. Direct/BYOK mode stores an optional key in the operating-system credential vault. The hosted backend keeps its key server-side.

## Supported versions

Security fixes target the current pre-release line. Older release candidates may not receive fixes. Check the latest release notes and this repository for status.

## Disclosure

Please allow reasonable time to investigate and ship a fix before public disclosure. We will credit reporters who want attribution and will avoid publishing personal data.
