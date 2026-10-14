# Finize V118 — P4: Slimme transactiesuggesties

Datum: 14 oktober 2026. Status: lokaal geïmplementeerd, gericht getest; klaar voor beoordeling.
Lokale asset-/cacheversie: **118-p4r1**. Branch: `agent/v117-stabilisatie`.
HEAD: `fbf8b34b8000570e05b9ec0b1ec3f00ddd33e7e5`.

## Uitkomst

P4 breidt `classifyOriginal`, `recognitionProposal`, `learnedRecognitionRules` en de bestaande Nakijken-editor uit. Er is één herkenningsroute. Een voorstel is geen goedkeuring: wijzigen, een alternatief kiezen en bulkbewerking boeken niets. Alleen de bestaande centrale, expliciete goedkeuringsroute activeert de financiële verwerking.

Nieuwe voorstellen leggen hun signaal, herkomst, onzekerheid en mogelijke alternatieven uit. Budgetten worden in de historische bankmaand opgelost. Geleerde regels krijgen optionele fysieke rekeningcontext; een winkelmatch neemt geen andere persoonlijke eigenaar over. Vaste-lastvoorstellen gebruiken bestaande occurrence-ID's. Transfers blijven onbevestigde voorstellen totdat de bestaande bevestigingsroute wordt gebruikt.

## Vooraf onderzocht en veiliggesteld

De actieve bron staat in `G:\Mijn Drive\Codex\financien\outputs\dion_dara_budget\webapp\github\Finize-live-repo`. De OneDrive-werkmap is niet de broncheckout.

Gelezen: het V118-inventarisatieplan; P5a/P1/P1b/P2-verslagen; P3-dashboardverslag, Impeccable-herstelverslag en herstelbewijs voor `118-p3r1`; de daadwerkelijke import-, approval-, budget-, salaris-, occurrence-, transfer-, refund-, spaar- en opslagcontracten. Interfaces zijn in de code gecontroleerd.

Vóór wijzigingen zijn alle **54 gewijzigde en niet-gevolgde bestanden** gekopieerd naar:

`C:\Users\dionv\AppData\Local\Finize-herstelpunten\v118-p4-20261014-162725`

`manifest.json` bevat branch, HEAD, bestandsnamen, grootte en SHA-256. Iedere kopie is tegen het origineel geverifieerd. Aan het einde zijn 42 bestanden uit dit herstelpunt bytegelijk; de overige 12 bevatten uitsluitend de P4-uitbreiding, gegenereerde assets of de noodzakelijke versieaanpassing. De bestaande ongecommitte wijzigingen zijn behouden.

## Gerichte inventarisatie en aanvullingen

