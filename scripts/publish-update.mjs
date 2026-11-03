#!/usr/bin/env node
// Explicit, auditable update publishing: build → sign → verify → upload →
// checksum → atomic manifest. Nothing is published unless a mode is chosen.
//
//   node scripts/publish-update.mjs --notes "..." [--confirm-publish]
//   node scripts/publish-update.mjs --notes "..." --staging <token>
//   node scripts/publish-update.mjs --rollback-to 0.5.0-rc.1 --confirm-publish
//
// The private signing key stays in the local build environment. Only the
// public key (embedded in the app) and the detached .sig file are uploaded.

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SSH_HOST = process.env.SBC_SSH_HOST || 'kkmt';
const REMOTE_BASE = process.env.SBC_REMOTE_UPDATES || '/opt/skyblock-companion/updates';
const PUBLIC_BASE = 'https://updates.plasmavpn.online/sbc/updates';
const MACOS_BUNDLE = path.join(ROOT, 'src-tauri/target/release/bundle/macos');

const argv = process.argv.slice(2);
const has = (name) => argv.includes(`--${name}`);
const arg = (name) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 ? argv[index + 1] : undefined;
};

function fail(message) {
  console.error(`publish-update: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) fail(`${command} ${args.join(' ')} failed with status ${result.status}`);
  return result;
}

function ssh(script) {
  return run('ssh', [SSH_HOST, script]);
}

function scp(local, remote) {
  run('scp', ['-q', local, `${SSH_HOST}:${remote}`]);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function compareVersions(a, b) {
  const [coreA, preA] = a.split('-', 2);
  const [coreB, preB] = b.split('-', 2);
  const numsA = coreA.split('.').map(Number);
  const numsB = coreB.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if (numsA[i] !== numsB[i]) return numsA[i] - numsB[i];
  }
  if (!preA && preB) return 1;
  if (preA && !preB) return -1;
  if (!preA && !preB) return 0;
  return preA.localeCompare(preB, undefined, { numeric: true });
}

function publicKey() {
  const conf = JSON.parse(fs.readFileSync(path.join(ROOT, 'src-tauri/tauri.conf.json'), 'utf8'));
  const raw = conf.plugins?.updater?.pubkey;
  if (!raw) fail('updater public key is missing in tauri.conf.json');
  const text = Buffer.from(raw, 'base64').toString('utf8');
  const blob = Buffer.from(text.split('\n').find((line) => line && !line.startsWith('untrusted comment')), 'base64');
  if (blob.length !== 42) fail('unexpected updater public key format');
  return { raw, keyId: blob.subarray(2, 10), key: blob.subarray(10, 42) };
}

function verifySignature(artifactPath, sigText) {
  const { keyId, key } = publicKey();
  const decoded = Buffer.from(sigText.trim(), 'base64').toString('utf8');
  const lines = decoded.split('\n').filter(Boolean);
  if (lines.length < 2) fail('signature file is malformed');
  const blob = Buffer.from(lines[1], 'base64');
  if (blob.length !== 74) fail('signature blob has an unexpected length');
  if (!blob.subarray(2, 10).equals(keyId)) fail('signature was produced by a different signing key');
  const algorithm = blob.subarray(0, 2).toString();
  const signature = blob.subarray(10, 74);
  const data = fs.readFileSync(artifactPath);
  const payload = algorithm === 'ED' ? crypto.createHash('blake2b512').update(data).digest() : data;
  const der = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), key]);
  const keyObject = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
  if (!crypto.verify(null, payload, keyObject, signature)) {
    fail(`signature verification failed for ${path.basename(artifactPath)}`);
  }
  console.log(`signature OK: ${path.basename(artifactPath)} (${algorithm})`);
}

function findArtifact(version) {
  if (!fs.existsSync(MACOS_BUNDLE)) fail(`bundle directory not found: ${MACOS_BUNDLE}`);
  const entries = fs.readdirSync(MACOS_BUNDLE);
  const tarball = entries.find((name) => name.endsWith('.app.tar.gz'));
  if (!tarball) fail('updater artifact (*.app.tar.gz) not found; run the signed build first');
  const signature = `${tarball}.sig`;
  if (!entries.includes(signature)) fail('updater artifact signature (*.sig) not found');
  const versioned = `SkyBlock.Companion_${version}_${arch()}.app.tar.gz`;
  const sigPath = path.join(MACOS_BUNDLE, signature);
  const sigText = fs.readFileSync(sigPath, 'utf8');
  verifySignature(path.join(MACOS_BUNDLE, tarball), sigText);
  return {
    tarball: path.join(MACOS_BUNDLE, tarball),
    versioned,
    sigText,
    sha256: sha256(path.join(MACOS_BUNDLE, tarball)),
  };
}

function arch() {
  return process.arch === 'arm64' || process.arch === 'aarch64' ? 'aarch64' : 'x86_64';
}

function readVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const conf = JSON.parse(fs.readFileSync(path.join(ROOT, 'src-tauri/tauri.conf.json'), 'utf8'));
  const cargo = fs.readFileSync(path.join(ROOT, 'src-tauri/Cargo.toml'), 'utf8').match(/^version = "([^"]+)"/m)?.[1];
  if (pkg.version !== conf.version || pkg.version !== cargo) fail('package.json, tauri.conf.json and Cargo.toml versions differ');
  return pkg.version;
}

function remoteLatest() {
  const result = spawnSync('ssh', [SSH_HOST, `cat '${REMOTE_BASE}/latest.json' 2>/dev/null || true`], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout.trim()) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function uploadAtomicManifest(manifest, remoteDir) {
  const temporary = `${REMOTE_BASE}/.tmp/latest.${process.pid}.json`;
  const local = path.join(os.tmpdir(), `sbc-latest-${process.pid}.json`);
  fs.writeFileSync(local, `${JSON.stringify(manifest, null, 2)}\n`);
  ssh(`mkdir -p '${REMOTE_BASE}/.tmp' '${remoteDir}'`);
  scp(local, temporary);
  ssh(`mv -f '${temporary}' '${remoteDir}/latest.json'`);
  fs.rmSync(local, { force: true });
  console.log(`manifest published atomically to ${remoteDir}/latest.json`);
}

const rollbackTo = arg('rollback-to');
if (rollbackTo) {
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(rollbackTo)) fail('invalid --rollback-to version');
  if (!has('confirm-publish')) fail('rollback changes the public manifest; pass --confirm-publish');
  const result = spawnSync('ssh', [SSH_HOST, `cat '${REMOTE_BASE}/history/${rollbackTo}.json'`], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout.trim()) fail(`history/${rollbackTo}.json not found on the VDS`);
  const manifest = JSON.parse(result.stdout);
  if (manifest.version !== rollbackTo) fail('history manifest version mismatch');
  uploadAtomicManifest(manifest, REMOTE_BASE);
  console.log(`rolled back to ${rollbackTo} (artifacts of newer versions were kept)`);
  process.exit(0);
}

const version = readVersion();
const notes = arg('notes') ?? (arg('notes-file') ? fs.readFileSync(path.resolve(arg('notes-file')), 'utf8') : undefined);
if (!notes || !notes.trim()) fail('release notes are required (--notes or --notes-file)');

const current = remoteLatest();
if (current?.version && compareVersions(version, current.version) <= 0) {
  fail(`published version ${current.version} is not older than ${version}; refusing to downgrade`);
}

const artifact = findArtifact(version);
const stagingToken = arg('staging');
const publish = has('confirm-publish');

if (stagingToken && !/^[A-Za-z0-9_-]{12,64}$/.test(stagingToken)) {
  fail('staging token must be 12-64 URL-safe characters');
}
if (stagingToken && publish) fail('choose either --staging or --confirm-publish, not both');

const target = stagingToken ? `staging/${stagingToken}` : `artifacts/${version}`;
const urlBase = `${PUBLIC_BASE}/${target}`;
const manifest = {
  version,
  notes: notes.trim(),
  pub_date: new Date().toISOString(),
  platforms: {
    [`darwin-${arch()}`]: {
      signature: artifact.sigText.trim(),
      url: `${urlBase}/${artifact.versioned}`,
    },
  },
};

const localDir = path.join(ROOT, 'dist/updates', target);
fs.mkdirSync(localDir, { recursive: true });
fs.copyFileSync(artifact.tarball, path.join(localDir, artifact.versioned));
fs.writeFileSync(path.join(localDir, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(localDir, `${artifact.versioned}.sha256`), `${artifact.sha256}  ${artifact.versioned}\n`);
console.log(`prepared ${path.join(localDir, artifact.versioned)} (sha256 ${artifact.sha256})`);

if (!stagingToken && !publish) {
  console.log('dry run complete: artifacts and manifest are prepared locally, nothing was uploaded.');
  console.log('pass --confirm-publish (public) or --staging <token> (test channel) to upload.');
  process.exit(0);
}

const remoteDir = `${REMOTE_BASE}/${target}`;
ssh(`mkdir -p '${REMOTE_BASE}/history' '${remoteDir}/history'`);
scp(path.join(localDir, artifact.versioned), `${remoteDir}/${artifact.versioned}`);
scp(path.join(localDir, `${artifact.versioned}.sha256`), `${remoteDir}/${artifact.versioned}.sha256`);
scp(path.join(localDir, 'latest.json'), `${remoteDir}/latest.json`);

const remoteChecksum = spawnSync('ssh', [SSH_HOST, `sha256sum '${remoteDir}/${artifact.versioned}'`], { encoding: 'utf8' });
if (remoteChecksum.status !== 0) fail('could not read the remote checksum');
if (!remoteChecksum.stdout.startsWith(artifact.sha256)) fail('remote artifact checksum does not match the local build');
console.log('remote checksum verified');

ssh(`cp -f '${remoteDir}/latest.json' '${REMOTE_BASE}/history/${version}.json'`);

if (stagingToken) {
  // The staging directory stays non-publicly linked; remove it after testing.
  console.log(`staging manifest: ${PUBLIC_BASE}/${target}/latest.json`);
} else {
  uploadAtomicManifest(manifest, REMOTE_BASE);
  console.log(`published ${version} to ${PUBLIC_BASE}/latest.json`);
}
