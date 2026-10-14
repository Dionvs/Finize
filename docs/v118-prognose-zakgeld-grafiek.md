# V118 — Lokale prognosecorrectie: zakgeld, grafiek en afschrijfdag

Datum: 14 oktober 2026. Status: lokaal geïmplementeerd en gericht geverifieerd; gereed voor beoordeling. Niet gepubliceerd.

## Uitgangspunt en herstelpunt

Actieve repository: `G:\Mijn Drive\Codex\financien\outputs\dion_dara_budget\webapp\github\Finize-live-repo`.
Branch: `agent/v117-stabilisatie`; uitgangs-HEAD: `e473dbb35e2e43d9e33e5eefe404f4f170cb8509`. De Git-status was bij aanvang schoon. De actuele repository bevat P5a/P1/P1b/P2 én de latere P3/P4-implementaties en releaseverslagen. Die zijn als uitgangspunt gebruikt.

Voor wijzigingen is een herstelpunt van 363 gevolgde/niet-genegeerde bestanden gemaakt in `..\Finize-herstel-v118-prognose-20261014-174948`. Iedere kopie is tegen het origineel gecontroleerd met SHA-256; `manifest.json` bevat de bestandsnamen en hashes. Geen reset, clean, checkout, commit, push, merge, deployment of wijziging van productiegegevens uitgevoerd.

## Bankgegevens: soort, persoon en betaaldag

Onder Instellingen → Bankrekeningen → Rekeningdetails → Dagelijkse prognose staat per geplande ontvangst:

- **Soort inkomsten:** Salaris óf Zakgeld.
- **Van wie:** Dion of Dara.
- **Dag van de maand:** 1–31, Laatste dag van de maand, of Niet ingesteld.

Bestaande salarisontvangsten verschijnen als afzonderlijke ingevulde regels. Een ontvangst toevoegen of verwijderen gebruikt hetzelfde formulier en dezelfde atomair opgeslagen profielcommand. Zo blijven bijvoorbeeld twee salarissen op de gezamenlijke rekening behouden. Zakgeld wordt uitsluitend geaccepteerd op een persoonlijke betaalrekening van de gekozen persoon; een verkeerde eigenaar, gezamenlijke rekening of dubbele toewijzing geeft een Nederlandse foutmelding.

De bestaande `accountProfiles[].liquidity.salaryDays` blijft de opslag voor salarissen. `allowanceDays` is een optionele uitbreiding binnen hetzelfde profiel en dezelfde lokale opslag, cloudcodec, rebase en conflictcontrole. `last` blijft onderscheiden van dag 31. Een ontbrekend `allowanceDays` blijft achterwaarts compatibel. Er is geen handmatig zakgeldbedrag toegevoegd.

## Bestaande berekening en kasbeweging

Salaris blijft afkomstig uit de bestaande salarisregels, inclusief maandoverschrijvingen. Zakgeld gebruikt de bestaande `monthlyFinancialForecast(month)` die de runtime aan P2 doorgeeft; de geïsoleerde core gebruikt dezelfde bestaande `financialForecastForMonth`. De bron is `forecast.owners[person].allowance`. De formule, historische maandberekening, budgetverdeling, spaar- en refundlogica zijn niet herschreven.

P2 geeft dezelfde berekende overboeking twee kaszijden met de identiteit `allowance:<persoon>:<maand>`: gezamenlijk uitgaand en persoonlijk inkomend. Negatief zakgeld keert de richting om. De ingestelde dag bepaalt het kasmoment. Een bestaande maandafsluitingsopdracht van het type `zakgeld-<persoon>` wordt niet daarnaast nog als losse transferplanning toegevoegd.

Een goedgekeurde zakgeldclassificatie (`maandelijkse-bijdrage`) met dezelfde persoon, maand, fysieke rekening en richting, of een bestaande expliciete transactielink uit de transferopdracht, vervangt de betreffende geplande zijde. De bankbronidentiteit blijft de bron voor eenmalige fysieke kasverwerking; werkelijk bedrag en bankdatum zijn leidend. Beide zijden worden afzonderlijk gecontroleerd. Er wordt niet gekoppeld op een gelijkend bedrag, een naam of een datumtolerantie.

Een behouden handmatige koppeling blijft bewijs als de bankbron opnieuw bij Nakijken staat. Zonder bewezen goedkeuring geeft een mogelijke zakgeldoverlap onzekerheid: de extra positieve ontvangst blijft buiten de kaslijn; een onzekere uitgaande verplichting blijft conservatief gereserveerd. De goedkeuringsroute en CSV-deduplicatie zijn behouden.

