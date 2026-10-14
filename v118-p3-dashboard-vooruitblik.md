# Finize V118 — P3 Dashboard & Vooruitblik

Datum: 14 oktober 2026. Lokale werkbuild: `118-p3`.
Branch: `agent/v117-stabilisatie`. Basis-HEAD: `fbf8b34b8000570e05b9ec0b1ec3f00ddd33e7e5`.

## Gebouwd

Vooruitblik is geïntegreerd bovenaan het bestaande Dashboard. Er is geen nieuw tabblad. De bestaande sidebar, mobiele ondernavigatie, maandkeuze en rekeningdetails blijven bereikbaar.

- Gezamenlijk/Persoonlijk, met de bestaande ingelogde rol; lokaal zonder account kan Dion/Dara worden gekozen. De contextvoorkeur blijft lokaal onthouden, buiten financiële state.
- Vier KPI's: Vrij na verplichtingen met informatief spaardoel, Huidig saldo met P1-status en peildatum, Laagste prognose met datum, Buffer.
- Volgende salaris, 7 dagen, 14 dagen, Einde maand en Eigen datum. Eén P2-resultaat voedt KPI's, grafiek, minimum, waarschuwing en betalingen. Een generatie-ID onderdrukt verouderde antwoorden.
- Verwachte saldo-ontwikkeling, euro-/datumas, bufferlijn, gebeurtenismarkeringen, herkenbaar minimum, legenda, selecteerbare dagen en een compact detailvak. Grafiekpunten werken met klik, echte touch en toetsenbord; de native dagselectie bereikt ook dagen zonder gebeurtenissen.
- Chronologische komende betalingen, met Werkelijk/Gepland/Voorlopig. Bekijk alles toont alle concrete P2-gebeurtenissen binnen de horizon. Vervangen plannen en reserveringen verschijnen niet als tweede bankbetaling. Betrouwbaar herleidbare bankbronnen en plannen in de geselecteerde maand openen bestaande bewerk-/planningsschermen.
- Compacte budgetsamenvatting, geplande zakgeldverdeling met percentages en concrete spaardoelen met bestaande iconen/afbeeldingen.
- Jaaroverzicht met vier KPI's, jaarkeuze en desktopmaandgrafiek. Mobiel vier KPI's in 2×2, zonder maandgrafiek. Ontbrekende maandprojecties worden als ontbrekend behandeld en expliciet gemeld.
- Onbekende, onvolledige en voorlopige prognoses blokkeren de overige kaarten niet. Ontbrekende rekening, ijkpunt of salarisdatum hebben instellingsacties. Negatieve prognoses blijven negatief; waarschuwingen benoemen onzekerheid.

## Gewijzigde modules en hergebruik

| Module | P3-wijziging |
|---|---|
| `src/ui/dashboard.mjs` | Nieuwe gedeelde presentatielaag, horizonbediening, kwaliteitsweergave, grafiek en interacties |
| `src/styles/dashboard-p3.css` | Geïsoleerde responsive dashboardstijl op bestaande Finize-tokens |
| `src/core/runtime.js` | Dashboard koppelt de UI aan bestaande selectors, rollen en navigatie |
| `scripts/build.mjs` | Nieuwe dashboardstijl wordt als laatste meegebundeld |
| `app.js`, `app.css` | Reproduceerbaar gegenereerde assets |
| `index.html`, `service-worker.js` | Synchrone lokale build-/cacheversie `118-p3` |
| P3-tests | Financiële presentatie, routes, voorkeur, ontbrekende gegevens, touch/toetsenbord, races en drie schermbreedtes |
| Bestaande cache-/structuurtests | Assetversie bijgewerkt; oude dashboardcompositieasserties vervangen door P3-compositieasserties, overige contracten behouden |

P1/P2 leveren de fysieke rekeningstand, vrijwaarde, spaarambitie, buffer, minima, horizon, dagen, reserveringen en gebeurtenisstatussen. P3 past deze bedragen niet aan. De grafiek gebruikt `expectedBalanceCents`; de conservatieve reserveringslijn wordt niet nogmaals afgetrokken. V117 blijft de bron voor maandbudgetten, goedgekeurd budgetverbruik, zakgeld, spaardoelen en jaarprojecties.

De P1/P2-motorbestanden, profielregisters, opslagmodules, importcontracten en eerdere opleverdocumenten zijn niet door P3 gewijzigd. Het bewijsmanifest vergelijkt hun hashes met het herstelpunt.

## Ontwerp en visuele vergelijking

Het vooraf geschreven ontwerpcontract staat in [`docs/v118-p3-dashboard-design.md`](docs/v118-p3-dashboard-design.md). Beide meegeleverde JPG's zijn geopend/geanalyseerd; hun compositie bepaalt het dashboard. De oorspronkelijke PNG-benamingen uit de opdracht verwijzen naar deze JPG-bijlagen.

Overeenkomsten: vier prognose-KPI's, brede grafiek links/betalingen rechts op desktop, drie middenkaarten, breed jaarpaneel; mobiel dezelfde volgorde, 2×2 prognose-KPI's, Budgetten/Zakgeld naast elkaar op 390 px en onder elkaar op 320 px, doelen eronder, jaar-KPI's 2×2.

