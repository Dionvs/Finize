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

## Fase 2: beveiligde account- en huishoudkoppeling

Status: lokaal afgerond en geverifieerd, nog niet gepubliceerd.

### Opgeleverd

- Firestore-lookup van een vooraf ingerichte accountkoppeling op genormaliseerd e-mailadres.
- Alleen een ingelogd en geverifieerd account kan zijn eigen koppeling lezen.
- De rol en het huishouden zijn alleen administratief in te richten en niet vanuit de browser te wijzigen.
- Eerste beveiligde huishoudlidprofiel wordt bij de eerste geldige aanmelding aangemaakt.
- Delen staat daarbij standaard uit en de lijst met verborgen KPI's start leeg.

### Bewuste grens van fase 2

- Auth blijft in de releaseconfiguratie uit.
- De aangeleverde adressen blijven uitsluitend in het genegeerde lokale koppelbestand staan.
- Het bestaande openbare `budgetPlanners/finize`-pad blijft tijdelijk intact; opslagmigratie volgt pas na een rekenkundige regressiecontrole.
- Er is nog niets naar Firebase, GitHub of GitHub Pages gepubliceerd.

### Verificatie

- Firestore-regels compileren zonder fouten via een Firebase CLI dry-run.
- 30 Node-tests geslaagd, inclusief account-, profiel- en regelcontracten.
- 34 Playwright-browsertests geslaagd; de bestaande interface en auth-preview blijven stabiel.
- JavaScript-syntax, CSS en de gegenereerde runtime zijn schoon en reproduceerbaar.
