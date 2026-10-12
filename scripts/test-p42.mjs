import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function run(args,env=process.env){
  const result=spawnSync(process.execPath,args,{cwd:root,env,stdio:'inherit'});
  if(result.error)throw result.error;
  return result.status??1;
}
if(!process.argv.includes('--reuse')){
  const firebase=path.join(process.env.APPDATA||path.join(os.homedir(),'AppData','Roaming'),'npm','node_modules','firebase-tools','lib','bin','firebase.js');
  const javaHome=process.env.JAVA_HOME||path.join(os.homedir(),'.cache','finize-v117-tools','jdk-21.0.12.1+1-jre');
  if(!existsSync(firebase)||!existsSync(path.join(javaHome,'bin','java.exe')))throw Error('Firebase CLI en Java 21 zijn vereist voor de volledige P4-regelverificatie.');
  const env={...process.env,JAVA_HOME:javaHome,JAVA_TOOL_OPTIONS:process.env.JAVA_TOOL_OPTIONS||'-Xmx3g',PATH:path.join(javaHome,'bin')+path.delimiter+process.env.PATH,FIREBASE_CLI_DISABLE_USAGE_REPORTING:'1',CI:'1'};
  process.exit(run([firebase,'emulators:exec','--only','firestore','--project','demo-finize-v117','--config','firebase.emulator.json','"'+process.execPath+'" scripts/test-p42.mjs --reuse'],env));
}

const output=path.join(root,'backups','v117-stabilisatie');mkdirSync(output,{recursive:true});
const smallLog=readFileSync(path.join(output,'p42-small-final.log'),'utf8').replaceAll(/\u001b\[[0-9;]*[A-Za-z]/g,'');
const smallProof=JSON.parse(readFileSync(path.join(output,'p42-performance-after.json'),'utf8'));
if(!/21 passed/.test(smallLog)||smallProof.appSha256!==createHash('sha256').update(readFileSync(path.join(root,'app.js'))).digest('hex'))throw Error('De definitieve 21 kleine browserproeven moeten eerst slagen op dezelfde app-build.');
const files=[];
function collect(directory){for(const entry of readdirSync(path.join(root,directory),{withFileTypes:true})){const name=path.join(directory,entry.name);if(entry.isDirectory())collect(name);else files.push(name);}}
for(const directory of ['src','scripts','tests'])collect(directory);
files.push('app.js','app.css','index.html','service-worker.js','package.json','playwright.config.cjs','firestore.rules','firestore.indexes.json','firebase.emulator.json');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=files.sort().map(name=>{const bytes=readFileSync(path.join(root,name));return {path:name.replaceAll('\\','/'),bytes:bytes.length,sha256:sha(bytes)};});
writeFileSync(path.join(output,'p42-final-build-manifest.json'),JSON.stringify({createdAt:new Date().toISOString(),files:manifest},null,2));
console.log('P4_BUILD_PROOF '+JSON.stringify({appSha256:manifest.find(row=>row.path==='app.js').sha256,files:manifest.length}));

const browser=['node_modules/@playwright/test/cli.js','test'];
// Each gate runs once. Never start the large fixture after an earlier failure.
const steps=[
  ['B 500 movements',[...browser,'tests/browser/v117-p4-scale.spec.cjs','--grep','500 bank movements','--max-failures=1']],
  ['Node',['scripts/run-node-tests.mjs']],['Syntax',['scripts/check-syntax.mjs']],
  ['CSS',['scripts/check-css.mjs']],['Generated',['scripts/build.mjs','--check']],
  ['Firestore Rules',['--test','tests/emulator/v117-p3.test.cjs','tests/emulator/v117-p4.test.cjs']],
  ['C Playwright',[...browser,'--grep-invert','P4 real browser and rules:|P4 repeated edits:|P4.2 small read and CPU measurements:','--max-failures=1']],
  ['D 5400 movements',[...browser,'tests/browser/v117-p4-scale.spec.cjs','--grep','5400 bank movements','--max-failures=1']]
];
const results=[{name:'A small focused browser gates',exitCode:0,counts:{passed:21,failed:0,skipped:0},log:'p42-small-final.log'}];
let failureCode=0;
for(const [name,args]of steps){
  console.log('P4_STEP '+name);const started=Date.now();
  const result=spawnSync(process.execPath,args,{cwd:root,env:{...process.env,FINIZE_WRITE_PHASE:'after',FINIZE_EVIDENCE_PREFIX:'p42'},encoding:'utf8',maxBuffer:128*1024*1024});
  const log=(result.stdout||'')+(result.stderr||'');
  const logName='p42-final-'+name.toLowerCase().replaceAll(/[^a-z0-9]+/g,'-')+'.log';
  writeFileSync(path.join(output,logName),log);process.stdout.write(log);
  const clean=log.replaceAll(/\u001b\[[0-9;]*[A-Za-z]/g,''),exitCode=result.status??1;
  const counts={passed:0,failed:0,skipped:0};
  if(args[0]==='scripts/run-node-tests.mjs'||args[0]==='--test'){
    for(const [,kind,count]of clean.matchAll(/(?:ℹ |# )(tests|pass|fail|skipped) (\d+)/g)){
      const key={tests:'registered',pass:'passed',fail:'failed',skipped:'skipped'}[kind];counts[key]=(counts[key]||0)+Number(count);
    }
    const files=clean.match(/(\d+) Node-tests geslaagd/);if(files)counts.files=Number(files[1]);
  }else if(args[0]===browser[0]){
    for(const kind of ['passed','failed','skipped','did not run']){
      const found=[...clean.matchAll(new RegExp('(?:^|\\n)\\s*(\\d+) '+kind+'(?:\\s|$)','g'))];
      if(found.length)counts[kind==='did not run'?'notRun':kind]=Number(found.at(-1)[1]);
    }
  }
  results.push({name,exitCode,durationMs:Date.now()-started,counts,log:logName,error:result.error?.message});
  writeFileSync(path.join(output,'p42-final-suite-status.json'),JSON.stringify({completed:false,results},null,2));
  if(exitCode){failureCode=exitCode;break;}
}
const changed=manifest.filter(row=>sha(readFileSync(path.join(root,row.path)))!==row.sha256).map(row=>row.path);
writeFileSync(path.join(output,'p42-final-suite-status.json'),JSON.stringify({completed:!failureCode,appSha256:manifest.find(row=>row.path==='app.js').sha256,results,notAttempted:steps.slice(results.length-1).map(([name])=>name),unchanged:changed.length===0,changed},null,2));
if(changed.length)throw Error('Bestanden gewijzigd tijdens eindverificatie: '+changed.join(', '));
if(failureCode)process.exit(failureCode);
console.log('P4_COMPLETE same-build verified');
