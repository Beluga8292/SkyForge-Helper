import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
export const policy = JSON.parse(fs.readFileSync(new URL('../release/channels.json', import.meta.url)));
export function validVersion(v) {
  return typeof v === 'string' && v.length < 128 && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(v) && (!v.includes('-') || v.split('+')[0].split('-').slice(1).join('-').split('.').every(x => !/^\d+$/.test(x) || x === '0' || !x.startsWith('0')));
}
export function endpointFor(version) { assert(validVersion(version)); return version.split('+')[0].includes('-') ? policy.rcEndpoint : policy.stableEndpoint; }
const decode = text => {
 assert(typeof text === 'string' && /^[A-Za-z0-9+/=\r\n]+$/.test(text.trim()), 'Not base64 signature content');
 return Buffer.from(text.trim(), 'base64');
};
/** Matches minisign-verify used by Tauri: verify the payload AND trusted comment. */
export function verifySignature(data, encoded, publicKey, expectedVersion) {
 const keyLines=decode(publicKey).toString('utf8').trim().split(/\r?\n/);
 const pk=Buffer.from(keyLines[1] ?? '', 'base64');assert(pk.length===42,'Invalid public key');
 const lines=decode(encoded).toString('utf8').trim().split(/\r?\n/);assert(lines.length===4 && lines[2].startsWith('trusted comment: '),'Malformed signature');
 const sig=Buffer.from(lines[1],'base64'), global=Buffer.from(lines[3],'base64');assert(sig.length===74 && global.length===64,'Invalid signature size');
 assert(sig.subarray(2,10).equals(pk.subarray(2,10)),'Wrong signing identity');
 const algorithm=sig.subarray(0,2).toString();assert(['ED','Ed'].includes(algorithm),'Unsupported signature algorithm');
 const key=crypto.createPublicKey({key:Buffer.concat([Buffer.from('302a300506032b6570032100','hex'),pk.subarray(10)]),format:'der',type:'spki'});
 const bytes=sig.subarray(10),comment=lines[2].slice('trusted comment: '.length);
 const payload=algorithm==='ED'?crypto.createHash('blake2b512').update(data).digest():data;
 assert(crypto.verify(null,payload,key,bytes),'Artifact signature mismatch');
 assert(crypto.verify(null,Buffer.concat([bytes,Buffer.from(comment)]),key,global),'Trusted comment signature mismatch');
 if(expectedVersion) assert(comment.split('\t').find(x=>x.startsWith('version:')) === `version:${expectedVersion}`, 'Signature is not bound to expected version');
 return comment;
}
export function validateManifest(m,{channel,tag}={}) {
 assert(m && validVersion(m.version),'Invalid version');
 assert(typeof m.notes==='string' && m.notes.trim(),'Release notes required');
 assert(typeof m.pub_date==='string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(m.pub_date) && Number.isFinite(Date.parse(m.pub_date)),'RFC3339 required');
 assert(new Date(m.pub_date.slice(0,10)+'T00:00:00Z').toISOString().startsWith(m.pub_date.slice(0,10)), 'Invalid calendar date');
 const pre=m.version.split('+')[0].includes('-');assert(!channel || channel===(pre?'rc':'stable'),'Channel/version mismatch');
 assert(m.platforms && Object.keys(m.platforms).length>0,'No verified platforms');
 for(const [platform,entry] of Object.entries(m.platforms)) {
  assert(['darwin-aarch64','windows-x86_64'].includes(platform),'Unsupported platform');
  assert(typeof entry.signature==='string' && decode(entry.signature).length>100,'Signature content required');
  const u=new URL(entry.url);assert(u.protocol==='https:' && u.hostname==='github.com' && !u.username && !u.password && !u.search && !u.hash,'Untrusted artifact URL');
  const prefix=`/${policy.repository}/releases/download/${tag ?? `v${m.version}`}/`;
  assert(u.pathname.startsWith(prefix) && u.pathname.length>prefix.length,'Wrong source release tag/repository');
  assert(platform==='darwin-aarch64'?u.pathname.endsWith('.app.tar.gz'):u.pathname.endsWith('.exe'),'Wrong Tauri v2 artifact format');
 }
 return m;
}
export function generateManifest({version,notes,date,commit,entries,publicKey}) {
 assert(validVersion(version) && /^[0-9a-f]{40}$/.test(commit),'Version/source SHA required');
 const platforms={},checksums=[];
 for(const entry of entries) {
  const receipt=JSON.parse(fs.readFileSync(entry.receipt,'utf8'));
  assert(receipt.version===version && receipt.commit===commit && receipt.identifier==='com.skyblock.companion' && receipt.productName==='SkyBlock Companion','Build provenance mismatch');
  const data=fs.readFileSync(entry.file),hash=crypto.createHash('sha256').update(data).digest('hex');assert(hash===receipt.sha256 && path.basename(entry.file)===receipt.file,'Artifact/receipt mismatch');
  const signature=fs.readFileSync(entry.file+'.sig','utf8').trim();verifySignature(data,signature,publicKey,version);
  assert(!platforms[receipt.platform],'Duplicate platform');
  platforms[receipt.platform]={signature,url:`https://github.com/${policy.repository}/releases/download/v${version}/${path.basename(entry.file)}`};checksums.push(`${hash}  ${path.basename(entry.file)}`);
 }
 return {manifest:validateManifest({version,notes,pub_date:date,platforms}),checksums:checksums.join('\n')+'\n'};
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
 const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 const conf=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json','utf8'));
 const result=generateManifest({...input,publicKey:conf.plugins.updater.pubkey});
 assert(input.output && !fs.existsSync(path.join(input.output,'latest.json')),'Use a fresh private output directory');fs.mkdirSync(input.output,{recursive:true});
 fs.writeFileSync(path.join(input.output,'latest.json'),JSON.stringify(result.manifest,null,2)+'\n');fs.writeFileSync(path.join(input.output,'SHA256SUMS.txt'),result.checksums);
 console.log('Verified manifest generated locally; no upload or publication performed');
}
