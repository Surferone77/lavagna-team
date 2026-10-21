-- The Hybrid One: setup completo e ripetibile
create table if not exists public.weeks (id text primary key, label text, data jsonb not null default '{}'::jsonb, updated_at timestamptz default now());
create table if not exists public.scores (id uuid primary key default gen_random_uuid(), workout_id text not null, athlete text not null, value double precision not null, raw text, note text, rx boolean default true, created_at timestamptz default now());
create index if not exists scores_workout_idx on public.scores(workout_id);
create index if not exists scores_athlete_idx on public.scores(athlete);
create table if not exists public.comunicazioni (id uuid primary key default gen_random_uuid(), utente text not null, messaggio text not null check (char_length(messaggio) between 1 and 2000), created_at timestamptz default now());
alter table public.weeks enable row level security;
alter table public.scores enable row level security;
alter table public.comunicazioni enable row level security;
do $$
declare p record;
begin
  for p in select * from (values
    ('weeks','weeks_read','select','using (true)'),
    ('weeks','weeks_insert','insert','with check (true)'),
    ('weeks','weeks_update','update','using (true) with check (true)'),
    ('scores','scores_read','select','using (true)'),
    ('scores','scores_insert','insert','with check (true)'),
    ('scores','scores_delete','delete','using (true)'),
    ('comunicazioni','comunicazioni_read','select','using (true)'),
    ('comunicazioni','comunicazioni_insert','insert','with check (true)')
  ) as t(tbl,pol,cmd,expr) loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=p.tbl and policyname=p.pol) then
      execute format('create policy %I on public.%I for %s %s', p.pol, p.tbl, p.cmd, p.expr);
    end if;
  end loop;
  for p in select unnest(array['weeks','scores','comunicazioni']) as tbl loop
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename=p.tbl) then
      execute format('alter publication supabase_realtime add table public.%I', p.tbl);
    end if;
  end loop;
end $$;
insert into storage.buckets (id, name, public) values ('screenshots','screenshots',true) on conflict (id) do nothing;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='screenshots_read') then
    create policy "screenshots_read" on storage.objects for select using (bucket_id = 'screenshots');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='screenshots_upload') then
    create policy "screenshots_upload" on storage.objects for insert with check (bucket_id = 'screenshots');
  end if;
end $$;
select (select count(*) from public.weeks) as settimane, (select count(*) from public.scores) as punteggi;
