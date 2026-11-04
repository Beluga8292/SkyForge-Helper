import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { generateManifest,policy } from './updater-manifest.mjs';
// This command can only create a PRIVATE DRAFT, never publish or promote a channel.
const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
assert(process.argv.includes('--create-private-draft'),'Explicit private-draft action required');
const conf=JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json','utf8'));
const {manifest,checksums}=generateManifest({...input,publicKey:conf.plugins.updater.pubkey});
assert(input.output && fs.readFileSync(path.join(input.output,'latest.json'),'utf8').trim()===JSON.stringify(manifest,null,2),'Manifest differs from verified output');
assert(fs.readFileSync(path.join(input.output,'SHA256SUMS.txt'),'utf8')===checksums);
const gh=process.env.SFH_GH ?? 'gh';
function run(args){const r=spawnSync(gh,args,{encoding:'utf8'});assert(r.status===0,'GitHub draft operation failed; no public-release fallback');return r.stdout;}
const owner=JSON.parse(run(['api','user'])).login;assert(owner==='Beluga8292','Unexpected authenticated owner');
const tag=`v${manifest.version}`;
// Existing release assets must never be overwritten, even another draft.
const existing=JSON.parse(run(['api',`repos/${policy.repository}/releases?per_page=100`]));assert(!existing.some(r=>r.tag_name===tag),'Release or draft already exists');
const found=spawnSync(gh,['api',`repos/${policy.repository}/releases/tags/${tag}`],{encoding:'utf8'});assert(found.status!==0 && found.stderr.includes('404'),'Release tag already exists or lookup failed');
const notes=path.join(input.output,'draft-notes.md');fs.writeFileSync(notes,input.notes+'\n\nNOT PUBLISHED. Awaiting updater E2E and explicit publication approval.\n');
run(['release','create',tag,'--repo',policy.repository,'--target',input.commit,'--draft',...(manifest.version.split('+')[0].includes('-')?['--prerelease']:[]),'--title',`SkyForge Helper ${manifest.version} — updater candidate`,'--notes-file',notes]);
const files=input.entries.flatMap(e=>[e.file,e.file+'.sig',e.receipt]);
run(['release','upload',tag,...files,path.join(input.output,'latest.json'),path.join(input.output,'SHA256SUMS.txt'),'--repo',policy.repository]);
console.log('Private draft prepared; no public release, RC channel promotion or VDS change');
