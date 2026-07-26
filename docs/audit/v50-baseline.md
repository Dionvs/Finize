# Finize v50-baseline

De technische opschoning gebruikt uitsluitend commit
`36696c5c5081eed21a4eafa0b2d2c90a41562d2a` als functionele en visuele
referentie. De herstel-tag is `v50-audit-baseline`.

## Gecontroleerde Git-blobs

| Bestand | Bytes | SHA-256 |
|---|---:|---|
| `index.html` | 953053 | `92ae487875d88358193005476672538fd7d9b7977c111445ae0cad734f424c69` |
| `update4.js` | 125444 | `f9fb3000507b7af4bdc8747bca8ab0dfb8f69102303716227adc00b7b56a5215` |
| `update4.css` | 14436 | `db7eafb2aca30f0eed973b0e3bbeb4c299894955cd8218ec73200fa5fe25c5a7` |
| `service-worker.js` | 1377 | `b8db43bbb8992a35e80b86f57f765c689ea37d2b6235a53a1a38e751f6262995` |
| `firebase.json` | 56 | `e87125f3ec6439a59ba44d80a6dcc46378a27a0644b0cda30abeafd2efb67e20` |
| `firestore.rules` | 636 | `e08800c22d8dc555640a2ff9da60a18a526e29dc7eb113d9607f0140bd51bfd9` |
| `README.md` | 7865 | `7f6aef9a9465d5181e37f096aeeddf9318922344b86941f81046f04e96d40713` |

De hashes zijn over de ruwe Git-blobs berekend. CRLF-regelafbrekingen in een
Windows-werkmap mogen niet als afwijking van de baseline worden behandeld.

## Lokale herstelkopieën

Voor de eerste wijziging is onder `backups/` een gedateerde, door
`git bundle verify` gecontroleerde Git-bundle en een Firestore-export gemaakt.
De aanvullende zip is een Windows-werkmapkopie en kan CRLF-regelafbrekingen
bevatten; de Git-bundle bewaart de exacte repository-objecten. Deze bestanden
bevatten mogelijk financiële data en worden daarom nooit gecommit.

De Firestore-export bevat het hoofddocument, één importheader en één chunk. Er
zijn geen cloudgegevens gewijzigd.

## Vastgelegde grenzen

- Schema v9, opslagkeys, IndexedDB-databases en Firestore-paden blijven gelijk.
- De v50-weergave, inclusief bekende mojibake en de bestaande
  spaardoel-progressiebalk, is de visuele baseline.
- Authenticatie en dataherstructurering vallen buiten deze opschoning.
- Publicatie gebeurt pas na één volledig geteste eindmerge.
