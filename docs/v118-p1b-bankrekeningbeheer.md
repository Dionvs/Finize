# V118 P1b — bankrekeningbeheer en saldobediening

Datum: 13 oktober 2026. Status: lokaal geïmplementeerd en gericht getest.
Werkbuild: `118-p1b`. Branch: `agent/v117-stabilisatie`. Basis-HEAD:
`fbf8b34b8000570e05b9ec0b1ec3f00ddd33e7e5`.

## 1. Uitkomst en expliciete gebruikerskeuze

De nieuwe route is **Instellingen → Bankrekeningen → Rekeningdetails → Saldo**.
Toevoegen, bekijken, bewerken, archiveren, heractiveren en P1-saldobeheer zijn
aangesloten op de bestaande app. De functie werkt ook in de lokale modus zonder
ingelogd account. Instellingen is daarvoor in de bestaande navigatie beschikbaar.

De gebruiker heeft de oorspronkelijke autorisatie-eis expliciet gewijzigd:
**werk lokaal, voorlopig zonder afscherming; alle rekeningen beheren**, ook de
persoonlijke rekening van het andere huishoudlid. Een browsertest bevestigt dat
een als Dion ingelogde gebruiker een rekening voor Dara kan registreren en haar
saldo kan beheren. Dit is de afgesproken tijdelijke werking, geen privacygarantie.

Er zijn geen productiegegevens gewijzigd, geen Firestore-regels gedeployed en
geen commit, push, merge of deployment uitgevoerd. P2 en P3 zijn niet gestart.

## 2. Herstelpunt en bestaande werkboom

P5a en P1 stonden ongecommit in dezelfde werkboom. Vóór wijzigingen zijn alle
gewijzigde en niet-gevolgde bestanden gekopieerd naar:

`C:\Users\dionv\AppData\Local\Finize-herstelpunten\v118-p1b-20261013-222512`

`manifest.json` bevat HEAD, branch, oorspronkelijke Git-status en SHA-256 per
gekopieerd bestand. Alle kopieën zijn tegen de bronhash gecontroleerd. De 14
bestandshashes van het eerdere P1-bewijs kwamen bij aanvang overeen. Alle drie
P5a-bestanden uit het eerdere bewijs zijn na P1b opnieuw gecontroleerd en gelijk.
De oude rapporten en bewijsbestanden blijven historische opleveringen; P1b heeft
een eigen bewijsbestand. Een herstel moet bewust per bestand gebeuren, met behoud
van eventuele latere wijzigingen; er is geen automatische terugzetactie uitgevoerd.

## 3. Rekeningoverzicht en rekeninggegevens

Het overzicht groepeert actieve rekeningen onder Gezamenlijk, Dion en Dara. Een
rekening toont naam, bekende bank, gemaskeerd IBAN, type, status en de P1-stand met
kwaliteitsstatus. Zonder ijkpunt verschijnt **Onbekend / Nog geen saldo-ijkpunt**.
Via **Toon gearchiveerde rekeningen** blijven archiefprofielen bereikbaar.

De formulieren gebruiken native invoervelden en selecties. Naam, expliciete
eigenaar, rekeningtype en een geldig Nederlands IBAN zijn verplicht bij nieuwe
registratie. Spaties en hoofdletters worden genormaliseerd; structuur en modulo-97
checksum worden gecontroleerd. Banknaam is optioneel. Een lege banknaam blijft
leeg en wordt als Onbekend weergegeven; er wordt geen bank geraden.

Er is één register: `accountProfiles`. Bestaande velden blijven behouden. Nieuwe
profielen hebben een eenmalig gekozen ID met `account-` en een UUID. De nieuwe
metadata is `accountType` (`payment` / `savings`) en `status` (`active` / `archived`).
`lastAccountOperationId` en `lastAccountOperationSignature` herkennen herhaalde
commands. Bestaande profielen krijgen geen verplichte bulkconversie: ontbrekende
status betekent actief, ontbrekend type wordt als Nog niet ingesteld getoond.

Nieuwe buitenlandse rekeningen vallen buiten deze versie. Bestaande buitenlandse
of afwijkende rekeningkenmerken blijven bij veilige metadatawijzigingen behouden.
Een bewezen IBAN kan ook niet naast een gearchiveerd profiel opnieuw worden
geregistreerd: heractiveren voorkomt dubbelzinnige historische rekeningherkenning.