De standaardhorizon vóór het volgende betrouwbare salaris blijft bestaan. Zonder salarisgrens krijgt een persoonlijke rekening met een ingestelde zakgelddag een expliciet gelabelde zakgeldprognose tot einde maand (bij een verstreken betaaldag tot einde volgende maand). Zakgeld wordt daarmee geen salarisgrens. De aangepaste einddatum blijft beschikbaar. Een ontvangst ná een eerder volgend salaris valt buiten die standaardperiode; kies dan Einde maand of Eigen datum.

## Vaste lasten: ingangsdatum en afschrijfdag

De actieve vaste-lasteneditor heeft **Ingangsdatum** en daarnaast **Afschrijfdag**. De laatste is een standaard keuzelijst met dag 1–31 en Laatste dag van de maand; Onbekend blijft beschikbaar voor bestaande ongedateerde regels.

De bestaande recurrence-motor blijft bepalen in welke maanden een vaste last actief is en welke occurrence-ID daarbij hoort. Maand-, kwartaal- en jaarfrequenties zijn niet veranderd. De afschrijfdag geeft uitsluitend de bankkasdatum binnen zo'n actieve maand. Dag 31 wordt bijvoorbeeld 28 februari of 29 februari in een schrikkeljaar. Een expliciete `cashDates[occurrenceId]` heeft voorrang.

Migratie is niet-destructief: na het oplossen van de bestaande historische configuratie wordt een volledige legacy-afschrijfdatum als bijbehorende dag gelezen. Het oorspronkelijke opgeslagen datumveld, eerdere betaalmomenten, transacties, maandafsluitingen en occurrence-ID's blijven intact. Nieuwe dagwijzigingen worden via `setRecurringFromMonth` in de bestaande historie of eenmalige maandoverschrijving opgeslagen. Geen bulk-herschrijving van financiële gegevens.

Weekfrequenties behouden hun bestaande weekplanning en legacy-kasdata. De maanddagkeuze is bij een weekfrequentie uitgeschakeld met uitleg, zodat wekelijkse occurrences niet op één maanddag worden samengevoegd.

P2 en de noodzakelijke P4-uitlezing van geplande betaalmomenten delen `fixedCashDate`. Een werkelijke CSV-afschrijving met bestaande occurrence-koppeling vervangt het plan, ook als de afschrijfdag later is gewijzigd.

## Grafiek en dagelijkse details

De bestaande SVG-grafiek, kleuren, dashboardstructuur, buffer en primaire waarde Vrij na verplichtingen zijn behouden. P2 levert per kalenderdag aanvullend `openingBalanceCents` en `mutationCents`, naast eindsaldo, budgetschatting en event-ID's. De grafiek voert geen eigen financiële saldoberekening uit.

Een datum is selecteerbaar via hover, klik, tik, toetsenbord of de bestaande dagkeuzelijst, ook zonder marker of mutaties. Desktophover toont een tooltip begrensd binnen grafiek en viewport. Klik/tik toont dezelfde blijvende detailkaart onder de grafiek. Sluiten en Escape verbergen de details.

De details bevatten datum, verwacht beginsaldo, afzonderlijke mutaties met omschrijving en teken, herkomst, dagsom en verwacht eindsaldo. Bekende bankboekingen, nog na te kijken boekingen, geplande inkomsten, vaste lasten, interne transfers en geschatte budgetuitgaven zijn herkenbaar. Een lege dag vermeldt Geen geplande mutaties. De bestaande onzekerheidsstatus blijft zichtbaar. Alle bedragen worden in eurocenten verwerkt en Nederlands opgemaakt.

## Uitgevoerde verificatie

- **299 Node-tests geslaagd, 0 fouten**: de nieuwe correctiesuite (36 gevallen), P1b, P2, P3, P4-suggesties, planning-timeline, bestaande zakgeldplanning, sparen/refunds/prognose en salaris. Geen volledige V118-regressie of schaalbenchmark uitgevoerd.
- **20 gerichte browsertests geslaagd, 0 fouten**, op de uiteindelijke lokale build: 6 nieuwe correctiegevallen en 14 gerelateerde bestaande P2/P3-gevallen. Inclusief IndexedDB-abort, verloren opslagbevestiging, cloudconflict, toetsenbord/touch, instellingen, herladen en datums.
- Nieuwe volledige flow op **1440, 390 en 320 px**: persoonlijke rekening → Zakgeld → Dion → Laatste dag → opslaan → prognose → datum selecteren → bedrag en saldo controleren → herladen → instellingen en prognose controleren.
- Verkeerde eigenaar/rekening wordt zonder gedeeltelijke opslag geweigerd. Bestaand salaris en een afzonderlijke zakgeldontvangst kunnen naast elkaar behouden blijven. Meerdere mutaties worden apart getoond; beginsaldo + dagsom = eindsaldo in iedere geprojecteerde dag.
- Februari/schrikkeljaar, kortere maanden, jaarwisseling, kwartaal/jaarfrequentie, weekbehoud, veilige legacy-uitlezing, historische vanaf/eenmalige wijzigingen, CSV-vervanging en mogelijke overlap bij Nakijken zijn gericht getest.
- JavaScript-syntax, CSS, reproduceerbare build en `git diff --check` geslaagd. Bestaande CSS-melding `--line` blijft ongewijzigd. Impeccable-controle van de gewijzigde UI gaf geen bevindingen.

