"""Local installed-dependency attribution inventory; Python 3.12, no network."""
from pathlib import Path
import hashlib
import importlib.metadata
import json
import tomllib

rows, texts = [], {}
def retain(folder, label):
    for f in folder.iterdir():
        if f.is_file() and f.name.lower() in {"license", "license-mit", "license-apache", "license.md", "license.txt", "licence", "copying", "ofl.txt", "notice", "notice.txt"}:
            text = f.read_text(errors="replace")
            texts.setdefault(hashlib.sha256(text.encode()).hexdigest(), (label + " / " + f.name, text))

for p in Path("node_modules").rglob("package.json"):
    try:
        d = json.loads(p.read_text())
        if not d.get("name") or not d.get("version"):
            continue
        lic = d.get("license", "UNKNOWN")
        if isinstance(lic, dict):
            lic = lic.get("type", "UNKNOWN")
        rows.append(dict(ecosystem="npm", name=d["name"], version=d["version"], license=str(lic)))
        retain(p.parent, d["name"] + " " + d["version"])
    except (ValueError, OSError):
        continue
roots = list((Path.home() / ".cargo/registry/src").glob("*"))
for pkg in tomllib.loads(Path("src-tauri/Cargo.lock").read_text())["package"]:
    if "registry+" not in pkg.get("source", ""):
        continue
    folder = next((r / f"{pkg['name']}-{pkg['version']}" for r in roots if (r / f"{pkg['name']}-{pkg['version']}").exists()), None)
    lic = "UNKNOWN"
    if folder:
        lic = tomllib.loads((folder / "Cargo.toml").read_text())["package"].get("license", "UNKNOWN")
        retain(folder, pkg["name"] + " " + pkg["version"])
    rows.append(dict(ecosystem="cargo", name=pkg["name"], version=pkg["version"], license=lic))
for dist in importlib.metadata.distributions():
    meta = dist.metadata
    lic = meta.get("License-Expression") or meta.get("License") or "UNKNOWN"
    if len(lic) > 120:
        label = (meta.get("Name") or "unknown") + " " + dist.version
        texts.setdefault(hashlib.sha256(lic.encode()).hexdigest(), (label, lic))
        lic = "SEE RETAINED LICENSE TEXT"
    rows.append(dict(ecosystem="python-installed", name=meta.get("Name", "UNKNOWN"), version=dist.version, license=lic))
    for file in dist.files or []:
        path = Path(dist.locate_file(file))
        if path.is_file() and path.name.lower() in {"license", "license.txt", "license.md", "copying", "notice"}:
            text = path.read_text(errors="replace")
            texts.setdefault(hashlib.sha256(text.encode()).hexdigest(), (meta.get("Name", "UNKNOWN") + " " + dist.version, text))
rows = list({(r["ecosystem"], r["name"], r["version"]): r for r in rows}.values())
Path("docs/THIRD-PARTY-INVENTORY.json").write_text(json.dumps({"scope": "Installed dependency metadata, not a legal compatibility certification", "dependencies": sorted(rows, key=lambda r: (r["ecosystem"], r["name"], r["version"]))}, indent=2) + "\n")
Path("docs/third-party/DEPENDENCY-LICENSES.txt").write_text("\n\n".join(name + "\n" + "-" * 40 + "\n" + text for name, text in texts.values()))
print(f"Dependency records: {len(rows)}; retained texts: {len(texts)}; unknown metadata: {sum(r['license'] == 'UNKNOWN' for r in rows)}")
