# Pakket 2 — applicatieregressie 01: directe mobiele doelvolgorde

**Status: bewezen; niet gerepareerd; pakket 2 onderbroken voor gebruikersbesluit.**

## Reproductie

1. Open de huidige app op 390 px met de vaste testfixture en twee fictieve Dion-doelen: 'Eerste testdoel' en 'Tweede testdoel'.
2. Open Spaardoelen via de bestaande navigatie.
3. Zoek de directe omhoog-/omlaagbediening op de doelkaarten, zoals de bestaande regressietest `spaardoelkaarten wijzigen direct van volgorde zonder beheerpop-up` vereist.
4. Vergelijk dezelfde state op 1440 px.

| Meting | Mobiel 390 px | Desktop 1440 px |
|---|---:|---:|
| Gerenderde doelkaarten | Aanwezig (5 over de zichtbare groepen) | Aanwezig |
| Dion-kaarten met bestaande `data-reorder-goal`-bediening | 0 | 2 |
| Knop 'Tweede testdoel omhoog' | 0 | 1 |

Dit is geen locator die alleen naar een oude sectieklasse zoekt. Ook een zoekopdracht over de hele actieve tab op de bestaande functie-attributen en toegankelijke knopnaam vindt op mobiel geen bediening. De screenshot is geopend en visueel gecontroleerd.

## Verwacht en werkelijk gedrag

**Verwacht:** de bestaande directe volgordebediening blijft bruikbaar op de mobiele doelkaarten, zonder een beheervenster te openen. De bestaande test controleert daarbij ook dat de volgorde werkelijk wordt opgeslagen.

**Werkelijk:** de actuele compacte mobiele kaarten tonen het doel en kunnen de editor openen, maar bevatten geen directe verplaatsknoppen. De desktopkaarten bevatten deze bediening wel. Dit bevijst een ontbrekende directe mobiele gebruikersroute; het is geen bewijs dat alle alternatieve beheerwegen ontbreken.

## Technische oorzaak

`src/core/runtime.js`, `applyMobileSavingsDesign`, vervangt de inhoud van de mobiele doelenlijst met `renderMobileVisualGoal`. De nieuwe `.mt-goal`-markup uit die renderer bevat geen `data-reorder-goal`, geen `data-goal-owner`-/`data-goal-id`-contract voor de directe bediening en geen `.goal-direct-order-controls` met de omhoog-/omlaagknoppen.

De oudere mobiele renderer en de desktoprenderer bevatten die bedieningscontracten wel. Alleen de testselector wijzigen of de test omleiden naar een beheervenster zou de bestaande directe route niet controleren en zou de regressie verbergen.

## Ernst en voorgestelde gerichte oplossing

Ernst: **middel**, ontbrekende mobiele bediening. Er is geen financiële datamutatie of kapitaalverlies door deze probe aangetoond.

Voorgestelde oplossing, uitsluitend na toestemming: herstel het bestaande contract en de bestaande directe verplaatsknoppen in de compacte mobiele doelrenderer. Hergebruik `bindDirectGoalOrdering`; behoud de huidige stijl en kaartindeling. Controleer vervolgens bovenste/onderste knopstatus, echte volgordewijziging, duurzame opslag, herladen, openen van de doel-editor en mobiel/desktop.

Dit is een applicatiewijziging buiten het eerder goedgekeurde test-/CI-herstel. Er is geen reparatie toegepast. De oorspronkelijke test is niet gewijzigd, verwijderd of uitgeschakeld.

## Bewijs

- `.cache/pakket2/mobile-order-probe.json`: bovenstaande metingen.
- `.cache/pakket2/mobile-order-probe-run.json`: onderzoeksprobe 1/1 geslaagd; bevestigt het ontbreken en het desktopverschil, geen geslaagde regressietest voor de gewenste mobiele bediening.
- `.cache/pakket2/browser-results/probe-classificatie-direct-53cb6--bestaande-desktopbediening/mobile-missing-order.png`.
- Oorspronkelijke mislukking: `.cache/pakket2/priority-browser-before.json`.

## Overige pakket-2-tussenstand

De classificatie is vóór testwijzigingen gecommitte in `9a782c8`. Daarna zijn uitsluitend bewezen Node-test-/fixture- en uitvoerproblemen aangepast in `e28626b`.

- Initiële Node-inventaris: 100 bestanden, 84 geslaagd en 16 mislukt.
- Nieuwe reguliere runner: 99 bestanden, inclusief pure backendtests; **1.372 tests geslaagd, 0 mislukt, 0 overgeslagen**.
- De bankretentie-emulatortest blijft expliciet afzonderlijk; de vereiste 8189-/SDK-omgeving is nog niet ingericht of uitgevoerd.
- De afzonderlijke HTTP-backendtest met SDK-/provider-mocks: **1 geslaagd**.
- Prioriteitsbrowserrun vóór wijzigingen: **31 geslaagd, 17 mislukt**.
- Aanvullende huidige-routeprobes voor vaste lasten, expliciete bankgoedkeuring en tegenrekeningselectie: **3 geslaagd**.
- De 478 Node-/35 browsergevallen uit pakket 1 zijn behouden. De reguliere runner omvat alle betrokken Node-bestanden; de volledige browserbasis moet bij hervatten opnieuw als afsluitende regressiecontrole worden uitgevoerd.
- Applicatiecode, gegenereerde assets, CSS, Firestore-regels, productiegegevens en bankverbindingen zijn in pakket 2 niet gewijzigd.
- Er is een lokale demo-emulator voor recordopslag gestart ter voorbereiding. Er is nog geen emulatorresultaat geclaimd; deze wordt bij dit stopmoment afgesloten.
- CI-aanpassingen, GitHub Actions-uitvoering en de volledige browsersuite zijn nog niet uitgevoerd. Er is niets gepusht of gepubliceerd.

De classificatie is dus nog geen voltooid pakketverslag. Pakket 2 en de vrijgave voor publicatie blijven open.
