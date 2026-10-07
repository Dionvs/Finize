# Finize v111 — privérekening en oudere importhistorie

Uitgangspunt: v110 (`b0901e9266ba47266f94988e4529e6049526f3bf`). Publicatie van beide gerichte fixes is afzonderlijk geautoriseerd op 7 oktober 2026. Marker: `finize-v111-private-income-import-history`. Schema blijft v11.

## Privé-inkomsten

De gezamenlijke inkomensuitsplitsing en brontransacties lazen ook ontvangsten op privérekeningen. `dashboardIncomeBreakdown` en `incomeSourceProjectionRows` filteren nu hun transaction projections op de fysieke rekening; losse legacy maandontvangsten van Dion/Dara worden niet meer als gezamenlijke ontvangst gepresenteerd. Salarisprecedence en de bestaande geplande referenties blijven behouden.

Een privérefund op een gezamenlijke categorie blijft een privébankontvangst, zonder normaal inkomen. De centrale engine blijft de gezamenlijke historische categorie corrigeren. Financiële bestemming en fysieke rekening blijven gescheiden. De financiële engine, planning, zakgeld, ledger, import lifecycle en privacyregels zijn niet gewijzigd.

## Oudere CSV's

De refreshguard in `openDraft` gebruikte uitsluitend `sameImportOperation` om vast te stellen of de lokale kopie tijdens het ophalen veranderde. Die vergelijking is altijd onwaar zonder operationId, ook bij een identieke legacykopie. Daardoor werd een geldige cloudrefresh ten onrechte geblokkeerd met “Een nieuwere lokale importkeuze blijft behouden”. Dit is niet maandgebonden.

De guard gebruikt nu de reeds bestaande `sameEditorBase`: moderne imports behouden de operation/versioncontrole; legacyimports worden op hun volledige opgeslagen basis vergeleken, zonder een identiteit te verzinnen. Een daadwerkelijke wijziging tijdens ophalen blijft geblokkeerd. IndexedDB-versiecontrole, immutable bankOriginal, cloud-CAS, lokale conflictkeuzes en tombstones blijven intact. Geen import is verwijderd, opnieuw goedgekeurd of financieel gereconstrueerd.

## Gerichte verificatie

- Inkomens-Node-tests: 13/13 PASS.
- P5 sync en Sync Hotfix 3: 35/35 PASS; bestaande cloud-importtest PASS.
- Inkomensbrowsercases: 15/15 PASS, inclusief 390px/1440px, privé-inkomsten, privérefund op gezamenlijke categorie, bronklik, splits en privacy.
- Bestaande importhistorie/rekeningfilter: 2/2 PASS.
- Nieuwe historie/reload/alleen-lezen cases: 2/2 PASS.
- Nieuwe legacy-cloudrefresh/conflict cases: 4/4 PASS. De twee ongewijzigde legacycases reproduceerden de fout vóór de fix en slagen erna. De twee echte lokale wijzigingen blijven beschermd.
- Bestaande vertraagde eigen hydration/volgende goedkeuring: 1/1 PASS.
- Syntax, CSS, build, generated-runtimecontrole en diff-check PASS.

De geïsoleerde UI-fixtures behouden state, bankOriginal, financial effects, forecast en opslag bij bekijken. De historiechecks veranderen geen financiële state/forecast en starten geen core-save. Cloudrefresh mag alleen de bestaande importdetailcache vernieuwen. Geen productiefinanciële mutaties of Firestore rules-deployment uitgevoerd tijdens ontwikkeling. Geen volledige regressieronde herhaald.

## Gewijzigde functionele bestanden

- `src/core/runtime.js`: fysieke rekeningfilter voor gezamenlijke inkomensuitsplitsing en bronklik.
- `src/import/runtime.js`: bestaande legacybasisvergelijking hergebruikt bij cloudrefresh.
- `app.js`: gegenereerd met de bestaande build.
- `tests/income-overview.test.cjs`, `tests/browser/income-overview.spec.cjs`: rekening-, refund- en alleen-lezen regressies.
- `tests/browser/import-history-readonly.spec.cjs`, `tests/browser/import-history-cloud-refresh.spec.cjs`: oude imports, reload en echte concurrerende lokale wijzigingen.
- `index.html`, `service-worker.js` en bestaande versiecontracttests: uitsluitend de consistente releasemarker bijgewerkt.

Oudere CSV's zonder betrouwbare source identity blijven leesbaar; de bestaande blokkade op onveilige edit/remove blijft behouden. Bij een echte gewijzigde lokale kopie wordt de guard niet omzeild. Er is geen nieuwe migratie of financiële productregel.
