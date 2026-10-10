create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('bug', 'feature', 'improvement', 'general', 'question')),
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 10 and 4000),
  email text,
  additional_details jsonb not null default '{}'::jsonb,
  device text,
  os text,
  origin_version text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
revoke all on table public.feedback from anon, authenticated;

-- Run this block when upgrading an existing table created by the previous schema.
alter table public.feedback drop constraint if exists feedback_status_check;
update public.feedback set status = case
  when status in ('completed', 'resolved') then 'resolved'
  when status in ('planned', 'in_progress', 'reviewed') then 'reviewed'
  else 'new'
end;
alter table public.feedback add constraint feedback_status_check check (status in ('new', 'reviewed', 'resolved'));