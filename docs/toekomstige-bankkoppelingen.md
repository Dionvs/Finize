# Toekomstige bankkoppelingen

Status: ontwerpnotitie bij V118, 14 oktober 2026. **P5b is uitgesteld tot een concrete provider is gekozen.** Deze release bevat geen provideradapter, live bankverbinding of productie-recordcutover.

## Bestaande contracten

| Grens | Bestaande implementatie en afspraak |
|---|---|
| Bankinvoer | `src/import/bank-input-contract.mjs`, versie 1: staging-envelopes voor `bank-transaction`, `balance-observation` en `coverage`. Validatie is geen boeking of goedkeuring; oorspronkelijke payload of payloadverwijzing blijft bewijs. |
| Fysieke rekening | `accountProfiles` en `src/core/account-profiles.mjs`: stabiel profiel-ID, onafhankelijk van naam of weergave. Een providerrekening moet aantoonbaar aan precies één fysiek profiel worden gekoppeld. Archiveren bewaart geschiedenis. |
| Werkelijke stand | `src/core/balance-checkpoints.mjs`: gedateerde saldo-waarneming als uitgangspunt, gevolgd door afzonderlijke bankbronnen. Een saldo is geen maandruimte. Brondekking, conflicten en onbekende invoer blijven zichtbaar. |
| Bronidentiteit | `src/core/bank-sources.mjs` en `src/import/import-identity.mjs`: bron, verwerking en expliciete goedkeuring zijn gescheiden. Bank-ID's vereisen een betrouwbare autoriteit; gelijke bedragen, datum of tekst zijn geen identiteitsbewijs. |
| CSV naast provider | CSV blijft de bestaande route. De P5a-envelop vervangt geen parser. Cross-import/cross-provider deduplicatie moet bewezen bronrelaties gebruiken en mogelijke duplicaten onderscheiden van bewezen dezelfde bron. |
| Voorstellen | `src/import/runtime.js`: één herkenningsroute, rekeningcontext en optionele herkomst. P4-voorstellen activeren geen financiële effecten; de bestaande centrale goedkeuringsroute blijft beslissend. |
| Verwerking | `src/core/transaction-processing.mjs`: dezelfde bron wordt eenmaal verwerkt, met individuele splits en financiële links. Een provider mag deze idempotentie of immutable bankvelden niet omzeilen. |
| Synchronisatie | Bestaande IndexedDB-/Firestore-envelope, operation receipts, CAS, journals en conflictbehoud. Geen stille last-write-wins bij afwijkende goedkeuringen, rekeningidentiteit of saldo-waarnemingen. |
| Toegang | V118 gebruikt de afgesproken tijdelijke huishoudtoegang: beide leden beheren gezamenlijke én persoonlijke rekeningen. Dit is geen bewijs van serverafgedwongen providerautorisatie of persoonlijke gegevensisolatie. |

## Vragen die pas met de provider kunnen worden beslist

- Welke IDs zijn stabiel per bankrekening, geboekte betaling en correctie? Overleven ze reconnect, consentvernieuwing, paging en een andere provider?
- Hoe worden pending, geboekt, gecorrigeerd, ingetrokken en teruggedraaide transacties gemodelleerd? P5a stelt niet-ondersteunde pending/veranderende gebeurtenissen uit; er is geen toestemming om daar nu financiële boekingen van te maken.
- Welk bewijs verbindt pending met geboekt, correctie met origineel en CSV met provider? Een afgeleide fingerprint mag ontbrekend bankbewijs niet vervangen.
- Wat betekent het providersaldo: booked/available, tijdstip, tijdzone, valuta, kaartreserveringen? Welk ijkpunt hoort daarbij en tot waar is de transactiedekking volledig?
- Zijn pagination, terugkijktermijn, webhookvolgorde, herhaling en ontbrekende periodes aantoonbaar controleerbaar? Hoe worden bronbytes en providerrevisies behouden?
- Hoe blijven werkelijk gekoppelde salaris-/vaste-last-occurrences, interne transferparen, refunds en spaarinlegrelaties geldig bij reversals of gewijzigde bankbronnen?
- Waar worden credentials/consents veilig beheerd, en wie autoriseert welke rekening? Browsercode mag geen bankgeheimen bevatten. Account-/huishoudwissel, intrekken van toestemming, reconnect en privacy vereisen expliciet ontwerp en verificatie.
- Welke quota, bewaartermijnen, toepasselijke contractuele vereisten en herstelmogelijkheden levert de gekozen provider?

## Voorwaarde voor P5b

Kies eerst een concrete provider en leg de bovenstaande antwoorden vast met diens daadwerkelijke documentatie en testgegevens. Ontwerp daarna de kleinste adapter op het bestaande invoer-, bron-, goedkeurings- en opslagcontract. Test in een afgescheiden omgeving, inclusief idempotentie, dekking, correcties, autorisatie, conflictsituaties en herstel. Geen fictieve provideradapter, nieuwe financiële motor of backendactivering als onderdeel van V118.
