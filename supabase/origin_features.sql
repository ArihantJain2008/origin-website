-- Origin account, release, download, community, and administration schema.
-- Apply after feedback.sql with the Supabase SQL editor or Supabase CLI.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create or replace function public.handle_new_origin_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_origin_auth_user_created on auth.users;
create trigger on_origin_auth_user_created after insert on auth.users
for each row execute function public.handle_new_origin_user();
revoke all on function public.handle_new_origin_user() from public, anon, authenticated;
-- Backfill users who existed before the profile trigger was installed.
insert into public.profiles(id, display_name)
select id, coalesce(raw_user_meta_data ->> 'display_name', '') from auth.users
on conflict (id) do nothing;

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.application_versions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  version text not null,
  release_url text,
  released_at timestamptz,
  is_prerelease boolean not null default false,
  created_at timestamptz not null default now(),
  unique(application_id, version)
);
create table if not exists public.installer_assets (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.application_versions(id) on delete cascade,
  platform text not null check (platform in ('windows','macos-arm','macos-intel','linux')),
  filename text not null,
  source_url text not null check (source_url like 'https://%'),
  byte_size bigint check (byte_size is null or byte_size >= 0),
  sha256 text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(version_id, filename)
);
create table if not exists public.visitors (
  id uuid primary key default gen_random_uuid(),
  identity_hash text not null unique,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create table if not exists public.download_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.installer_assets(id) on delete restrict,
  user_id uuid references auth.users(id) on delete set null,
  visitor_id uuid references public.visitors(id) on delete set null,
  event_type text not null check (event_type in ('requested','completed','interrupted','failed')),
  full_transfer boolean not null default false,
  request_id uuid not null,
  byte_count bigint not null default 0 check (byte_count >= 0),
  http_status integer,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists download_events_asset_created_idx on public.download_events(asset_id, created_at desc);
create index if not exists download_events_type_created_idx on public.download_events(event_type, created_at desc);
create index if not exists download_events_user_created_idx on public.download_events(user_id, created_at desc) where user_id is not null;
create table if not exists public.unique_downloads (
  version_id uuid not null references public.application_versions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  visitor_id uuid references public.visitors(id) on delete cascade,
  completed_at timestamptz not null default now(),
  check (num_nonnulls(user_id, visitor_id) = 1),
  unique(version_id, user_id),
  unique(version_id, visitor_id)
);
create index if not exists unique_downloads_version_idx on public.unique_downloads(version_id);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 1 and 4000),
  status text not null default 'published' check (status in ('published','hidden','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(application_id,user_id)
);
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  status text not null default 'published' check (status in ('published','hidden','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists comments_application_created_idx on public.comments(application_id, created_at desc);
create index if not exists comments_parent_idx on public.comments(parent_id) where parent_id is not null;
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('review','comment','user','application')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 5 and 2000),
  status text not null default 'open' check (status in ('open','investigating','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists reports_status_created_idx on public.reports(status, created_at desc);
create index if not exists reports_target_idx on public.reports(target_type, target_id);
create unique index if not exists reports_one_per_user_target_idx on public.reports(reporter_id, target_type, target_id) where reporter_id is not null;
create table if not exists public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_email text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  admin_email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now()
);
create or replace function public.origin_user_is_active() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and suspended_at is null)
$$;
revoke all on function public.origin_user_is_active() from public, anon;
grant execute on function public.origin_user_is_active() to authenticated;
create or replace function public.set_origin_user_suspension(p_user_id uuid, p_suspended boolean) returns integer
language plpgsql security definer set search_path = public, auth as $$
declare v_revoked integer := 0;
begin
  update public.profiles set suspended_at = case when p_suspended then now() else null end, updated_at = now() where id = p_user_id;
  if not found then raise exception 'profile not found'; end if;
  if p_suspended then
    delete from auth.sessions where user_id = p_user_id;
    get diagnostics v_revoked = row_count;
  end if;
  return v_revoked;
end $$;
revoke all on function public.set_origin_user_suspension(uuid,boolean) from public, anon, authenticated;
grant execute on function public.set_origin_user_suspension(uuid,boolean) to service_role;

-- Atomic identity creation, event recording, and unique counting. A unique
-- download is counted once only after the transfer has completed.
create or replace function public.record_download_event(
  p_asset_id uuid, p_identity_hash text, p_user_id uuid, p_event_type text,
  p_request_id uuid, p_byte_count bigint default 0, p_http_status integer default null,
  p_user_agent text default null, p_full_transfer boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_visitor_id uuid; v_version_id uuid; v_count bigint; v_unique boolean := false;
begin
  if p_event_type not in ('requested','completed','interrupted','failed') then raise exception 'invalid event'; end if;
  select version_id into v_version_id from installer_assets where id=p_asset_id and active=true;
  if v_version_id is null then raise exception 'installer unavailable'; end if;
  if p_user_id is null then
    if p_identity_hash is null or length(p_identity_hash) < 32 then raise exception 'invalid identity'; end if;
    insert into visitors(identity_hash) values (p_identity_hash)
    on conflict(identity_hash) do update set last_seen_at=now() returning id into v_visitor_id;
  end if;
  insert into download_events(asset_id,user_id,visitor_id,event_type,request_id,byte_count,http_status,user_agent,full_transfer)
  values(p_asset_id,p_user_id,v_visitor_id,p_event_type,p_request_id,greatest(p_byte_count,0),p_http_status,left(p_user_agent,500),p_full_transfer);
  if p_event_type = 'completed' and p_full_transfer then
    if p_user_id is not null then
      insert into unique_downloads(version_id,user_id) values(v_version_id,p_user_id) on conflict do nothing;
      get diagnostics v_count = row_count; v_unique := v_count > 0;
    else
      insert into unique_downloads(version_id,visitor_id) values(v_version_id,v_visitor_id) on conflict do nothing;
      get diagnostics v_count = row_count; v_unique := v_count > 0;
    end if;
  end if;
  select count(*) into v_count from unique_downloads where version_id=v_version_id;
  return jsonb_build_object('unique_downloads',v_count,'counted_new_identity',v_unique);
end $$;

insert into public.applications(slug,name,description) values ('origin','Origin','Developer workspace and project launcher') on conflict(slug) do nothing;
alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.application_versions enable row level security;
alter table public.installer_assets enable row level security;
alter table public.visitors enable row level security;
alter table public.download_events enable row level security;
alter table public.unique_downloads enable row level security;
alter table public.reviews enable row level security;
alter table public.comments enable row level security;
alter table public.reports enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.admin_sessions enable row level security;
revoke all on public.visitors, public.download_events, public.unique_downloads, public.admin_audit_logs, public.admin_sessions from anon, authenticated;
revoke all on function public.record_download_event(uuid,text,uuid,text,uuid,bigint,integer,text,boolean) from public, anon, authenticated;
grant execute on function public.record_download_event(uuid,text,uuid,text,uuid,bigint,integer,text,boolean) to service_role;

-- Least-privilege client access. Privileged server endpoints use the
-- server-only service role and must still enforce ownership themselves.
revoke all on public.profiles, public.applications, public.application_versions,
  public.installer_assets, public.visitors, public.download_events,
  public.unique_downloads, public.reviews, public.comments, public.reports,
  public.admin_audit_logs from anon, authenticated;
grant all on public.profiles, public.applications, public.application_versions,
  public.installer_assets, public.visitors, public.download_events,
  public.unique_downloads, public.reviews, public.comments, public.reports,
  public.admin_audit_logs, public.admin_sessions, public.feedback to service_role;
grant usage, select, update on all sequences in schema public to service_role;
grant select on public.applications, public.application_versions, public.installer_assets to anon, authenticated;
grant select on public.reviews, public.comments to anon;
grant select on public.profiles, public.reviews, public.comments, public.reports to authenticated;
grant select on public.download_events to authenticated;
grant insert (id, display_name) on public.profiles to authenticated;
grant update (display_name, updated_at) on public.profiles to authenticated;
grant insert (application_id, user_id, rating, body) on public.reviews to authenticated;
grant update (rating, body, updated_at) on public.reviews to authenticated;
grant delete on public.reviews to authenticated;
grant insert (application_id, user_id, parent_id, body) on public.comments to authenticated;
grant update (body, updated_at) on public.comments to authenticated;
grant delete on public.comments to authenticated;
grant insert (reporter_id, target_type, target_id, reason) on public.reports to authenticated;

drop policy if exists applications_public_read on public.applications;
create policy applications_public_read on public.applications for select to anon, authenticated using (true);
drop policy if exists versions_public_read on public.application_versions;
create policy versions_public_read on public.application_versions for select to anon, authenticated using (not is_prerelease);
drop policy if exists installers_public_read on public.installer_assets;
create policy installers_public_read on public.installer_assets for select to anon, authenticated using (active and exists (
  select 1 from public.application_versions v where v.id = version_id and not v.is_prerelease
));
drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid() and public.origin_user_is_active()) with check (id = auth.uid() and public.origin_user_is_active());
drop policy if exists download_events_read_own on public.download_events;
create policy download_events_read_own on public.download_events for select to authenticated using (user_id = auth.uid() and public.origin_user_is_active());
drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read on public.reviews for select to anon, authenticated using (status = 'published' or user_id = auth.uid());
drop policy if exists reviews_insert_own on public.reviews;
create policy reviews_insert_own on public.reviews for insert to authenticated with check (user_id = auth.uid() and public.origin_user_is_active());
drop policy if exists reviews_update_own on public.reviews;
create policy reviews_update_own on public.reviews for update to authenticated using (user_id = auth.uid() and public.origin_user_is_active()) with check (user_id = auth.uid() and public.origin_user_is_active());
drop policy if exists reviews_delete_own on public.reviews;
create policy reviews_delete_own on public.reviews for delete to authenticated using (user_id = auth.uid() and public.origin_user_is_active());
drop policy if exists comments_public_read on public.comments;
create policy comments_public_read on public.comments for select to anon, authenticated using (status = 'published' or user_id = auth.uid());
drop policy if exists comments_insert_own on public.comments;
create policy comments_insert_own on public.comments for insert to authenticated with check (user_id = auth.uid() and public.origin_user_is_active());
drop policy if exists comments_update_own on public.comments;
create policy comments_update_own on public.comments for update to authenticated using (user_id = auth.uid() and public.origin_user_is_active()) with check (user_id = auth.uid() and public.origin_user_is_active());
drop policy if exists comments_delete_own on public.comments;
create policy comments_delete_own on public.comments for delete to authenticated using (user_id = auth.uid() and public.origin_user_is_active());
drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports for insert to authenticated with check (reporter_id = auth.uid() and public.origin_user_is_active());
drop policy if exists reports_read_own on public.reports;
create policy reports_read_own on public.reports for select to authenticated using (reporter_id = auth.uid());
