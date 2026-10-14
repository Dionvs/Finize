# V118 P1 — saldo-ijkpunten en rekeningstanden

Datum: 13 oktober 2026. Status: lokaal geïmplementeerd en gericht geverifieerd.
Basis: branch `agent/v117-stabilisatie`, HEAD
`fbf8b34b8000570e05b9ec0b1ec3f00ddd33e7e5`. Werkbuild: `118-p1`.
De al aanwezige, ongecommitte P5a-bestanden en V118-inventarisatie zijn behouden.

## 1. Wat is gebouwd

Per bestaand fysiek rekeningprofiel kan een werkelijk banksaldo met peildatum
worden ingevoerd, gecontroleerd, bevestigd en later gecorrigeerd. De rekeningstand
volgt uit het nieuwste geldige ijkpunt op of vóór de gevraagde datum en de
oorspronkelijke bankmutaties erna. De UI toont de stand tot en met vandaag.

De bediening staat in de bestaande bankimportinterface. De gezamenlijke rekening,
persoonlijke rekeningen en een bestaand spaarrekeningprofiel gebruiken dezelfde
projectie en bediening. Er is geen nieuw rekeningbeheer of dashboard gebouwd.

De functies zijn aangesloten op de app. P2–P5b zijn niet uitgevoerd. Er is niet
gecommit, gepusht, gemerged, gedeployed of op productie geschreven.

## 2. Bestanden

| Bestand | Wijziging |
|---|---|
| `src/core/balance-checkpoints.mjs` | Pure selectie, validatie via P5a, historie, vergelijking en append-command |
| `src/ui/account-balances.mjs` | Rekeningstanden, invoer, bevestiging, historie en correctie |
| `src/core/runtime.js` | Aansluiting op `commitChange`, bestaande importopslag en cloudhistoriecontrole |
| `src/import/runtime.js` | Kleine render-/bindaansluiting binnen de bestaande importinterface |
| `src/storage/period-workspace.mjs` | Ijkpunten als volledig geladen globale, niet-financiële gegevens behandelen |
| `src/storage/sync-protocol.mjs` | Onveranderlijke ijkpunten behouden bij rebase; verlies in inkomende snapshots blokkeren |
| `src/styles/import.css` | Bestaande vormgeving uitbreiden met responsieve invoer en historie |
| `app.js`, `app.css`, `index.html`, `service-worker.js` | Gebouwde assets en gelijke versie `118-p1` |
| `tests/v118-p1-balance.test.cjs` | 36 nieuwe gerichte Node-gevallen |
| `tests/browser/v118-p1-balances.spec.cjs` | 9 nieuwe browsergevallen |

Zes bestaande testbestanden met een expliciete asset-/cacheversie zijn aangepast
aan `118-p1`. Er zijn geen financiële verwachtingen in bestaande tests gewijzigd.
P5a, de transactiemotor, de bestaande CSV-bronselectie, schema 11,
IndexedDB-versie 4 en de Firestore-regels zijn ongewijzigd.

## 3. Definitief datamodel en daggrens

`balanceCheckpoints` is een optionele lijst in de huishoudstate. Een nieuwe lijst
ontstaat pas bij een expliciet bevestigde waarneming. Iedere waarneming bevat:

| Veld | Betekenis |
|---|---|
| `version` | Modelversie 1 |
| `id`, `operationId` | `balance-<operatie-ID>` en de vaste operatie-ID van de invoeractie |
| `householdId`, `accountProfileId` | Huishoudscope en bestaand fysiek rekeningprofiel |
| `amountCents`, `currency` | Getekend veilig geheel aantal centen, EUR |
| `asOfDate`, `boundary` | Kalenderdag `YYYY-MM-DD`, uitsluitend `end-of-bank-day` |
| `source` | `manual-observation` |
| `createdAt`, `actor` | ISO-vastlegtijd; ingelogde UID indien betrouwbaar beschikbaar, anders `null` |
| `revision`, `supersedesId` | Revisie vanaf 1, optionele verwijzing naar de vorige waarneming |
| `note` | Optionele toelichting |

