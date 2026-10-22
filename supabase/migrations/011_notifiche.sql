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
