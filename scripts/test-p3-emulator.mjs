import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {firebaseTestEnvironment} from './firebase-test-environment.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tests=['--test','tests/emulator/v117-p3.test.cjs'];
if(process.argv.includes('--p4'))tests.push('tests/emulator/v117-p4.test.cjs');
if(process.argv.includes('--reuse')){
  const result=spawnSync(process.execPath,tests,{cwd:root,stdio:'inherit'});process.exit(result.status??1);
}
const {firebase,env}=firebaseTestEnvironment();
// All arguments are fixed local test paths. No Firebase production project is accepted.
const command='"'+process.execPath+'" '+tests.join(' ');
const result=spawnSync(process.execPath,[firebase,'emulators:exec','--only','firestore','--project','demo-finize-v117','--config','firebase.emulator.json',command],{cwd:root,env,stdio:'inherit'});
process.exit(result.status??1);
