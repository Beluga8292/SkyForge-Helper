// Disposable Windows runner only: exercise the shipped UI and native updater.
// No endpoint overrides, IPC mocks, signing credentials or real-user fixtures.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
assert(process.platform==='win32' && process.env.GITHUB_ACTIONS==='true','Disposable Windows Actions runner required');
const [exe]=process.argv.slice(2);assert(exe && fs.existsSync(exe));
fs.mkdirSync('artifacts/updater-e2e',{recursive:true});
const child=spawn(exe,[],{stdio:'ignore',env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9222'}});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let ws,id=0,waiting=new Map();
async function connect(){
 try{ws?.close();}catch{}
 const pages=await (await fetch('http://127.0.0.1:9222/json/list',{signal:AbortSignal.timeout(2000)})).json();
 const page=pages.find(p=>p.type==='page' && p.webSocketDebuggerUrl);assert(page);
 ws=new WebSocket(page.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data)),pending=waiting.get(m.id);if(pending){waiting.delete(m.id);m.error?pending.reject(new Error('CDP command failed')):pending.resolve(m.result);}});
 ws.addEventListener('close',()=>{for(const p of waiting.values())p.reject(new Error('Webview closed'));waiting.clear();});
}
function call(method,params={}){return new Promise((resolve,reject)=>{const n=++id;waiting.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});assert(!r.exceptionDetails,'UI evaluation failed');return r.result.value;}
async function poll(fn,timeout=120000){const end=Date.now()+timeout;while(Date.now()<end){try{if(await fn())return;}catch{}await delay(1000);}throw new Error('Bounded native updater UI wait timed out');}
async function click(labels){return evaluate(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>!b.disabled && ${JSON.stringify(labels)}.includes(b.textContent.trim()));if(!b)return false;b.click();return true;})()`);}
async function screenshot(name){const {data}=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(`artifacts/updater-e2e/${name}.png`,Buffer.from(data,'base64'));}
try{
 await poll(async()=>{await connect();return true;});
 await poll(()=>evaluate(`!!document.querySelector('[role="dialog"]') && document.querySelector('[role="dialog"]').textContent.includes('0.5.0-rc.6')`));
 await screenshot('update-available');
 assert(await click(['Update','Обновить']),'Update button missing');
 await poll(()=>evaluate(`[...document.querySelectorAll('button')].some(b=>['Install and restart','Установить и перезапустить'].includes(b.textContent.trim()) && !b.disabled)`));
 await screenshot('download-signature-verified');
 console.log('SHIPPED RC.5 DISCOVERY / UI / DOWNLOAD / NATIVE SIGNATURE PASS');
 try{assert(await click(['Install and restart','Установить и перезапустить']));}catch(e){if(ws.readyState===WebSocket.OPEN)throw e;}
 // Do not start rc.6 ourselves: native updater must cause the restart.
 await poll(()=>child.exitCode!==null);
 try{ws.close();}catch{}
 await poll(async()=>{await connect();return (await evaluate(`window.__TAURI_INTERNALS__.invoke('plugin:app|version')`))==='0.5.0-rc.6';});
 assert(await evaluate(`(()=>{const a=[...document.querySelectorAll('a')].find(a=>a.getAttribute('href')==='#/settings');if(!a)return false;a.click();return true;})()`),'Settings route missing');
 await poll(()=>evaluate(`document.body.textContent.includes('0.5.0-rc.6')`));
 await poll(()=>click(['Check for updates','Проверить обновления']));
 await delay(300);
 await poll(()=>evaluate(`document.body.textContent.includes('You have the latest version') || document.body.textContent.includes('Установлена последняя версия')`));
 assert(await evaluate(`!document.querySelector('[role="dialog"]')`),'Unexpected repeated update dialog');
 await screenshot('rc6-github-current');
 fs.writeFileSync('artifacts/updater-e2e/result.json',JSON.stringify({nativeFlow:true,from:'0.5.0-rc.5',to:'0.5.0-rc.6',automaticRestart:true,githubCheckCurrent:true,guiScreenshots:true}));
 console.log('NATIVE INSTALL / AUTOMATIC RESTART / RC.6 GITHUB CHECK / NO REPEAT PASS');
}finally{try{ws?.close();}catch{}}
