"""Scan the exact Git index (or pre-stage candidates), never echo matched values."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument("--candidates", action="store_true")
args = parser.parse_args()
cmd = ["git", "ls-files", "-z"]
if args.candidates:
    cmd += ["--cached", "--others", "--exclude-standard"]
files = sorted(set(subprocess.check_output(cmd).decode().strip("\0").split("\0")) - {""})
patterns = {
    "private-key": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"),
    "github-token": re.compile(r"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})"),
    "aws-access-id": re.compile(r"(?:AKIA|ASIA)[A-Z0-9]{16}"),
    "personal-host-path": re.compile(r"/(?:Users|home)/[a-zA-Z0-9_.-]+/"),
    "private-network": re.compile(r"\b(?:10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+)\b"),
    "credential-literal": re.compile(r'''(?im)(?:HYPIXEL_API_KEY|TAURI_SIGNING_PRIVATE_KEY_PASSWORD|GITHUB_TOKEN|POSTGRES_PASSWORD)[ \t]*[:=][ \t]*["']?([A-Za-z0-9_+/.=-]{12,})'''),
}
allowlist=json.loads(Path(".security-scan-allowlist.json").read_text())
findings = []
for name in files:
    p = Path(name)
    lower = name.lower()
    if (p.name.startswith(".env") and p.name != ".env.example") or any(x in p.parts for x in [".verification", "node_modules", "target", "__pycache__", ".venv"]) or p.suffix.lower() in {".sqlite", ".sqlite3", ".db", ".dmg", ".exe", ".msi", ".pem", ".key", ".p12", ".pfx", ".cats", ".zip"}:
        findings.append({"file": name, "rule": "sensitive-or-generated-path"})
    data = p.read_bytes() if args.candidates else subprocess.check_output(["git", "show", ":" + name])
    text = data.decode("utf-8", errors="replace")
    for rule, pattern in patterns.items():
        for match in pattern.finditer(text):
            if any(a["file"] == name and a["rule"] == rule and a["sha256"] == hashlib.sha256(match.group().encode()).hexdigest() for a in allowlist):
                continue
            # Synthetic path/network fixtures deliberately exercise traversal or
            # redaction; review tests separately, do not blanket-allow secrets.
            if rule in {"personal-host-path", "private-network"} and (".test." in name or "/tests/" in name or name.startswith("scripts/")):
                continue
            if rule == "credential-literal" and match.group(1).lower() in {"change-me-in-production", "example_password", "changeme_password"}:
                continue
            findings.append({"file": name, "rule": rule, "line": text.count("\n", 0, match.start()) + 1})
summary = {"files": len(files), "findings": findings, "status": "FAIL" if findings else "PASS", "scope": "candidate working files" if args.candidates else "exact Git index", "note": "Heuristic scan; manual owner review required before first public push"}
print(json.dumps(summary, indent=2))
sys.exit(bool(findings))
