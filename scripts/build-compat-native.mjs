import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
const target = process.env.SFH_BUILD_TARGET;
if (!['aarch64-apple-darwin', 'x86_64-pc-windows-msvc'].includes(target)) throw new Error('Explicit supported target required');
const bundles = process.argv[2];
if (!['app', 'nsis,msi'].includes(bundles)) throw new Error('Explicit compatibility bundles required');
// Cargo encoded flags avoid shell quoting/path-with-spaces issues. Order matters:
// the more specific workspace prefix wins, including compile-time file! paths.
const flags = [
  `--remap-path-prefix=${os.homedir()}=/builder-home`,
  `--remap-path-prefix=${process.cwd()}=/workspace`,
];
const env = { ...process.env, CARGO_ENCODED_RUSTFLAGS: flags.join('\x1f') };
const r = spawnSync(process.execPath, [path.join('node_modules', '@tauri-apps', 'cli', 'tauri.js'), 'build', '--target', target, '--config', 'src-tauri/tauri.ci.generated.json', '--bundles', bundles], { env, stdio: 'inherit' });
process.exit(r.status ?? 1);
