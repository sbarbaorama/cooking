# 🍝 Ricettario

Ricettario personale che funziona su **PC, tablet e telefoni Android** (anche offline), installabile come app.
È una PWA in HTML/CSS/JavaScript puro: niente server, niente compilazione, niente dipendenze.
I dati restano sul dispositivo e si sincronizzano con un **repository GitHub privato**.

## Funzioni

- **Ricette**: elenco con ricerca (anche per ingrediente), categorie, tag, preferite, voti, ordinamento (recenti, più votate, più cucinate, più veloci, da riscoprire), pulsante "Ispirami".
- **Importazione**
  - *Incolla testo*: titolo, porzioni, tempi, difficoltà, ingredienti, passaggi e note vengono riconosciuti in automatico. Negli ingredienti una riga che finisce con `:` (es. `Per decorare:`) è il titolo di una sezione e non finisce nella lista della spesa; le righe brevi che iniziano con "Per" senza quantità (`Per la crema`) diventano sezioni da sole.
  - *Da un link*: legge i dati strutturati (schema.org/Recipe) usati dalla maggior parte dei siti di ricette (GialloZafferano, Cookist, BBC Good Food…).
  - *Cerca sul web*: per nome del piatto o per ingredienti (anche presi dalla dispensa), apre Google limitato ai siti di ricette scelti (GialloZafferano, Cookaround, Fatto in casa da Benedetta, Cookist, Misya, Il Cucchiaio d'Argento, La Cucina Italiana). Trovata la ricetta si importa con *Condividi → Ricettario*, il bookmarklet o "Ho copiato il link: importa". C'è un collegamento anche in *Dispensa → Cosa cucino?* e nell'elenco ricette quando la ricerca non trova nulla.
  - *Bookmarklet* per PC: un pulsante nei preferiti che manda la ricetta della pagina aperta al Ricettario.
  - *Condividi → Ricettario* su Android (con l'app installata).
  - **Niente doppioni**: due ricette non possono avere lo stesso nome (maiuscole, accenti e punteggiatura non contano). Mentre scrivi il titolo compare un avviso con un nome alternativo; al salvataggio puoi salvare con un altro nome, sostituire la ricetta esistente (mantenendo voti, preferita e volte cucinata) o aprirla. Avviso anche se importi di nuovo un link già usato.
- **Dettaglio ricetta**: porzioni ricalcolabili, ingredienti da spuntare, indicazione di cosa hai già in dispensa, passaggi con **timer** cliccabili ("cuocete 10 minuti" → ⏱), stampa, condivisione, duplicazione, foto personale.
- **Calorie stimate**: se una ricetta non ha le calorie, l'app le stima dagli ingredienti con una tabella interna di circa 200 alimenti (pesi medi dei pezzi, cucchiai, bicchieri…). La stima compare nella ricetta (tocca per vedere il calcolo riga per riga), nelle schede dell'elenco (🔥 ≈ kcal), nell'ordinamento *Meno caloriche* e in modifica, con il pulsante "usa" per copiarla nel campo. Le calorie inserite a mano hanno sempre la precedenza. Il menu *Dietetico* sceglie i piatti fino a circa 450–550 kcal a porzione.
- **Modalità cucina**: un passaggio per schermata a caratteri grandi, schermo sempre acceso, scorrimento col dito o con le frecce.
- **Dispensa e "Cosa cucino?"**: inserisci cosa hai in casa (con scadenze facoltative) e ottieni le ricette ordinate per ingredienti disponibili, con priorità a quelli in scadenza. Puoi indicare gli ingredienti da usare per forza e quanti ne possono mancare. Gli ingredienti "sempre in casa" (sale, olio…) non contano come mancanti. Il confronto riconosce singolari/plurali e nomi generici ("pasta" vale per spaghetti, penne…).
- **Lista della spesa**: aggiungi gli ingredienti di una ricetta (scalati, senza quelli che hai già), somma automatica delle quantità, divisione per reparto, **invio su WhatsApp** (lista formattata per reparto, anche direttamente a un contatto preferito) o con altre app, prodotti frequenti da aggiungere con un tocco, "Annulla" dopo un'eliminazione, "sposta in dispensa" a fine spesa.
- **Di stagione**: filtro e indicazione delle ricette con frutta e verdura del mese; il riempimento automatico del menu le preferisce.
- **Menu settimanale**: pranzo e cena per ogni giorno. **Compila automaticamente** riempie i pasti vuoti (pranzi e cene, solo cene o solo pranzi) con uno stile a scelta: *Varietà* (pasta, carne, pesce e verdure a rotazione), *Vegetale*, *Pasta*, *Carne* o *Dietetico*. A pranzo preferisce i primi, a cena i secondi, senza ripetere le ricette nella settimana e privilegiando quelle ben votate, di stagione e non cucinate di recente. Il pulsante ↻ su un piatto ne propone un altro dello stesso stile; ogni operazione si può annullare. Lista della spesa della settimana.
- **Sincronizzazione GitHub** automatica, con unione delle modifiche fatte su più dispositivi. Per condividere la lista in famiglia, *Altro → Lista condivisa* genera un link che configura l'app sul telefono dell'altra persona (senza token).
- Grafica mediterranea (terracotta, blu egeo, oliva, limone), backup/ripristino JSON, tema chiaro/scuro, statistiche, ricette di esempio.

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
- I proxy vengono provati tutti insieme e vince il primo che restituisce la ricetta. I link condivisi dal telefono vengono ripuliti: rimandi di Google (`google.com/amp/s/…`, `share.google/…`, `/url?q=…`), cache AMP e parametri di tracciamento.
- Se l'importazione non riesce, l'app mostra il link usato, il risultato di ogni proxy (*Dettagli tecnici*), un pulsante **Riprova** e, se insieme al link è arrivato del testo, **Usa il testo condiviso**.
- Se un sito blocca il proxy: usa il **bookmarklet** (gira direttamente sulla pagina aperta, senza proxy) oppure copia il testo e usa **Incolla testo**.

## Sviluppo in locale

Serve solo un server statico (i moduli JavaScript non funzionano aprendo il file direttamente):

```bash
python -m http.server 8765
```

e poi apri `http://localhost:8765`.

Per pubblicare una nuova versione fai doppio clic su **`pubblica.bat`** (lancia `pubblica.ps1`): elenca i file cambiati, controlla che non contengano codici segreti, aumenta la versione in `sw.js` se è cambiato qualcosa dell'app, chiede una descrizione facoltativa e pubblica tutto in un solo commit (`Ricettario v5 - descrizione`). La descrizione si può passare anche da riga di comando: `pubblica.bat "Nuova grafica"`. La versione in uso è indicata in fondo alla barra laterale e in *Altro → App e aspetto*: le app aperte vedono l'avviso **Aggiorna** appena esce una versione nuova (controllano quando tornano in primo piano e ogni ora); da lì puoi anche **controllare subito** o **forzare l'aggiornamento**, che riscarica i file dell'app senza toccare i dati.

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
| `js/nutrition.js` | Tabella delle calorie e stima a porzione |
| `js/menu.js` | Classificazione delle ricette (pasta, carne, pesce, vegetale, leggera) e compilazione del menu |
| `js/season.js` | Calendario di frutta e verdura di stagione |
| `js/samples.js` | Ricette di esempio |
| `fonts/` | Caratteri DM Sans e Fraunces (licenza SIL OFL), inclusi per l'uso offline |

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
