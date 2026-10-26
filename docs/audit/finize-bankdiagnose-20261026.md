# Finize — werkpakket A, diagnose 26 oktober 2026

Basis: V118-r13, main/origin-main `28025c6d09c685e1517ef31d3548bcb02b1b3cdf`. Afzonderlijke lokale branch `codex/bank-sync-diagnose-20261025`. Deze diagnose wijzigt geen bankcode of productiegegevens. Werkpakket B wordt apart ontwikkeld en bewijst geen herstel van A.

## Waarneming en keten

Dion meldt dat Persoonlijk werkt, de eerste gezamenlijke import slaagde en herhaling van Gezamenlijk na ongeveer 5–10 seconden faalt met: `De actie is niet afgerond. Controleer je verbinding en probeer opnieuw. Stap: Bankgegevens vergelijken.`

`src/ui/bank-connection.mjs`: `/sync`-request → HTTP/JSON → `resolveProviderImportBase` en `listImports` (fase import-read) → `stageProviderSnapshot` (fase staging) → `persistImportDraft` (fase storage). De generieke stagingtekst betekent een foutcode buiten de beperkte UI-tabel of een native exception. Een rechtstreeks gemelde backend-, cloudread- of persistfout heeft een andere fase. Ongeldige eerdere input kan wel indirect staging laten mislukken.

`providerBatchId` gebruikt profiel-ID plus vaste bankaccounthash; bronrij-ID gebruikt bankaccounthash plus providerreferentie. Geen apart stagingpad voor de tweede rekening. `resolveProviderImportBase` hergebruikt pending-base- en revisiecontrole. `pendingImportBaseMatches` bewijst de lokale queue/operatieketen tegen cloudbasis/epoch/revisie; bestaande recordserialisatie bewaart volledige providerInput.

## Actueel bewijs — uitsluitend lezen

Bestaande CLI-aanmelding gebruikt voor begrensde Firestore-reads. Geen bank-API, autorisatie, sessie-, IAM-, cloudwrite- of backendactie. Identiteiten uitsluitend intern vergeleken; geen e-mail, IBAN, profiel-/huishouden-ID, bankhash, sessie, token, transactie-inhoud of bedragen opgeslagen in dit verslag.

- Huidige accountLinks van beide vooraf bekende accounts bevestigen de onderzochte huishoudscope.
- Deze scope heeft geen `financialStorage/current`; `budgetState/current` bestaat in geverifieerd chunkformaat. De legacy backendreader is in deze situatie geen bewezen opslagroute-afwijking. Geen backendaanpassing voorgesteld.
- Persoonlijke bankimport: actief, channel bank-api, versie39, 26 rijen met 26 expliciete goedkeuringen. Geen ontbrekende providerInput/facts of ongeldig opgeslagen remittance-type.
- De import-ID, afgeleid met de bestaande `providerBatchId` uit de **permanente binding van de tweede rekening**, verwijst exact naar een **verwijderbewijs**: lifecycle deleted, versie98; geen channel of rijen. Persoonlijke binding verwijst naar de actieve import.
- De huidige financiële cloudgeneratie is met de bestaande decoder en hashes gecontroleerd en bleef tijdens lezen gelijk. Het tweede profiel is Gezamenlijk. Precies één verwijderbewijs, geen actieve importsummary voor deze ID, nul resterende bron-/effectverwijzingen en expliciete goedkeuringen bij deze import, nul gevonden verwijzingen in gesloten maanden of de onderzochte vervangings-, transfer-, voorschot-, spaar- en dekkingsledgers. Dit is geen algemene claim dat alle mogelijke apparaat- of operatiehistorie ontbreekt.

## Reproducties

52 bestaande relevante Node-tests en vijf bestaande browsergevallen voor gescheiden rekeningen slagen. Alle autorisaties/providerresponses in die tests zijn synthetisch; geen echte bankactie. Normale eerste en herhaalde synchronisatie van beide rekeningcontexten slaagt ook na een bestaande financiële record-roundtrip; identiteiten, providerInput en goedkeuringen blijven behouden.

Extra gerichte proef met ongewijzigde functies: persoonlijk actief + gezamenlijke tombstone; `resolveProviderImportBase` geeft de tombstone terug. `installBankConnection.ingest` bereikt staging en `stageProviderSnapshot` werpt `provider-batch-conflict`, fase staging. De UI-tabel mist deze code en produceert de gemelde generieke tekst. Persoonlijk herhalen slaagt; financiële staat, lokale imports en tombstone blijven gelijk.

