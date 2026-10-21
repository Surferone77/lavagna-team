# The Hybrid One — app del team

Lavagna allenamenti per il team, stile SugarWOD: workout del giorno divisi in blocchi,
classifica live (RX / Scaled), storico, bacheca del team. Gli allenamenti si caricano
da screenshot o foto: l'AI li legge, tu controlli le card e salvi.

Frontend React (Vite) · Database e realtime Supabase · Lettura AI con una Edge Function · Hosting Netlify.

---

## Novità v2
- **Upload foto affidabile**: ogni immagine viene convertita in JPEG e ridimensionata nel browser
  (HEIC dell'iPhone compreso). Gli screenshot lunghi vengono tagliati in pezzi sovrapposti,
  così il testo resta leggibile. Una chiamata AI per screenshot, con "Riprova" sul singolo file.
- **Risposta AI strutturata** (tool use): niente più JSON troncati o "errore parse".
- **Revisione a card**: titolo, formato, tipo di punteggio e testo modificabili, riordino, aggiunta ed eliminazione.
- **Punteggi**: For Time (anche `CAP+12`), Reps, Round+reps (`5+12`), Carico, Nota. Classifica RX sopra Scaled, con filtro.
- **Id stabili**: se ricarichi o modifichi un giorno, i punteggi restano sui blocchi con lo stesso titolo.
- **Data automatica**: scegli il giorno, settimana ed etichetta si calcolano da sole.
- **Bacheca** del team in tempo reale.

---

## 1) Database (Supabase)
SQL Editor → esegui in ordine:
1. `schema.sql` (solo su un progetto nuovo)
2. `supabase/migrations/002_v2_upgrade.sql` (su tutti: si può ripetere senza danni)

Da **Project Settings → API** copia `Project URL` e la chiave `anon public`.

## 2) Edge Function (lettura AI)
```bash
supabase login
supabase link --project-ref IL-TUO-PROJECT-REF
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# facoltativo: cambiare modello senza toccare il codice
# supabase secrets set ANTHROPIC_MODEL=claude-sonnet-4-6
supabase functions deploy read-screenshots
```

## 3) In locale
```bash
npm install
cp .env.example .env     # incolla VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev
```

## 4) Online (Netlify)
1. Push della repo su GitHub.
2. Netlify → **Add new site → Import an existing project** → scegli la repo.
   Build e cartella di pubblicazione sono già in `netlify.toml` (`npm run build` → `dist`).
3. **Site configuration → Environment variables**: aggiungi `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. **Deploy**. Ogni `git push` rifà il deploy da solo.

Sul telefono: apri il link in Safari → Condividi → **Aggiungi a Home** e si usa come un'app.

---

## Link per la coach (Giada)
Pagina semplificata per caricare il programma di tutta la settimana: un pulsante, selezione degli
screenshot, giorni riconosciuti in automatico (quelli non scritti vanno in ordine e sono evidenziati
in giallo), **Pubblica**, poi "Avvisa il gruppo su WhatsApp".

1. Scegli un codice lungo e mettilo in `VITE_COACH_CODE` (in `.env` e nelle variabili di Netlify).
2. Manda a Giada il link `https://tuo-sito.netlify.app/?coach=IL-CODICE`.
3. Lei lo apre in Safari → Condividi → **Aggiungi a Home**.

Dal sabato in poi la pagina propone già la settimana successiva.

## Sicurezza
L'accesso è anonimo: chiunque abbia il link può leggere e scrivere. Per un team ristretto va bene.
Il codice coach nasconde la pagina di caricamento, ma non è una vera protezione del database: per quella serve il login.
Prossimo passo consigliato: login Supabase Auth e caricamento allenamenti riservato ai coach.

## Struttura
```
schema.sql                                -> schema base
supabase/migrations/002_v2_upgrade.sql    -> bacheca, realtime, indici
supabase/functions/read-screenshots/      -> Edge Function AI
src/App.jsx                               -> navigazione, lavagna, salvataggi
src/components/                           -> WorkoutCard, UploadPanel, WorkoutEditor, Bacheca
src/lib/images.js                         -> conversione, resize e taglio immagini
src/lib/scoring.js                        -> tipi di punteggio e classifica
src/lib/weeks.js                          -> settimane ISO, id stabili, unione risultati
netlify.toml                              -> configurazione Netlify
```
