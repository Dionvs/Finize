# V118 P2 — dagelijkse prognose en Vrij na verplichtingen

Datum: 14 oktober 2026. Status: lokaal geïmplementeerd en gericht geverifieerd.
Werkbuild: `118-p2`. Basis-HEAD: `fbf8b34b8000570e05b9ec0b1ec3f00ddd33e7e5`,
branch `agent/v117-stabilisatie`.

## 1. Uitkomst en werkboom

P2 voegt een pure dagelijkse rekeningprojectie en compacte prognose-instellingen
toe. Er is geen dashboard gebouwd. De fysieke startstand komt uitsluitend uit P1;
de bestaande V117-maandmotor blijft leidend voor financiële betekenis, historische
bedragen, budgetimpact, spaardekking en zakgeld. `available` wordt nergens als
banksaldo, extra verplichting of nieuwe financiële waarheid gebruikt.

De ongecommitte P5a-, P1- en P1b-wijzigingen waren bij aanvang aanwezig. Voor het
bewerken is een met SHA-256 gecontroleerd herstelpunt gemaakt van alle gewijzigde
en niet-gevolgde bestanden:

`C:\Users\dionv\AppData\Local\Finize-herstelpunten\v118-p2-20261014-072609`

Het manifest bevat de oorspronkelijke Git-status, HEAD en bestandshashes.
P2 heeft de bestaande wijzigingen behouden. Oudere rapporten en bewijsbestanden
blijven historische opleveringen. Het P2-bewijs staat in
[`audit/v118-p2-bewijs.json`](audit/v118-p2-bewijs.json).

## 2. Gebouwde modules en interfaces

| Bestand | Functie |
|---|---|
| `src/core/daily-liquidity.mjs` | Adapter, canonieke gebeurtenissen, horizon, daglijn, reserveringen, tekorten en betrouwbaarheid |
| `src/core/liquidity-settings.mjs` | Profielinstellingen, standaardbuffer en validatie van unieke rekening-/salaristoewijzing |
| `src/ui/liquidity-settings.mjs` | Native formulier in bestaande rekeningdetails |
| `src/core/account-profiles.mjs` | Nieuw `liquidity-settings`-command via bestaande profielmutatiegrens |
| `src/core/balance-checkpoints.mjs` | Optionele `checkpointId` om voor de toekomst hetzelfde startijkpunt te blijven gebruiken |
| `src/ui/bank-accounts.mjs` | Aansluiting van het formulier |
| `src/core/runtime.js` | `window.FinizeLiquidity`, bestaande opslag en beperkte dependency-loading |
| `src/storage/sync-protocol.mjs` | Ook bij samenvoeging unieke primaire rekening en salarisontvangst bewaken |
| `src/styles/settings.css` | Bestaande formulierstijl, checkbox en compacte kaart |
| `tests/v118-p2-liquidity.test.cjs` | 53 nieuwe financiële en opslagcontractgevallen |
| `tests/browser/v118-p2-liquidity.spec.cjs` | 7 nieuwe browsergevallen |

Gebouwde assets, HTML en service worker gebruiken dezelfde versie `118-p2`.
Bestaande tests met een letterlijke cache-/assetversie zijn daarop aangepast.
Financiële verwachtingen in bestaande tests zijn niet gewijzigd. De financiële
transactiemotor, planning-resolvers, CSV-verwerking, schema 11, IndexedDB-versie 4
en Firestore-regels zijn niet gewijzigd.

Pure exports:

- `buildLiquidityInput(state, options)`: adapter naar één expliciete invoerstructuur.
- `projectDailyLiquidity(input)`: uitsluitend exacte centberekeningen en dagprojectie.
- `selectDailyLiquidity(state, options)`: bovenstaande stappen samen.
- `liquidityRequiredMonths(state, options)`: benodigde perioden voor P1 en de horizon.
- `liquidityReasonMessage(reason)`: Nederlandse toelichting op kwaliteitsredenen.
- `shiftLiquidityDay(date, offset)`: kalenderdagberekening zonder lokale DST-verschuiving.

`options` bevat `accountProfileId`, `asOfDate`, optioneel `endDate`, huishoud- en
profielscope, importdetails, beschikbaarheid daarvan en eventuele P5a-bankdekking.
De optionele pure `monthlyForecast(state, month)`-adapter levert de bestaande
maandprognose. De app injecteert hier nadrukkelijk `monthlyFinancialForecast`,
inclusief de bestaande compatibiliteitsbehandeling van vaste teruggaven. P3 moet
deze aansluiting behouden en geen eigen spaar- of zakgeldformule toevoegen.

