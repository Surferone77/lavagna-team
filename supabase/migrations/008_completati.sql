-- Blocchi segnati come completati ("visto"): uno per atleta e blocco.
-- L'app li legge solo per il nome di chi usa il telefono: ognuno vede la sua percentuale.
create table if not exists public.workout_done (
  id uuid primary key default gen_random_uuid(),
  athlete text not null,
  workout_id text not null,
  week_id text,
  created_at timestamptz not null default now(),
  unique (athlete, workout_id)
);
create index if not exists workout_done_athlete_idx on public.workout_done (athlete);
alter table public.workout_done enable row level security;
drop policy if exists "done_select" on public.workout_done;
drop policy if exists "done_insert" on public.workout_done;
drop policy if exists "done_delete" on public.workout_done;
create policy "done_select" on public.workout_done for select using (true);
create policy "done_insert" on public.workout_done for insert with check (true);
create policy "done_delete" on public.workout_done for delete using (true);