| Onderdeel | Bestond en werkte volgens gerichte contracttests | Concreet gat en kleine aanvulling | Bewaking |
|---|---|---|---|
| Herkenning | Prioriteit tegenrekening → omschrijving → organisatie → trefwoord → prediction; conflictdetectie | Optionele uitleg, echte herkomst, onzekerheidsstatus en alternatieven in dezelfde route | update4-import-engine, update4-import-review-simplification, nieuwe P4-tests |
| Categorie/budget | Historische budgetresolver en budget-ID-validatie bij opslaan | Nu ook op het voorstel toegepast; ongeldige historische bestemming wordt leeggelaten; ongeldige budgetalternatieven niet aangeboden | Nieuwe P4-historie- en conflictgevallen; v113-csv-processing |
| Eigenaar | Bankrekeningprofiel en expliciete budgeteigenaar | Geleerde regels per profiel, broneigenaar, rekeningkenmerk en richting; geen eigenaarsovername tussen rekeningen of op grond van een winkelmatch | Nieuwe P4-contextgevallen |
| Salaris | Werkgever én ontvangstrekening én actief handmatig goedgekeurd salaris; occurrence- en salarisbron-ID | Bestaand bewijs ongewijzigd hergebruikt; ontbrekend of ambigu bewijs zichtbaar; afschrijving geeft geen salarispersoon | Alle 8 v117-p4-salary-tests; nieuwe P4-veiligheidsgevallen |
| Vaste lasten | Gekoppelde regel, historische bedragen, tolerantie en occurrence-keuzelijst | Voorstel voor vrij occurrence-ID bij passende tegenrekening, eigenaar, bedrag en datum; expliciete kasdatum gaat voor planningsanker; meerdere betaalmomenten blijven open | Nieuwe P4-occurrencegevallen; v113-csv-processing |
| Interne transfers | Eigen tegenrekening herkennen, fysieke profielkeuze, expliciete paarbevestiging | Uitleg voor één bron, mogelijk wederkerig paar of ambigu paar; bron-ID's blijven kandidaatmetadata; geen automatische paarbevestiging | Nieuwe P4-transfergevallen; bestaande transactie-/importcontracten |
| Sparen | V117-spaarmotor, doelen en expliciete inlegrelaties | Doelvoorstel vereist geregistreerde goedkeuringsherkomst, geldige rekeningcontext en bestaand doel van die eigenaar; blijft te bevestigen | Nieuwe P4-spaargevallen; package4-savings-refunds-forecast, v117-budget-detail-capital |
| Refunds | Eén echte kasontvangst plus categoriecorrectie; refundCategory/refundMonth | Geen correctiemaand raden; maandkeuze blijft leeg en wordt in P4 expliciet verplicht, ook na editorgebruik | Nieuwe P4-refundgevallen; bestaande refundcontracten |
| Leren | Bestaande regelopslag en leerfunctie; maximum 300 regels | Optionele context/herkomst; geen leren uit ongoedgekeurde, uitgesloten of gesplitste voorstellen; de huidige editor- en bronapprovalroute roept de bestaande leerfunctie nu binnen dezelfde kandidaatcommit aan | Nieuwe P4-leer-/normalisatiegevallen, daadwerkelijke browserherstart |
| Bulk | Afzonderlijke bronapproval, geselecteerde bronnen, receipt/journal | Nieuwe categorie-bulkscope voor aangevinkte bronnen; geen overname van unieke salaris-, rekening-, refund- of inleglinks via een template; categorie wist alleen het opnieuw te kiezen budget-ID | Nieuwe P4-bulkgevallen, 5-uit-10-browserflow; v117-p1/p44 |
| Opslag | IndexedDB, Firestore-envelope, CAS/conflicten en operation receipts | Metadata blijft binnen bestaande records; geen nieuw schema of opslagpad | P4-envelope/normalisatie; package5-sync, cloud-sync-protocol, v117-p1/p44 |

## Gewijzigde modules en bestanden

- `src/import/runtime.js`: herkenningscontext, uitleg, voorstelvalidatie, bestaande leerfunctie bij expliciete commit, beperkte bulkbescherming en Nakijken-bediening.
- `src/styles/import.css`: compacte uitleg, native details/select en mobiele tekst/raakgebieden in de bestaande vormgeving.
- `app.js` en `app.css`: opnieuw gegenereerd via het bestaande buildscript; `index.html` en `service-worker.js`: consistente asset-/cacheversie.
- Twee nieuwe P4-testbestanden; zes bestaande release-/cachetestbestanden bevatten uitsluitend de nieuwe versieverwijzing.
- Dit verslag en `docs/audit/v118-p4-bewijs.json` zijn nieuw. Geen andere bronmodules zijn voor P4 aangepast.

## Voorstelmetadata en leerregels

Een importregel kan optioneel `suggestion` bevatten:

- `version: 118`, `status: supported | uncertain | conflict | none`.
- `level`, `ruleIds`, `reasons`, `needsConfirmation` en `alternatives`.
- `provenance` met aantoonbaar geregistreerde handmatige goedkeuring, of `kind: legacy-rule`.
- Waar relevant: `occurrences`, een nog te bevestigen `destinationOwner`, en `transfer` met soort kandidaat en bestaande bron-ID's.

