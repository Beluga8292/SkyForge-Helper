"""Collect explicitly non-release installers and SHA-256; never upload/deploy."""
from pathlib import Path
import hashlib
import json
import platform
import os
import plistlib
import shutil
import subprocess

root = Path(__file__).resolve().parent.parent
conf = json.loads((root / "src-tauri/tauri.conf.json").read_text())
version = json.loads((root / "package.json").read_text())["version"]
assert conf["version"] == version
assert conf["identifier"] == "com.skyblock.companion"
assert conf["productName"] == "SkyBlock Companion", "Native rename migration gate not satisfied"
out = Path(os.environ.get("SFH_ARTIFACT_DIR", str(root / "artifacts")))
out.mkdir(exist_ok=True)
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
    assert info["LSMinimumSystemVersion"] == conf["bundle"]["macOS"]["minimumSystemVersion"]
    dmgs = list((target / "dmg").glob("*.dmg"))
    assert len(dmgs) == 1, "Expected exactly one Tauri DMG"
    target_dmg = out / "SkyForge-Helper-macOS-arm64.dmg"
    shutil.copyfile(dmgs[0], target_dmg)
    subprocess.run(["hdiutil", "verify", str(target_dmg)], check=True)
    print(
        "macOS ARM64/version/identifier/DMG verification PASS; "
        "Developer ID and notarization unavailable (ad-hoc signing only)"
    )
elif platform.system() == "Windows":
    assert platform.system() == "Windows"
    native = (target.parent / "skyblock-companion.exe").read_bytes()
    assert native[:2] == b"MZ"
    pe = int.from_bytes(native[0x3c:0x40], "little")
    assert native[pe:pe + 4] == b"PE\0\0"
    assert int.from_bytes(native[pe + 4:pe + 6], "little") == 0x8664
    assert str(Path.home()).encode() not in native and str(root).encode() not in native
    nsis = list((target / "nsis").glob("*.exe"))
    assert len(nsis) == 1, "Expected one NSIS installer"
    shutil.copyfile(nsis[0], out / "SkyForge-Helper-Setup-x64.exe")
    # MSI is optional: WiX cannot encode the non-numeric `rc.N` pre-release
    # version, so the NSIS setup is the validated package for this line.
    msi = list((target / "msi").glob("*.msi"))
    if msi:
        shutil.copyfile(msi[0], out / "SkyForge-Helper-x64.msi")
        print("Windows NSIS/MSI collected; Authenticode and install E2E run in the workflow")
    else:
        print("Windows NSIS collected; MSI not produced for this pre-release version")
else:
    raise SystemExit(f"Unsupported packaging host: {platform.system()}")

# Source and imported-pack check: CI has no local runtime packs or credentials.
blocked = {".env", ".sqlite", ".sqlite3", ".db", ".key", ".p12", ".pfx", ".cats"}
for file in out.rglob("*"):
    assert file.suffix.lower() not in blocked
files = [p for p in out.iterdir() if p.is_file() and p.name != "SHA256SUMS.txt"]
assert files, "No artifacts collected"
(out / "SHA256SUMS.txt").write_text(
    "".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n" for p in sorted(files)),
    newline="\n",
)
