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

## Fase 3: accountgebonden opslag zonder rekenwijziging

Status: lokaal afgerond en geverifieerd, nog niet gepubliceerd.

### Opgeleverd

- De bestaande complete Finize-state blijft ongewijzigd het invoerformaat van dezelfde rekenmotor.
- Een actieve accountkoppeling gebruikt het beveiligde cloudpad `households/{householdId}/budgetState/current`.
- Bankimportdetails gebruiken hetzelfde beveiligde huishouden in plaats van het oude openbare pad.
- Lokale state, back-up en migratiekopie zijn per account en huishouden gescheiden.
- Zonder actieve Update 6-auth blijft exact het bestaande lokale en cloudpad actief.

### Bewuste grens van fase 3

- Het bestaande document is nog niet naar het nieuwe pad gekopieerd.
- De oude openbare regels blijven tot de gecontroleerde live-migratie bestaan.
- Auth blijft uit, waardoor de productie-app en alle huidige berekeningen nog exact zoals voorheen werken.

### Verificatie

- 31 Node-tests geslaagd, inclusief de nieuwe opslagpad- en cachescheidingscontracten.
- Alle bestaande Update 2 t/m 5-rekentests zijn ongewijzigd geslaagd.
- 34 Playwright-browsertests geslaagd op telefoon-, tablet- en desktopformaten.
- Firestore-regels compileren zonder fouten via een Firebase CLI dry-run.
- JavaScript-syntax, CSS en de gegenereerde runtime zijn schoon en reproduceerbaar.

## Fase 4: accountnavigatie, Instellingen en delen

Status: lokaal afgerond en geverifieerd, nog niet gepubliceerd.

### Opgeleverd

- Mobiel toont bij een account exact vijf knoppen: Dashboard, Gezamenlijk, eigen tab, Spaardoelen en Instellingen.
- De persoonlijke tab van de andere persoon is standaard verborgen.
- Desktop toont die andere tab alleen wanneer de eigenaar het volledige overzicht deelt.
- Instellingen bevat Account, Huishouden, Delen, Cloud en Data & back-up.
- De eigenaar kan de volledige persoonlijke tab delen en vier afzonderlijke KPI-kaarten verbergen.
- Een gedeelde andere tab is alleen-lezen; verborgen KPI-kaarten worden niet gerenderd.
- Dashboard en Gezamenlijk zijn niet gewijzigd.

### Verificatie

- 31 Node-tests en alle bestaande Update 2 t/m 5-rekentests geslaagd.
- 37 Playwright-browsertests geslaagd, inclusief accountnavigatie, vijf mobiele knoppen, alleen-lezen en verborgen KPI's.
- Alle zeven bestaande visuele baselines blijven exact binnen hun goedgekeurde toleranties.
- Firestore-regels compileren zonder fouten via een Firebase CLI dry-run.
- Impeccable-detector: geen bevindingen.
- Inlogscherm daadwerkelijk geopend; semantiek, checkbox **Ingelogd blijven** en visuele hiërarchie gecontroleerd.
