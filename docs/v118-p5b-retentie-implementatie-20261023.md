# P5b — goedgekeurd bewaarbeleid lokaal geïmplementeerd

**Vervolgstatus:** de backendupdate en gerichte TTL-policy zijn inmiddels in Google Cloud uitgevoerd en gecontroleerd. Zie [clouduitrol](v118-p5b-clouduitrol-20261023.md). De onderstaande tekst bewaart de lokale implementatiestap; bankgebruik blijft uitgeschakeld.

23 oktober 2026. Het akkoord op de termijnen is verwerkt in lokale code. Geen deployment, publicatie, TTL-activering, bankautorisatie, cloudwijziging of verwijdering uitgevoerd in deze stap. De frontend en gedeployde bankroutes blijven uitgeschakeld.

## Gedrag

- De vaste rekeningbinding staat afzonderlijk in `account-binding`: profielscope, rekeninghash en hash van de ingestelde IBAN. Dit record krijgt geen TTL. Herautorisatie blijft dezelfde identiteit controleren wanneer een verlopen sessierecord is verdwenen.
- `connection-control` bewaart afzonderlijk de intrekkingsgeneratie, zonder TTL. Intrekking maakt eerder begonnen autorisaties ongeldig, ook wanneer de callback op dat moment nog met de provider communiceert.
- Tijdelijke state en synchronisatievergrendeling krijgen het native Firestore Timestamp-veld `finizeBankExpiresAt`, op 24 uur na hun oorspronkelijke vervalmoment. Actieve en oude sessiereferenties krijgen dit veld op 7 dagen na hun oorspronkelijke toestemmingsverloop.
- Lege tijdelijke records zijn na 24 uur opruimbaar. Statuslezingen en herhaalde intrekkingen schuiven de oorspronkelijke geldigheid van een sessie niet op.
- Bestaande verbindingen worden transactioneel gesplitst voordat ze TTL krijgen. Een ontbrekende vaste binding bij een reeds gemigreerde verbinding blokkeert gebruik en nieuwe autorisatie. Onbekende of ongeldige sessievervaldatums krijgen geen automatische verwijdertermijn; deze blijven beschikbaar voor intrekking of beoordeling.
- Intrekking blokkeert lokaal eerst toegang en bewaart de benodigde oude sessiereferentie voordat de provider wordt aangeroepen. Per expliciete intrekkingsactie worden maximaal vijf openstaande sessies behandeld. Bij resterende of mislukte intrekkingen blijft de melding onbevestigd en kan de gebruiker opnieuw proberen. Bekend verlopen sessies vereisen geen provideroproep meer.
- Transacties, saldobronnen, financiële goedkeuringen en CSV-/API-bronbewijzen krijgen geen TTL. Er is geen delete-permissie toegevoegd en geen scheduler gebouwd.

De opslag gebruikt native Firestore-transacties en Timestamp-velden. De opslagadapter is begrensd tot toegestane documenten onder `finizeBankPrivate/ing/metadata`.

## Verificatie

- 40 gerichte Node-tests geslaagd: backend, configuratie en provideradapter. Hieronder vallen verlopen/gebruikt state vóór en na opruimen, behoud van de rekeningidentiteit, oorspronkelijke vervaltermijnen, mislukte intrekking, migratie en gelijktijdige callbacks/intrekking.
- Vier tests tegen een echte lokale Firestore-emulator geslaagd: native Timestamp-typen en padbeperking, atomair terugdraaien bij een fout, vijf gelijktijdige transacties en de begrensde query naar openstaande intrekkingen. Deze emulator gebruikt uitsluitend het demoproject `demo-finize-bank-retention` op `127.0.0.1:8189`; de test weigert andere bestemmingen.
- Tien gerichte browsertests geslaagd op mobiel en desktop. De extra controle toont een nog openstaande intrekking ook na opnieuw openen. Bestaande controles op rekeningstand, expliciete financiële goedkeuring, CSV/API-overlap en duurzaam herladen slagen.
- Lokale SDK-/grenscontroles, syntax, reproduceerbaarheid van de gegenereerde app en diffcontrole geslaagd. Geen volledige regressiesuite of productieproef met een echte banksessie uitgevoerd.
- Alleen-lezen cloudcontrole: `finizeBankExpiresAt` heeft geen TTL-configuratie; de collectiegroup `metadata` bevat geen andere geconfigureerde TTL-velden en geen bestaande documenten met het nieuwe veld. De volledige lijst had geen vervolgpagina. Er zijn geen policies gewijzigd. Een eerste gefilterde veldquery mislukte; de geslaagde hercontrole gebruikte alleen een projectie van documentnamen en het vervalveld, zonder financiële inhoud.

## Voorbereide cloudstap

`functions/retention/finizeBankExpiresAt.field.json` bevat uitsluitend de beoogde native veldpolicy. Deze is niet toegepast. Vóór latere activering moet de controle op bestaande policies/veldgebruik opnieuw worden uitgevoerd. Pas dan kan uitsluitend `ttlConfig` op dit veld worden gewijzigd; geen algemene regels-/indexdeployment. Firestore verwijdert asynchroon en de applicatie blijft vervaltijden zelf controleren.

De volgende uitrolstap omvat de backendupdate en gerichte TTL-activering, gevolgd door controle van de werkelijke configuratie. Activering van bankgebruik en publicatie van Finize blijven apart. De lokale privacytekst claimt terecht nog geen actieve automatische opschoning.

## Bestanden

Nieuw: `functions/src/bank-retention.mjs`, `functions/retention/finizeBankExpiresAt.field.json`, `tests/v118-p5b-retention-emulator.test.mjs` en dit verslag. Aangepast: `functions/src/index.mjs`, `functions/src/enable-banking.mjs`, `src/ui/bank-connection.mjs`, gerichte backend-/browsertests en gegenereerde `app.js`. Bestaand ander werk is behouden. Herstelkopieën staan buiten de repository onder `C:/Users/dionv/AppData/Local/Finize/p5b-retentie-20261023/`.