Andere geïsoleerde risico's: gewijzigde feiten bij dezelfde bank-ID geven bewust provider-identity-conflict; kunstmatig ontbrekende providerInput of verkeerd remittance-type geven TypeError. Deze laatste scenario's zijn niet als productieoorzaak vastgesteld.

## Oorzaak en herstelgrens

**Concrete oorzaakconditie aangetoond:** de vaste bankimport-ID van Gezamenlijk botst met het permanente verwijderbewijs. Dit verklaart de rekeningafhankelijke fout en is door de volledige relevante keten gereproduceerd. De echte mislukte HTTP-response/lokale apparaatstand is niet vastgelegd; er is geen nieuwe echte banksync uitgevoerd.

De tombstone is een beschermingsbewijs, geen leeg concept. Niet verwijderen, overschrijven, negeren of automatisch heractiveren. Alleen een specifiekere fouttekst is diagnoseverbetering en lost de synchronisatie niet functioneel op. Een eventuele nieuwe importgeneratie vereist expliciete bevestiging en een vooraf beoordeeld ontwerp met afzonderlijke importidentiteit, behoud van harde bankbronidentiteiten, controle op bestaande verwijzingen/conflicten, en geen automatische hergoedkeuring van verwijderde transacties.

Dion heeft rechtstreeks bevestigd: “Ja, verwijderd; bevestigde nieuwe bundel toestaan”. Dit staat het bouwen van een bevestigingsroute toe. Het is geen uitvoering van een echte herimport: die vereist later een afzonderlijke bevestiging in Finize.

## ChatGPT-review

Alle diagnoseverslagen via computerbesturing naar de bestaande reviewchat gestuurd en volledige reacties gelezen. Eerste review: aanvullende alleen-lezen diagnose toegestaan; geen speculatieve reparatie. Aanvullende review: sterk oorzaakbewijs, akkoord voor herstelontwerp, **nog geen implementatie- of publicatieakkoord voor A**. Tombstone behouden; expliciete gebruikersbevestiging vóór opnieuw opbouwen; bestaande lifecycle-, scope-, provideridentiteits-, revisie- en goedkeuringsregels leidend. Controleer financiële/historische/operationele afhankelijkheden. Werk twee opties uit: duidelijke stopmelding of expliciet bevestigde nieuwe generatie. Review is op verslagbasis; reviewer heeft code en tests niet zelfstandig uitgevoerd.

## Fase B — lokaal herstel

Na de ontwerpreview en Dions bevestiging gaf ChatGPT voorwaardelijk akkoord voor lokale implementatie en synthetische tests. De aanvullende commitcontrole is vooraf expliciet beoordeeld. Publicatie vereist een nieuwe eindreview.

- `bank-import-generation.mjs`: stabiele afzonderlijke ID afgeleid van root-ID en exacte verwijderoperatie. De oorspronkelijke tombstone blijft bestaan. Bestaande actieve generatie wordt hergebruikt; een later verwijderde generatie krijgt pas na nieuwe bevestiging een opvolger. Maximaal 16 schakels; onduidelijkheid blokkeert.
- `bank-connection.mjs`: verwijderde import krijgt specifieke melding. Alleen handmatig Bank bijwerken biedt een expliciete bevestiging; zonder callback of bij annuleren geen nieuwe bundel. Vereist volledige financiële context, atomaire opslag, verbonden cloud zonder bekend conflict en een expliciet uit de cloud teruggelezen ouder-tombstone. Lokale offlinefallback is geen bewijs. Na bevestiging worden basis, scope en generatie opnieuw gecontroleerd.
- `runtime.js`: het financiële verwijderbewijs telt als bestaande importreferentie. Cloudherstel van tombstone-details vereist dezelfde versie/operatie in die financiële basis. Nieuwe generatie controleert resterende financiële/historische verwijzingen, openstaande journals en queue. Geen niet-atomaire fallback.
- `household-store.mjs`: in dezelfde bestaande IndexedDB-transactie als head/revisiecontrole en doelimport-CAS worden actuele ouder-tombstone, financiële records/verwijderbewijs en pending/conflict/uncertain journals/queue gelezen. Afwijking breekt de gehele commit af.
- Legacy cloudtransport leest ouder-tombstone en doelheader vóór schrijven in dezelfde bestaande financiële transactie. Recordcloud controleert ouder plus financieel verwijderbewijs vóór snapshotbouw; bestaande volledige head-CAS blijft gelden. Geen wijziging van backend, Firestore-regels of opslagformaat.
- Bronrij-ID en harde provideridentiteit blijven identiek; nieuwe bundel-ID is afzonderlijk. Nieuwe rijen zijn niet goedgekeurd. Nakijken kiest de actieve bundel.

