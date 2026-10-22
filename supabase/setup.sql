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
-- Foto dei workout (ripetibile)
create table if not exists public.photos (
  id          uuid primary key default gen_random_uuid(),
  workout_id  text not null,
  week_id     text,
  day_key     text,
  athlete     text not null,
  path        text not null,
  thumb_path  text not null,
  width       int,
  height      int,
  bytes       int,
  created_at  timestamptz default now()
);
create index if not exists photos_workout_idx on public.photos(workout_id);
alter table public.photos enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='photos' and policyname='photos_read') then
    create policy "photos_read" on public.photos for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='photos' and policyname='photos_insert') then
    create policy "photos_insert" on public.photos for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='photos' and policyname='photos_delete') then
    create policy "photos_delete" on public.photos for delete using (true);
  end if;
end $$;
-- bucket pubblico, max 5 MB a file, solo immagini
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='photos_obj_read') then
    create policy "photos_obj_read" on storage.objects for select using (bucket_id = 'photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='photos_obj_insert') then
    create policy "photos_obj_insert" on storage.objects for insert with check (bucket_id = 'photos');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='photos_obj_delete') then
    create policy "photos_obj_delete" on storage.objects for delete using (bucket_id = 'photos');
  end if;
end $$;
-- Allegati nella bacheca (ripetibile)
alter table public.comunicazioni add column if not exists allegato_path  text;
alter table public.comunicazioni add column if not exists allegato_nome  text;
alter table public.comunicazioni add column if not exists allegato_tipo  text;
alter table public.comunicazioni add column if not exists allegato_bytes int;
-- il testo può essere vuoto se c'è un allegato
alter table public.comunicazioni drop constraint if exists comunicazioni_messaggio_check;
alter table public.comunicazioni drop constraint if exists comunicazioni_contenuto_check;
alter table public.comunicazioni add constraint comunicazioni_contenuto_check
  check (char_length(messaggio) <= 2000 and (char_length(messaggio) > 0 or allegato_path is not null));
-- bucket pubblico, massimo 5 MB a file
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', true, 5242880)
on conflict (id) do update set file_size_limit = 5242880;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='attach_read') then
    create policy "attach_read" on storage.objects for select using (bucket_id = 'attachments');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='attach_insert') then
    create policy "attach_insert" on storage.objects for insert with check (bucket_id = 'attachments');
  end if;
end $$;
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
-- Risposte ai messaggi in bacheca (ripetibile)
alter table public.comunicazioni add column if not exists reply_to     uuid;
alter table public.comunicazioni add column if not exists reply_utente text;
alter table public.comunicazioni add column if not exists reply_testo  text;
-- Note private sui blocchi (ripetibile)
alter table public.workout_notes add column if not exists privata boolean not null default false;

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

-- Bacheca: modificare ed eliminare i propri messaggi (ripetibile)
alter table public.comunicazioni add column if not exists modificato_at timestamptz;
alter table public.comunicazioni add column if not exists eliminato boolean not null default false;
alter table public.comunicazioni drop constraint if exists comunicazioni_contenuto_check;
alter table public.comunicazioni add constraint comunicazioni_contenuto_check
  check (char_length(messaggio) <= 2000 and (eliminato or char_length(messaggio) > 0 or allegato_path is not null));
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'comunicazioni' and policyname = 'comunicazioni_update') then
    create policy "comunicazioni_update" on public.comunicazioni for update using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='attach_delete') then
    create policy "attach_delete" on storage.objects for delete using (bucket_id = 'attachments');
  end if;
end $$;

-- Notifiche push e novità dell'app (ripetibile)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  athlete text,
  prefs jsonb not null default '{"workout": true, "bacheca": true, "changelog": true}',
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
drop policy if exists "push_select" on public.push_subscriptions;
drop policy if exists "push_insert" on public.push_subscriptions;
drop policy if exists "push_update" on public.push_subscriptions;
drop policy if exists "push_delete" on public.push_subscriptions;
create policy "push_select" on public.push_subscriptions for select using (true);
create policy "push_insert" on public.push_subscriptions for insert with check (true);
create policy "push_update" on public.push_subscriptions for update using (true) with check (true);
create policy "push_delete" on public.push_subscriptions for delete using (true);

create table if not exists public.changelog (
  id uuid primary key default gen_random_uuid(),
  version text,
  title text not null,
  body text default '',
  created_at timestamptz not null default now()
);
alter table public.changelog enable row level security;
drop policy if exists "changelog_select" on public.changelog;
create policy "changelog_select" on public.changelog for select using (true);
-- le novità le scrive solo l'amministratore (SQL editor), non l'app

-- Link del giorno per gli ospiti: una COPIA del giorno, letta solo tramite token, con scadenza.
create table if not exists public.shared_days (
  token text primary key check (char_length(token) >= 16),
  week_id text,
  day_key text,
  day_date date,
  day_label text,
  workouts jsonb not null,
  created_by text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked boolean not null default false,
  check (expires_at <= created_at + interval '8 days')
);
alter table public.shared_days enable row level security;
drop policy if exists "shared_insert" on public.shared_days;
create policy "shared_insert" on public.shared_days for insert with check (true);
-- nessuna select diretta: l'ospite legge solo il suo giorno passando il token
create or replace function public.get_shared_day(t text)
returns table (day_label text, day_date date, workouts jsonb, created_by text, expires_at timestamptz)
language sql security definer set search_path = public as $$
  select day_label, day_date, workouts, created_by, expires_at from public.shared_days
  where token = t and not revoked and expires_at > now()
$$;
create or replace function public.revoke_shared_day(t text) returns void
language sql security definer set search_path = public as $$
  update public.shared_days set revoked = true where token = t
$$;
grant execute on function public.get_shared_day(text) to anon, authenticated;
grant execute on function public.revoke_shared_day(text) to anon, authenticated;
