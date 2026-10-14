# V118 P5a — gedeeld bankinvoercontract

Datum: 13 oktober 2026. Status: lokaal geïmplementeerd en gericht getest.

P5a legt de kleine gedeelde invoergrens vóór P1 vast. De pure module
`src/import/bank-input-contract.mjs` onderscheidt banktransacties, saldo-waarnemingen
en dekkingsinformatie. De bestaande CSV-parser, financiële verwerking, bron-ID's,
goedkeuring, opslag en synchronisatie blijven de actieve route.

Dit pakket omvat geen saldo-editor, dagprognose, dashboard, bankprovider,
netwerkverbinding of productieactivering. P1–P4 en P5b zijn hiermee niet opgeleverd.

## Gebruik en resultaat

Vier exports vormen de grens:

- `normalizeBankInput(input, scope)`: valideert en maakt een onafhankelijke,
  diep bevroren JSON-kopie van de genormaliseerde invoer en oorspronkelijke herkomst.
- `normalizeCsvBankInput(row, batch, scope)`: leest een bestaande geparste CSV-regel;
  wijzigt geen enkele regel, import, bron, goedkeuring of financiële state.
- `compareBankInputs(left, right, scope)`: vergelijkt twee transactie-enveloppen;
  geeft een classificatie en beide originele bewijzen terug, zonder samenvoeging.
- `decimalAmountToCents(amount)`: zet een reeds geparst numeriek eurobedrag exact om
  naar gehele centen; weigert extra decimalen, onveilige getallen en typecoercie.

`scope` bevat `householdId` en de bestaande `accountProfiles` van het reeds
geautoriseerde huishouden. Een rekening-ID moet precies eenmaal voorkomen. Deze
controle vervangt geen authenticatie of serverautorisatie: de aanroeper moet de
scope en aangeleverde bron betrouwbaar vaststellen.

Het resultaat van normalisatie bevat `ok`, `disposition`, `record`, `errors` en
`warnings`. `blocked` levert geen record op. `deferred` bewaart geldige informatie
waarvan de kasbetekenis nog niet voldoende vaststaat. `ready` betekent uitsluitend
dat deze versie van het invoercontract is doorlopen: het bewijst geen goedkeuring,
bankdekking, veilige bestedingsruimte of toestemming om een boeking te maken.

## Versie 1

| Veld | Contract |
|---|---|
| `version` | Exact `1`; onafhankelijk van financieel schema 11 |
| `recordType` | `bank-transaction`, `balance-observation` of `coverage` |
| `householdId` / `accountProfileId` | Bestaand huishouden en fysieke rekening; eigenaar is geen rekening-ID |
| `channel` | `csv`, `bank-api` of `manual`; manual uitsluitend voor waarneming/dekking |
| `authority` | Niet-lege namespace voor de uitgevende bron |
| `identity` | `bank-id`, `file-row`, `observation-id` of `null` |
| `facts` | Getypeerde canonieke feiten, zie hieronder |
| `provenance` | Originele JSON-`payload` of `payloadRef`, eventueel aanvullende herkomst |

Een `bank-id` bevat `authority` en `id`; de authority moet overeenkomen met de
envelop. De toekomstige adapter kiest de namespace volgens de echte reikwijdte
van de provider-ID. Als een provider ID's per verbinding uitgeeft, hoort die
verbindingsscope in de namespace. Alleen een bewezen alias kan namespaces later
verbinden. Een import-ID, ophaaloperatie, omschrijving of bedraghash is nooit een
bank-ID. `observation-id` geldt uitsluitend voor niet-transacties.

Een `file-row` bevat de bestaande SHA-256 `fileDigest` en positieve `rowOrdinal`.
Ontbreekt uitsluitend de digest in een oude proof terwijl het originele CSV-bestand
aanwezig is, dan wordt deze voor de nieuwe envelop berekend. De oude proof blijft
ongewijzigd in de herkomst. Een bestaande afwijkende digest blokkeert. Ontbreekt
identiteitsbewijs volledig, dan blijft `identity: null` met `unproven-identity`.

Herkomst is JSON zonder verliesgevende waarden zoals `undefined`, NaN of cycli.
De kopie wordt bevroren; het origineel bij de aanroeper blijft bewerkbaar. Dit is
bronbehoud in geheugen, geen cryptografische authenticatie. Tokens en andere secrets
horen niet in deze payload: een latere adapter levert uitsluitend financiële
brondata of een toegestane referentie aan.

## Drie afzonderlijke invoertypen

**Banktransactie.** `amountCents` is getekend en veilig geheel; `currency` is exact
`EUR`. Vereist zijn `transactionDate`, `description` en `bankStatus` (`booked` of
`pending`). Optioneel zijn `bookingDate`, `valueDate`, `transactionTime`,
`counterpartyAccount` en `reference`. Datums zijn geldige kalenderdatums. Pending
blijft `deferred`; onbekende status en niet-EUR blokkeren. Een ontbrekende tijd
wordt niet geraden.

