import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { validateManifest, verifySignature } from './updater-manifest.mjs';
const [url] = process.argv.slice(2);
assert(url && new URL(url).protocol === 'https:', 'HTTPS manifest URL required');
const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
assert(response.ok,'Manifest HTTP error');
assert(/application\/(?:json|octet-stream)|text\/plain/i.test(response.headers.get('content-type') ?? ''),'Unexpected content type');
const manifest=validateManifest(await response.json());
const conf=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json','utf8'));
for(const [platform,entry] of Object.entries(manifest.platforms)){
 const r=await fetch(entry.url,{signal:AbortSignal.timeout(120_000)});assert(r.ok && !/text\/html/.test(r.headers.get('content-type') ?? ''),'Artifact HTTP/content error');
 const data=Buffer.from(await r.arrayBuffer());verifySignature(data,entry.signature,conf.plugins.updater.pubkey,manifest.version);
 console.log(JSON.stringify({platform,version:manifest.version,signature:'PASS',sha256:crypto.createHash('sha256').update(data).digest('hex')}));
}
