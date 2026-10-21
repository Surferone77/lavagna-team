-- Risposte ai messaggi in bacheca (ripetibile)
alter table public.comunicazioni add column if not exists reply_to     uuid;
alter table public.comunicazioni add column if not exists reply_utente text;
alter table public.comunicazioni add column if not exists reply_testo  text;
select count(*) as messaggi from public.comunicazioni;
