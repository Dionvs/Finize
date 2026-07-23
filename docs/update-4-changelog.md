# Update 4 — Slimme bankimport & uitgaven

## Nieuw

- Automatische ING-import en generieke CSV-kolomherkenning.
- Exacte rekeningprofielen met een vaste rekeninghouder.
- Eén lokaal bewaard importconcept met full-screen controle.
- Zeker/Nakijken-classificatie, herkenningsregels en stabiele duplicaatfingerprints.
- Splits, Niet meetellen, vaste lasten, spaardoelen, voorschotten en notities.
- Eén transactionele verwerkings- en reconcile-engine.
- Directionele voorschotten en expliciete, gedeeltelijke aflossingsallocaties.
- Importgeschiedenis met volledige undo.
- Correcties in afgesloten maanden met status `Correctie nodig`.
- Aparte handmatige override voor werkelijk inkomen.
- Offline importopslag en uitgestelde Firestore-sync in begrensde chunks.

## Compatibiliteit

- Bestaande transacties en Update 2/3-functionaliteit blijven behouden.
- Schema v1–v4 migreert idempotent naar v5 met een lokale pre-migratieback-up.
- `account`, `financialFor` en `owner` blijven voorlopig als compatibiliteitsvelden bestaan.
- Herkenningsregels bewaren geen rekeninghouder of financiële eigenaar.

## Bekende acceptatievoorwaarde

De meegeleverde ING-fixtures zijn synthetisch en geanonimiseerd. Voor definitieve acceptatie moeten de drie afgesproken echte, geanonimiseerde exports van Dion, Dara en de gezamenlijke rekening nog door dezelfde testset worden gehaald.