De waarneming doorloopt het P5a-type `balance-observation`, kanaal manual, type
booked. Er wordt geen transactie-envelop of financieel effect aangemaakt.

Een ijkpunt van € 1.000 op 10 oktober bevat alle geboekte bankmutaties tot en met
10 oktober. Een afschrijving van € 100 op 11 oktober geeft € 900. De afschrijving
van € 50 op 10 oktober wordt niet opnieuw afgetrokken. Geldige ISO-kalenderdagen
worden lexicografisch vergeleken; maandgrenzen worden expliciet opgebouwd.
UTC-dagrekenen wordt alleen gebruikt om een volgende kalenderdag te vinden.

Negatieve en nulstanden zijn toegestaan. Toekomstige peildatums, ongeldige datums,
bedragen met extra decimalen en onbekende rekeningprofielen worden geweigerd.

## 4. Bankbedragen en drie kwaliteitsdimensies

De projectie hergebruikt `selectBankTransactions` en `sourceRecordKey`. Ze telt
uitsluitend `bankOriginal.amount`, exact omgerekend naar eurocenten. Budgetimpact,
verwerkte splitbedragen, maandruimte, openingssaldo-instellingen, maandcorrecties
en spaardoelsaldi zijn geen invoer voor deze rekeningstand.

- **Bevestigde bronnen:** geboekte, bruikbare bankbronnen met expliciete handmatige
  goedkeuring. Ook `Niet meetellen` houdt zijn fysieke bankbedrag.
- **Voorlopige bronnen:** bruikbare geboekte bronnen zonder die goedkeuring. Ze
  tellen eenmaal mee en maken de bronstatus voorlopig. Latere goedkeuring verandert
  de status en de verdeling bevestigd/voorlopig, niet de rekeningstand.
- **Onzekere bronnen:** onbesliste mogelijke duplicaten, bronconflicten, onbekende
  rekening, ontbrekende bankgegevens/valuta, ongeldige bedragen/datums en pending
  of onbekende boekingsstatus worden uitgezonderd met een concrete reden.

Handmatige registraties en uitgevoerde handmatige transfers zonder aangetoonde
bankbron tellen niet mee en worden als onopgelost gemeld. Een expliciete vervanging
van een handmatige transactie wordt al door de bestaande bronselectie onderdrukt.
Interne bankoverboekingen beïnvloeden alleen de betreffende fysieke rekening;
P1 wijzigt de bestaande huishoudinkomsten of spaarledgers niet.

De afzonderlijke kwaliteitsvelden zijn:

1. `bankSources`: confirmed, provisional of uncertain.
2. `coverage`: complete, partial of unknown. De selector kan expliciete
   P5a-dekkingsverklaringen ontvangen. De huidige UI leidt geen dekking af uit CSV
   of een sluitend saldo; na de ijkpuntdag is de dekking daarom doorgaans onbekend.
3. `storage`: verified of incomplete. Voor gedeeltelijke historie moeten alle
   maanden na het ijkpunt tot de berekendatum geverifieerd beschikbaar zijn.

`Bevestigd` verschijnt alleen als ook de andere voorwaarden voldaan zijn. Op de
ijkpuntdag zelf is geen aanvullend transactiebereik nodig. Onbekende dekking of
openstaande reviews geeft `Voorlopig`; uitgesloten onzekere bronnen geven
`Onvolledig`. De bekende deeloptelling blijft in dat laatste geval zichtbaar met
de redenen. Ontbreekt het ijkpunt of een belangrijke opslagafhankelijkheid, dan is
`balanceCents: null` en toont de UI **Onbekend**, nooit een verzonnen nul.

## 5. Dubbeltelling, revisies en reconciliatie

