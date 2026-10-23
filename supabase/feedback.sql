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
  status text not null default 'new' check (status in ('new', 'planned', 'in_progress', 'completed', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
revoke all on table public.feedback from anon, authenticated;