## 4. Wijzigen, archiveren en heractiveren

Naam, banknaam en rekeningtype zijn bewerkbaar. IBAN en eigenaar kunnen alleen
worden gecorrigeerd wanneer de volledige beschikbare historie én losse
importdetails geen verwijzing bevatten. De controle omvat transacties, imports,
overboekingen, herkenningsregels, ijkpunten en overige stateverwijzingen naar ID of
rekeningkenmerk. Een gedeeltelijke periodewerkruimte vereist eerst de bestaande
route voor volledige historie. Als dat niet lukt, blijft de wijziging geblokkeerd.

Een toegestane correctie behoudt het profiel-ID. Voor een andere fysieke rekening
moet de gebruiker een nieuw profiel toevoegen. Bestaande bronbewijzen worden niet
herschreven. Verouderde formulieren overschrijven geen nieuwere profielstand en
behouden de invoer met een begrijpelijke foutmelding.

Archiveren en heractiveren wijzigen de status van hetzelfde profiel. Transacties,
ijkpunten, overboekingsverwijzingen en historische rekeningherkenning blijven
behouden. Fysiek verwijderen wordt aan de lokale mutatiegrens geblokkeerd.
Gearchiveerde rekeningen worden niet aangeboden voor nieuwe selectie. Een al
gebruikte verwijzing blijft zichtbaar bij raadpleging of correctie. Nieuwe CSV’s,
nieuwe bankbronregistraties, eerste goedkeuring van bankmutaties en nieuwe
saldowaarnemingen vereisen heractiveren. Bestaande saldo-ijkpunten blijven ook in
het archief corrigeerbaar.

## 5. CSV en interne overboekingen

Een handmatig geregistreerde rekening wordt bij de eerste CSV op haar bestaande
IBAN en profiel-ID herkend. Profielaanmaak vanuit de bestaande CSV-editor gebruikt
dezelfde centrale commandroute en validatie. Die editor heeft hiervoor ook een
keuze tussen betaalrekening en spaarrekening. Zij maakt geen parallel register.

Van rekening en Naar rekening gebruiken dezelfde profielen. Daardoor is een
rekening van Dara zonder eerdere CSV al bruikbaar als tegenrekening. Archief-
profielen worden bij nieuwe selectie uitgefilterd; bestaande geselecteerde
verwijzingen blijven met hun archiefstatus zichtbaar. De financiële verwerking
van interne overboekingen, sparen, zakgeld en budgetten is niet vervangen.

## 6. P1-saldobediening

De bestaande P1-component wordt in rekeningdetails voor precies het geselecteerde
profiel gebruikt. Berekening, peildatum, kwaliteitsstatus, vergelijking, expliciete
bevestiging, historie en correcties blijven dezelfde P1-functionaliteit gebruiken.
De knop heet Banksaldo invoeren of Banksaldo bijwerken, afhankelijk van het ijkpunt.
De waarneming maakt geen inkomsten, uitgaven of correctieboeking aan.

De uitgebreide rekeningstandeninterface is uit CSV verwijderd. Daar staat nu
**Bankrekeningen en banksaldo’s beheren**, die de nieuwe instellingenroute opent.
`openBankAccountDetails(accountProfileId)` is de gedeelde navigatie-ingang voor
later hergebruik door P3. Er is geen dashboardkaart toegevoegd.

## 7. Daadwerkelijke autorisatiegrens

De bestaande betrouwbare accountkoppeling gebruikt geverifieerde authenticatie en
de serverbeheerde `accountLinks`-rol. Firestore begrenst de financiële opslag per
gekoppeld huishouden. Binnen dat huishouden zijn de huidige financiële state en
importgegevens breed leesbaar en schrijfbaar voor gekoppelde leden. De actieve
cloudroute bewaart huishoudstate als JSON-chunks; zij biedt geen afzonderlijke
serverrechten per persoonlijk rekeningprofiel of saldo-ijkpunt.

