import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { endpointFor,validVersion,verifySignature,validateManifest,generateManifest } from './updater-manifest.mjs';
// Ephemeral in-memory unit-test key only; never used as app trust or saved.
const pair=crypto.generateKeyPairSync('ed25519'),id=Buffer.alloc(8,7),publicBytes=pair.publicKey.export({format:'der',type:'spki'}).subarray(-32);
const pub=Buffer.from('untrusted comment: test public key\n'+Buffer.concat([Buffer.from('Ed'),id,publicBytes]).toString('base64')+'\n').toString('base64');
const data=Buffer.from('isolated public unit test artifact'),version='0.5.0-rc.6';
function sign(bytes,comment=`timestamp:1\tfile:fixture\tversion:${version}`){const sig=crypto.sign(null,crypto.createHash('blake2b512').update(bytes).digest(),pair.privateKey),global=crypto.sign(null,Buffer.concat([sig,Buffer.from(comment)]),pair.privateKey);return Buffer.from('untrusted comment: test\n'+Buffer.concat([Buffer.from('ED'),id,sig]).toString('base64')+'\ntrusted comment: '+comment+'\n'+global.toString('base64')+'\n').toString('base64');}
const sig=sign(data);
const manifest=()=>({version,notes:'Verified preparation',pub_date:'2026-11-04T10:00:00Z',platforms:{'windows-x86_64':{signature:sig,url:`https://github.com/Beluga8292/SkyForge-Helper/releases/download/v${version}/test.exe`}}});
test('valid SemVer, numeric prerelease and separate stable/RC routes',()=>{for(const v of ['0.5.0-rc.6','1.0.0','1.2.3+build-1'])assert(validVersion(v));for(const v of ['01.0.0','0.5.0-rc.06','v0.5.0','1.0','1.0.0-'])assert(!validVersion(v));assert(endpointFor(version).includes('/rc-channel/'));assert(endpointFor('1.0.0').includes('/latest/'));});
test('actual payload and trusted version signatures verified',()=>assert(verifySignature(data,sig,pub,version)));
test('corrupt payload rejected',()=>assert.throws(()=>verifySignature(Buffer.from('corrupt'),sig,pub,version)));
test('wrong signature rejected',()=>assert.throws(()=>verifySignature(data,sign(Buffer.from('other')),pub,version)));
test('wrong identity rejected',()=>{const wrong=Buffer.from(pub,'base64').toString().replace('test public','different public');const pk=Buffer.from(wrong).toString('base64');const badKey=Buffer.concat([Buffer.from('Ed'),Buffer.alloc(8,8),publicBytes]);const wrongId=Buffer.from('untrusted comment: test\n'+badKey.toString('base64')+'\n').toString('base64');assert.throws(()=>verifySignature(data,sig,wrongId,version));assert(verifySignature(data,sig,pk,version));});
test('version prefix confusion rejected',()=>assert.throws(()=>verifySignature(data,sig,pub,'0.5.0-rc.60')));
test('trusted comment tampering rejected',()=>{const s=Buffer.from(sig,'base64').toString().replace('version:0.5.0-rc.6','version:0.5.0-rc.7');assert.throws(()=>verifySignature(data,Buffer.from(s).toString('base64'),pub));});
test('manifest matches platform/source URL and channel',()=>{assert(validateManifest(manifest(),{channel:'rc'}));assert.throws(()=>validateManifest(manifest(),{channel:'stable'}));});
test('invalid date, empty platform, HTML and wrong release tag rejected',()=>{for(const m of [{...manifest(),pub_date:'today'},{...manifest(),pub_date:'2026-02-30T10:00:00Z'},{...manifest(),platforms:{}},'<html>not json</html>'])assert.throws(()=>validateManifest(m));const m=manifest();m.platforms['windows-x86_64'].url=m.platforms['windows-x86_64'].url.replace(`v${version}`,'v0.5.0-rc.5-installers');assert.throws(()=>validateManifest(m));});
test('no fictitious Windows zip or untrusted redirect host in manifest',()=>{for(const url of ['https://evil.example/test.exe',manifest().platforms['windows-x86_64'].url+'.zip']){const m=manifest();m.platforms['windows-x86_64'].url=url;assert.throws(()=>validateManifest(m));}});
test('manifest generation binds receipt, bytes, signature, source and version',()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sfh-manifest-'));try{const file=path.join(dir,'test.exe'),receipt=file+'.receipt.json',commit='a'.repeat(40);fs.writeFileSync(file,data);fs.writeFileSync(file+'.sig',sig);fs.writeFileSync(receipt,JSON.stringify({version,commit,identifier:'com.skyblock.companion',productName:'SkyBlock Companion',file:'test.exe',platform:'windows-x86_64',sha256:crypto.createHash('sha256').update(data).digest('hex')}));const input={version,notes:'candidate',date:'2026-11-04T10:00:00Z',commit,entries:[{file,receipt}],publicKey:pub};const r=generateManifest(input);assert(r.manifest.platforms['windows-x86_64']);assert(!r.manifest.platforms['darwin-aarch64']);assert.throws(()=>generateManifest({...input,commit:'b'.repeat(40)}));fs.writeFileSync(file,Buffer.from('bad'));assert.throws(()=>generateManifest(input));}finally{fs.rmSync(dir,{recursive:true});}});
