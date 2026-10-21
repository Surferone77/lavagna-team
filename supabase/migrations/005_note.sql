-- Note del team sui blocchi di allenamento (ripetibile)
create table if not exists public.workout_notes (
  id          uuid primary key default gen_random_uuid(),
  workout_id  text not null,
  athlete     text not null,
  testo       text not null check (char_length(testo) between 1 and 1000),
  created_at  timestamptz default now()
);
create index if not exists workout_notes_workout_idx on public.workout_notes(workout_id);
alter table public.workout_notes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='workout_notes' and policyname='notes_read') then
    create policy "notes_read" on public.workout_notes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='workout_notes' and policyname='notes_insert') then
    create policy "notes_insert" on public.workout_notes for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='workout_notes' and policyname='notes_delete') then
    create policy "notes_delete" on public.workout_notes for delete using (true);
  end if;
end $$;
select count(*) as note from public.workout_notes;
