-- Note private sui blocchi (ripetibile)
alter table public.workout_notes add column if not exists privata boolean not null default false;
select count(*) as note from public.workout_notes;