## 3. Canoniek gebeurteniscontract

Alle geldbedragen zijn veilige gehele eurocenten. Gebeurtenissen bevatten:

| Veld | Betekenis |
|---|---|
| `id` | Stabiele logische ID; bankbron, salaris-persoon-maand, occurrence of overboekingszijde |
| `accountProfileId` | Fysiek profiel-ID; `null` betekent onopgelost |
| `date` | Kasdag `YYYY-MM-DD`, of `null` bij ontbrekende/onzekere datum |
| `amountCents` | Getekende kasbeweging; bankbedrag komt uit de oorspronkelijke bron |
| `type` | `bank`, `salary`, `income`, `fixed`, `internal-transfer` |
| `status` | `actual`, `provisional`, `planned`, `reservation`, `replaced`, `unresolved` |
| `dateQuality` | `confirmed`, `explicitly-planned`, `unknown`; budgetverdeling gebruikt `estimated` |
| `sourceId` | Oorspronkelijke bankbron indien aanwezig |
| `occurrenceId`, `planningSourceId`, `month` | Herkomst en bestaande administratieve maandidentiteit |
| `replacedBy` | Bankbron-ID's die dit plan expliciet vervangen |
| `replaces`, `financialTypes` | Bij bankgebeurtenissen: bewezen planningslinks en bestaande verwerkingssoorten |
| `warnings` | Onzekerheden of ontbrekende rekeningtoewijzing |

Vervangen plannen blijven raadpleegbaar, maar tellen niet als kasbeweging. Een
bankbron met meerdere financiële splits blijft één getekende gebeurtenis.
De spaarambitie is een apart informatieveld en wordt niet tot een kasgebeurtenis
omgevormd. Alle gegevens zijn afgeleid en worden niet opgeslagen.

## 4. Startstand, werkelijk versus gepland

De startstand is `selectAccountBalance(..., toDate: asOfDate)`, aan het einde van
de berekendag. Mutaties op of vóór het saldo-ijkpunt zitten al in het ijkpunt;
mutaties tot en met `asOfDate` zitten al in de startstand. De toekomst bevat alleen
bruikbare P1-bankmutaties ná `asOfDate`. Een later aanwezig ijkpunt vervangt de
gekozen startbasis niet ongemerkt; de nieuwe optionele P1-parameter pint die basis
zonder de oorspronkelijke ijkpunthistorie te filteren of te wijzigen.

Salaris gebruikt de bestaande persoon-/maandlink
`income-defaults-salary-{persoon}:{maand}`. Werkelijk € 2.530 vervangt gepland
€ 2.500; een bonus blijft een afzonderlijke ontvangst. Expliciete nul en
historische salarisinstellingen blijven leidend. Een gekoppelde ontvangst vóór
het ijkpunt onderdrukt het toekomstplan eveneens.

Vaste lasten gebruiken uitsluitend de bestaande `fixedOccurrenceId`. Meerdere
gekoppelde bankbetalingen onderdrukken samen één plan; hun afzonderlijke fysieke
bankbedragen blijven behouden. Overige inkomsten gebruiken `incomeOccurrenceId`.
Een bronlink zonder bewezen occurrence geeft onzekerheid. Bij overige inkomsten
komt het extra onbewezen plan dan niet bovenop de bekende ontvangst.

Een behouden handmatig goedgekeurde salaris-/occurrencelink blijft bruikbaar als
de geboekte bron opnieuw bij Nakijken staat. Nieuwe herkenningssuggesties worden
niet als vervangingsbewijs gebruikt. Intrekken van een bron wordt via de bestaande
bronlifecycle gerespecteerd. Er is geen nieuwe matching op bedrag, tekst of datum.
Een identiek bedrag zonder expliciete link kan een andere betaling zijn.

Bankmutaties bij Niet meetellen houden hun kasimpact. Refunds volgen de echte
bankdatum; de historische categoriecorrectie maakt geen tweede ontvangst.
Spaarledgers of spaardoelsaldi maken evenmin extra fysieke mutaties.

## 5. Datums, horizon en rekeningtoewijzing

Een salarisbetaaldag is een afzonderlijke, expliciet bevestigde profielinstelling
per persoon. Beide salarissen kunnen verschillende dagen en fysieke rekeningen
hebben. De gekozen dag herhaalt maandelijks; dag 29–31 valt in een kortere maand
op de laatste kalenderdag, zoals het formulier vermeldt. Er worden geen
weekend-/feestdagcorrecties geraden. Legacy-salarisbegindatums worden niet gebruikt
als bewezen betaaldag. De instelling verandert geen salarisbedragen.

