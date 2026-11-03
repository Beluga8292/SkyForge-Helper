import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Local, password-protected Tauri updater key. It must never be copied to the
// VDS, committed to the repository or printed in logs.
const keyPath = process.env.TAURI_SIGNING_PRIVATE_KEY || path.join(os.homedir(), '.tauri', 'skyblock-companion.key');
const passwordFile = process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD_FILE || path.join(os.homedir(), '.tauri', 'skyblock-companion.password');
if (!fs.existsSync(keyPath)) {
  console.error(`Updater signing key not found at ${keyPath}`);
  process.exit(1);
}
const password = process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || (fs.existsSync(passwordFile) ? fs.readFileSync(passwordFile, 'utf8').trim() : '');
if (!password) {
  console.error(`Updater signing key password not found at ${passwordFile}`);
  process.exit(1);
}

const env = {
  ...process.env,
  VITE_RELEASE_CANDIDATE: 'true',
  TAURI_SIGNING_PRIVATE_KEY: fs.readFileSync(keyPath, 'utf8').trim(),
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: password,
};
for (const k of Object.keys(env)) {
  if (/^(APPLE_(ID|PASSWORD|TEAM_ID|CERTIFICATE|CERTIFICATE_PASSWORD|API_KEY|API_ISSUER|API_KEY_PATH)|CSC_|WIN_CSC_)/.test(k)) delete env[k];
}
// Ad-hoc local signing only; no production identity/notarization is claimed.
env.APPLE_SIGNING_IDENTITY = process.env.APPLE_SIGNING_IDENTITY || '-';

function run(cmd, args) {
  const result = spawnSync(cmd, args, { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(process.execPath, ['scripts/verify-release.mjs', '--release']);
run(process.execPath, ['scripts/configure-backend.mjs', '--release']);
const cli = 'node_modules/@tauri-apps/cli/tauri.js';
// App-only packaging avoids Finder automation on headless/local validation runs.
const bundles = process.platform === 'win32' ? 'nsis' : (process.argv.includes('--app-only') ? 'app' : 'app,dmg');
run(process.execPath, [cli, 'build', '--config', 'src-tauri/tauri.backend.generated.json', '--bundles', bundles]);