Bewuste verschillen: bestaande Finize-logo, warmere kleuren, lettertypen, sidebar en ondernavigatie blijven. Vrij na verplichtingen en de informatieve spaardoelondertekst volgen de definitieve afspraak. Zakgeld toont verdeling in plaats van verbruik. De jaarcijfers behouden hun bestaande huishoudbetekenis, met expliciet huishoudlabel. De standaardgrafiek eindigt vóór salaris; voorbeeldinkomsten worden niet nagebouwd. Grafiekdetails worden bij selectie in een detailvak getoond; er staan geen vaste voorbeeldballonnen over de lijn. Kwaliteitsmeldingen kunnen extra hoogte vragen. Het desktopdashboard is daardoor bij onvolledige gegevens langer dan de compacte voorbeeldafbeelding.

## Impeccable-controle

De geïnstalleerde Impeccable 4.0.2 is daadwerkelijk gebruikt: `context.mjs`, `new-work.md`, `craft-floor.md` en de technische auditreferentie zijn geladen. De richting was al door de gebruiker vastgelegd; er zijn geen alternatieve ontwerpen of gegenereerde mockups gemaakt. Het bestaande visuele systeem is uitgebreid, niet vervangen.

De detector is één keer uitgevoerd op de nieuwe UI-/CSS-modules en gaf `[]`. De verplichte onafhankelijke finish-reviewer is gestart, maar kon door een accountgebruiksgrens niet uitvoeren. Dit is geen geslaagde onafhankelijke review. De daadwerkelijke screenshotvergelijking en technische eindcontrole zijn daarom in de hoofdthread uitgevoerd.

Eén gerichte verbeteringsronde: leesbare mobiele grafiekassen op de werkelijke paneelbreedte, directe bedienbare SVG-punten met 44px-raakgebied en focus, compactere grafiekbediening, bestaande SVG-iconen, compacte uitklapbare kwaliteitsredenen en betrouwbare bronroutes. Geen tweede detectorrun of algemene ontwerp-/prestatieoptimalisatie.

| Auditdimensie | Score | Onderbouwing |
|---|---:|---|
| Toegankelijkheid | 3/4 | Native knoppen/selecties, labels, focus, Enter/Space en echte touch getest; geen volledige schermlezer-certificering |
| Performance | 4/4 | Geen nieuwe bibliotheek/netwerklaag, gedeelde P2-dataset, geen globale herberekening bij horizonwissel |
| Responsive | 3/4 | 1440/390/320 gecontroleerd, geen pagina-overflow; bestaande vaste ondernavigatie blijft en content is weg te scrollen |
| Theming | 4/4 | Bestaande Finize-tokens, iconen, componenttaal en navigatie behouden |
| Implementatie-integriteit | 3/4 | Financiële bronnen en concrete routes gecontroleerd; onafhankelijke finish-review bleef door gebruikslimiet onuitgevoerd |
| **Totaal** | **17/20** | Handmatige gerichte audit; geen claim van volledige WCAG-certificering |

## Testbewijs en screenshots

De exacte opdrachten, uitslagen, build-hashes en bestandsvergelijking staan in [`docs/audit/v118-p3-bewijs.json`](docs/audit/v118-p3-bewijs.json). Testlogs staan onder `.cache/v118-p3/`.

- Node: 133 geslaagd, 0 mislukt; daarvan 14 nieuwe P3-gevallen. Direct geraakte P2-, budget-, zakgeld-, periode-, cache- en structuurcontracten zijn meegenomen.
- Browser: 13 geslaagd, 0 mislukt; 10 nieuwe P3-gevallen en de drie bestaande P2-instellingencontroles op 1440/390/320 px.
- Build, gegenereerde-assetscontrole, JavaScript-syntax, CSS en `git diff --check` geslaagd. CSS meldt uitsluitend het reeds bestaande token `--line`.

Screenshotlocaties, daadwerkelijk geopend voor de visuele vergelijking:

- `.cache/v118-p3/before-1440.png` en `before-390.png`: dashboard vóór implementatie.
- `.cache/v118-p3/dashboard-1440.png`: definitief desktopdashboard.
- `.cache/v118-p3/dashboard-390.png`: mobiel, vier prognose-KPI's en vier jaar-KPI's in 2×2.
- `.cache/v118-p3/dashboard-320.png`: compact mobiel, stapelende middenkaarten, geen horizontale pagina-overflow.

De screenshots en browsertests gebruiken uitsluitend synthetische lokale testgegevens. Er zijn geen voorbeeldbedragen in applicatielogica vastgezet en geen productiegegevens aangepast.

## Herstelpunt en grenzen

Herstelpunt: `C:\Users\dionv\AppData\Local\Finize-herstelpunten\v118-p3-20261014-102601`. Alle bij aanvang gewijzigde/niet-gevolgde bestanden zijn gekopieerd, met SHA-256 gecontroleerd en samen met branch, HEAD en Git-status vastgelegd.

Geen commit, push, merge, deployment, productiecutover, Firestore-wijziging, schaaltest, volledige V118-regressie of emulatorreeks. P4/P5b zijn niet gestart. De pc is niet in slaapstand gezet.

Beperkingen: P2 blijft afhankelijk van expliciet ingestelde primaire rekeningen, ijkpunten, salaris-/kasdatums en bankdekking. P3 verbergt die onzekerheid niet. De tijdelijke P1b-afspraak over rekeningbeheer blijft; P3 voegt geen serverprivacy toe. Het jaaroverzicht blijft het bestaande huishoudjaaroverzicht, ook wanneer de rekeningprognose op Persoonlijk staat. Niet-gecertificeerde of ontbrekende historische maanden worden als onvolledig gemeld. Beoordeling door de gebruiker is de volgende stap; er is geen publicatie uitgevoerd.
