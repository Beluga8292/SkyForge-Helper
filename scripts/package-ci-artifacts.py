"""Collect explicitly non-release installers and SHA-256; never upload/deploy."""
from pathlib import Path
import hashlib
import json
import platform
import os
import plistlib
import shutil
import subprocess
import tarfile
import tempfile

root = Path(__file__).resolve().parent.parent
conf = json.loads((root / "src-tauri/tauri.conf.json").read_text())
version = json.loads((root / "package.json").read_text())["version"]
assert conf["version"] == version
assert conf["identifier"] == "com.skyblock.companion"
assert conf["productName"] == "SkyBlock Companion", "Native rename migration gate not satisfied"
out = Path(os.environ.get("SFH_ARTIFACT_DIR", str(root / "artifacts")))
out.mkdir(exist_ok=True)
base = f"SkyForge-Helper_{version}_compat-dev"
target_root = Path(os.environ.get("CARGO_TARGET_DIR", str(root / "src-tauri/target")))
target = target_root / os.environ["SFH_BUILD_TARGET"] / "release/bundle"
if platform.system() == "Darwin":
    apps = list((target / "macos").glob("*.app"))
    assert len(apps) == 1
    app = apps[0]
    info = plistlib.loads((app / "Contents/Info.plist").read_bytes())
    assert info["CFBundleIdentifier"] == conf["identifier"]
    assert info["CFBundleShortVersionString"] == version
    binary = app / "Contents/MacOS" / info["CFBundleExecutable"]
    binary_bytes = binary.read_bytes()
    assert str(Path.home()).encode() not in binary_bytes, "Personal build path in native artifact"
    assert str(root).encode() not in binary_bytes, "Workspace build path in native artifact"
    arch = subprocess.check_output(["lipo", "-archs", str(binary)], text=True).strip()
    assert arch == "arm64", "Expected macOS ARM64 only"
    subprocess.run(["codesign", "--verify", "--deep", "--strict", str(app)], check=True)
    assert (app / "Contents/Resources/LICENSE").is_file()
    assert (app / "Contents/Resources/licenses/NEU-LICENSE.txt").is_file()
    with tarfile.open(out / f"{base}_macos-arm64.app.tar.gz", "w:gz") as archive:
        def portable_header(info):
            info.uid = info.gid = 0
            info.uname = info.gname = ""
            info.pax_headers = {k: v for k, v in info.pax_headers.items() if k not in {"atime", "ctime"}}
            return info
        archive.add(app, arcname=app.name, filter=portable_header)
    with tempfile.TemporaryDirectory(prefix="dmg-stage-", dir=out) as folder_name:
        folder = Path(folder_name)
        shutil.copytree(app, folder / app.name, symlinks=True)
        (folder / "Applications").symlink_to("/Applications", target_is_directory=True)
        subprocess.run(["hdiutil", "create", "-volname", "SkyForge Helper compatibility test", "-srcfolder", str(folder), "-ov", "-format", "UDZO", str(out / f"{base}_macos-arm64.dmg")], check=True)
    print("macOS ARM64/version/identifier/ad-hoc verification PASS; Developer ID and notarization unavailable")
else:
    assert platform.system() == "Windows"
    native = (target.parent / "skyblock-companion.exe").read_bytes()
    assert native[:2] == b"MZ"
    pe = int.from_bytes(native[0x3c:0x40], "little")
    assert native[pe:pe + 4] == b"PE\0\0"
    assert int.from_bytes(native[pe + 4:pe + 6], "little") == 0x8664
    assert str(Path.home()).encode() not in native and str(root).encode() not in native
    for sub, ext in [("nsis", "exe"), ("msi", "msi")]:
        files = list((target / sub).glob(f"*.{ext}"))
        assert len(files) == 1, f"Expected one {ext} installer"
        shutil.copyfile(files[0], out / f"{base}_windows-x64.{ext}")
    print("Windows installers collected; Authenticode, install/update/uninstall E2E not asserted")
# Source and imported-pack check: CI has no local runtime packs or credentials.
blocked = {".env", ".sqlite", ".sqlite3", ".db", ".key", ".p12", ".pfx", ".cats"}
for file in out.rglob("*"):
    assert file.suffix.lower() not in blocked
files = [p for p in out.iterdir() if p.is_file() and p.name != "SHA256SUMS.txt"]
(out / "SHA256SUMS.txt").write_text("".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n" for p in sorted(files)))
