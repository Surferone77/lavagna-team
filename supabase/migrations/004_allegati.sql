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
select count(*) as messaggi from public.comunicazioni;
