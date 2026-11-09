# Pakket 2 — bestanden en commits

Basispunt pakket 1: `6246bd5`. Alle wijzigingen staan uitsluitend lokaal op `herstel/pakket1-financiele-bugs`. Geen push of deployment.

## Implementatie-, test- en CI-commits

| Commit | Beschrijving |
|---|---|
| `9a782c8` | Classify existing Node and priority UI failures before test changes |
| `e28626b` | Repair classified Node fixtures and release checks; run all non-emulator Node tests |
| `88146bd` | Record genuine mobile goal-order regression and pause before application changes |
| `34df089` | Restore approved direct ordering on mobile goal cards |
| `7d845ad` | Repair classified UI fixtures and routes; isolate browser test servers |
| `3278339` | Run main quality checks and separate extended isolated emulator coverage |
| `9e8abc1` | Record approval focus regression and pause package 2 for decision |
| `458063d` | Preserve active import focus after approval changes its section |
| `cefe0c7` | Align classified financial UI regressions with current controls and durable save |
| `4aeace9` | Keep approved import focus regressions in automatic smoke coverage |
| `2ad27d5` | Name the sole separate emulator test explicitly in the Node inventory |
| `31889be` | Repair classified history fixtures, inline race hook and income forecast selectors |
| `40467cb` | Test current income routes, responsive cards and documented header geometry |
| `5f9d0a9` | test: compare recovery UI with independent current-main baseline |
| `acc57c1` | test: retain financial assertions on current savings and import routes |
| `28a2fa0` | test: initialise legacy import accounts before runtime validation |
| `f78b60e` | test: verify durable import boundaries and current forecast controls |
| `a29ff64` | test: verify current inline PWA shell and explicit bank and backup controls |
| `5069749` | test: check responsive containment and explicit savings proposals in current UI |
| `6f49fe0` | test: restore import lifecycle, account navigation and migration coverage |
| `f65bdf6` | test: expose negative mobile budget bar after refund regression |
| `02aabfa` | fix: clamp approved mobile refund budget bar without changing amounts |
| `f9d7d5e` | test: preserve income and fixed-expense history through current editors |
| `1c167f0` | test: verify savings coverage and explicit cancellation without weakening amounts |
| `d8db0fc` | test: verify reconstruction status, liquidity metadata and explicit suggestions |
| `468401b` | docs: record demonstrated mixed-income recognition decision |
| `cf3d9b2` | test: align dashboard and chart interactions with documented current UI |
| `63d4bee` | test: align record fixtures and document partial savings import blocker |
| `2a08958` | test: verify pinned upgrades and atomic approval against current inline release |
| `fa75aa1` | test: preserve financial contracts and record unresolved current UI limits |
| `1f8b5c3` | ci: keep manual scale tests separate from functional regression checks |

De verslagcommit met dit document komt bovenop deze lijst; zijn ID wordt in de oplevering vermeld.

## Volledig gewijzigd bestandsoverzicht

A = toegevoegd, M = gewijzigd. Gegenereerde appbestanden zijn via de bestaande build gemaakt; de financiële bronwijzigingen van pakket 1 horen bij het basispunt. Historische snapshotbestanden zijn behouden.

