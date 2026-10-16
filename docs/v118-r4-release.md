# Finize V118-r4 — Impeccable UX-publicatie

Publicatie expliciet goedgekeurd op 16 oktober 2026. Inhoudelijke wijzigingen en auditbeperkingen staan in [het UX-verslag](v118-impeccable-ux-minimal.md).

## Release en herstel

- Vorige gepubliceerde commit: `3f9b8859f4e4e1ebc5ed2e6ff1e915a71d3c2c9f` (V118-r3).
- Nieuwe assetversie: `118-r4`; serviceworkercache: `finize-v118-r4`.
- Herstelpunt: tag `rollback/finize-v118-r3-20261016`.
- Lokale back-up: `backups/v118-r4-prepublish-20261016-223902/` (genegeerd door Git).
- Back-up bevat 383 bron-/test-/documentatiebestanden, per kopie gecontroleerde SHA-256-manifesten, volledige Git-bundle, binaire werkboompatch en Git-status. Daarnaast zijn de zeven gepubliceerde r3-assets met hashes apart bewaard.
- Dit is een softwareback-up. Productiegegevens in browsers of Firestore worden niet geëxporteerd, gewist of gewijzigd door deze publicatie.
- Voor herstel: publiceer de runtimebestanden van het herstelpunt als nieuwe commit. Bewaar browseropslag; wis geen localStorage of IndexedDB. De cache-overgang ruimt alleen oude `finize-`-appcaches op.

## Scope

Rustigere Vooruitblik met informatie op aanvraag, duidelijkere bestaande prognosebeperkingen, toegankelijkere navigatie en vensters, afzonderlijke kaartacties, lokale contrastcorrecties en begrijpelijkere instellingen-/back-upteksten.

Geen wijzigingen aan financiële motor, CSV-verwerking, opslag, synchronisatie, Firebase-configuratie of authenticatie. De lokale inlogfout is opgelost door de preview via de reeds toegestane host `localhost` te openen.

## Verificatie

- Build, syntax, CSS en reproduceerbaarheid geslaagd. Bestaande CSS-melding `--line` blijft vermeld.
- 34 gerichte Node-controles geslaagd, inclusief cacheversie, offline shell, planning- en transactieregressies.
- Definitieve gecombineerde browserronde: **36 geslaagd, 2 overgeslagen, 0 fouten** (`.cache/v118-r4-browser-final.log`, 2,6 minuten). Twee oudere V117-herstelproeven zijn overgeslagen omdat ze aparte V117-assets vereisen; de echte r3/r4-herstelproef is wel uitgevoerd. Aanvullende cache-/offline-/rollbackronde: **3/3 geslaagd** (`.cache/v118-r4-cache-final.log`). De nieuwe cacheproef controleerde aanvankelijk te vroeg, tijdens installatie; de definitieve proef wacht op activatie en opruiming.
- Financiële/opslag-/import-/auth-/configuratiemodules machinegecontroleerd ongewijzigd ten opzichte van r3.
- Eerder volledig uitgevoerde algemene suites hebben één bestaande Node-fout en acht op r3 gereproduceerde browserfouten; zie het UX-verslag. Deze release wordt niet als volledig groene algemene regressie gepresenteerd.

De nieuwe cacheproef gebruikt uitsluitend synthetische gegevens en een geïsoleerde lokale server. Zij controleert r3 → r4, offline herladen en r4 → r3, met behoud van transacties, budgetten, inkomsten, vaste lasten, doelen, ijkpunten, maanden, prognoses, importbron, journal, synchronisatiewachtrij en een lokale sentinel. Een andere appcache moet behouden blijven.