**Saldo-waarneming.** Vereist zijn getekende `amountCents`, `currency`, `asOfDate`,
`balanceType` (`booked`/`available`) en `boundary` (`end-of-bank-day`/`timestamp`).
Een tijdstip vereist `observedAt` in ISO-formaat met expliciete tijdzone. Available
en tijdstipgebonden waarnemingen blijven `deferred` totdat P1/P5b vastlegt welke
mutaties/reserveringen al zijn inbegrepen. Een geboekt einde-dagsaldo kan dienen
als contractinvoer voor P1; dit pakket berekent er geen rekeningstand mee.

**Dekking.** `fromDate`, `toDate`, `completeness` (`unknown`/`partial`/`complete`)
en `basis` (`unknown`/`file-range`/`bank-statement`/`provider-assertion`). Een compleet
bereik vereist een verklaarde bankafschrift- of providerbasis. CSV-min/max en
geverifieerde opslagperioden worden niet tot complete bankdekking gepromoveerd.
De verklaring blijft afhankelijk van het aangeleverde bewijs; P5a controleert niet
zelf een bankafschrift of externe provider.

## CSV-brug en bestaande verwerking

| Nieuwe envelop | Bestaande CSV-bron |
|---|---|
| `facts.amountCents` | `bankOriginal.amount`, exact maal 100 |
| `facts.transactionDate` | `bankOriginal.bankDate` |
| `facts.bookingDate` / `valueDate` | Zelfde velden uit `bankOriginal`, anders `null` |
| `facts.description` | `rawDescription`, anders `description` |
| `facts.bankStatus` | Expliciete bronstatus indien aanwezig; huidige CSV-parser levert geboekte mutaties |
| `provenance.payload.bankOriginal` | Volledige onveranderde bron, inclusief `rawCells`, notities en bestaande bronvelden |
| `provenance.importReference` | Bestaande `batchId`, `rowId`, optioneel bestaand `bankSourceId`; geen nieuwe ID |

CSV blijft via `createImportDraft`, expliciete goedkeuring, `planImportEffects` en
de bestaande commitroute lopen. De envelop bevat op hoofdniveau geen `source`,
`bankOriginal`, `processingStatus` of `approvalSource`. Daardoor interpreteert
`getTransactionSource(envelope)` hem niet als CSV of manual en is hij financieel
inactief. **Enveloppen horen niet in `state.transactions` of een legacy-migratieroute.**

Een latere bankadapter moet een afzonderlijke, geteste review/command-brug bouwen;
het kopiëren naar `bankOriginal` of toevoegen van `source: 'bank-api'` is onvoldoende.
P5a voegt bewust geen omgekeerde converter toe die goedkeuring of identiteit verzint.
P1 kan de saldo-invoer gebruiken zonder de CSV-verwerking te vervangen.

## Kanaaloverlap en bronidentiteit

Een gedeelde banknamespace en bank-ID, hetzelfde huishouden en dezelfde fysieke
rekening vormen noodzakelijk identiteitsbewijs. Canonieke transactiefacts moeten
ook overeenkomen: bedrag, valuta, geboekte status, transactiedatum, boek-/waardedatum,
tijd, bronomschrijving, tegenrekening en referentie. Ontbreekt aan één kant een
optioneel bekend feit, dan is de vergelijking onbeslist. Verschillende bekende
feiten bij dezelfde identiteit geven `identity-conflict`; geen overwrite.

Bij CSV/API-overlap mogen ruwe representaties verschillen. De vergelijking bewaart
beide payloads. Notities, bankcodes en ruwe cellen worden niet weggegooid maar zijn
geen kanaaloverstijgende identiteitsheuristiek. Een inhoudelijke match zonder
gedeeld bewijs geeft hoogstens `possible-duplicate`. Verschillende bank-ID's binnen
dezelfde namespace en verschillende regelnummers binnen hetzelfde bestand blijven
afzonderlijke bronnen, ook bij exact gelijke bedragen en omschrijvingen.

CSV/CSV wordt doorverwezen naar het bestaande `classifyCsvDuplicate`-contract,
inclusief `immutableBankFields` en `rawCells`. Die bestaande functies zijn niet
aangepast. `same-source` is een vergelijkingsuitkomst, geen automatische merge of
goedkeuring. Pending→booked en het duurzaam vastleggen van aliasrelaties volgen pas
in P5b en de latere verwerking.

## Verificatie en begrenzing

De nieuwe testfile bevat 47 contractgevallen. Vier bestaande testfiles dekken
CSV-verwerking/bronherstel, V117-goedkeuring, de CSV-parser en de financiële motor.
Het bewijsbestand `audit/v118-p5a-bewijs.json` legt de uiteindelijke selectie,
uitslag, bestands-hashes en lokale logs vast. De Node-telling voor oudere bestanden
kan een script met meerdere gewone assertions als één testbestand tellen.

Build-reproduceerbaarheid en syntax zijn gecontroleerd. Er zijn geen UI-wijzigingen:
browser-/emulatorreeksen en schaalbenchmarks zijn daarom niet gestart. Bestaande
runtime-assets, service-worker, schema en Firebase-configuratie zijn ongewijzigd.
Er is geen volledige V118-eindregressie of publicatie uitgevoerd.
