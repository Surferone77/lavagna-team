-- =====================================================================
-- Lavagna Team HYROX — schema Supabase
-- Esegui tutto questo nel SQL Editor di Supabase (Run).
-- =====================================================================

-- Settimane: ogni riga è una settimana intera (giorni + workout in JSON)
create table if not exists public.weeks (
  id          text primary key,            -- es. "2026-W27"
  label       text,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz default now()
);

-- Punteggi: una riga per tentativo
create table if not exists public.scores (
  id          uuid primary key default gen_random_uuid(),
  workout_id  text not null,               -- es. "2026-W27__lun__1"
  athlete     text not null,
  value       double precision not null,   -- secondi / reps / kg
  raw         text,                         -- valore mostrato ("8:42", "80")
  note        text,
  rx          boolean default true,
  created_at  timestamptz default now()
);
create index if not exists scores_workout_idx on public.scores(workout_id);

-- ---------------------------------------------------------------------
-- RLS — board di team: accesso anonimo permissivo.
-- Va bene per un gruppo ristretto. Per restringere vedi il README.
-- ---------------------------------------------------------------------
alter table public.weeks  enable row level security;
alter table public.scores enable row level security;

create policy "weeks_read"   on public.weeks  for select using (true);
create policy "weeks_insert" on public.weeks  for insert with check (true);
create policy "weeks_update" on public.weeks  for update using (true) with check (true);

create policy "scores_read"   on public.scores for select using (true);
create policy "scores_insert" on public.scores for insert with check (true);
create policy "scores_delete" on public.scores for delete using (true);

-- ---------------------------------------------------------------------
-- Realtime: classifica live (aggiornamento istantaneo per tutto il team)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.scores;

-- ---------------------------------------------------------------------
-- Storage: bucket per archiviare gli screenshot caricati
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do nothing;

create policy "screenshots_read"
  on storage.objects for select using (bucket_id = 'screenshots');
create policy "screenshots_upload"
  on storage.objects for insert with check (bucket_id = 'screenshots');
