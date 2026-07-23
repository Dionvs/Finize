# Finize Update 4 — voortgang

## Fase 0 — Analyse en veiligheidsbasis

- Status: afgerond
- Basis: commit `649f1de`
- Branch: `agent/update4-slimme-bankimport`
- Back-up: `backups/update4-start-20260723/`
- Bestaande tests: Update 2 en Update 3 groen
- Bevindingen:
  - huidige import is vluchtig en schrijft regels naar `transactionReviewQueue`;
  - kernopslag is één localStorage/Firestore-document;
  - IndexedDB bestaat al voor spaardoelfoto's;
  - Update 3 bevat al transactiereview, vaste lasten, inkomsten, voorschotten en maandafsluiting;
  - echte ING-testexports ontbreken nog.
- Bugs/risico's:
  - service-worker-cache moet bij afronding worden verhoogd;
  - Firestore-kerndocument mag niet door ruwe importhistorie boven de limiet groeien.
- Resterend: fasen 1 t/m 7.

