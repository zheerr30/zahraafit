-- MUSCLE STUDIO 3D — cloud projects table.
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)

create table if not exists public.projects (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 120),
  asset_id       text,
  schema_version integer not null default 1,
  doc            jsonb not null,
  camera         jsonb,
  thumbnail      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists projects_user_updated_idx on public.projects (user_id, updated_at desc);

alter table public.projects enable row level security;

create policy "Users read own projects"   on public.projects for select using (auth.uid() = user_id);
create policy "Users insert own projects" on public.projects for insert with check (auth.uid() = user_id);
create policy "Users update own projects" on public.projects for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own projects" on public.projects for delete using (auth.uid() = user_id);
