# Third-party notices

SkyForge Helper original code is MIT, Copyright (c) 2026 Beluga_8292.
Third-party code/data retain their own licenses; the root MIT license does not
relicense resource packs, game assets, fonts or dependencies.

- **FurfSky Reborn:** All Rights Reserved. Original pack textures/ZIP/CATS are
  not included in this source tree or installer resources. Import remains local,
  user initiated. The importer/resolver implementation is original project code.
- **NotEnoughUpdates-REPO:** MIT. Catalogs/advisor metadata and selected lore derive
  from commit `423bcc754b530a52ac87190bd77cb286aabd564b` at
  https://github.com/NotEnoughUpdates/NotEnoughUpdates-REPO . Retain
  [the upstream license](docs/third-party/NEU-LICENSE.txt), including its copyright.
- **Hypixel:** item/API metadata are sourced from the Hypixel Public API; this is
  not ownership of Hypixel/Mojang intellectual property. Respect the API's terms,
  limits and key requirements. Metadata snapshots record provenance.
- **Minecraft / Mojang:** game assets and names belong to their owners. Vanilla
  texture assets are fetched/cached at runtime by the existing resolver, not
  bundled wholesale or relicensed as MIT. This is an unofficial companion.
- **Inter and JetBrains Mono:** font packages use SIL Open Font License 1.1;
  retain OFL notices in redistributed font-bearing bundles.
- **React, Vite, Radix, Zustand, TanStack Query, Recharts, Lucide, Zod and other
  JS libraries:** see exact installed metadata and retained license notices.
- **Tauri and plugins:** generally MIT OR Apache-2.0; Rust transitive components
  have their own licenses. Redistributed native components require their notices.
- **Backend libraries:** FastAPI, Starlette, Pydantic, HTTPX, SQLAlchemy, Redis
  client and other installed Python distributions retain their licenses.

[Dependency inventory](docs/THIRD-PARTY-INVENTORY.json) and
[retained license texts](docs/third-party/DEPENDENCY-LICENSES.txt) are generated
from installed metadata. They include build-only dependencies, not a claim that
all listed code ships in the app. Lightning CSS has MPL-2.0 metadata and a build
libvips package has LGPL-3.0-or-later metadata; source/license obligations must be
reviewed for actual distributed components. Unknown platform-specific license
metadata and target-platform bundled dependency notices remain a distribution
review gate. This inventory is not a complete legal compliance certification.

Do not add proprietary packs or third-party artwork without permission.
