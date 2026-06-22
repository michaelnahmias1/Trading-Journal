-- ─────────────────────────────────────────────────────────────────────────────
-- Trading Journal — initial schema
-- Multi-user-ready from day one: every row is scoped to auth.uid() via RLS.
-- P&L / tax / R are NEVER stored — only the raw inputs live here.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── profiles ─────────────────────────────────────────────────────────────────
-- One row per user. Initial capital is held per native currency; default
-- commission autofills the add-trade form to keep logging friction-free.
create table if not exists public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  initial_capital_usd numeric(18, 2) not null default 0,
  initial_capital_ils numeric(18, 2) not null default 0,
  default_commission  numeric(18, 4) not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ── strategies (setups) ──────────────────────────────────────────────────────
create table if not exists public.strategies (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists strategies_user_id_idx on public.strategies (user_id);

-- ── trades ───────────────────────────────────────────────────────────────────
-- status (open/closed) is DERIVED from whether exit_price is set — not stored.
create table if not exists public.trades (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  symbol              text not null,
  asset_type          text not null default 'stock' check (asset_type in ('stock')),
  direction           text not null check (direction in ('long', 'short')),
  native_currency     text not null check (native_currency in ('USD', 'ILS')),
  entry_date          date not null,
  entry_price         numeric(18, 6) not null check (entry_price > 0),
  quantity            numeric(18, 6) not null check (quantity > 0),
  exit_date           date,
  exit_price          numeric(18, 6) check (exit_price > 0),
  commission_per_side numeric(18, 4) not null default 0 check (commission_per_side >= 0),
  stop_loss           numeric(18, 6) check (stop_loss > 0),
  target_price        numeric(18, 6) check (target_price > 0),
  strategy_id         uuid references public.strategies (id) on delete set null,
  notes               text,
  screenshot_url      text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  -- a closed trade must have both an exit price and an exit date
  constraint exit_pair check (
    (exit_price is null and exit_date is null) or
    (exit_price is not null and exit_date is not null)
  )
);

create index if not exists trades_user_id_idx on public.trades (user_id);
create index if not exists trades_user_exit_idx on public.trades (user_id, exit_date);

-- ── updated_at maintenance ───────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_trades_updated_at on public.trades;
create trigger trg_trades_updated_at
  before update on public.trades
  for each row execute function public.set_updated_at();

-- ── auto-create a profile on signup ──────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Row-Level Security ───────────────────────────────────────────────────────
alter table public.profiles   enable row level security;
alter table public.strategies enable row level security;
alter table public.trades     enable row level security;

-- profiles: a user sees and edits only their own row.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- strategies: scoped to the owner.
drop policy if exists "strategies_all_own" on public.strategies;
create policy "strategies_all_own" on public.strategies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- trades: scoped to the owner.
drop policy if exists "trades_all_own" on public.trades;
create policy "trades_all_own" on public.trades
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