Nieuwe herkenningsregels kunnen `context` en `provenance` bevatten. Context bestaat uit profiel-ID, broneigenaar, rekeningkenmerk, richting en gekozen budgeteigenaar. Herkomst bevat bronregel-ID, import-ID en het daadwerkelijk aanwezige goedkeuringstijdstip. Er worden geen historische goedkeuringen bijgemaakt.

Oude regels blijven werken zonder migratie en worden aangeduid als **Herkomst onbekend / bestaande regel**. Inhoudelijk bewerken van een regel verwijdert de oude goedkeuringsherkomst. De bestaande limiet van 300 regels blijft staan. Een regelwijziging herschrijft geen al goedgekeurde transacties.

De metadata is uitleg bij het oorspronkelijke voorstel. De zichtbare verwerkingsvelden blijven de actuele gebruikerskeuze. Betrouwbaarheid gebruikt geen percentages. Een gelijke datum, bedrag of omschrijving bewijst geen bronidentiteit of verplichting.

## Nakijken op desktop en mobiel

De bestaande transactierij bevat een compacte status, zichtbare onzekerheid/conflicten en de native uitklapper **Waarom dit voorstel?**. Bij conflicterende regels kan de gebruiker via **Alternatief voorstel** een geldige bestemming kiezen. Bestaande velden voor eigenaar, categorie, salaris, vaste last, betaalmoment, doel, transferrekeningen en refund blijven de verdere keuzes bieden.

De bulkeditor heeft **Alleen aangevinkte transacties**. Vijf uit tien selecteren past uitsluitend die vijf categorieën aan. De eigen bron-ID, bankdatum, bankbedrag, profiel en splits blijven behouden. Een template kopieert geen unieke financiële bronrelaties; onverenigbare velden worden uitsluitend volgens de bestaande typewisselregels verwijderd.

Impeccable 4.0.2 is beperkt gebruikt voor context, polish en de kwaliteitsvloer van deze kleine uitbreiding. De detector geeft `[]`. De daadwerkelijke screenshots op 1440, 390 en 320 px zijn geopend en visueel gecontroleerd. Geen algemene audit of redesign.

## Financiële en opslaggrenzen

Er is geen wijziging in P1, P1b, P2, P3 of de financiële maandmotor. SHA-256 tegen het herstelpunt bevestigt onder meer ongewijzigde `src/core/runtime.js`, data-normalisatie, rekeningprofielen, saldo-ijkpunten, dagelijkse liquiditeit, liquidity settings, dashboard, presentatie, P5a-bankinvoer en de bestaande lokale/syncmodules.

Daarnaast zijn 10 bestaande motor-/opslagbestanden met hun Git-blob op HEAD vergeleken, waaronder transaction-engine, transaction-model, transaction-processing, planning-timeline, recurring-occurrences, salary-assignment, import-lifecycle, import-identity, household-store en import-sync-protocol. Alle zijn ongewijzigd. Daarmee zijn ook de salaris-/zakgeldformules, spaardekking en refundberekeningen behouden.

De aangepaste importmodule leest die bestaande contracten en maakt voorstellen. De noodzakelijke P4-refundmaandcontrole staat in de importvalidatie; oude transacties en het algemene refundcontract worden niet gemigreerd. Het bestaande editorjournal bewaart concepten; importrecords worden pas via de bestaande goedkeuringscommit vervangen. Nieuwe regelmetadata wordt in dezelfde duurzame kandidaatcommit opgenomen. CAS, receipts, intrekken/hergoedkeuren en synchronisatieconflicten volgen de bestaande route.

## Eindverificatie

**273 gerichte Node-tests geslaagd, 0 mislukt**, waaronder **25 nieuwe P4-tests**.