P1b voegt volgens de gewijzigde opdracht geen eigenaarafscherming toe. De nieuwe
validatie beschermt rekeningidentiteit en historie in de normale lokale
schrijfroutes; zij is geen beveiliging tegen een gewijzigde client of rechtstreekse
Firestore-aanroep. Bestaande persoonlijke tabfilters elders in de app bewijzen
evenmin serverzijdige privacy. `firestore.rules` en `src/auth` zijn ongewijzigd.

Voor herstel van de oorspronkelijke beheerrechten is een afzonderlijk ontwerp
nodig voor servercontrole op rekeningmutaties, met afdekking van de bestaande
snapshot-/chunkroute en imports. Volledige persoonlijke leesprivacy vraagt ook een
afzonderlijke opslag-/leesgrens. Dat vervolg is niet geïmplementeerd of geactiveerd.

## 8. Opslag, synchronisatie en conflictgedrag

Alle rekeningcommands lopen via `commitChange`, de bestaande huishoud-IndexedDB-
transactie en operatiebewijzen. ID en operatie-ID blijven vast tijdens opnieuw
proberen. Een kandidaat wordt pas zichtbaar na duurzame opslag. Een abort behoudt
de vorige state; verloren ontvangstbevestiging wordt met readback en receipt
hersteld. De command controleert het actuele profiel opnieuw vóór opslag.

Metadata- en statuswijzigingen normaliseren historische transacties niet opnieuw.
In een gedeeltelijke werkruimte kunnen zulke wijzigingen zonder onnodige globale
historielaadactie worden opgeslagen. Identiteitswijzigingen en toevoegingen houden
de bestaande afhankelijkheidsgrens.

De gerichte rebase voor `accountProfiles` bewaart onafhankelijke wijzigingen en
gelijktijdige toevoegingen. Tegenstrijdige velden, nieuw dubbel IBAN en profiel-
verlies geven een expliciet conflict. Inkomende snapshots worden vóór acceptatie
op verlies en overschrijven van lokale rekeningwijzigingen gecontroleerd.

Beide versies worden duurzaam in het bestaande conflictjournal bewaard. Vanuit
Bankrekeningen kan de gebruiker het bestaande conflictscherm openen, beide
rekeningversies bekijken en lokaal of cloud opnieuw laten toetsen. Ontbrekende
profielen worden bij de keuze behouden; historie- en IBAN-controles blijven gelden.
Een na het bewaren van het conflict opnieuw gewijzigde rekening blokkeert de
verouderde keuze. Ook na een opgeloste rekeningkeuze blijven beide journalversies
als bewijs aanwezig. Tegenstrijdige wijzigingen vereisen dus een expliciete keuze.

Financieel schema 11 en IndexedDB-versie 4 blijven gelijk. Productie-recordopslag
is niet ingeschakeld. Cloudgedrag is getest met lokale snapshots en testopslag;
er is geen verbinding met een productieserver gebruikt.

## 9. Gewijzigde modules

| Module of bestand | P1b-wijziging |
|---|---|
| `src/core/account-profiles.mjs` | Centrale profielcommands, IBAN-validatie, historie- en archiefcontroles |
| `src/ui/bank-accounts.mjs` | Overzicht, details, formulieren en navigatie |
| `src/ui/account-balances.mjs` | Bestaande P1-component op één profiel en archiefgedrag |
| `src/core/balance-checkpoints.mjs` | Nieuwe waarneming op archiefrekening blokkeren; correcties behouden |
| `src/core/runtime.js` | Instellingen, gedeelde opslagcommand, mutatiegrens en snapshotcontrole |
| `src/core/data-normalization.mjs` | Expliciet lege banknaam behouden |
| `src/import/runtime.js` | Centrale profielaanmaak, rekeningtype, selecties, archiefcontrole en bestaand conflictjournal |
| `src/storage/sync-protocol.mjs` | Gerichte rekeningrebase en behoudcontrole |
| `src/storage/period-workspace.mjs` | Veilige metadata onderscheiden van identiteitswijzigingen |
| `src/styles/settings.css` | Bestaande stijlen uitbreiden voor overzicht en formulieren |
| `app.js`, `app.css`, `index.html`, `service-worker.js` | Gebouwde assets en gelijke versie `118-p1b` |
| `tests/v118-p1b-accounts.test.cjs` | 37 nieuwe gerichte Node-gevallen |
| `tests/browser/v118-p1b-accounts.spec.cjs` | 13 nieuwe browsergevallen |
| Bestaande P1-/V117-browserfixtures en assetcontracttests | Nieuwe navigatie en geldige profielaanmaak; financiële verwachtingen behouden |

