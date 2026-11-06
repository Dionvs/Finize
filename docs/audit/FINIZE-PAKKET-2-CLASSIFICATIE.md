# Pakket 2 — classificatie vóór testwijzigingen

Basis: herstelbranch op `6246bd5`, met pakket 1 behouden. GitHub-main: `7a7d72e`. Bij deze nulmeting waren er nog geen wijzigingen aan bestaande tests of applicatiecode voor pakket 2. Onderzoeksprobes staan uitsluitend onder `.cache/pakket2/`.

## Node-nulmeting

Alle 100 root-testbestanden zijn afzonderlijk met Node/TAP uitgevoerd: **84 bestanden geslaagd, 16 mislukt**. Dit zijn bestandenaantallen, niet aantallen assertions. De oorspronkelijke logbestanden en tellingen staan in `.cache/pakket2/node-before.json`.

| Bestand | Classificatie | Aangetoonde oorzaak / te behouden controle |
|---|---|---|
| `fix-round-1-6.test.cjs` | Verouderde testextractie en onjuiste afbakening | Eindmarker van functie-extractie bestaat niet meer; daardoor worden latere functies meegetest. Encodingtest behandelt ook CSS-commentaren als zichtbare inhoud. Privacy, gedeelde rekenfunctie en echte zichtbare tekst blijven toetsbaar. |
| `forecast-current-basis.test.cjs` | Verouderde verwachting | Toegevoegde onbetaalde historische last van € 100 blijft gereserveerd. Cash is € 2.000, na reservering € 1.900. Test mag beide begrippen niet gelijkstellen. |
| `html-inline-syntax.test.cjs` | Verouderde verwachting | Vereist externe assets en nul inline scripts; de actuele, reproduceerbare release is bewust inline. |
| `package7-release-audit.test.cjs` | Onvolledige testdouble + oude releasewaarde | Fetch-event mist `waitUntil`; mismatch-fixture vervangt r25 terwijl actuele marker r46 is. Bescherming tegen een verkeerde offline shell moet behouden blijven. |
| `service-worker-cache.test.cjs` | Verouderde verwachting | Vereist externe assetverwijzingen en hardgecodeerde r25. Zelfde huidige release in shell, losse assets en worker blijft verplicht. |
| `update4-final-regression.test.cjs` | Verouderde verwachting | Cacheversie r25 vastgelegd in test. |
| `update4-ui-structure.test.cjs` | Verouderde verwachting | Externe stylesheet/scriptverwijzingen verwacht bij inlinelevering. |
| `update5-responsive-structure.test.cjs` | Verouderde verwachting | Zelfde inline/externe mismatch en hardgecodeerde r25. |
| `v117-p2.test.cjs` | Onjuiste afhankelijkheidsresolutie | Hardgecodeerd `node_modules/playwright/...` bestaat niet onder pnpm. De AST-controle op awaited financiële opslag blijft vereist. |
| `v117-p4-salary.test.cjs` | Ongeldige fixture | Alleen bankdatum gewijzigd naar september; betaaldatum blijft oktober. Huidige administratieve maand volgt betaaldatum. Bron-/bankdatum moet behouden blijven. |
| `v117-p4.test.cjs` | Ongeldige fixture | Novemberfixture houdt een oktoberbetaaldatum. Budget-ID- en historische assertions blijven behouden. |
| `v118-p5b-backend.test.mjs` | Onjuiste uitvoerconfiguratie | Gegenereerde `functions/shared` ontbreekt vóór backendbuild. |
| `v118-p5b-bootstrap.test.mjs` | Onjuiste uitvoerconfiguratie | Dezelfde ontbrekende backendbuild. |
| `v118-p5b-configuration.test.mjs` | Onjuiste uitvoerconfiguratie | Dezelfde ontbrekende backendbuild. |
| `v118-p5b-multi.test.mjs` | Onjuiste uitvoerconfiguratie | Dezelfde ontbrekende backendbuild. |
| `v118-p5b-retention-emulator.test.mjs` | Ontbrekende emulator / SDK-omgeving | Vereist expliciet loopback-emulator 8189. Geen inhoudelijke uitslag zolang de geïsoleerde emulator ontbreekt. |

