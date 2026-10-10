import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tests=['--test','tests/emulator/v117-p3.test.cjs'];
if(process.argv.includes('--reuse')){
  const result=spawnSync(process.execPath,tests,{cwd:root,stdio:'inherit'});process.exit(result.status??1);
}
const firebase=path.join(process.env.APPDATA||path.join(os.homedir(),'AppData','Roaming'),'npm','node_modules','firebase-tools','lib','bin','firebase.js');
const javaHome=process.env.JAVA_HOME||path.join(os.homedir(),'.cache','finize-v117-tools','jdk-21.0.12.1+1-jre');
if(!existsSync(firebase)||!existsSync(path.join(javaHome,'bin','java.exe')))throw Error('Installeer Firebase CLI en Java 21, of zet JAVA_HOME. De echte emulatortest mag niet worden vervangen door een testdouble.');
const env={...process.env,JAVA_HOME:javaHome,PATH:path.join(javaHome,'bin')+path.delimiter+process.env.PATH,FIREBASE_CLI_DISABLE_USAGE_REPORTING:'1',CI:'1'};
// All arguments are fixed local test paths. No Firebase production project is accepted.
const command='"'+process.execPath+'" --test tests/emulator/v117-p3.test.cjs';
const result=spawnSync(process.execPath,[firebase,'emulators:exec','--only','firestore','--project','demo-finize-v117','--config','firebase.emulator.json',command],{cwd:root,env,stdio:'inherit'});
process.exit(result.status??1);