Een bankbron telt eenmaal, ongeacht financiële splits of meerdere bewezen
importverwijzingen. Bestaande bank-ID-/file-row-bewijzen worden alleen gebruikt om
tegenstrijdige materialisaties te signaleren. Er is geen nieuwe matching op
omschrijving, datum en bedrag. Teruggetrokken bronnen leveren geen kasmutatie op.

Een volgende waarneming vergelijkt de nieuwe stand met de eerdere afgeleide stand.
Bij € 1.000 minus € 350 wordt € 650 verwacht; invoer van € 625 toont een verschil
van −€ 25. De vergelijking en onzekerheden staan vóór de knop **Bevestig banksaldo**.
Het verschil is informatief en maakt geen correctieboeking aan.

Correcties voegen een nieuwe revisie toe. Zowel het bedrag als een foutieve
peildatum kan worden gecorrigeerd; de oorspronkelijke waarneming blijft intact.
Een gewone invoer op een al gebruikte actieve peildatum wordt geblokkeerd met de
verwijzing naar Corrigeren. Een verouderde revisie kan niet opnieuw worden vervangen.

De selector kiest uit niet-vervangen, geldige waarnemingen op datum, revisie,
vastlegtijd en ten slotte ID. Tegenstrijdige gelijktijdige waarnemingen voor dezelfde
dag blijven beide behouden, maar geven een expliciete historieconflictstatus en
geen betrouwbare saldo-uitkomst. De gewone editor blokkeert dan verdere wijzigingen;
een aparte conflictkeuze-interface is niet in P1 gebouwd.

Voor bevestiging wordt de volledige vergelijking opnieuw berekend. Als bankbronnen
of ijkpunten intussen zijn gewijzigd, moet de gebruiker opnieuw controleren en
bevestigen. Herhaling van dezelfde vastgelegde operatie voegt niets toe.

## 6. Waar de gebruiker de functie vindt

Open **Gezamenlijk** of de eigen persoonlijke tab, kies de bestaande actie
**Uitgave toevoegen**, daarna **Bankbestand importeren**. Bovenaan de bankimport
staat nu **Rekeningstanden**, met een overzicht per bestaand rekeningprofiel.

1. Kies **Banksaldo invoeren** en vul saldo, peildatum en eventueel toelichting in.
2. Kies **Controleer saldo**. Bekijk verwachting, waarneming, verschil en redenen.
3. Kies **Bevestig banksaldo**. De knop wacht op de duurzame opslagbevestiging.
4. Open **Eerdere ijkpunten** voor historie en **Corrigeren**.

Dezelfde velden en acties werken op 1440, 390 en 320 pixels. Bedrag, datum en
toelichting gebruiken native formuliervelden; foutmeldingen en bevestigingsstatus
zijn semantisch gemarkeerd. Technische bron-/revisie-ID's blijven in de gegevens;
de historie toont begrijpelijke revisies en Nederlandse vastlegtijden.

## 7. Opslag en synchronisatie

De bestaande `commitChange` → DataAdapter → huishoud-IndexedDB-route bewaart het
record atomair met de vaste operatie-ID. Kandidaten zijn niet zichtbaar voordat
de commit is bevestigd. De bestaande operatie-receipts en readback herstellen
een verloren ontvangstbevestiging. Bij een abort blijft de vorige stand behouden.

De bestaande JSON-/recordcodec bewaart de optionele lijst zonder schemaverhoging.
Ijkpunten zijn globale records zonder maandfilter, zodat alle ijkpunten ook in een
gedeeltelijke periodewerkruimte aanwezig blijven. Alleen dit niet-financiële veld
is toegevoegd aan de lijst van globale wijzigingen waarvoor geen volledige
transactiehistorie hoeft te worden geladen.