De gezamenlijke horizon eindigt op de dag vóór de eerstvolgende relevante
salarisontvangst. Een eerdere interne ontvangst verschuift die gezamenlijke
horizon niet. Persoonlijke rekeningen kunnen een expliciet geplande, fysiek
gekoppelde overboeking als volgende ontvangst gebruiken. Reeds vóór de berekendag
gerealiseerd salaris wordt overgeslagen. Bij historische berekendatums kan een
al bekende latere werkelijke salarisontvangst de plandatum vervangen.

`endDate` kiest een handmatige, inclusieve einddag. Zonder betrouwbare volgende
ontvangst blijft de standaardhorizon onbekend en is er geen definitieve vrijwaarde.
Een standaardzoekactie kijkt maximaal 13 salarismaanden vooruit; een handmatige
horizon is begrensd op 24 kalendermaanden. Dit voorkomt onbegrensde dagberekeningen.

`afschrijfdatum` was een los expliciet veld; het wijzigde de bestaande recurrence
en occurrence-ID niet. P2 gebruikt voor maand-/jaaroccurrences de dag uit dit
historisch opgeloste veld binnen de occurrence-maand. De occurrence-ID en
financiële maand blijven behouden. Bij weekoccurrences geldt alleen een exact
passende expliciete datum; anders blijft de kasdatum onbekend. Een expliciete
`cashDates[occurrenceId]` heeft voorrang. Er is geen tweede recurrence-engine.

Bij overige inkomsten zijn expliciete kasdatums of occurrence-datums uit de
versiebeheerde planning bruikbaar. Oudere onbewezen begindatums blijven onzeker.
Een ongedateerde ontvangst verhoogt de kaslijn niet. Een ongedateerde vaste
verplichting wordt gereserveerd en blokkeert een definitieve vrijwaarde. Een
verstreken, niet-vervangen plandatum wordt als openstaand/onzeker gemeld.

Expliciete profiel-ID's gaan voor. Voor bestaande eigenaarplanning zonder fysiek
profiel kiest de gebruiker één primaire betaalrekening per eigenaar. Dit is geen
automatische keuze van de eerste rekening. Niet-toewijsbare gebeurtenissen blijven
onopgelost. Voor interne overboekingen moeten beide fysieke eindpunten, bedrag en
kasdag vaststaan. Onvolledige overboekingsvoorstellen en ongedateerde spaarambities
worden niet omgezet in bankafschrijvingen. Een bewezen werkelijke vervanging
onderdrukt de geplande transfer. Op rekeningniveau zijn er twee tegengestelde
zijden; er ontstaan geen nieuwe huishoudinkomsten.

## 6. Budgetten, daglijn en Vrij na verplichtingen

Per relevante maand en budget wordt het bestaande historische budget opgehaald.
`budgetActual` blijft leidend voor goedgekeurde uitgaven, budget-ID's, refunds en
spaardekkingen. Bekende concrete bankbetalingen binnen de horizon verbruiken al
budgetruimte en staan daarnaast uitsluitend met hun oorspronkelijke kasbedrag op
de banklijn. Betalingen ná de horizon verlagen de reservering binnen deze horizon
niet. Een vaste last gebruikt het bestaande vaste-lastencontract en consumeert
niet op grond van alleen een gelijk categorielabel een variabel budget.

Voorbeeld: € 500 budget minus € 150 verwerkte uitgaven geeft € 350 reservering.
Iedere reservering heeft één ID per eigenaar, maand en budget. Bij een expliciete
`reservationId` op een concrete toekomstige verplichting kan de pure projectie die
dekking eenmaal uit de resterende reservering halen. De gewone app-adapter gebruikt
voor concrete bankuitgaven de bestaande `budgetActual`-route.

De volledige resterende budgetruimte van elke geraakte maand wordt conservatief
gereserveerd. Een horizon die twee maanden raakt heeft twee afzonderlijke
maandbudgetten, elk met eigen historie en verbruik; hetzelfde maandbudget wordt
niet tweemaal gereserveerd. Er wordt geen pro-rata bestedingsrecht verzonnen.
Ook een gedeeltelijk geraakte toekomstige maand reserveert haar volle resterende
maandbudget. Dit kan bewust voorzichtig uitvallen.

De daglijn verdeelt dezelfde budgetreservering gelijkmatig over de resterende
dagen van die maand binnen de horizon. Restcenten gaan naar de eerste dagen.
De som van die dagbedragen is exact de reservering. Zonder resterende dagen zijn
er geen verdelingspunten; de conservatieve reservering blijft wel zichtbaar.

