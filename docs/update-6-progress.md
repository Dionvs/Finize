# Update 6 — voortgang

## Fase 1: auth- en accountbasis

Status: lokaal afgerond en geverifieerd, nog niet gepubliceerd.

### Opgeleverd

- Productwaarheid vastgelegd in `PRODUCT.md`.
- Centrale Firebase-configuratie voorbereid.
- Firebase Authentication-shell voor Google en e-mail/wachtwoord.
- E-mailverificatie, wachtwoordherstel en duidelijke fout-/wachtstaten.
- Selectievak **Ingelogd blijven** met lokale of sessiepersistentie.
- Auth-bootstrap vóór rendering en cloudverbinding.
- Zuivere contracten voor rollen, accountstatus en persistentie.
- Lokale, niet-gecommitteerde koppeling van de aangeleverde e-mailadressen aan Dion en Dara.

### Bewuste grens van fase 1

- Auth staat in de releaseconfiguratie nog uit.
- De beveiligde Firestore-accountlookup en regels volgen samen in een latere fase.
- De bestaande financiële state, berekeningen, tabs en productiecloud zijn niet gewijzigd.
- Er is niets naar GitHub Pages of Firebase gepubliceerd.

### Verificatie

- 29 Node-tests geslaagd, inclusief het nieuwe Update 6-authcontract.
- 34 Playwright-browsertests geslaagd, inclusief de nieuwe desktop- en 390px-authflow.
- JavaScript-syntax, CSS, gegenereerde runtime en `git diff --check` zijn schoon.
- Impeccable-detector: geen bevindingen.
- Visueel geopend op desktop en 390px; geen overflow of browserconsolefouten.
