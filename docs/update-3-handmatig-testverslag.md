# Finize Update 3 — handmatig testverslag

Datum: 23 juli 2026

## Geautomatiseerd

- Inline JavaScript-syntaxis: geslaagd, drie inline scripts.
- Update 2 rekenregressie: geslaagd.
- Terugkeerregels: geslaagd voor maandelijks, driemaandelijks, 11-wekelijks, jaarlijks, maandafklemming en schrikkeljaar.
- Bedragshistorie en eenmalige maandoverride: geslaagd.
- Migratiefixtures schema v1, v2 en v3: geslaagd, inclusief herhaald migreren zonder duplicaten.
- Rekening versus `financialFor`: geslaagd voor gezamenlijke uitgave vanaf Dions rekening.
- Budget, reserve-afleiding, schuldnetting en gedeeltelijke aflossing: geslaagd.
- Afsluiten, blokkeren op reviewwachtrij, idempotent opnieuw bevestigen, heropenen en nieuwe revisie: geslaagd.

## Live rooktest

- `index.html` geopend vanaf de Google Drive-repository via een lokale preview.
- Dashboard, cloudstatus, maandkiezer en alle vijf tabs zichtbaar.
- Update 3-kaart zichtbaar zonder horizontale overflow.
- Planningmodal geopend; gemigreerde vaste lasten en inkomsten zijn leesbaar.
- Mobiele CSS gebruikt éénkolomsformulieren en fullscreen-modals onder 768 px.

## Veiligheid van gegevens

- Voor implementatie is een gedateerde back-up van `index.html` en `service-worker.js` gemaakt.
- Firestore-tweecontextentest is niet met productiegegevens uitgevoerd; hiervoor is eerst een expliciete volledige export en herstelronde nodig.
- De live preview heeft geen testtransacties, afsluitingen of correcties opgeslagen.
