import fs from 'node:fs';
import assert from 'node:assert/strict';
const pkg=JSON.parse(fs.readFileSync('package.json')),conf=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json'));
const cargo=fs.readFileSync('src-tauri/Cargo.toml','utf8').match(/^version = "([^"]+)"/m)?.[1];
const release=process.argv.includes('--release');
assert.equal(pkg.version,cargo);assert.equal(pkg.version,conf.version);assert.match(pkg.version,/^\d+\.\d+\.\d+-rc\.\d+$/);
assert.equal(conf.identifier,'com.skyblock.companion');assert.equal(conf.bundle.windows.nsis.installMode,'currentUser');
assert(!/(?:http|https|ws):\/\/(?:localhost|127\.0\.0\.1)(?=[:\/; ])/.test(conf.app.security.csp),'Release CSP contains development endpoints');
for(const p of JSON.parse(fs.readFileSync('src-tauri/capabilities/default.json')).permissions)if(typeof p==='object'&&p.identifier==='http:default')assert(p.allow.every(v=>v.url.startsWith('https://')||/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(v.url)),'Release HTTP allow-list contains a non-HTTPS, non-loopback URL');
assert(!fs.readFileSync('vite.config.ts','utf8').includes('sourcemap: true'));

// Updater: official Tauri plugin, HTTPS-only, embedded public key, signed artifacts.
const updater=conf.plugins?.updater;
assert(updater,'The Tauri updater plugin is not configured');
assert(Array.isArray(updater.endpoints)&&updater.endpoints.length>0,'Updater endpoints are missing');
for(const url of updater.endpoints){
  assert(url.startsWith('https://'),`Updater endpoint must use HTTPS: ${url}`);
  assert(!url.includes('*'),'Updater endpoint must not contain a wildcard');
}
assert(typeof updater.pubkey==='string'&&updater.pubkey.length>40,'Updater public key is missing');
assert.equal(Buffer.from(updater.pubkey,'base64').toString('utf8').includes('minisign public key'),true,'Updater public key is not a minisign key');
assert(conf.bundle.createUpdaterArtifacts===true,'bundle.createUpdaterArtifacts must be true');
assert(updater.dangerousInsecureTransportProtocol!==true,'Insecure updater transport is forbidden');

const backend=process.env.VITE_BACKEND_URL?.trim();
if(release){
  assert(backend,'Production backend URL is required for a release build (VITE_BACKEND_URL)');
  assert(backend.startsWith('https://'),'Production backend URL must use HTTPS');
  assert(!backend.includes('*'),'Production backend URL must not contain a wildcard');
}
console.log(JSON.stringify({version:pkg.version,configuration:'PASS',updater:{endpoints:updater.endpoints,signature:'embedded public key'},backend_endpoint:backend?'supplied_requires_validation':'NOT CONFIGURED — release gate blocked'}));
