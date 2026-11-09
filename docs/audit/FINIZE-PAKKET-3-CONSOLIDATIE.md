# Finize — pakket 3: technische consolidatie

Uitgangspunt: geaccepteerde herstelronde `5521110`, branch `herstel/pakket1-financiele-bugs`. GitHub-main is op 9 november 2026 nog `7a7d72e25660975ba88269e7835b98d32858ada5`.

De latere gebruikersinstructie gaat voor op de oorspronkelijke brede eindcontrole: alleen direct relevante tests per gewijzigde component. De grote schaaltest blijft open; geen nieuwe emulator-/schaalrun. Geen publicatie, productiegegevens, banksynchronisaties, beveiligingsregels of migraties.

## 3.1 Ontwikkelafhankelijkheden — afgerond

Gerichte wijzigingen: `@playwright/test` 1.55.0 → 1.55.1; `postcss` 8.5.6 → 8.5.23; transitief `nanoid` 3.3.16 → 3.3.18 en `source-map-js` 1.2.1 → 1.2.2. Geen major upgrades, `--force` of nieuwe afhankelijkheden. `esbuild` blijft 0.25.9.

| Oorspronkelijke melding | Bereik en afhandeling |
|---|---|
| GHSA-7mvr-c777-76hp | Playwright-browserdownloader controleerde certificaatauthenticiteit onvoldoende. Alleen ontwikkel-/CI-tooling; patch toegepast. |
| GHSA-qx2v-qp2m-jg93 | PostCSS-stringify/XSS. Lokale CSS-tooling, geen browserruntime; patch toegepast. |
| GHSA-6g55-p6wh-862q | PostCSS-sourceMappingURL/bestandslezing. Lokale parser; patch toegepast. |
| GHSA-fxqj-rqcc-2cmp | Aanvullende PostCSS-sourceMappingURL-fix zonder `from`. Patch toegepast. |
| GHSA-r28c-9q8g-f849 | PostCSS-padtraversal bij oude sourcemaps. Patch toegepast. |
| GHSA-2v37-7h3g-55p8 | `nanoid`-customgenerator bij grootte nul. Transitieve patch toegepast. |
| GHSA-68fv-2mgg-jv7q | `source-map-js`-indexed-map/DoS. Transitieve patch toegepast. |

`pnpm audit`: **7 meldingen (5 hoog, 2 matig) → 0**. Vóór/na-JSON: `.cache/pakket3-audit-root-before.json` en `-after.json`.

De afzonderlijke backend-lockfile heeft **9 matige meldingen**, terug te voeren op [GHSA-w5hq-g745-h8pq](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq). Die betreft v3/v5/v6 met een externe uitvoerbuffer; v4 is volgens de onderhouders niet getroffen. De drie directe uuid-gebruikers in de vastgelegde dependencyboom zijn gaxios 6.7.1, google-gax 4.6.1 en teeny-request 9.0.0. De lokaal beschikbare bron van exact die versies gebruikt alleen `v4()` zonder buffer. Finize zelf roept geen uuid-v3/v5/v6-bufferpad aan. De meldingen zijn niet genegeerd of als opgelost gerapporteerd. De aangeboden volledige SDK-upgrade is een major-upgrade; deze is niet uitgevoerd. `functions/package.json` en de backend-lockfile blijven ongewijzigd.

Controle: reproduceerbare build vóór/na, CSS-parser en **1 opstart-browsertest geslaagd**. De eerste browserpoging miste de binary van de nieuwe toolpatch; uitsluitend de bijbehorende Chromium-headless-shell is geïnstalleerd, waarna dezelfde test slaagde. De applicatiebundels veranderden in deze fase niet. Geen financiële tests herhaald omdat geen applicatielogica veranderde.

## 3.2 Functievervangingen — gericht onderzocht

De huidige core bevatte vóór deze ronde elf directe functiehertoewijzingen en drie toewijzingen via `installUpdate4Hooks`: samen veertien locaties. De oorspronkelijke scan bevat geen lijst met afzonderlijke locaties; dit is de huidige reconstructie, geen bewijs dat de oude detector exact dezelfde veertien telde.