Uitgevoerd: v118-p4-suggestions, update4-import-engine, update4-import-review-simplification, v117-p4-salary, v117-p1, v117-p44, v113-csv-processing, package4-savings-refunds-forecast, v117-budget-detail-capital, package5-sync, cloud-sync-protocol, html-inline-syntax, service-worker-cache en package7-release-audit.

Deze reeks bewaakt voorstellen zonder budget-/zakgeld-/spaar-/refundeffect, historische maanden, herhaalde bevestiging, intrekken/hergoedkeuren, ontvangstbewijzen, splits, bronidentiteiten, duurzame keuzes en bestaande veilige lokale/cloudconflicten. Nieuwe P4-tests controleren ook metadata via de bestaande normalisatie en cloud-envelope.

**4 browsergevallen geslaagd, 0 mislukt**. De drie volledige reviewflows op **1440, 390 en 320 px** gebruiken echte CSV-invoer met tien synthetische bronnen, zichtbare conflicten, alternatiefkeuze zonder boeking, vijf geselecteerde categoriewijzigingen, duurzame conceptkeuzes na herladen, één expliciete goedkeuring en precies één financiële verwerking na opnieuw herladen. Nieuwe leerregelherkomst blijft na herstart aanwezig. Geen page errors, geen horizontale modaloverflow; de nieuwe uitleg is minimaal 12 px. Het vierde, afzonderlijk uitgevoerde browsergeval controleert de lege correctiemaand bij een refund en twee refundsplits, zonder financiële ontvangst te boeken.

Build, JavaScript-syntax, CSS, byte-reproduceerbare assets en diffcheck slagen. Alleen het bestaande CSS-token `--line` en Git-notities over regelafbrekingen worden gemeld. Release-/cachetests zijn bijgewerkt naar `118-p4r1`; de overige bestaande testinhoud is behouden.

Controleerbaar bewijs: [docs/audit/v118-p4-bewijs.json](docs/audit/v118-p4-bewijs.json). Volledige eindcommando's, aantallen, hashes, behouden bestanden en grenzen staan daarin. Eindlogs en screenshots staan in `.cache/v118-p4/`.

## Bewust niet gebouwd en beperkingen

- Geen nieuwe suggestie-, recurrence-, reconciliatie-, CSV- of financiële motor.
- Geen automatische goedkeuring, transferpaarbevestiging, bronfusie of overslaan op basis van fuzzy overeenkomsten.
- Geen eigenaar bepalen uit alleen organisatie, salarisbedrag of maandfrequentie; geen aankoop of historische refundmaand raden.
- Geen unieke inlegrelatie aanleren of naar meerdere bankbronnen kopiëren; geen doel afleiden uit alleen een spaarrekening.
- Geen terugwerkende wijziging van goedgekeurde transacties, budgethistorie of bestaande regels zonder herkomst.
- Geen Firestore-schemawijziging, productie-recordcutover, nieuwe Firebase-architectuur, bankkoppeling of P5b.
- Geen 500-/5.400-transactieschaaltests, benchmark, volledige V118-regressie of emulatorreeks.

De browsercontrole betreft Chromium met mobiele viewports, geen fysieke telefoon of volledige WCAG-certificering. Devicewissel en cloudconflicten zijn met de bestaande gemockte contracttests gecontroleerd; er zijn geen echte cloudclients of productiegegevens gebruikt. Oude regels hebben onbekende herkomst. Een bestaand regelvoorstel of exact datum-/bedragsignaal blijft een voorstel; ambiguïteit vraagt een gebruikerskeuze.

P5b of een echte bankkoppeling moet later provideridentiteiten, cross-import/cross-provider relatiebewijs, volledige bankdekking, providerreversals en echte multi-device/cloudcontracten toetsen. P4 maakt dat bewijs niet zelf aan.

## Stopconditie

Uitsluitend P4 is uitgevoerd. Geen Git-reset, checkout, cleanup, commit, push, merge, deployment of productiewijziging. P5b is niet begonnen. Wacht op beoordeling.