Iedere dag levert drie afzonderlijk benoemde waarden:

- `cashBalanceCents`: startstand plus werkelijke/bruikbare voorlopige en gedateerde
  geplande kasbewegingen.
- `expectedBalanceCents`: kaslijn minus de tot die dag verdeelde budgetschatting.
- `afterReservationsCents`: kaslijn minus de volledige relevante reservering.

De derde lijn is de conservatieve grondslag voor één hoofdwaarde:

`Vrij na verplichtingen = max(0, minimum(afterReservationsCents) − bufferCents)`

De dagverdeling wordt **niet** nogmaals op de conservatieve lijn afgetrokken.
Daardoor stijgt Vrij na verplichtingen niet alleen doordat geschatte budgetuitgaven
later in de grafiek vallen. Een gezamenlijke buffer geldt uitsluitend op de
primaire gezamenlijke betaalrekening: standaard € 200. Persoonlijke rekeningen
hebben standaard € 0. De gebruiker kan de toepasselijke buffer aanpassen.

De uitvoer levert het minimum en de minimumdatum van de verwachte daglijn,
het minimum na volledige reserveringen, eerste negatieve datum, eerste datum
onder de buffer en afzonderlijk de eerste bufferonderschrijding na reserveringen.
`shortfallCents` en `reservedShortfallCents` blijven zichtbaar wanneer de
vrijwaarde op nul wordt begrensd.

`savingsPlans` en `savingsGoalCents` zijn uitsluitend informatie uit de bestaande
maandplanning, inclusief de persoonlijke automatisch berekende spaarambitie.
Gepland sparen wordt niet opnieuw afgetrokken. Een expliciet geplande fysieke
spaaroverboeking kan wel één kasbeweging zijn. De V117-p4r5-behandeling van interne
spaarinleg blijft in de ongewijzigde financiële motor.

## 7. Betrouwbaarheid

P1-bankbronnen, bankdekking en opslagkwaliteit blijven aparte dimensies. CSV-bereik
en geverifieerde opslagmaanden bewijzen geen volledige bankdekking. Onbekende
startstand wordt `null`, nooit een fictieve nul.

| Prognosestatus | Betekenis |
|---|---|
| `projected` | Invoer voldoende onderbouwd; toekomstige bedragen blijven een prognose, budgettiming blijft een schatting |
| `provisional` | Bijvoorbeeld Nakijken, onbekende bankdekking of onzekere inkomsten; geen definitieve vrijwaarde |
| `incomplete` | Essentiële datum, rekening, planning of opslag ontbreekt; alleen een bekende deelindicatie indien mogelijk |
| `unknown` | Geen bruikbare startstand of geen betrouwbare horizon |

`freeAfterObligationsCents` is alleen bij `projected` gevuld.
`indicativeFreeAfterObligationsCents` bevat waar mogelijk de voorlopige berekening.
P3 moet de status, `reasons` en hun Nederlandse `message` daarbij tonen, ook bij
minimum en tekorten. Een onbekende toekomstige ontvangst wordt niet meegerekend.
Een ontbrekende periode blokkeert definitieve zekerheid, ook als een deeloptelling
nog beschikbaar is.

## 8. Instellingen, opslag en P3-aansluiting

Route: **Instellingen → Bankrekeningen → Rekeningdetails → Dagelijkse prognose**.
Native checkbox en getalvelden stellen primaire rekening, veiligheidsbuffer en
salarisbetaaldagen in. Er is geen tweede rekeningregister. Het optionele veld
`accountProfiles[].liquidity` bevat `version: 1`, `primaryForOwner`, `bufferCents`
en `salaryDays: {dion?, dara?}`.

Opslag gebruikt `FinizeAccountsSave` → `applyAccountProfileCommand` → `commitChange`
en de bestaande atomaire IndexedDB-/receipt-route. Verwachte profielstand en vaste
operatie-ID voorkomen verouderde overschrijvingen en dubbele writes. Een abort
bewaart de vorige instelling; verloren bevestiging wordt via readback hersteld.
De bestaande profielcodec en synchronisatieroute bewaren de velden. Samenvoeging
blokkeert ook als twee apparaten hetzelfde salaris op verschillende rekeningen
instellen. De bestaande conflictroute bewaart beide versies.

P3 gebruikt deze bestaande runtime-interface:

```js
const projection = await FinizeLiquidity.project({
  accountProfileId,
  asOfDate: '2026-10-14',
  // endDate: '2026-10-31' // optionele expliciete einddag
});
FinizeLiquidity.openSettings(accountProfileId);
```