| Functie / locaties | Actieve route en besluit |
|---|---|
| `calcDoel` | Update-2-implementatie met geselecteerde rekenmaand, subdoelen en prognose. Wordt gebruikt door doelweergave/groepsberekening en geëxporteerd. Financiële gedragsverschillen met de oude declaratie: behouden, geen consolidatie. |
| `calcGroep` | Update-2-implementatie met verdeling in centen en subdoelen; gekoppeld aan verwerkingsmodal en publieke `FinizeUpdate2.calculateGroup`. Behouden. |
| `renderDashboardGoalPreviewCard` (2) | Laatste wrapper roept de vóór beide hertoewijzingen vastgelegde oorspronkelijke renderer aan. De eerste hertoewijzing werd nergens vastgelegd of tussentijds aangeroepen: verwijderd. De actieve subdoelwrapper en oorspronkelijke renderer blijven bestaan. |
| `renderMobileGoalRow` | Wrapper bewaart de oorspronkelijke rijrenderer, voegt subdoelinformatie toe. Capture en volgorde behouden. |
| `renderMobileSpaardoelen` (2) | Laatste wrapper roept de vóór beide hertoewijzingen bewaarde oorspronkelijke renderer aan. De eerste tussenrenderer werd synchroon overschreven zonder aanroep/capture: verwijderd. Actieve handlers en historie blijven staan. |
| `openMobileGoalEditor` | Wrapper gebruikt `u2BaseGoalEditor` voor de bestaande editor en voegt subdoelvelden toe. Behouden; actuele subdoeleditor werkelijk geopend en gecontroleerd. |
| `getMonthlyBaseIncome` | Laatste implementatie gebruikt `getDistributionIncomeParts(...).salary`. Historische inkomensselectie behouden. |
| `sumVasteTeruggaven` | Laatste implementatie gebruikt dezelfde maandgebonden inkomensbron voor refund. Behouden. |
| `getMonthTransactions` | Laatste implementatie gebruikt `selectActiveTransactions` met maand/eigenaar. Behouden. |
| `renderBankImportSection`, `bindBankImport`, `renderActiveTab` (3 hooks) | Importmodule installeert functies via de expliciete hookbrug. De actieve tabwrapper bewaart de eerdere functie en plant de verrekenkaart via een microtask. Nodig voor modulevolgorde en bestaande import-/tabhandlers: behouden. |

De verwijderde code bevatte uitsluitend functiedeclaraties en toewijzingen; er stonden geen uitvoerende callbacks of initialisatieacties tussen de oude en definitieve renderertoewijzingen. Geen wijziging aan berekeningen, opslag of gebeurtenisafhandeling. Commit: `476b0d2`.

## 3.3 Vermoedelijk ongebruikte functies — conservatieve afhandeling

Twee helpers zijn met hun dode renderpad verwijderd: `u2RenderGoalRow` en `u2RenderChildSummary`. Alle naamverwijzingen stonden uitsluitend in de eveneens verwijderde tussenrenderers of in elkaar. Geen export, global bridge, HTML-handler, callbackregistratie of testaanroep gevonden.

De oorspronkelijke lijst van 33 namen ontbreekt. Een actuele tekstscreening van `src`, tests en scripts levert 31 andere eenmalige, niet direct geëxporteerde functienamen op. Drie hebben expliciete test-/toolingverwijzingen (`renderRecurringFixedManage`, `u3ConfirmedTransactions`, `renderU3AdminPanel`). De andere 28 zijn **behouden**, omdat een naamfrequentie geen volledige analyse van dynamische bereikbaarheid, migratiecompatibiliteit en console/debuggebruik vervangt. Expliciet geëxporteerde functies zoals `prepareFixedAccountAlignment`, `createProductionRecordTransport` en `savingsNote` zijn niet als veilig verwijderbaar aangemerkt.

Per naam is het beperkte bewijs vastgelegd in [pakket3-functie-inventaris.json](pakket3-functie-inventaris.json). Dit is een screening met bewaarbesluit, geen volledige callgraph en geen claim dat alle oorspronkelijke 33 bevindingen definitief zijn gesloten.

## 3.4 Offlinecache — bewezen duplicatie verwijderd

De lokale server leverde dezelfde inline HTML-shell onder `/` en `/index.html`; de service worker bewaarde beide. Offline navigatie leest uitsluitend `./index.html`. Daarom wordt alleen die canonieke HTML-shell vooraf opgeslagen en op release-inhoud gecontroleerd. JavaScript, CSS, manifest en optionele afbeeldingen blijven behouden. Cacheversie, opslagkeys, activatievolgorde en afwijzing van ongeldige shells blijven gelijk.

Gemeten response-inhoud, na de bronconsolidatie en direct vóór/na deze cachewijziging:

| Meting | Bytes | MiB |
|---|---:|---:|
| Voor | 8.084.842 | 7,71 |
| Na | 5.776.681 | 5,51 |
| Besparing | **2.308.161 (28,55%)** | **2,20** |

Dit is response-inhoud, niet het fysieke schijfgebruik van de browser. Bij een reeds geïnstalleerde cache met dezelfde naam wordt de eerder opgeslagen extra rootkopie niet actief verwijderd; de gemeten besparing geldt voor een verse cache en een volgende normale releasecache. Er zijn geen gebruikersgegevens verwijderd om ruimte te winnen.

Werkelijk gecontroleerd: installatie, online openen, offline herladen, oude-cache-voorrang, opnieuw verbinden, registratie-update zonder nieuwe release, nogmaals offline herladen en bytegelijk behoud van fictieve state. Eén extra gerichte Node-test controleert succesvolle installatie met ontbrekende optionele afbeeldingen en afwijzing van verkeerde HTML, beide zonder dubbele HTML-entry. Drie bestaande service-worker-tests controleren actuele cachekeuze, niet-blokkerend navigatiegedrag en activatievolgorde.

