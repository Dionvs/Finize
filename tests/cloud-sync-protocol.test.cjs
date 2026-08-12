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
  assert.equal(protocol.isStaleCloudSnapshot({...documentData,syncVersion:6},7,protocol.cloudStateSignature(state)),true,'een vertraagde lagere cloudversie moet worden genegeerd');
  assert.equal(protocol.isStaleCloudSnapshot(documentData,7,protocol.cloudStateSignature(state)),false,'de bevestigde snapshot blijft geldig');
  assert.equal(protocol.isStaleCloudSnapshot({...documentData,state:{meta:{...state.meta,updatedBy:'oud'}}},7,protocol.cloudStateSignature(state)),true,'dezelfde versie met andere inhoud mag niet terugrollen');
  assert.equal(protocol.isStaleCloudSnapshot({...documentData,syncVersion:8},7,protocol.cloudStateSignature(state)),false,'een werkelijk nieuwere cloudversie blijft geldig');

  assert.throws(
    ()=>protocol.assertCloudBase({...documentData,syncVersion:8},7,protocol.cloudStateSignature(state)),
    error=>error.code===protocol.CLOUD_CONFLICT_CODE,
    'een nieuwere serverversie moet de lokale write blokkeren'
  );

  const base = {
    meta:{revision:10,updatedAt:'oud',updatedBy:'mobiel'},
    incomeDefaultsHistory:{dion:[{id:'loon-dion',salary:2953}],dara:[{id:'loon-dara',salary:3250}]},
    voorkeur:{thema:'licht'}
  };
  const local = structuredClone(base);
  local.meta={revision:11,updatedAt:'lokaal',updatedBy:'laptop'};
  local.incomeDefaultsHistory.dion[0].salary=2344;
  const remote = structuredClone(base);
  remote.meta={revision:12,updatedAt:'cloud',updatedBy:'mobiel'};
  remote.voorkeur.thema='donker';
  const rebased = protocol.rebaseLocalChanges(base,local,remote);
  assert.equal(rebased.incomeDefaultsHistory.dion[0].salary,2344,'de zojuist gewijzigde lokale waarde mag niet terugvallen');
  assert.equal(rebased.incomeDefaultsHistory.dara[0].salary,3250,'onaangeraakte waarden blijven uit de cloud komen');
  assert.equal(rebased.voorkeur.thema,'donker','een gelijktijdige wijziging op een ander cloudveld blijft behouden');
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
  assert.match(runtime,/rebasePendingOntoRemote\(documentData, normalizedRemote\)/);
  assert.match(runtime,/rebaseLocalChanges\(base, localSnapshot, normalizedRemote\)/);
  assert.match(runtime,/async restoreBackup\(restoredState, backupReason\)/);
  assert.match(runtime,/const saved = await this\.saveNow\(restored\)/,'een back-up moet eerst door Firestore worden bevestigd');
  assert.match(runtime,/this\.writeInFlight = true;[\s\S]*const saved = await this\.saveNow\(restored\)/,'tijdens herstel mag een tussentijdse snapshot de schermstand niet vervangen');
  assert.match(runtime,/isStaleCloudSnapshot/,'vertraagde lagere snapshots moeten worden geweigerd');
  assert.match(runtime,/await this\.acceptRemote\(\{/,'pas daarna mag de herstelde back-up de schermstand worden');
  assert.match(runtime,/await CloudAdapter\.restoreBackup\(migratedImport/);
  assert.match(rules,/request\.resource\.data\.syncVersion\s*==\s*resource\.data\.syncVersion\s*\+\s*1/);

  console.log('Cloud-sync protocol blokkeert verouderde writes.');
})().catch(error=>{
  console.error(error);
  process.exit(1);
});
