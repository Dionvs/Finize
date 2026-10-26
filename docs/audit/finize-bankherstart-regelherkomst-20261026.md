# Bankherstart na V118-r14 — herkenningsregelherkomst

Uitgangsbasis: `7b564a5e1ad6ebe91a5a9ac1bb2c489c0013fda5`. Nieuwe herstelbranch `codex/bank-restart-block-diagnose-20261026`.

## Diagnose

De gebruiker meldt de specifieke hervattingsblokkade in fase Bestaande import lezen. De financiële cloudgeneratie is opnieuw uitsluitend gelezen en met de bestaande decoder geverifieerd. De permanente gezamenlijke binding wijst nog op de verwijderde rootimport. Tombstone en financieel verwijderbewijs zijn geldig en hebben dezelfde versie en operatie. De gelezen financiële staat is volledig en bleef tijdens lezen gelijk.

De huidige guard is eerst ongewijzigd op deze financiële staat in geheugen toegepast: bank-import-restart-blocked. Het enige gevonden verwijzingspad buiten het verwijderbewijs is `recognitionRules[].provenance.importBatchId`. Dit is een bewaarde herkomstvermelding van een eerder handmatig geleerde herkenningsregel. De brede recursieve r14-guard behandelt die ten onrechte als een actieve financiële afhankelijkheid.

De r14-browserfixture had de persoonlijke import goedgekeurd, maar de gezamenlijke import vóór verwijdering nog niet. Daardoor ontbrak juist de gezamenlijke geleerde regel. Dat ontbrekende productiegeval is nu toegevoegd. Een synthetische reproductie met bestaande materialisatie-, leer- en verwijderfuncties toont dezelfde fout met nul overgebleven financiële transacties en één bewaarde herkenningsregel.

De screenshot kan op zichzelf ook een andere controleconditie vertegenwoordigen. De hierboven beschreven concrete cloudconditie is rechtstreeks gereproduceerd; er is geen echte banksynchronisatie door Codex uitgevoerd.

## Vooraf beoordeeld minimaal herstel

ChatGPT heeft de diagnose en het aangescherpte voorstel beoordeeld en lokale implementatie met regressietests toegestaan. De uitzondering geldt uitsluitend voor het exacte veld `recognitionRules[index].provenance.importBatchId`, bij een geldig manual-approval herkomstbewijs met bronrij en tijdstip. Alleen de vier bestaande, ondersteunde provenancevelden zijn toegestaan; ontbrekend, ongeldig of onbekend bewijs schakelt de uitzondering uit.

`kind`, `sourceRowId` en `approvedAt` kunnen een herkenningsvoorstel onderbouwen. De importBatchId-waarde in deze regelherkomst verleent zelf geen actieve bronlink of goedkeuring. De overige provenancevelden en alle andere locaties worden volledig gecontroleerd. Het bestaande verwijderbewijs wordt alleen op zijn echte hoofdlocatie uitgezonderd, niet in willekeurige geneste objecten. Pending/conflict/uncertain journals en conflicterende queue blijven blokkeren.

Herkenningsregels, provenance, tombstone en financieel verwijderbewijs worden niet gewijzigd of verwijderd. Er is geen migratie, reparatie van productiegegevens, bankactie of wijziging van de financiële engine. De API-adapter zet nieuwe rijen nog altijd op Nakijken zonder goedkeuring.

## Gerichte verificatie

- 30/30 Node-tests: bestaande generatie-, bron-, cloud- en atomiciteitscontroles plus vijftien gerichte regelherkomstgevallen. Geldige meervoudige regelherkomst blijft behouden; ontbrekend/ongeldig bewijs, onbekende geneste velden, financiële/historische verwijzingen en journals/queue blijven blokkeren.
- 12/12 browsergevallen met echte IndexedDB: beide imports daadwerkelijk goedkeuren, gezamenlijke import verwijderen met bewaarde geleerde regel, annuleren/bevestigen/herladen/herhalen, daarna ook de nieuwe generatie expliciet goedkeuren en opnieuw bijwerken zonder dubbele effecten of verlies van goedkeuringen.
- De specifieke guard is daarna opnieuw uitsluitend in geheugen op de geverifieerde cloudstaat toegepast: dezelfde bewaarde herkomst, nu geen valse blokkade. Geen staging, opslaan of echte bankrequest op productie uitgevoerd.

Het afzonderlijke spaarvraagstuk is nog diagnose/afbakening; geen spaarbedrag, verdeling of brongegeven is hiervoor gewijzigd. Een volgende technische review en gecombineerde releasecontrole blijven vereist vóór publicatie.

Aanvullende reviewpunten zijn afgehandeld: kalendergeldige ISO-tijd en bronrij-identiteit volgen het bestaande handmatige leercontract; een tijdstip wordt niet als autorisatie gebruikt. Bestaande bronprefixen met `importId:rowId` blijven herkend. Ook de legacy replacement-identiteit wordt nu op de volledige bankimport-ID gecontroleerd, zodat een afzonderlijke generatie niet abusievelijk als de root wordt behandeld. Negatieve tests blokkeren oude replacement-afhankelijkheden; een expliciete rootverwijzing blijft ook in een childrecord blokkeren.

Na deze laatste bronwijziging slagen alle 77 bestanden van de volledige Node-run. ChatGPT heeft expliciet technisch akkoord gegeven voor lokale commit en volledige releasecontrole; nog geen merge/publicatie. De oude financiële/prognosecode is ongewijzigd.
