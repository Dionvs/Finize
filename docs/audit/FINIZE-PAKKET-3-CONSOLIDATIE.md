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

## Volgende componenten

3.2–3.3: alleen aantoonbaar overschreven of ongebruikte implementaties consolideren; twijfelgevallen behouden. 3.4: alleen bewezen cacheduplicatie. 3.5: CSS uitsluitend per component met vóór/na-bewijs. 3.6: onderruimte is in de geaccepteerde herstelronde al gecorrigeerd. 3.7: alleen actieve metadata, geen historische opslag-/cache-identificaties. 3.8: gerichte controles en rapportage, geen volledige testvolrun.
