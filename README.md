# Simulatore investimenti (v2)

Web app installabile (PWA) per fare proiezioni **ipotetiche** di fondi, ETF e titoli: capitale iniziale, versamento mensile (PAC), costi, bollo, tasse italiane e inflazione. Strumento educativo, non consulenza.

## Cosa fa
- **Risultati**: riquadri riassuntivi, grafico anni × valore (20 anni di default, modificabili), una linea per titolo più Totale e Soldi versati, accese/spente dalla lista a sinistra. Fascia pessimista–ottimista, interruttori "netto tasse" e "in euro di oggi". Tabella con versato, tre scenari, guadagno, tasse, "costo dei costi" e rendimento netto annuo.
- **Lettura da foto o PDF** (v2): "Scatta foto" o "Foto o PDF" nella pagina Titoli; Gemini legge nome, ISIN, tipo, SRI e costi dalla scheda/KID e li evidenzia in giallo da controllare. Serve una chiave Gemini (Impostazioni), che resta solo sul dispositivo. Se un modello è sovraccarico l'app ne prova altri da sola.
- **Dove vanno i costi** (v2.3): toccando il riquadro "Costo dei costi" si apre un pop-up con i costi in euro voce per voce e a chi vanno (banca, società di gestione, mercato, uscita), la crescita persa e cosa va allo Stato (bollo e tasse al ritiro).
- **Andamento storico** (v2.2): "🔎 Cerca andamento storico" chiede a Gemini con ricerca Google i rendimenti annualizzati 1/3/5/10 anni dall'ISIN (richiede che la chiave abbia la ricerca disponibile: sul piano gratuito spesso no); in alternativa la foto del factsheet legge anche i rendimenti passati. La proposta riaggiunge i costi annui del prodotto (lo storico è già al netto), limita il medio al 10% e prende un pessimista prudente.
- **Titoli di riferimento** (v2.1): spunta "Solo riferimento" su un titolo (es. un ETF indice) per vederlo nel grafico a puntini, simulato con gli stessi soldi dei titoli reali accesi, senza farlo entrare nel totale.
- **Titoli**: nuovo / modifica / duplica / elimina; tutti i costi (ingresso, fisso per rata, spese correnti, transazione, performance, uscita), quota in titoli di Stato (12,5%), tre rendimenti ipotetici con valori indicativi per tipo; ripartizione di una cifra unica in percentuali.
- **Impostazioni**: backup Excel (cartella a scelta su PC con Chrome/Edge, altrimenti download), backup automatico, ripristino da Excel, chiave e modello Gemini, anni, inflazione, aliquote, bollo, tema.
- Funziona offline dopo la prima apertura. I dati restano solo sul dispositivo e nel file Excel.

## Come sono fatti i calcoli (`calc.js`)
Mese per mese: rendimento netto annuo = rendimento lordo − (spese correnti + transazione + performance), composto mensilmente; ingresso e costo fisso tolti da capitale e da ogni rata; bollo 0,2% sul valore a fine anno; alla vendita costo di uscita e tasse sul guadagno (26% / 12,5% sulla quota titoli di Stato). Verificato con l'analisi dei fondi Eurizon (30.000 € + 500 €/mese, 6% lordo): fondo 2,2% + 3% ingresso → 112.682 € a 10 anni, ETF 0,2% → 133.128 €.

## Provarla sul PC senza pubblicarla
Apri un terminale nella cartella e lancia `python -m http.server 8000`, poi vai su http://localhost:8000. (Aprendo `index.html` con doppio clic funziona quasi tutto, ma non l'installazione né l'uso offline.)

## Pubblicarla (GitHub Pages)
Carica il contenuto di questa cartella in un repository GitHub, poi Settings → Pages → "Deploy from a branch" → `main` / root. L'indirizzo sarà `https://<utente>.github.io/<repository>/`. Dal telefono: apri l'indirizzo e scegli "Installa app" / "Aggiungi a schermata Home".

## Librerie incluse (`lib/`)
Chart.js 4.4.1 (MIT) e SheetJS 0.18.5 (Apache 2.0), copiate in locale per l'uso offline.
