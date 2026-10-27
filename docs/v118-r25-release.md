# V118-r25 — visuele schermindeling

Publicatie expliciet geautoriseerd op 27 oktober 2026. Basis is V118-r24, commit `cfc576f34fa0e28a65083a441d483a12b96a269e`.

## Wijziging

De goedgekeurde responsive-indeling wordt gepubliceerd: passende mobiele KPI-kaarten, gestapelde budgetten/transacties en spaardoeldetails op smallere schermen, doorlopende periodeknoppen en een compacte springlink naar de bestaande importacties. Tekstformaten, infoknopjes en financiële berekeningen blijven behouden. Zie [implementatie en beperkingen](visual-responsive-fit-20261027.md).

`index.html` en de serviceworker gebruiken samen `118-r25` / `finize-v118-r25`. De cachewerking en opslagcode zijn niet gewijzigd; alleen de releaseaanduidingen zijn verhoogd. Alle bestaande actuele versieasserties zijn bijgewerkt.

## Releasecontrole

Op de publicatieversie slagen alle **86 Node-testbestanden** en **14 gerichte browsertests**. Syntax, CSS, reproduceerbare build en `git diff --check` slagen eveneens.

De gerichte browserronde combineert de twaalf layoutcontroles met offline herladen bij een aanwezige verouderde cache en een echte serviceworkerwissel van de gepinde r24-code naar r25, offline herladen en terugrollen naar r24. De laatste proef vergelijkt transacties, budgetten, inkomsten, vaste lasten, spaardoeladministratie, saldo-ijkpunten, maandsnapshots, prognoses, importbronregels, journal, wachtrij en lokale opslag vóór en na de wissel. Alle gegevens zijn synthetisch; externe backends zijn geblokkeerd.

De eerdere implementatiecontrole omvatte 86 geslaagde Node-testbestanden en 46 geslaagde gerichte browsertests. De drie oude prognosetests en twee onderzochte oude desktoptests falen ook met de oorspronkelijke code; dit is geen volledig groene oude regressiesuite. Deze release verandert hun prognose-inhoud niet.

Lokale releasebewijzen staan in `.cache/responsive-fit/r25-unit.log` en `.cache/responsive-fit/r25-browser.log`. De gegenereerde bestanden worden gecontroleerd met `node scripts/build.mjs --check`, de syntax-/CSS-controles en `git diff --check`.

## Publicatiecontrole

Publicatiedoel: `main`, GitHub Pages vanuit de repositoryroot, <https://dionvs.github.io/Finize/>. Na de Pages-deployment worden HTTP-status, versieaanduidingen, inhoudshashes van de publieke assets en de visuele schermindeling gecontroleerd. Er worden tijdens de publieke controle geen financiële acties uitgevoerd.
