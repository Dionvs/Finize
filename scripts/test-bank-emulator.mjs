import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {firebaseTestEnvironment} from './firebase-test-environment.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {firebase,env}=firebaseTestEnvironment();
const command=`"${process.execPath}" --test tests/v118-p5b-retention-emulator.test.mjs`;
const result=spawnSync(process.execPath,[firebase,'emulators:exec','--only','firestore','--project','demo-finize-bank-retention','--config','firebase.bank-emulator.json',command],{cwd:root,env:{...env,FIRESTORE_EMULATOR_HOST:'127.0.0.1:8189'},stdio:'inherit'});
process.exit(result.status??1);
