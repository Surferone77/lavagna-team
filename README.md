# Lavagna Team HYROX

Lavagna allenamenti per il team: divisa per giorni e workout, classifica live condivisa,
e lettura automatica degli screenshot con l'AI. Frontend React (Vite) + Supabase.

Database **vuoto**: lo riempi tu caricando gli screenshot dalla app.

---

## Cosa ti serve (gratis)
- Account **Supabase** → https://supabase.com
- Account **Vercel** → https://vercel.com
- Una **chiave API Anthropic** (per la lettura screenshot) → https://console.anthropic.com
- **Node.js** installato in locale, e la **Supabase CLI** (`npm i -g supabase`)

---

## 1) Database (Supabase)
1. Crea un nuovo progetto su Supabase.
2. Apri **SQL Editor** → incolla tutto il contenuto di `schema.sql` → **Run**.
   Crea le tabelle `weeks` e `scores`, le policy, il realtime e il bucket `screenshots`.
3. In **Project Settings → API** copia: `Project URL` e la chiave `anon public`.
   Ti servono al passo 3.

## 2) Edge Function (lettura screenshot con l'AI)
La chiave Anthropic resta sul server, non finisce mai nel browser.

```bash
# dalla cartella del progetto
supabase login
supabase link --project-ref IL-TUO-PROJECT-REF      # lo trovi nell'URL del progetto
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...    # la tua chiave Anthropic
supabase functions deploy read-screenshots
```

## 3) Frontend in locale (prova)
```bash
npm install
cp .env.example .env
# apri .env e incolla VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (dal passo 1)
npm run dev
```
Apri l'indirizzo locale: dovresti vedere la lavagna vuota. Prova **Carica screenshot**.

## 4) Online (Vercel)
1. Metti il progetto su GitHub (`git init`, commit, push).
2. Su Vercel: **New Project** → importa la repo.
3. In **Environment Variables** aggiungi `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. **Deploy**. Ottieni un URL tipo `https://lavagna-team.vercel.app`.
5. Mandi quel link nel gruppo WhatsApp: il team lo apre e logga i punteggi.

> Dominio tuo (opzionale): in Vercel → Settings → Domains puoi collegare
> es. `lavagna.enrico-smeraldi.com`.

---

## Uso settimanale
- **Carica screenshot** → scegli giorno + immagini → l'AI legge → controlli → **Aggiungi alla lavagna**.
- Il team apre il link, mette il nome (una volta), e inserisce i punteggi.
- Le classifiche si aggiornano **in tempo reale** per tutti.

## Fare modifiche
- **Contenuti** (workout, settimane): dalla app, oppure a mano nel Table Editor di Supabase.
- **Aspetto / nuove funzioni**: modifichi il codice React → `git push` → Vercel ri-deploya da solo.
- **Database** (nuove colonne/tabelle): piccoli script SQL nel SQL Editor.

## Sicurezza (da sapere)
Di default l'accesso è **anonimo e permissivo**: chiunque abbia il link + anon key può
leggere e scrivere. Va bene per un team ristretto. Per restringere:
- aggiungi **Supabase Auth** (login) e cambia le policy RLS in `schema.sql` per legare
  scrittura a utenti autenticati;
- oppure tieni l'editing settimane solo a te e lascia al team solo l'inserimento punteggi.
Chiedi pure e ti preparo la versione con login.

## Struttura
```
schema.sql                              -> da eseguire su Supabase
supabase/functions/read-screenshots/    -> Edge Function (lettura AI)
src/App.jsx                             -> la app
src/supabaseClient.js                   -> connessione Supabase
.env.example                           -> variabili da compilare
```
# lavagna-team