| Status | Bestand |
|---|---|
| A | `.github/workflows/verify-scale.yml` |
| M | `.github/workflows/verify.yml` |
| M | `.gitignore` |
| M | `app.css` |
| M | `app.js` |
| A | `docs/FINIZE-TESTEN.md` |
| A | `docs/audit/FINIZE-PAKKET-2-APPLICATIEBUG-01.md` |
| A | `docs/audit/FINIZE-PAKKET-2-APPLICATIEBUG-02.md` |
| A | `docs/audit/FINIZE-PAKKET-2-APPLICATIEBUG-03.md` |
| A | `docs/audit/FINIZE-PAKKET-2-BESTANDEN-EN-COMMITS.md` |
| A | `docs/audit/FINIZE-PAKKET-2-BEVINDING-04-HERKENNING.md` |
| A | `docs/audit/FINIZE-PAKKET-2-BEVINDING-05-PARTIELE-SPAARIMPORT.md` |
| A | `docs/audit/FINIZE-PAKKET-2-BEVINDING-06-UI-EN-TESTGRENZEN.md` |
| A | `docs/audit/FINIZE-PAKKET-2-CLASSIFICATIE.md` |
| A | `docs/audit/FINIZE-PAKKET-2-TEST-EN-CI-VERSLAG.md` |
| A | `docs/audit/FINIZE-PAKKET-2-TUSSENSTAND-2026-11-08.md` |
| A | `docs/audit/evidence/pakket2-bug03-360.png` |
| A | `docs/audit/evidence/pakket2-bug03-na-430.png` |
| A | `docs/audit/pakket2-bevinding04-bewijs.json` |
| A | `docs/audit/pakket2-bevinding05-bewijs.json` |
| A | `docs/audit/pakket2-bronbehoud.json` |
| A | `docs/audit/pakket2-browser-resultaten.json` |
| A | `docs/audit/pakket2-bug03-bewijs.json` |
| A | `firebase.bank-emulator.json` |
| M | `index.html` |
| M | `package.json` |
| M | `playwright.config.cjs` |
| A | `scripts/firebase-test-environment.mjs` |
| M | `scripts/run-node-tests.mjs` |
| M | `scripts/serve.mjs` |
| A | `scripts/test-bank-emulator.mjs` |
| M | `scripts/test-p3-emulator.mjs` |
| M | `src/core/runtime.js` |
| M | `src/import/runtime.js` |
| M | `src/styles/mobile-tabs.css` |
| M | `tests/browser/bank-import-generation.spec.cjs` |
| A | `tests/browser/budget-bar-refunds.spec.cjs` |
| M | `tests/browser/dashboard-selected-month.spec.cjs` |
| M | `tests/browser/desktop-special-tabs.spec.cjs` |
| M | `tests/browser/finize-audit-herstel.spec.cjs` |
| M | `tests/browser/fix-round-1-6.spec.cjs` |
| M | `tests/browser/fixed-payment-progress.spec.cjs` |
| M | `tests/browser/forecast-current-basis.spec.cjs` |
| M | `tests/browser/function-parity-goals-income.spec.cjs` |
| A | `tests/browser/helpers/test-origin.cjs` |
| M | `tests/browser/helpers/v118-ux-fixture.cjs` |
| M | `tests/browser/hotfix-migration-backup.spec.cjs` |
| A | `tests/browser/import-approval-focus.spec.cjs` |
| M | `tests/browser/import-history-cloud-refresh.spec.cjs` |
| M | `tests/browser/import-history-readonly.spec.cjs` |
| M | `tests/browser/import-review-simplification.spec.cjs` |
| M | `tests/browser/income-outlook.spec.cjs` |
| M | `tests/browser/income-overview.spec.cjs` |
| M | `tests/browser/iphone-responsive-text.spec.cjs` |
| M | `tests/browser/liquidity-pot-release.spec.cjs` |
| A | `tests/browser/mobile-goal-order.spec.cjs` |
| M | `tests/browser/mobile-recovery.spec.cjs` |
| M | `tests/browser/mobile-tabs-upgrade.spec.cjs` |
| M | `tests/browser/modal-and-commit-stability.spec.cjs` |
| M | `tests/browser/month-end-budget-timing.spec.cjs` |
| M | `tests/browser/month-end-savings.spec.cjs` |
| M | `tests/browser/p2-balance-date.spec.cjs` |
| M | `tests/browser/p2-release-upgrade.spec.cjs` |
| M | `tests/browser/package1-data-foundation.spec.cjs` |
| M | `tests/browser/package2-planning-timeline.spec.cjs` |
| M | `tests/browser/package3-transaction-engine.spec.cjs` |
| M | `tests/browser/package4-allowance-planning-correction.spec.cjs` |
| M | `tests/browser/package4-savings-refunds-forecast.spec.cjs` |
| M | `tests/browser/package5-import-lifecycle.spec.cjs` |
| M | `tests/browser/package6-functional-consolidation.spec.cjs` |
| M | `tests/browser/package7-release-audit.spec.cjs` |
| M | `tests/browser/responsive-fit.spec.cjs` |
| M | `tests/browser/savings-link-proposals.spec.cjs` |
| M | `tests/browser/storage-hotfix-2.spec.cjs` |
| M | `tests/browser/transaction-overview-design.spec.cjs` |
| M | `tests/browser/update6-account-navigation.spec.cjs` |
| M | `tests/browser/v113-csv-processing.spec.cjs` |
| M | `tests/browser/v117-p1.spec.cjs` |
| M | `tests/browser/v117-p2-migration.spec.cjs` |
| M | `tests/browser/v117-p2.spec.cjs` |
| M | `tests/browser/v117-p3.spec.cjs` |
| M | `tests/browser/v117-p4-budget-identity.spec.cjs` |
| M | `tests/browser/v117-p4-salary.spec.cjs` |
| M | `tests/browser/v117-p4-scale.spec.cjs` |
| M | `tests/browser/v117-p4-write-amplification.spec.cjs` |
| M | `tests/browser/v117-p4.spec.cjs` |
| M | `tests/browser/v117-p42-performance.spec.cjs` |
| M | `tests/browser/v117-p43-performance.spec.cjs` |
| M | `tests/browser/v117-p44-group-recovery.spec.cjs` |
| M | `tests/browser/v117-p44-performance.spec.cjs` |
| M | `tests/browser/v117-p44-period-window.spec.cjs` |
| M | `tests/browser/v117-p44-release-safety.spec.cjs` |
| M | `tests/browser/v118-p1-balances.spec.cjs` |
| M | `tests/browser/v118-p1b-accounts.spec.cjs` |
| M | `tests/browser/v118-p2-liquidity.spec.cjs` |
| M | `tests/browser/v118-p3-dashboard.spec.cjs` |
| M | `tests/browser/v118-p4-suggestions.spec.cjs` |
| M | `tests/browser/v118-p5b-bank.spec.cjs` |
| M | `tests/browser/v118-p5b-three-accounts.spec.cjs` |
| M | `tests/browser/v118-prognose-correctie.spec.cjs` |
| M | `tests/browser/v118-prognose-periodes.spec.cjs` |
| M | `tests/browser/v118-r4-release.spec.cjs` |
| M | `tests/browser/v118-r40-startup-upgrade.spec.cjs` |
| M | `tests/browser/v118-release-safety.spec.cjs` |
| M | `tests/browser/v118-ux-minimal.spec.cjs` |
| M | `tests/browser/v118-vrij-spaardoel.spec.cjs` |
| M | `tests/browser/v50-visual-baseline.spec.cjs` |
| A | `tests/browser/v50-visual-baseline.spec.cjs-snapshots/r46-1024.png` |
| A | `tests/browser/v50-visual-baseline.spec.cjs-snapshots/r46-1440.png` |
| A | `tests/browser/v50-visual-baseline.spec.cjs-snapshots/r46-360.png` |
| A | `tests/browser/v50-visual-baseline.spec.cjs-snapshots/r46-390.png` |
| A | `tests/browser/v50-visual-baseline.spec.cjs-snapshots/r46-430.png` |
| A | `tests/browser/v50-visual-baseline.spec.cjs-snapshots/r46-768.png` |
| M | `tests/fix-round-1-6.test.cjs` |
| A | `tests/fixtures/main-r46-computed-styles.json` |
| A | `tests/fixtures/main-r46-layout.json` |
| M | `tests/forecast-current-basis.test.cjs` |
| A | `tests/helpers/release-shell.cjs` |
| M | `tests/helpers/v117-p4-browser.cjs` |
| M | `tests/html-inline-syntax.test.cjs` |
| M | `tests/package7-release-audit.test.cjs` |
| M | `tests/service-worker-cache.test.cjs` |
| M | `tests/update4-final-regression.test.cjs` |
| M | `tests/update4-ui-structure.test.cjs` |
| M | `tests/update5-responsive-structure.test.cjs` |
| M | `tests/v117-p2.test.cjs` |
| M | `tests/v117-p4-salary.test.cjs` |
| M | `tests/v117-p4.test.cjs` |