Browserruns gebruiken uitsluitend synthetische lokale fixtures in geïsoleerde contexten, met geblokkeerd Firebase/backendverkeer. Geen echte gegevens gebruikt of aangepast. Instellingen en grafiek zijn visueel geopend en beoordeeld op desktop en mobiel; geen horizontale pagina-overflow. De exacte testselecties, hashes en bewijsbestanden staan in [het auditbewijs](audit/v118-prognose-zakgeld-grafiek-bewijs.json). Lokale logs en screenshots staan onder `.cache/v118-prognose/`.

## Aanvullende controle: Vrij na verplichtingen over meerdere maanden

Na de aanvullende vraag zijn negen gerichte tests toegevoegd voor 3, 6 en 12 maanden. De berekening zelf hoefde hiervoor niet gewijzigd te worden. De tests gebruiken de centrale bestaande P2-selector, de bestaande maandmotor en synthetische bedragen.

| Synthetische situatie | Gecontroleerde uitkomst |
|---|---|
| Gezamenlijk, 3 maanden, startsaldo € 5.000, maandbudget € 101,01, buffer € 200 | Drie aparte reserveringen, samen € 303,03; Vrij na verplichtingen € 4.496,97 |
| Dezelfde planning over 6 maanden | Zes reserveringen, samen € 606,06; Vrij na verplichtingen € 4.193,94 |
| Dezelfde planning over 12 maanden | Twaalf reserveringen, samen € 1.212,12; Vrij na verplichtingen € 3.587,88 |
| Persoonlijk, 3 maanden, startsaldo € 5.000, zakgeld € 3.000 p/m, vaste last € 100 p/m, budget € 101,01 p/m, buffer € 100 | Vrij na verplichtingen € 4.596,97; verwacht eindsaldo € 13.396,97. Toekomstig zakgeld wordt vooraf niet als vrij saldo uitgegeven |
| Vroege afschrijving vóór salaris, 3 maanden | Laagste saldo − € 1.000 en Vrij na verplichtingen € 0, ondanks verwacht eindsaldo € 5.000 |
| December–februari met kwartaalfrequentie | Alleen de januari-occurrence, afschrijving op 31 januari, drie aparte maandbudgetreserveringen |
| Historische afschrijfdagwijziging vanaf november | Alleen de betreffende kasdatums wijzigen; dezelfde totale verplichtingen en vrijwaarde |
| Gekoppelde CSV-afschrijving in oktober | Alleen oktoberplan vervangen; november en december blijven gepland; werkelijke afwijking van € 5 werkt door |
| Decemberhistorie ontbreekt | Geen definitieve vrijwaarde; expliciete ontbrekende-periode-status |

De gezamenlijke voorbeelden bevatten ook de bestaande berekende salarissen, zakgeldoverboekingen en maandelijkse vaste last. De zakgeldmotor reserveert daarvoor al gezamenlijke lasten/budgetten in de verdeling; de test controleert de uiteindelijke kaslijn en reserveringen samen. Alle dagelijkse mutaties blijven in centen sluiten. Deze bedragen zijn uitsluitend testfixtures.

## Gewijzigde bestanden en beperkingen

Core: `src/core/account-profiles.mjs`, `daily-liquidity.mjs`, `liquidity-settings.mjs`, `planning-timeline.mjs`, `runtime.js`. Gedeelde betaalmomentuitlezing: `src/import/runtime.js`. UI: `src/ui/liquidity-settings.mjs`, `src/ui/dashboard.mjs`, `src/styles/dashboard-p3.css`. Gegenereerd: `app.js`, `app.css`. Tests: `tests/v118-prognose-correctie.test.cjs`, `tests/browser/v118-prognose-correctie.spec.cjs` en beperkte selector/invoer-aanpassing in de bestaande P2-browsersuite. Dit verslag en het auditbewijs zijn toegevoegd.

Een saldo-ijkpunt, betrouwbare bankdekking en expliciete fysieke rekeningkoppelingen blijven nodig. Ontbrekende gegevens blijven onbekend/onvolledig; de app raadt geen bestemming. Een niet-bewezen CSV-relatie wordt niet als bevestigde match behandeld. Er is geen productiecloudtest uitgevoerd; opslagcodec, synchronisatieconflict en lokaal herstel zijn gericht geverifieerd. De geïsoleerde browserfixtures bevatten bewust ook ontbrekende koppelingen, zodat de bestaande onzekerheidslabels zichtbaar zijn.

**Stopconditie bereikt: lokale implementatie, gerichte verificatie en verslag gereed. Nog niet publiceren.**
