-- ─────────────────────────────────────────────────────────────────────────────
-- app_cache — a tiny shared key/value cache for NON-sensitive global values.
--
-- Motivation: the USD/ILS FX rate must be fetched from the external provider at
-- most ~3×/day (free-tier budget). An in-memory cache can't enforce that on
-- serverless: every cold start / parallel instance has its own memory and calls
-- the API again (observed: dozens of calls/day). A row in the database is shared
-- by ALL instances, so the rate is fetched once per 8h window for everyone.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.app_cache (
  key        text primary key,
  payload    jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_cache enable row level security;

-- The cache holds only public, non-sensitive data (e.g. the published USD/ILS
-- rate). Any signed-in user may read it and refresh it when it goes stale.
drop policy if exists "app_cache_select_auth" on public.app_cache;
create policy "app_cache_select_auth" on public.app_cache
  for select using (auth.uid() is not null);

drop policy if exists "app_cache_insert_auth" on public.app_cache;
create policy "app_cache_insert_auth" on public.app_cache
  for insert with check (auth.uid() is not null);

drop policy if exists "app_cache_update_auth" on public.app_cache;
create policy "app_cache_update_auth" on public.app_cache
  for update using (auth.uid() is not null) with check (auth.uid() is not null);
