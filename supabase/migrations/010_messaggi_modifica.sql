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
