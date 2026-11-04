"""Collect unsigned Tauri v2 payloads with a source receipt. No key or upload."""
from pathlib import Path
import hashlib
import json
import os
import platform
import shutil
import subprocess
import tarfile

root = Path(__file__).resolve().parent.parent
conf = json.loads((root / 'src-tauri/tauri.conf.json').read_text())
version = conf['version']
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
assert conf['identifier'] == 'com.skyblock.companion' and conf['productName'] == 'SkyBlock Companion'
out = Path(os.environ.get('SFH_UPDATER_OUT', str(root / 'artifacts/updater')))
out.mkdir(parents=True, exist_ok=True)
target = Path(os.environ.get('CARGO_TARGET_DIR', str(root / 'src-tauri/target'))) / os.environ['SFH_BUILD_TARGET'] / 'release'
if platform.system() == 'Darwin':
    import plistlib
    app = target / 'bundle/macos/SkyBlock Companion.app'
    info = plistlib.loads((app / 'Contents/Info.plist').read_bytes())
    assert info['CFBundleIdentifier'] == conf['identifier'] and info['CFBundleShortVersionString'] == version
    binary = app / 'Contents/MacOS' / info['CFBundleExecutable']
    assert subprocess.check_output(['lipo', '-archs', str(binary)], text=True).strip() == 'arm64'
    subprocess.run(['codesign', '--verify', '--deep', '--strict', str(app)], check=True)
    p = 'darwin-aarch64'
    file = out / f'SkyForge-Helper_{version}_{p}.app.tar.gz'
    assert not file.exists(), 'Use a fresh output directory'
    def headers(item):
        item.uid = item.gid = 0
        item.uname = item.gname = ''
        return item
    with tarfile.open(file, 'w:gz') as tar:
        tar.add(app, arcname=app.name, filter=headers)
else:
    assert platform.system() == 'Windows' and conf['bundle']['windows']['nsis']['installMode'] == 'currentUser'
    p = 'windows-x86_64'
    native = (target / 'skyblock-companion.exe').read_bytes()
    assert native[:2] == b'MZ'
    pos = int.from_bytes(native[0x3c:0x40], 'little')
    assert native[pos:pos+4] == b'PE\0\0' and int.from_bytes(native[pos+4:pos+6], 'little') == 0x8664
    candidates = list((target / 'bundle/nsis').glob('*.exe'))
    assert len(candidates) == 1
    file = out / f'SkyForge-Helper_{version}_{p}-setup.exe'
    assert not file.exists()
    shutil.copyfile(candidates[0], file)
receipt = dict(schema=1, version=version, commit=commit, identifier=conf['identifier'], productName=conf['productName'], platform=p, file=file.name, sha256=hashlib.sha256(file.read_bytes()).hexdigest())
Path(str(file) + '.receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(f'Unsigned {p} payload collected; signing and publication require separate local gates')
