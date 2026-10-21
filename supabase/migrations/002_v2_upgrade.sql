-- =====================================================================
-- Hybrid Engine v2 — migrazione compatibile
-- Si può eseguire sia su un progetto già esistente (dopo schema.sql) sia su uno nuovo
-- (prima esegui schema.sql). Ripeterla non fa danni.
-- =====================================================================

-- Bacheca del team
create table if not exists public.comunicazioni (
  id          uuid primary key default gen_random_uuid(),
  utente      text not null,
  messaggio   text not null check (char_length(messaggio) between 1 and 2000),
  created_at  timestamptz default now()
);
alter table public.comunicazioni enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'comunicazioni' and policyname = 'comunicazioni_read') then
    create policy "comunicazioni_read" on public.comunicazioni for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'comunicazioni' and policyname = 'comunicazioni_insert') then
    create policy "comunicazioni_insert" on public.comunicazioni for insert with check (true);
  end if;
end $$;

-- Indice per caricare velocemente i punteggi per atleta (storico personale / PR)
create index if not exists scores_athlete_idx on public.scores(athlete);

-- Realtime: oltre ai punteggi, anche settimane e bacheca
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'weeks') then
    alter publication supabase_realtime add table public.weeks;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'comunicazioni') then
    alter publication supabase_realtime add table public.comunicazioni;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'scores') then
    alter publication supabase_realtime add table public.scores;
  end if;
end $$;
