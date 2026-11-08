# Pakket 2 — tussenstand 8 november 2026

**Pakket 2 is niet afgerond. Niet gepubliceerd. Pakket 3 is niet gestart.**

## Gecontroleerde omgeving

Zelfstandige clone onder Documents, branch `herstel/pakket1-financiele-bugs`; actuele mainreferentie `7a7d72e25660975ba88269e7835b98d32858ada5`. De oorspronkelijke zes Drive-wijzigingen zijn met SHA256 gelijk bevonden en de beschermde indexlock bestaat nog: `.cache/pakket2/original-source-verification.json`. Productiegegevens en bankverbindingen zijn ongemoeid gebleven. Alleen synthetische fixtures, HTTP-mocks en lokale demo-emulators zijn gebruikt.

## Bevestigde resultaten

- Volledige normale Node-suite: **1372 geslaagd, 0 mislukt, 0 overgeslagen** (`node-after-focus.log`). De oorspronkelijke 478 Node-tests blijven regressiebasis.
- Backend-HTTP-mock: 1 geslaagd; records-emulator: 42 geslaagd; afzonderlijke native retention-emulator: 4 geslaagd.
- Automatische lokale browser-smoke: **40 geslaagd**, inclusief de oorspronkelijke 35 en vijf gerichte regressies voor de afzonderlijk goedgekeurde applicatiecorrecties.
- Recente gerichte controles: inkomensbronnen 15/15, mobiele/modalcontroles 29/29, onafhankelijke r46-visuals 7/7, planning/tijdlijn 6/6, transactiemotor 15/15, CSV/API-bronroutering 2/2 en maand-eindesparen 10/10. Deze aantallen overlappen met de brede suite en mogen niet worden opgeteld tot een nieuw totaal.
- Visuele referenties zijn verkregen uit een afzonderlijk Git-archief van main, niet uit de herstelbranch. De oude V50-referenties zijn behouden.
- De CI-configuratie bevat push/PR-events voor main en gescheiden snelle/uitgebreide controles. Lokaal gevalideerd; **geen echte GitHub Actions-run bevestigd**, omdat niets gepusht of gepubliceerd is.

## Brede browsercontrole en begrenzing

De run bevat 643 gevallen en bereikte de ingestelde limiet van 5400 seconden. Exacte eindstatussen uit het JSON-rapport: `{'passed': 314, 'failed': 171, 'timedOut': 2, 'skipped': 4, 'notRun': 152}`. De reporterstatistiek telt 314 geslaagd, 173 onverwacht mislukt en 156 overgeslagen/niet afgerond. Twee suitefouten melden de tijdslimiet voor uitvoering en teardown.

Bewijs: `.cache/pakket2/browser-full-final.json` en `.log`. De run kwam bij de schaalproef met 5400 bankbewegingen over 36 maanden en circa 23,1 MB synthetische fixture-inhoud. Er is geen bewijs dat alle resterende tests uitgevoerd zijn. Deze run liep gedurende gerichte testreparaties; enkele oorspronkelijke mislukkingen hebben inmiddels een afzonderlijke geslaagde hertest. Het ruwe totaal is daarom geen actuele unieke resterende-foutentelling.

De defectenclassificatie staat in `FINIZE-PAKKET-2-CLASSIFICATIE.md`. De oorspronkelijke negen onverklaarde prioriteitsgevallen zijn onderzocht. Andere cohorten blijven open, onder meer oudere importfixtures/kaartselectoren, oude dashboardcontracten, emulator-/schaaltests en de opslagraceproef. De bekende 194,5 px mobiele onderruimte blijft zichtbaar als falende controle; dit is het afzonderlijk afgesproken onderzoek voor pakket 3 en is niet stilzwijgend aangepast.

Een korte V113/P1/P2-fixtureproef is beëindigd toen na de verklaarde registerfixture ook verouderde kaartbediening bleek. De niet volledig geverifieerde wijzigingen zijn teruggenomen. Alleen aantoonbaar geslaagde gerichte wijzigingen zijn behouden.

## Afgesloten werkzaamheden voor deze tussenstand

De brede run en de eigen lokale emulator zijn beëindigd. Geen nieuwe brede run gestart. De bestaande server op poort 4173 is ongemoeid gebleven.

Voorgestelde vervolgstap: resterende testgevallen per verklaard cohort uitvoeren, met korte uitvoer en begrensde runs; zware schaaltests afzonderlijk behandelen. Geen volledige 643-testsherhaling zonder nieuwe aanleiding. Dit is een tussenstand, geen acceptatieverslag en geen akkoord voor pakket 3.