`src/styles/import.css` bevat de eerder aanwezige P1-stijlen en is door P1b niet
opnieuw gewijzigd. Oudere synthetische V117-profielen worden vóór bootstrap als
legacyfixture geladen; zij worden niet als nieuwe ongeldige rekeningen aangemaakt.

## 10. Uitgevoerde verificatie

Definitieve uitslag: **325 Node-tests geslaagd, 0 fouten; 27 browsergevallen
geslaagd, 0 fouten**. Daarvan zijn 37 Node- en 13 browsergevallen nieuw voor P1b.
Oudere scripts met meerdere gewone assertions kunnen als één Node-test tellen.
De exacte commands, hashes en logpaden staan in `audit/v118-p1b-bewijs.json`.

Getest zijn de rekeningcommands, checksum/dubbel IBAN, alle lokale eigenaren,
historieblokkades, stabiele identiteit, archiveren/heractiveren, eerste CSV,
tegenrekeningselectie, P1-saldo’s en correcties, codecs, rebase en werkelijke lokale
snapshotacceptatie. Browsergevallen omvatten echte IndexedDB-abort, wachten op
opslag, verloren bevestiging, verouderde invoer, duurzaam conflictbehoud na herladen
en expliciete conflictkeuze. Een ingelogde Dion→Dara-route en native verplichte
eigenaarskeuze met toetsenbordbediening zijn afzonderlijk getest.

De bestaande gerichte contracten dekken P5a, CSV-verwerking, V117-bronnen en
goedkeuring, transactiemotor, maandadministratie, afgesloten maanden, periode-
werkruimte, sync, accountscope, authcontract en cache-/assetconsistentie. Browser-
bewijs omvat negen bestaande P1-gevallen, twee V117-spaarinlegroutes, de cache-
upgradecontrole en twee bestaande accountnavigatiegevallen.

De aangepaste routes zijn bediend op 1440, 390 en 320 px. Overzicht, formulier,
rekeningdetails en saldohistorie zijn in screenshots geopend en visueel bekeken.
Geen horizontale overflow is gemeten. De Impeccable-eindcontrole vond één punt:
nieuwe rekeningen moeten een expliciete eigenaar vereisen. Dit is gerepareerd en
met een browsergeval gecontroleerd. De gerichte mechanische UI-scan gaf geen
bevindingen. Build-reproduceerbaarheid, JavaScript-syntax, CSS en `git diff --check`
slagen. De CSS-check meldt alleen de eerder bekende ontbrekende v50-token `--line`.

Ontwikkelruns bevatten gecorrigeerde testproblemen: een aangepaste broncodevorm
paste niet bij een bestaande tekstassertie, een codecfixture miste `complete:true`,
en een nieuwe integratietest begon vóór de tweede rekeningcommit klaar was. De
laatste situatie werd terecht door de opslaggrens geweigerd. Alleen de definitieve
groene runs vormen bovenstaande oplevercijfers.

## 11. Grenzen en hergebruik

P2 kan dezelfde stabiele profiel-ID’s, P5a-invoer en bestaande P1-selectors blijven
gebruiken. P3 kan `openBankAccountDetails` gebruiken om dezelfde rekeningdetails
te openen. Er is geen tweede saldomodel, financiële motor of rekeningregister.

Resterende grenzen: geen persoonlijke serverafscherming; geen nieuwe buitenlandse
rekeningregistratie; IBAN-/eigenaarcorrecties met enige historie zijn geblokkeerd;
P1’s bestaande tegenstrijdige ijkpunthistorie heeft nog geen eigen keuze-interface;
bankdekking wordt niet uit CSV afgeleid. Nieuwe mutaties op archiefrekeningen
vereisen heractiveren. Er is geen volledige V118-regressie, emulatorreeks,
500-/5.400-transactieschaaltest of benchmark uitgevoerd.

**P1b stopt lokaal voor beoordeling. Een productiepublicatie en het opnieuw
invoeren van de oorspronkelijke bevoegdheidsgrens vereisen een afzonderlijke
opdracht.**