**Grens:** een volledige uitrol/rollback naar een andere echte release is niet uitgevoerd; dat blijft onderdeel van een latere publicatiecontrole. Geen nieuwe cacheversie of release gepubliceerd. Commit: `f0ab1e6`.

## 3.5 CSS — één doelcomponent geconsolideerd

De twee onvoorwaardelijke regels voor `.u2-dashboard-extra` in `src/styles/goals.css` zijn samengevoegd met behoud van alle uiteindelijk actieve declaraties. Geen `!important` verwijderd om alleen een lager cijfer te krijgen: de actuele telling blijft **1.933**.

Voor en na zijn dezelfde fictieve spaardoelen geopend op **390 px mobiel, 1440 px desktop en 820 px tablet**, in die volgorde. Berekende rijstijlen/afmetingen en de relevante samengestelde componentstijlen zijn gelijk; de subdoeleditor toont het opgeslagen subdoel. Screenshots van desktop en tablet zijn bytegelijk. De mobiele PNG is niet bytegelijk; visuele inspectie toont geen zichtbare layoutwijziging, en de vastgelegde computed styles/afmetingen zijn wel gelijk. Daarom wordt geen pixelperfecte mobiele screenshotgelijkheid geclaimd.

Header, maandselector, KPI's, overige dashboarddelen, gezamenlijk/persoonlijk, budgetten, transacties, navigatie en andere modals zijn niet verder herschreven. De bestaande cascade buiten deze doelcomponent is **behouden**, niet als volledig opgeschoond of opnieuw visueel gevalideerd gemarkeerd. De volledige in de oorspronkelijke opdracht beschreven CSS-ronde blijft dus gedeeltelijk open. Dit beperkt het wijzigings- en testoppervlak conform de latere instructie om zuinig te werken. Commit: `476b0d2`.

## 3.6 Onderste mobiele ruimte

Al hersteld en gericht gevalideerd in de geaccepteerde herstelronde `5521110`. Niet opnieuw aangepast of met een brede suite hertest. Zie [het gerichte herstelverslag](FINIZE-GERICHT-HERSTELVERSLAG-20261109.md).

## 3.7 Actieve metadata

Rootpakket heet nu `finize`, versie `118.0.0`, overeenkomstig de huidige productgeneratie. Dit is pakketmetadata, geen nieuwe gepubliceerde release. README beschrijft de werkelijke inline levering en duidt het oude architectuurdocument als historisch. De CSS-controle noemt onbekende variabelen zonder verouderd V50-label. Historische documentnamen, fixtures, migraties, opslagkeys en cache-identificaties zijn behouden. Commit: `c42cc31`.

## 3.8 Gerichte controle en resterende grenzen

| Controle | Laatste relevante uitkomst |
|---|---|
| Browser: opstart na toolpatch | 1 geslaagd |
| Browser: doelen, drie viewports en editor | 1 geslaagd, computed-styles vergeleken met vóórmeting |
| Browser: PWA/offline/reconnect/state | 1 geslaagd |
| Node: service-workergevallen | 4 geslaagd (3 bestaand + 1 nieuw) |
| Afzonderlijke Node-contractscripts | 2 geslaagd: doel-/inkomenspariteit en service-workercache |
| Build, syntax, CSS-parser, Git-whitespace | Geslaagd; bestaande `--line`-waarschuwing met expliciete fallback behouden |
| Emulator / schaal / volledige suite | **Niet uitgevoerd** |
| GitHub Actions / productie / publicatie | **Niet uitgevoerd** |

Dit zijn drie unieke browsergevallen, geen volledige appacceptatie. Sommige zijn voor de vóór/na-vergelijking herhaald. Vier eerdere controlepogingen mislukten door testopstelling: ontbrekende nieuwe browserbinary, niet-globale renderernaam, een verouderde accordionselector en een al geconsumeerde `Response` in de nieuwe cachemeting. Die oorzaken zijn gecorrigeerd; er is hiervoor geen applicatiegedrag aangepast of assertion afgezwakt. De laatste relevante controles slagen.

Compacte metingen: [pakket3-gericht-bewijs.json](pakket3-gericht-bewijs.json). Lokale ruwe screenshots en vóórmetingen staan onder `.cache/pakket3-*`; die zijn geen vereiste voor normale tests. Een gerichte vergelijking kan met `FINIZE_P3_COMPARE=1` worden uitgevoerd wanneer de bijbehorende vóórmeting beschikbaar is.

De grote schaaltest blijft **open**, evenals de oude timeout-/emulatorbeperking. Geen nieuwe poging met dezelfde omgeving, geen verhoogde limieten en geen verhulde groene eindstatus. De negen backendmeldingen en de niet volledig uitgevoerde CSS-/legacyinventaris blijven zichtbaar. De aantoonbaar veilige consolidaties van deze ronde zijn afgerond; brede pakket-3-voltooiing of releasevrijgave wordt niet geclaimd.