Er is in deze Node-mislukkingen nog geen nieuwe applicatiebug bewezen. Herhaling na herstel van testomgeving en verwachtingen moet deze classificatie bevestigen; afwijkingen worden apart geregistreerd.

## UI-nulmeting met prioriteit

De drie betrokken browserbestanden zijn opnieuw uitgevoerd: **31 geslaagd, 17 mislukt, 0 overgeslagen**. De eerdere negen open gevallen zijn hieronder afzonderlijk opgenomen.

| Open geval uit scan | Classificatie vóór wijziging | Onderzoeksbewijs |
|---|---|---|
| Gedeelde vaste-lasteneditor mobiel/desktop | Verouderde route/selectors | De hele lastregel is nu de bewerkknop; er is geen geneste knop 'Bewerken'. Verdeling staat achter 'Extra instellingen'. |
| 50/50 opslaan in tijdlijn | Verouderde route/selectors | Zelfde route; zichtbare knop heet 'Wijzigingen opslaan'. |
| Nieuwe last, maanduitzondering en stoppen | Verouderde route/selectors | Oude editorbediening/-labels; financiële eindpunten blijven afzonderlijk te controleren. |
| Vaste last verwijderen | Verouderde route/selectors | Oude geneste bewerkknop; verwijderactie zit in huidige editor. |
| Bankgoedkeuring 390 px | Test opent transactiekaart niet | Compacte kaart toont de bron, maar verwerken wordt bereikbaar na openen via `[data-u4-focus-open]`. |
| Bankgoedkeuring 1440 px | Zelfde verkeerde gebruikersroute | Zelfde compacte kaart, niet een financiële blokkade. |
| Goedkeuring met gelijktijdige wijziging | Zelfde routefout vóór bereiken scenario | Eerst huidige transactiekaart openen; conflictassertions behouden. |
| CSV/API-overlap expliciet koppelen | Verborgen actie in niet-geopende kaart | Specifieke overlapfixture na openen herhalen; identiteits-/brongegevensassertions behouden. |
| Tegenrekeningselectie | Onjuiste testopzet / ontbrekende typekeuze | Kies de huidige transactiefamilie 'Interne overboeking' en open de kaart; dan verschijnt de rekeningkeuze. |

Aanvullende echte browserprobes via huidige zichtbare bediening slagen **3/3**:

1. Vaste last naar 50/50 opslaan; huidige maand verandert, september blijft 'income-ratio'.
2. Compacte transactie openen en expliciet verwerken: vóór goedkeuring € 0 effect, erna € 10.
3. Type 'Interne overboeking' kiezen en bestaande Dara-rekening terugvinden in de tegenrekeningselector.

De eerste versie van de onderzoeksprobe gebruikte zelf nog de verborgen native selector en een verkeerd transactiefamilie-ID. Die probe is gecorrigeerd naar zichtbare bediening; er is daarvoor geen applicatiecode gewijzigd. Beide onderzoeksruns zijn bewaard.

De overige acht mislukkingen in deze prioriteitsrun zijn aanvankelijk kandidaten voor verdwenen dashboard-/lijstmarkup, gewijzigde zichtbare labels of oude spaardoel-/budgetselectors. Nadere inspectie bevestigt echter een echte applicatieregressie bij de directe mobiele doelvolgorde: de huidige mobiele kaarten bevatten helemaal geen verplaatsknoppen. Zie [de afzonderlijke bevinding](FINIZE-PAKKET-2-APPLICATIEBUG-01.md). De oorspronkelijke test is hiervoor niet afgezwakt of aangepast. De overige gevallen krijgen pas een definitieve beoordeling na herhaling via de actuele route.

## Vervolg en grenzen

Pas na deze registratie worden bestaande tests en uitvoerconfiguraties gericht bijgewerkt. Applicatiebugs die bij het bereiken van de oorspronkelijke financiële eindpunten alsnog blijken, krijgen een afzonderlijke reproductie en worden niet automatisch gerepareerd. De pakket-1-basis van 478 Node-gevallen en 35 browsergevallen blijft behouden. Geen publicatie, productiegegevens of bankverbindingen; uitsluitend fixtures, mocks en lokale demo-emulators.
