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
