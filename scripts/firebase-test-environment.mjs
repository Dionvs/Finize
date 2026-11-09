import {existsSync} from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function firebaseTestEnvironment(){
  const firebase=process.env.FINIZE_FIREBASE_CLI||path.join(process.env.APPDATA||path.join(os.homedir(),'AppData','Roaming'),'npm','node_modules','firebase-tools','lib','bin','firebase.js');
  const javaHome=process.env.JAVA_HOME||(process.platform==='win32'?path.join(os.homedir(),'.cache','finize-v117-tools','jdk-21.0.12.1+1-jre'):'');
  const java=javaHome&&path.join(javaHome,'bin',process.platform==='win32'?'java.exe':'java');
  if(!existsSync(firebase)||java&&!existsSync(java))throw Error('Installeer Firebase CLI en Java 21; stel FINIZE_FIREBASE_CLI en JAVA_HOME in. Emulatortests gebruiken uitsluitend lokale demo-projecten.');
  return {firebase,env:{...process.env,...(javaHome?{JAVA_HOME:javaHome,PATH:path.join(javaHome,'bin')+path.delimiter+process.env.PATH}:{}),JAVA_TOOL_OPTIONS:process.env.JAVA_TOOL_OPTIONS||'-Xmx2g',FIREBASE_CLI_DISABLE_USAGE_REPORTING:'1',CI:'1'}};
}
