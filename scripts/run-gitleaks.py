"""Pinned official scanner, checksum verified; scans exact indexed file bytes."""
from pathlib import Path
import hashlib
import io
import platform
import subprocess
import tarfile
import tempfile
import urllib.request

version = "8.30.1"
arch = "arm64" if platform.machine().lower() in {"arm64", "aarch64"} else "x64"
os_name = {"Darwin": "darwin", "Linux": "linux"}[platform.system()]
name = f"gitleaks_{version}_{os_name}_{arch}.tar.gz"
base = f"https://github.com/gitleaks/gitleaks/releases/download/v{version}/"
checks = urllib.request.urlopen(base + f"gitleaks_{version}_checksums.txt", timeout=30).read().decode()
blob = urllib.request.urlopen(base + name, timeout=60).read()
expected = next(line.split()[0] for line in checks.splitlines() if line.split()[-1] == name)
assert hashlib.sha256(blob).hexdigest() == expected
with tempfile.TemporaryDirectory(prefix="sfh-secret-scan-") as folder:
    root = Path(folder)
    with tarfile.open(fileobj=io.BytesIO(blob), mode="r:gz") as archive:
        member = archive.extractfile("gitleaks")
        assert member is not None
        exe = root / "gitleaks"
        exe.write_bytes(member.read())
        exe.chmod(0o700)
    tree = root / "source"
    tree.mkdir()
    for raw in subprocess.check_output(["git", "ls-files", "-z"]).decode().split("\0"):
        if not raw:
            continue
        path = Path(raw)
        assert not path.is_absolute() and ".." not in path.parts
        dest = tree / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(subprocess.check_output(["git", "show", ":" + raw]))
    subprocess.run([str(exe), "dir", str(tree), "--redact=100", "--no-banner"], check=True)
