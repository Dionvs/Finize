# V118-r9 — gedocumenteerd toestemmingsadres ondersteunen

23 oktober 2026. Vervolg op [de r8-uitrol](v118-r8-bankkoppeling-release-20261023.md). De r8-site, backendactivering en TTL-policy zijn uitgevoerd en gecontroleerd. De eerste echte toestemmingsaanvraag werd door Enable Banking geaccepteerd, maar vervolgens door onze te beperkte adrescontrole geblokkeerd: `invalid-authorization-url`.

## Oorzaak en wijziging

De provider retourneert `https://tilisy.enablebanking.com`. De oorspronkelijke code accepteerde uitsluitend `https://auth.enablebanking.com`. Enable Banking documenteert beide adressen tijdens zijn migratie; de eigen productpagina toont het oude adres nog als voorbeeld voor POST /auth.

De gedeelde pure functie `src/import/bank-authorization-url.mjs` accepteert uitsluitend deze twee exacte HTTPS-origins, zonder gebruikersnaam/wachtwoord, op het pad `/ais/start` met optionele afsluitende slash. Andere domeinen, lookalikes, HTTP, afwijkende poorten en betaalroutes worden afgewezen. Frontend en backend gebruiken dezelfde broncontrole. De bestaande native Functions-build verpakt daarvan een kopie naast de al gedeelde opslagdecoder; geen tweede afwijkende controlelijst.

De backend logt bij een mislukte aanvraag uitsluitend een vaste routenaam, beperkte foutcode en status. Een extra lokale grenscontrole bevestigt dat vrije pad- en bodywaarden niet in deze diagnostiek komen. Geen request-URL, querystring, sleutel, token, autorisatiecode, bankresponse of IBAN wordt gelogd. Tijdelijke diagnostiek die alleen de afgewezen openbare hostnaam toonde is na vaststelling van de oorzaak verwijderd.

## Verificatie

- Alle 41 gerichte backend-/configuratie-/providergevallen geslaagd, inclusief beide geldige origins en afwijzing van onveilige adressen. Echte Functions-SDK-entry, vier HTTP-grenzen en privacy van foutdiagnostiek geslaagd.
- Alle 73 reguliere Node-testbestanden opnieuw geslaagd na de cacheversiewijziging.
- Alle 27 gerichte browsergevallen geslaagd: beide toestemmingsadressen via de echte bundel met synthetische toestemmingspagina, bankstatus, ophalen, intrekking, CSV/API-overlap, goedkeuring, duurzaam herladen, HTML-beveiliging en PWA-upgrade/rollback. De volledige eerdere brede browserverzameling is niet opnieuw uitgevoerd; de gedocumenteerde historische fouten uit r8 blijven daarvan onderscheiden.
- Syntax en reproduceerbare appbuild geslaagd. HTML, serviceworker en bijbehorende releaseverwachtingen gebruiken `118-r9`.
- Drie echte koppelpogingrecords gecontroleerd met alleen een projectie van vervalmetadata: echte Firestore Timestamp-velden, steeds exact 24 uur na oorspronkelijke poginggeldigheid. Geen sessie of bankinformatie daarvoor gelezen.
- Bronpakket van de definitieve backendcorrectie: SHA-256 `ac63f6896771707358fbfc916c6a058095f0a7b03f7860ea0848e9fca63e67a2`. Runtime-identiteit, bouwaccount, configuratie en IAM blijven behouden. Alleen broncode wordt bijgewerkt.

## Bestaand browserconflict

Via de normale exportknop is een lokale herstelkopie gemaakt: `C:/Users/dionv/Downloads/dion-dara-budget-backup-2026-10-23.json`. Deze bevat privégegevens en blijft buiten de repository.

De huidige drie lokale rekeningprofielen zijn alleen-lezen vergeleken met een stabiel gelezen cloudversie. Rekeningidentiteiten, bedragen en prognose-instellingen zijn gelijk. Alleen `updatedAt` en `lastAccountOperationId` van ING Dara verschillen; de cloudmetadata is nieuwer. Er is geen profielversie gekozen of overschreven. Daarnaast blijft een afzonderlijk `compact-state`-conflict met veilig bewaarde lokale importkeuzes zichtbaar. Dat vraagt beoordeling voordat werkelijk ophalen en synchroniseren wordt getest; er is geen oude keuze verwijderd.

## Afronding

Controleer na de backendupdate de werkelijke revisie en bronchecksum, en na de push de exacte Pages-commit plus de openbare bestanden. Open daarna opnieuw de toestemmingsroute vanuit het juiste profiel. De rekeninghouder rondt zelf voorwaarden en ING-toestemming af. Zonder die toestemming wordt geen API-banksessie geclaimd en er worden geen saldi of transacties opgehaald.

Bewijsstukken staan lokaal onder `C:/Users/dionv/AppData/Local/Finize/p5b-auth-20261023/`, `p5b-auth-origin-20261023/` en `p5b-authfix-20261023/`; deze bevatten operationele en privéconfiguratie en worden niet gepubliceerd.

Bronnen: [Enable Banking migratie van toestemmingsadressen](https://enablebanking.com/blog/2026/06/12/enable-banking-changelog-may-2026), [eigen POST /auth-voorbeeld](https://enablebanking.com/accounts-api/), [API-referentie](https://enablebanking.com/docs/api/reference/).