`project` leest importdetails, gebruikt de bestaande periodewerkruimte voor alleen
benodigde maanden en injecteert de echte runtime-maandselector. `select(options)`
is de synchrone variant voor reeds geladen gegevens; zonder aangeleverde
`imports` wordt importbeschikbaarheid niet verondersteld. `requiredMonths(options)`
staat apart beschikbaar. De pure berekening doet geen financiële writes en wordt
niet aan iedere bestaande render gehangen. Er is geen nieuwe cache of globale
synchronisatielaag.

P3 krijgt `days`, herleidbare `events`, `reservations`, `savingsPlans`, horizon,
minimum-/tekortvelden, buffer, één vrijwaarde en kwaliteitsinformatie. Het eerder
besproken dashboardontwerp blijft buiten P2; P3 hoeft geen parallelle berekening
te maken. Een alternatieve einddatum is via de interface beschikbaar; er is in P2
geen extra dashboard- of horizonselector gebouwd.

## 9. Gerichte verificatie

Definitieve selectie: **429 Node-tests geslaagd, 0 fouten**, waaronder **53 nieuwe
P2-tests**; **21 browsergevallen geslaagd, 0 fouten**, waaronder **7 nieuwe P2-gevallen**.
Exacte commands, logpaden, herstelpunt en hashes staan in het P2-bewijsbestand.

De dekking omvat de gevraagde saldo-/daglijnvoorbeelden, splits, Nakijken en opnieuw
goedkeuren, actuals vóór het ijkpunt, salarisprecedence en expliciete nul, bonus,
meerdere vaste actuals, refunds op bankdatum, budgetverbruik, reservering versus
dagverdeling, concrete budgetbetalingen, spaarambitie en werkelijke spaarmutaties,
horizons, jaarwisseling, schrikkeljaar, veiligheidsbuffer, tekorten, incomplete
perioden en ongewijzigde financiële state/maanduitkomsten.

Direct geraakte bestaande contracttests dekken P5a, P1, P1b, planninghistorie,
transactiemotor, zakgeld, salaris, V117-p4r5, periodeopslag, synchronisatie,
CSV-verwerking en asset-/cachecontracten. De bestaande CSV-/rekeningbrowsertests
blijven groen. Desktop en mobiel roepen dezelfde projectie aan en leveren dezelfde
uitkomsten; de nieuwe instellingen zijn op 1440, 390 en 320 pixels bediend,
herladen en in geopende screenshots gecontroleerd, zonder horizontale overflow.

Browserbewijs omvat echte IndexedDB-abort, verloren ontvangstbevestiging, wachten
op duurzame opslag, verouderde invoer, native validatie en duurzaam cloudconflict.
Productie-Firestore is niet benaderd; cloudgedrag is met lokale snapshots getest.

JavaScript-syntax, CSS, reproduceerbare build en `git diff --check` slagen.
De CSS-controle meldt alleen de al bekende v50-token `--line`. Tijdens ontwikkeling
zijn fixturefouten hersteld (ontbrekende historische refundcategorie/profielnaam en
verkeerde codec-aanroep) en verwachtingen voor de geschatte dagverdeling en
persoonlijke spaarambitie gecorrigeerd. De oplevercijfers gebruiken de uiteindelijke
groene runs, niet die ontwikkelruns.

## 10. Grenzen en stopconditie

- Zonder expliciete primaire rekening en salarisbetaaldagen kan oude planning
  nog onopgelost zijn. Er is bewust geen automatische rekening-/datumgok.
- Geen automatische bankdekking, weekendcorrectie of providerinformatie.
- Weeklasten zonder passende expliciete kasdatum blijven onzeker. Oude losse
  transfer-/spaarvoorstellen zonder twee fysieke eindpunten worden niet uitgevoerd
  of omgezet in verplichte uitgaven.
- Volle budgetreservering per geraakte maand kan bij een korte grensoverschrijdende
  horizon voorzichtig uitvallen; maandbedragen en grenzen zijn expliciet zichtbaar.
- De bestaande lokale P1b-afspraak zonder aanvullende eigenaarafscherming blijft
  gelden. P2 verandert geen serverrechten of productieopslag.

Er zijn geen benchmarks, 500-/5.400-transactieschaaltests, volledige emulatorreeks
of integrale V118-regressie uitgevoerd. Die laatste volgt pas na alle pakketten.
Er is niet gecommit, gepusht, gemerged of gedeployed. Geen productiegegevens zijn
gewijzigd. P3, P4, P5b, bankproviderkoppelingen en cloud-recordcutover zijn niet
gestart. **P2 stopt hier voor beoordeling.**
