# 🍝 Ricettario

Ricettario personale che funziona su **PC, tablet e telefoni Android** (anche offline), installabile come app.
È una PWA in HTML/CSS/JavaScript puro: niente server, niente compilazione, niente dipendenze.
I dati restano sul dispositivo e si sincronizzano con un **repository GitHub privato**.

## Funzioni

- **Ricette**: elenco con ricerca (anche per ingrediente), categorie, tag, preferite, voti, ordinamento (recenti, più votate, più cucinate, più veloci, da riscoprire), pulsante "Ispirami".
- **Importazione**
  - *Incolla testo*: titolo, porzioni, tempi, difficoltà, ingredienti, passaggi e note vengono riconosciuti in automatico.
  - *Da un link*: legge i dati strutturati (schema.org/Recipe) usati dalla maggior parte dei siti di ricette (GialloZafferano, Cookist, BBC Good Food…).
  - *Bookmarklet* per PC: un pulsante nei preferiti che manda la ricetta della pagina aperta al Ricettario.
  - *Condividi → Ricettario* su Android (con l'app installata).
  - Avviso se la ricetta esiste già.
- **Dettaglio ricetta**: porzioni ricalcolabili, ingredienti da spuntare, indicazione di cosa hai già in dispensa, passaggi con **timer** cliccabili ("cuocete 10 minuti" → ⏱), stampa, condivisione, duplicazione, foto personale.
- **Modalità cucina**: un passaggio per schermata a caratteri grandi, schermo sempre acceso, scorrimento col dito o con le frecce.
- **Dispensa e "Cosa cucino?"**: inserisci cosa hai in casa (con scadenze facoltative) e ottieni le ricette ordinate per ingredienti disponibili, con priorità a quelli in scadenza. Puoi indicare gli ingredienti da usare per forza e quanti ne possono mancare. Gli ingredienti "sempre in casa" (sale, olio…) non contano come mancanti. Il confronto riconosce singolari/plurali e nomi generici ("pasta" vale per spaghetti, penne…).
- **Lista della spesa**: aggiungi gli ingredienti di una ricetta (scalati, senza quelli che hai già), somma automatica delle quantità, divisione per reparto, condivisione, "sposta in dispensa" a fine spesa.
- **Menu settimanale**: pranzo e cena per ogni giorno, riempimento automatico delle cene, lista della spesa della settimana.
- **Sincronizzazione GitHub** automatica, con unione delle modifiche fatte su più dispositivi.
- Backup/ripristino JSON, tema chiaro/scuro, statistiche, ricette di esempio.

## 1. Pubblicare l'app (repository del codice)

1. Crea un repository su GitHub, per esempio `ricettario`, e carica tutti i file di questa cartella.
2. Nel repository vai su **Settings → Pages**, in *Build and deployment* scegli **Deploy from a branch**, branch `main`, cartella `/ (root)`, e salva.
3. Dopo un minuto l'app è online su `https://<tuo-utente>.github.io/ricettario/`.

> GitHub Pages gratuito richiede che il repository del **codice** sia pubblico. Va bene: il codice non contiene nessun dato né token. I tuoi dati stanno nel repository privato (punto 2).

## 2. Repository privato per i dati

1. Crea un secondo repository **privato**, per esempio `ricettario-dati`, spuntando "Add a README" (così ha già il branch `main`).
2. Crea un token: **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
   - *Repository access*: **Only select repositories** → solo `ricettario-dati`
   - *Permissions → Repository permissions → Contents*: **Read and write**
   - Scadenza a piacere (es. 1 anno; alla scadenza basta crearne uno nuovo).
3. Apri l'app → **Altro** → inserisci utente, nome del repository dati e token → **Salva** → **Verifica connessione**.
4. Ripeti il punto 3 su ogni dispositivo.

I dati finiscono nel file `ricettario.json` (JSON leggibile) e le foto scattate dall'app nella cartella `images/`. Ogni modifica è un commit, quindi la cronologia di GitHub permette di recuperare qualsiasi versione precedente.

### Sicurezza

- Il token è salvato **solo** nel browser del dispositivo (IndexedDB), mai nel repository.
- Usa un token *fine-grained* limitato al solo repository dei dati: anche se venisse letto, darebbe accesso solo alle ricette.
- La verifica della connessione avvisa se il repository dei dati è pubblico per errore.

## 3. Installare l'app

- **Android (Chrome)**: apri l'indirizzo dell'app → menu ⋮ → **Installa app** (o "Aggiungi a schermata Home"). Da quel momento compare tra le app di condivisione: da una ricetta in Chrome, *Condividi → Ricettario*.
- **PC (Chrome/Edge)**: icona di installazione nella barra degli indirizzi.
- **Tablet**: come Android.

## Importare dai siti

- Il download delle pagine passa da un proxy CORS pubblico (di default `api.allorigins.win`, con altri due come riserva) perché i browser non permettono a una pagina di leggere un altro sito. Il proxy vede solo l'indirizzo della ricetta. Puoi cambiarlo in *Altro → Importare ricette dal web* (`{url}` viene sostituito dal link).
- Se un sito blocca il proxy: usa il **bookmarklet** (gira direttamente sulla pagina aperta, senza proxy) oppure copia il testo e usa **Incolla testo**.

## Sviluppo in locale

Serve solo un server statico (i moduli JavaScript non funzionano aprendo il file direttamente):

```bash
python -m http.server 8765
```

e poi apri `http://localhost:8765`.

Quando pubblichi una nuova versione, cambia `VERSION` in `sw.js` così i dispositivi aggiornano la cache offline.

### Struttura

| File | Contenuto |
|---|---|
| `index.html`, `css/styles.css` | Struttura e stile (responsive, tema chiaro/scuro) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installazione come app, funzionamento offline, condivisione da Android |
| `js/app.js` | Avvio, navigazione, sincronizzazione automatica |
| `js/store.js`, `js/db.js` | Dati locali (IndexedDB) e unione tra dispositivi |
| `js/github.js` | Lettura/scrittura del file dati e delle foto su GitHub |
| `js/parser.js` | Riconoscimento di ingredienti, testo incollato e pagine web |
| `js/match.js` | Confronto ingredienti/dispensa e reparti della spesa |
| `js/ui.js` | Componenti condivisi: foto, finestre, timer, modalità cucina, lista spesa |
| `js/views.js`, `js/views-home.js` | Le schermate |
| `js/samples.js` | Ricette di esempio |

### Formato dei dati (`ricettario.json`)

```json
{
  "app": "ricettario", "schema": 1,
  "recipes": [{ "id": "…", "title": "…", "servings": 4, "ingredients": ["320 g di spaghetti"], "steps": ["…"],
                "tags": [], "rating": 0, "favorite": false, "createdAt": 0, "updatedAt": 0 }],
  "pantry": [{ "id": "…", "name": "uova", "expiry": "2026-11-02" }],
  "shopping": [{ "id": "…", "name": "farina", "qty": 500, "unit": "g", "checked": false }],
  "plan": [{ "id": "…", "date": "2026-10-23", "meal": "cena", "recipeId": "…" }],
  "prefs": { "staples": ["sale", "pepe"] }
}
```

Gli elementi eliminati restano per 180 giorni come `{ "id", "deleted": true }`, così la cancellazione si propaga a tutti i dispositivi.
