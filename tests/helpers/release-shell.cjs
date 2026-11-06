const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const release=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/name="finize-inline-release" content="([^"]+)"/)?.[1];
function assertReleaseShell(html,worker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8')){
 assert.match(release,/^\d+-r\d+$/,'Een expliciete actuele release is vereist');
 assert.equal(html.match(/name="finize-inline-release" content="([^"]+)"/)?.[1],release);
 assert.equal(worker.match(/const CACHE_NAME\s*=\s*"([^"]+)"/)?.[1],`finize-v${release}`);
 for(const asset of ['app.js','app.css'])assert(worker.includes(`./${asset}?v=${release}`),`Cacheversie van ${asset} wijkt af`);
 const normalized=html.replace(/\r\n/g,'\n');
 for(const asset of ['app.js','app.css'])assert(normalized.includes(fs.readFileSync(path.join(root,asset),'utf8').replace(/\r\n/g,'\n').trim()),`Inline ${asset} wijkt af van de gebouwde bron`);
}
module.exports={release,assertReleaseShell};
