# Finize V118-r14 — releasecontrole 26 oktober 2026

## Wijzigingen en afzonderlijke beoordeling

- B: `e22c490` vaste KPI-periode tot vóór het eerstvolgende relevante salaris/zakgeld, onafhankelijk van grafiekfilters; `488e58c` aanvullende periodeafhankelijkheden voor een verre toekomstige grafiekmaand.
- A: `97598b0` bevestigde nieuwe bankimportgeneratie na bewust verwijderen, met behoud van de oorspronkelijke tombstone, harde bronidentiteiten en bestaande goedkeuringen. Lokale atomaire controles en bestaande cloud-CAS blijven leidend. Bronadoptie weigert afwijkende beschermde brongegevens vóór enige mutatie.
- Release: uitsluitend cache-/assetversie r14 en bijbehorende bestaande testverwachtingen. Geen backend-, bankautorisatie-, sessie-, Firestore-regel- of financiële bronwijziging.

Diagnose en implementatie: [werkpakket A](finize-bankdiagnose-20261026.md). Prognose: [werkpakket B](finize-inkomensprognose-20261026.md).

## Definitieve lokale resultaten

| Controle | Resultaat |
|---|---|
| Volledige bestaande Node-run | 76/76 testbestanden geslaagd |
| Gerichte A/import/verwerkingscontroles | 143/143 tests geslaagd |
| Aanvullende synthetische bank/backend/provider/multi/bootstrap/configuratie | 97/97 tests geslaagd |
| Afzonderlijke B-controle vóór samenvoegen | 120/120 rekentests en 28/28 browsergevallen |
| Gecombineerde A+B-browsercontrole na laatste bronwijziging | 78/78 geslaagd |
| Aanvullende atomaire huishoudscope en PWA-cache/offline/reconnect | 3/3 geslaagd |
| Asynchrone twee-apparatenproef met expliciete cloudflush | 3/3 opeenvolgende herhalingen geslaagd |
| JavaScript-syntax, CSS, gegenereerde build en whitespace-diff | geslaagd; bestaande CSS-tokenmelding `--line` |

De controles overlappen; aantallen mogen niet als unieke tests worden opgeteld. Geen echte bankactie uitgevoerd. De afzonderlijke backend-retentie-emulatorproef is niet opnieuw gedraaid: backend/retentie zijn ongewijzigd. Cloudtransport is met synthetische responses getest; de productieoorzaakconditie is uitsluitend via lezen en exacte ketenreproductie vastgesteld.

De 78 gecombineerde browsergevallen bevatten beide rekeningcontexten, eerste/herhaalde import, verwijdering en bevestigde nieuwe bundel, behoud van goedkeuringen/categorieën, native IndexedDB-abort en herstel, gewijzigde lokale/cloudbasis, twee geïsoleerde apparaten en historische maandgegevens. Mobiele controles: 320/390/430 px; de uiteindelijke screenshot op 390 px is geopend en visueel gecontroleerd. De daadwerkelijke r13→r14-PWA-update, offline herladen en softwareterugrol behouden financiële fixtures, planning, importdetails, journals en queue.

Oudere lifecycle-tests zijn bijgewerkt voor de bestaande maandfilterfunctie en correcte voorbereiding vóór bootstrap; financiële assertions zijn behouden. De oude fixture faalde ook met het ongewijzigde r13-bundelbestand. De asynchrone cloudtest wacht expliciet op de bestaande opslagbevestiging.

## Productiebehoud en publicatiegrens

Vóór publicatie is een uitsluitend-lezen vergelijking vastgelegd: financiële cloudmanifest, 24 importheaders en twee permanente rekeningbindingen. Alleen SHA-256 en aantallen zijn lokaal opgeslagen, geen bankgegevens of identiteiten. Na publicatie worden dezelfde projecties opnieuw gelezen en vergeleken. Geen productie-write of echte bank-API-call toegestaan of uitgevoerd.

GitHub Pages gebruikt de bestaande bron `main` en pad `/`, buildtype legacy. De bronversie op GitHub is vóór vrijgave gecontroleerd tegen de lokale uitgangsbasis. Publicatie volgt pas na de definitieve technische ChatGPT-review en de reeds door Dion gegeven voorwaardelijke toestemming. Daarna volgen deploymentstatus, publieke assethashes en geïsoleerde synthetische browsertests.

Dit verslag bewijst geen geslaagde echte banksynchronisatie. De gebruiker moet de nieuwe bundel later zelf in Finize bevestigen; oude verwijderde goedkeuringen worden niet automatisch hersteld.
