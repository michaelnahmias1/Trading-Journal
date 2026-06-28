-- ─────────────────────────────────────────────────────────────────────────────
-- trade_closes — partial realizations of a single trade.
--
-- A position is rarely closed in one shot. Instead of splitting a trade into
-- several rows, the ONE parent trade stays open and records each partial close
-- here. The parent's quantity remains the ORIGINAL size (the cost basis is never
-- mutated); the still-open quantity is  trades.quantity − Σ trade_closes.quantity.
--
-- When the last tranche brings the remaining quantity to zero, the parent's
-- exit_price is set to the QUANTITY-WEIGHTED AVERAGE close price and exit_date to
-- the latest close date. From that moment the trade looks exactly like a normal
-- closed trade, so every existing per-trade calculation (gross/net/R/stats/tax/
-- equity) keeps working unchanged — partial closes enter the statistics ONLY at
-- full close. Until then only their realized net P&L feeds the live portfolio.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.trade_closes (
  id          uuid primary key default gen_random_uuid(),
  trade_id    uuid not null references public.trades (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  quantity    numeric(18, 6) not null check (quantity > 0),
  close_price numeric(18, 6) not null check (close_price > 0),
  close_date  date not null,
  commission  numeric(18, 4) not null default 0 check (commission >= 0),
  created_at  timestamptz not null default now()
);

create index if not exists trade_closes_trade_id_idx on public.trade_closes (trade_id);
create index if not exists trade_closes_user_id_idx on public.trade_closes (user_id);

-- ── Row-Level Security — scoped to the owner, like trades. ────────────────────
alter table public.trade_closes enable row level security;

drop policy if exists "trade_closes_all_own" on public.trade_closes;
create policy "trade_closes_all_own" on public.trade_closes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── close_trade_partial — record one tranche, atomically. ─────────────────────
-- Verifies ownership, that the trade is still open, and that the tranche fits in
-- the remaining quantity. On the final tranche it stamps the weighted-average
-- exit onto the parent so the trade becomes "closed". Returns the parent trade
-- row (unchanged for a partial, exit-stamped for a full close).
create or replace function public.close_trade_partial(
  p_trade_id   uuid,
  p_qty        numeric,
  p_price      numeric,
  p_date       date,
  p_commission numeric default 0
)
returns public.trades
language plpgsql
security definer set search_path = public
as $$
declare
  v_trade     public.trades;
  v_closed    numeric;
  v_remaining numeric;
  v_avg       numeric;
  v_last      date;
begin
  -- Lock the parent and confirm ownership in one step.
  select * into v_trade from public.trades
    where id = p_trade_id and user_id = auth.uid()
    for update;
  if not found then
    raise exception 'trade not found';
  end if;
  if v_trade.exit_price is not null then
    raise exception 'trade already closed';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'quantity must be positive';
  end if;
  if p_price is null or p_price <= 0 then
    raise exception 'price must be positive';
  end if;

  select coalesce(sum(quantity), 0) into v_closed
    from public.trade_closes where trade_id = p_trade_id;

  v_remaining := v_trade.quantity - v_closed;
  -- small epsilon so floating quantities that "just" fill the position pass.
  if p_qty > v_remaining + 1e-9 then
    raise exception 'quantity % exceeds remaining %', p_qty, v_remaining;
  end if;

  insert into public.trade_closes
    (trade_id, user_id, quantity, close_price, close_date, commission)
  values
    (p_trade_id, auth.uid(), p_qty, p_price, p_date, coalesce(p_commission, 0));

  v_closed := v_closed + p_qty;

  -- Fully closed → stamp the weighted-average exit on the parent.
  if v_closed >= v_trade.quantity - 1e-9 then
    select sum(close_price * quantity) / nullif(sum(quantity), 0), max(close_date)
      into v_avg, v_last
      from public.trade_closes where trade_id = p_trade_id;
    update public.trades
      set exit_price = v_avg, exit_date = v_last
      where id = p_trade_id
      returning * into v_trade;
  end if;

  return v_trade;
end;
$$;

-- Only signed-in users may call this. Postgres grants EXECUTE to PUBLIC by
-- default; revoke it so the anon role cannot reach the RPC.
revoke execute on function public.close_trade_partial(uuid, numeric, numeric, date, numeric) from public;
grant execute on function public.close_trade_partial(uuid, numeric, numeric, date, numeric) to authenticated;
