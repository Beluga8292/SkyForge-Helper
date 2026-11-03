# Security

Never include Hypixel keys, Tauri signing secrets, Apple/Windows certificates,
SSH credentials, databases, resource packs or local diagnostics in commits/issues.
Use `.env.example` as a configuration template; real `.env` files remain local.
VITE_* variables are public client configuration and must never contain secrets.

The desktop BYOK key uses the OS credential vault. The backend uses its own
server-side environment. Ordinary pull-request CI receives neither key nor
production credentials. Local imported resource packs remain on the user's device.

Before the first publication, review `docs/PUBLICATION-FILES.txt`, run
`python3 scripts/audit-publication.py`, review third-party notices, and approve the
exact staged tree. The scanner reports paths/rule names, never matched values.
A heuristic PASS is not proof against every possible secret; owner review remains
required. Re-run after any staged change. Do not push the whole local directory.

No public security contact is verified yet. Do not post secret-bearing reports in
public issues. A private reporting/contact channel must be configured by the
repository owner before public publication.
