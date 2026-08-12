const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async()=>{
  const protocol = await import(pathToFileURL(path.join(__dirname, '..', 'src', 'storage', 'sync-protocol.mjs')).href);
  const state = {meta:{revision:4175,updatedAt:'2026-08-11T18:56:02.952Z',updatedBy:'mobile'}};
  const documentData = {syncVersion:7,state};

  assert.equal(protocol.cloudDocumentVersion({}),0,'oude documenten starten veilig op cloudversie 0');
  assert.equal(protocol.cloudDocumentVersion(documentData),7);
  assert.equal(protocol.cloudStateSignature(state),'4175|2026-08-11T18:56:02.952Z|mobile');
  assert.equal(protocol.assertCloudBase(documentData,7,protocol.cloudStateSignature(state)),7);

  assert.throws(
    ()=>protocol.assertCloudBase({...documentData,syncVersion:8},7,protocol.cloudStateSignature(state)),
    error=>error.code===protocol.CLOUD_CONFLICT_CODE,
    'een nieuwere serverversie moet de lokale write blokkeren'
  );
  assert.throws(
    ()=>protocol.assertCloudBase({...documentData,state:{meta:{...state.meta,updatedBy:'laptop'}}},7,protocol.cloudStateSignature(state)),
    error=>error.code===protocol.CLOUD_CONFLICT_CODE,
    'ook een write van een oude app zonder versieverhoging moet worden herkend'
  );

  const runtime = fs.readFileSync(path.join(__dirname, '..', 'src', 'core', 'runtime.js'),'utf8');
  const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'),'utf8');
  assert.match(runtime,/firestore\.runTransaction/,'cloudwrites moeten via een servertransactie lopen');
  assert.match(runtime,/assertCloudBase\(currentData, expectedVersion, expectedSignature\)/);
  assert.doesNotMatch(runtime,/remoteRevision\s*<=\s*localRevision/,'apparaat-lokale revisions mogen clouddata niet meer blokkeren');
  assert.doesNotMatch(runtime,/btnUploadCloud|Lokale stand naar cloud zetten/,'een lokale stand mag niet handmatig over de cloud worden gezet');
  assert.match(runtime,/Cloudstand opnieuw laden/);
  assert.match(runtime,/acceptRemote\(documentData, normalizedRemote, 'lokale wijzigingen voor cloudherstel'\)/);
  assert.match(runtime,/committedStateSnapshot = stateBeforeImport/,'een herstelde JSON-back-up moet als nieuwe wijziging worden opgeslagen');
  assert.match(rules,/request\.resource\.data\.syncVersion\s*==\s*resource\.data\.syncVersion\s*\+\s*1/);

  console.log('Cloud-sync protocol blokkeert verouderde writes.');
})().catch(error=>{
  console.error(error);
  process.exit(1);
});
