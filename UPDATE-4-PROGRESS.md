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

## Fase 1 — Datamodel, migratie en opslag

- Status: afgerond
- Gewijzigd: `index.html`, `update4.js`, migratie-/opslagtest
- Uitgevoerd:
  - schema v5 en compatibiliteitsprojectie voor transacties;
  - rekeningprofielen, importsamenvattingen, spaardoelledger, vervangingsarchief en inkomensoverrides;
  - opschoning van eigenaarvelden uit herkenningsregels;
  - IndexedDB-stores voor imports, journal en syncwachtrij;
  - importchunks tot circa 700 kB en maximaal 200 regels;
  - afzonderlijke Firestore-importdocumenten;
  - herstel van een onderbroken pending journal.
- Tests: v1-v4-achtige normalisatie, idempotentie, eigenaarvelden en chunking.
- Resterend: fasen 2 t/m 7.

## Fase 2 — CSV-importmotor

- Status: afgerond met synthetische ING-fixtures
- Uitgevoerd:
  - quote- en newline-veilige CSV-tokenizer;
  - ING-formaat- en kolomdetectie plus generieke mapping;
  - rekeningprofielherkenning op genormaliseerd IBAN;
  - onveranderbare banklaag, import-ID's en fingerprints;
  - duplicaatcontrole op originele bankgegevens;
  - regelprioriteit tegenrekening, omschrijving, organisatie, zoekwoord en voorspelling;
  - Zeker/Nakijken met conflict- en bijzondere-verwerkingsredenen;
  - salaris, overige inkomsten, sparen en interne overboekingen altijd Nakijken.
- Tests: Dion-, Dara- en gezamenlijke ING-fixture, overlap, conflict en eigenaar-isolatie.
- Openstaand: definitieve controle met drie echte geanonimiseerde ING-exports.
- Resterend: fasen 3 t/m 7.

## Fase 3 — Full-screen importinterface

- Status: afgerond
- Uitgevoerd:
  - gedeeld dashboardblok op desktop en mobiel;
  - full-screen conceptmodal met sticky verwerkingsactie;
  - Nakijken open, Zeker ingeklapt en duplicaten compact;
  - rekeningprofiel kiezen of aanmaken;
  - datum, bedrag, budgeteigenaar, categorie, type en status bewerken;
  - Meer opties, vaste last, spaardoel, voorschot, Niet meetellen, notitie en splits;
  - conceptwijzigingen direct naar IndexedDB;
  - maximaal drie importbonnetjes en alle-importsweergave;
  - beheerscherm voor regels zonder eigenaarvelden;
  - responsieve layout voor 384/430 px en desktop.
- Tests: UI-markers, externe assets en mobiele CSS-structuur.
- Resterend: fasen 4 t/m 7.

## Fase 4 — Definitieve financiële verwerking

- Status: afgerond
- Uitgevoerd:
  - technische validatie vóór iedere kernwijziging;
  - één idempotent effectplan en operation journal;
  - splits als afzonderlijke financiële regels met één fysieke bankmutatie;
  - salaris en overige inkomsten apart van uitgaven;
  - terugbetaling als negatieve uitgave;
  - Niet meetellen zonder budget-, inkomen- of spaardoelimpact;
  - originele bankmutatie voor rekeningcontrole;
  - vervanging van bevestigde handmatige matches met herstelarchief;
  - late import in afgesloten maand als `Correctie nodig`;
  - importsamenvatting na verwerking.
- Tests: splits, gesloten maand, fysieke rekeningmutatie, voorschottelling, invalidatie en idempotent opnieuw toepassen.
- Resterend: fasen 5 t/m 7.

## Fase 5 — Sparen, interne overboekingen en verrekenen

- Status: afgerond
- Uitgevoerd:
  - deterministische spaardoelledger met idempotente doelcorrectie;
  - voorgestelde paren voor twee kanten van een interne overboeking;
  - directionele voorschotten zonder automatische nettosaldering;
  - maandafsluiting maakt geen automatische voorschotaflossingen meer;
  - handmatig type `terugbetaling-voorschot` met oudste-eerst voorstel;
  - gedeeltelijke allocaties over open voorschotten;
  - dashboardkaart en detailvenster met persoon- en maandfilter.
- Tests: directionele tegengestelde saldi, oudste-eerst, spaardoelimpact en idempotentie.
- Resterend: fasen 6 en 7.