### Aanvullend bewezen opslagprobleem

De nieuwe volledige browserproef persoonlijke import → bestaande goedkeuring → tweede import reproduceerde een TypeError in de bestaande kandidaatadoptie: een ongewijzigde, genest bevroren `remittance_information`-array werd met splice gemuteerd. ChatGPT keurde een gerichte veiligheidsaanpassing vooraf goed. De adoptie controleert nu structureel alle bevroren brononderdelen vóór enige mutatie. Identieke onderdelen blijven dezelfde objecten; afwijkingen geven source-integrity. De vergelijking onderscheidt ontbrekende velden en undefined en controleert geneste arrays. Gewone financiële wijzigingen blijven mogelijk. Geen rekenregel veranderd.

### Verificatie vóór eindreview

142/142 gerichte Node-tests slagen, inclusief oorspronkelijke deleted-root-fout, nieuwe generaties, bronidentiteit, behouden goedkeuringen, afhankelijkheden, pending-operaties, frozen-bronpreflight, legacy target/parent-conflict en recordcloud-roundtrip. De volledige runner met 76 Node-testbestanden is eveneens geslaagd (de laatste toegevoegde bewijsproef is aanvullend gericht herhaald).

Tien nieuwe browsergevallen gebruiken echte IndexedDB met uitsluitend synthetische snapshots en cloudresponses: beide rekeningen, annuleren, bevestigen, herhalen/herladen, parallel bevestigen, wijziging tijdens dialoog, late pending-operatie, offline ouder en native opslagabort/herproberen; handmatige bevestigingsroute op 320/390/430 px. De laatste gecombineerde A-browserherhaling omvat 50 gevallen en wordt vóór vrijgave afgerond.

De oudere lifecycle-browserfixture faalde ook met het ongewijzigde r13-bundelbestand: de initiële mutatie werd niet toegepast en de geselecteerde maand bleef juli. De fixture wordt nu vóór bootstrap klaargezet. Bestaande assertions zijn behouden; voor bronregels in september/2099 wordt het bestaande expliciete maandfilter gekozen. Alle negen lifecyclegevallen slagen, inclusief twee geïsoleerde apparaten, legacy cloudtransactie en behoud na reload.

Er is geen echte banksynchronisatie uitgevoerd. Synthetisch succes is geen bewijs van een nieuwe echte banksynchronisatie. Productiegegevens en bankverbindingen zijn niet gewijzigd.

## Definitieve lokale controle

Na de laatste bronwijziging: 143/143 gerichte Node-tests, 97/97 aanvullende synthetische banktests (.mjs) en alle 76 bestanden van de volledige Node-run slagen. De gecombineerde releasecontrole slaagt voor 78/78 browsergevallen. Daarin zit de werkelijke r13→r14-serviceworker-update, offline gebruik en softwareterugrol met gelijkblijvende financiële teststaat, imports, journals en queue. De aanvullende huishoudscope/PWA-proef wordt afzonderlijk vastgelegd in het releaseverslag.

De laatste veiligheidsaanvullingen weigeren cycli/bijzondere objecttypen vóór bronadoptie en binden een nieuwe generatie ook tijdens atomaire opslag aan het huishouden. Er is geen wijziging van rekenregels, backend, financiële brongegevens of bankverbinding.

ChatGPT las de implementatiebevindingen en keurde voortzetting naar de gecombineerde eindcontrole goed. Expliciet nagelezen: legacy parent/target-validatie en financiële manifestpublicatie delen dezelfde transactie (`core/runtime.js`, bestaande prepareCloudSnapshot/readAndValidate/publish-keten). Voorbereide chunks zijn zonder gepubliceerd manifest niet zichtbaar. Recordcloud behoudt de volledige head-CAS; geen afzonderlijke nieuwe importwriter. De gedeelde bronpreflight gebruikt structurele vergelijking vóór enige adoptie. De reviewer heeft de tests niet zelfstandig uitgevoerd.

Een oudere twee-apparatentest controleerde de cloud soms vóór het afronden van de asynchrone opslag. De test wacht nu expliciet op de bestaande `flushImportSync`; drie opeenvolgende herhalingen slagen, met behoud van alle financiële assertions. Daarna is de gehele gecombineerde browsercontrole opnieuw geslaagd.
