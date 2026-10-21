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
select count(*) as foto from public.photos;
