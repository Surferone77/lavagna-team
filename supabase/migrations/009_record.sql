-- Record personali (PR): ogni riga è un valore nello storico di un esercizio.
-- Il PR è il migliore per atleta + esercizio (+ RM per i carichi). private = visibile solo a chi l'ha scritto (nell'app).
create table if not exists public.personal_records (
  id uuid primary key default gen_random_uuid(),
  athlete text not null,
  category text not null default 'altro',
  exercise text not null,
  kind text not null check (kind in ('weight','time','reps','rounds')),
  rm int,
  value double precision not null,
  raw text,
  record_date date not null default current_date,
  note text default '',
  private boolean not null default false,
  score_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists personal_records_athlete_idx on public.personal_records (athlete);
alter table public.personal_records enable row level security;
drop policy if exists "pr_select" on public.personal_records;
drop policy if exists "pr_insert" on public.personal_records;
drop policy if exists "pr_update" on public.personal_records;
drop policy if exists "pr_delete" on public.personal_records;
create policy "pr_select" on public.personal_records for select using (true);
create policy "pr_insert" on public.personal_records for insert with check (true);
create policy "pr_update" on public.personal_records for update using (true) with check (true);
create policy "pr_delete" on public.personal_records for delete using (true);
do $$ begin
  alter publication supabase_realtime add table public.personal_records;
exception when duplicate_object then null; end $$;