De bestaande cloudcodec is verliesloos getest met het nieuwe veld. Rebase bewaart
de vereniging van onveranderlijke historie, inclusief twee gelijktijdige eerste
toevoegingen wanneer het optionele veld nog niet in de basis bestond. Een gewijzigde
waarneming met hetzelfde ID veroorzaakt een conflict. De echte clientroute voor
inkomende cloudsnapshots weigert verlies of overschrijving van bestaande lokale
ijkpunten. Deze route is in een lokale browser getest met aangeleverde snapshots;
er is geen productieserver gebruikt.

## 8. Uitgevoerde controles

De definitieve selectie staat in `audit/v118-p1-bewijs.json`, inclusief hashes en
lokale logpaden. Uitslag: **286 Node-tests geslaagd, 0 fouten; 12 browsergevallen
geslaagd, 0 fouten**. Daarvan zijn 36 Node- en 9 browsergevallen nieuw voor P1.
Oudere scripts met meerdere gewone assertions kunnen als één Node-test tellen.

De gerichte bestaande dekking omvat P5a, CSV-bronverwerking en -goedkeuring,
transactiemotor, maandadministratie/afsluitingen, periodedeelstaten, syncprotocol,
HTML-/cachecontracten en responsieve structuur. Browserbewijs omvat:

- Invoeren, verschil bevestigen, corrigeren, herladen, veldvalidatie en de zichtbare
  navigatieroute op 1440/390/320 px, zonder horizontale overflow.
- Echte IndexedDB-abort, opnieuw proberen met dezelfde operatie, verloren
  ontvangstbevestiging, wachten op opslag en een gewijzigde vergelijking.
- Behoud en blokkade van ijkpunthistorie in de bestaande cloudacceptatieroute.
- Dezelfde bediening voor een persoonlijk spaarrekeningprofiel.
- Twee bestaande V117-import-/spaarinlegroutes op 390 en 1440 px.
- De bestaande browsercontrole op oude cacheverwijdering en bijpassende assets.

De screenshots zijn geopend en visueel gecontroleerd. Build-reproduceerbaarheid,
JavaScript-syntax en CSS-controle slagen. De CSS-controle meldt de reeds bekende
v50-token `--line`; P1 introduceert die niet. De beperkte mechanische UI-scan gaf
geen bevindingen.

Tijdens ontwikkeling zijn testverwachtingen gecorrigeerd voor Nederlandse negatieve
euro-opmaak en het wachten op een asynchrone commit. Latere tests controleren ook
correctie van een foutieve peildatum en conflicterende bronidentiteiten. De
oplevercijfers zijn de uiteindelijke groene runs, niet de eerdere ontwikkelruns.

## 9. Hergebruik voor P2 en grenzen

P2 kan `selectAccountBalance`, `checkpointHistory`, `balanceRequiredMonths` en
de P5a-waarnemingsvalidatie gebruiken. De selector levert rekening-ID, gekozen
ijkpunt, beginstand, gesorteerde bankmutaties, bevestigde/voorlopige centtotalen,
eindstand, kwaliteitsdimensies en concrete redenen. De berekende rekeningstand
wordt niet opgeslagen als tweede waarheid.

Beperkingen: geen automatische bankdekking, geen live provider, geen automatische
conversie van oude openings-/afsluitsaldi, geen conflictkeuze bij gelijktijdige
tegenstrijdige ijkpunten en geen P2-prognose. Een oud bankrecord zonder noodzakelijke
feiten blijft onzeker in P1; zijn bestaande financiële verwerking wordt niet aangepast.

Er zijn geen 500-/5.400-transactieschaaltests, benchmarks, volledige V118-regressie
of Firestore-emulatorsuite uitgevoerd. De financiële schema's en serverregels zijn
ongewijzigd; lokale codec-, protocol- en clientroutecontroles dekken de geraakte
opslagpaden. De integrale V118-regressie en een eventuele publicatie blijven latere,
afzonderlijke stappen. **P1 stopt hier voor beoordeling; P2 is niet gestart.**
