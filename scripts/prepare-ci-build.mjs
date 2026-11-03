import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
// Packaging only: never loads a private signing key or emits updater packages.
if (!process.env.VITE_BACKEND_URL) throw new Error('Explicit public backend URL required');
if (process.env.SBC_UPDATER_ENDPOINT) throw new Error('Updater overrides are forbidden in this workflow');
for (const key of ['TAURI_SIGNING_PRIVATE_KEY', 'TAURI_SIGNING_PRIVATE_KEY_PASSWORD', 'APPLE_CERTIFICATE', 'APPLE_API_KEY', 'CSC_KEY_PASSWORD']) {
  if (process.env[key]) throw new Error('Signing secrets must not be supplied to compatibility-test packaging');
}
for (const script of ['scripts/verify-branding.mjs', 'scripts/verify-release.mjs']) {
  const check = spawnSync(process.execPath, [script], { stdio: 'inherit' });
  if (check.status) process.exit(check.status);
}
const r = spawnSync(process.execPath, ['scripts/configure-backend.mjs', '--release'], { stdio: 'inherit' });
if (r.status) process.exit(r.status);
const conf = JSON.parse(fs.readFileSync('src-tauri/tauri.backend.generated.json', 'utf8'));
conf.build = { ...conf.build, beforeBuildCommand: 'npm run build -- --emptyOutDir false' };
conf.bundle = { createUpdaterArtifacts: false, ...(process.platform === 'darwin' ? { macOS: { signingIdentity: '-' } } : {}) };
fs.writeFileSync('src-tauri/tauri.ci.generated.json', JSON.stringify(conf, null, 2) + '\n');
