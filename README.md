# Trading Journal

A personal **swing-trading journal** — a *mirror* that reflects, clearly, where you
stand now versus your past self. It is a **pure measurement tool**, not a trade
gatekeeper, a learning platform, or a discipline tracker.

Two quality axes only:

1. **Fidelity** — it reflects real, net, after-tax money, accurately.
2. **Low friction** — logging a trade takes seconds.

## The money model

Three layers, kept separate (all math lives in one pure, unit-tested module:
`src/lib/calculations.ts`):

1. **Gross** — `(sell − buy) × qty`, direction-adjusted, native currency. No
   commissions, no tax. Measures trading skill; always visible.
2. **Net** — tax is on profit **after commissions**, and commission is charged
   **twice** (entry + exit):
   `net = 0.75 × (gross − 2 × commission_per_side)`
3. **Tax balance** — a separate rolling line. **Positive = you owe** the state,
   **negative = accrued credit** (tax shield from losses). Conceptually resets
   Jan 1 (the "Year" view shows that balance).

**Portfolio value** = `initial_capital + Σ net realized + net unrealized`, always
**net** (a 25% provision is applied to unrealized P&L too). Shown in **both ILS and
USD**; the two figures breathe with FX in **opposite directions** — that gap is
currency, not trading. **FX never enters trade-level statistics.**

**Statistics** are all **gross** (they measure the trader) except **Profit Factor**,
shown twice (gross & net) — the gap is the cost of friction. **Average R** is
aggregate only, never per-trade.

> Current scope: **stocks only, USD statistics**. Crypto and multi-currency stats
> are deferred but the seams (`asset_type`, the market-data interface) anticipate them.

## Tech stack

- **Next.js** (App Router, TypeScript) — deploy on Vercel (Hobby tier)
- **Supabase** — Postgres, Auth (email + password), Storage, Row-Level Security
- **Recharts** for the equity curve
- **Vitest** for the calculations tests
- Market data behind a swappable interface: **Finnhub** (quotes) + a **separate**
  FX API (exchangerate.host). Until keys are set, deterministic **mock** values are
  served. All external calls go through server-side route handlers — keys never
  reach the browser.

## Getting started

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Run the migration in **SQL Editor**: paste the contents of
   `supabase/migrations/0001_init.sql` and run it. This creates the
   `profiles`, `strategies`, and `trades` tables, the RLS policies, and a trigger
   that auto-creates a profile row on signup.
3. (Optional) Under **Authentication → Providers → Email**, disable
   "Confirm email" for the smoothest single-user signup.

### 3. Environment variables

```bash
cp .env.example .env.local
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase
  **Settings → API**.
- `FINNHUB_API_KEY` and `EXCHANGERATE_API_KEY` — optional. Leave blank to use mock
  prices/FX; the whole app still runs end-to-end.

### 4. Run

```bash
npm run dev      # http://localhost:3000
npm test         # run the calculations test suite
npm run build    # production build
```

Sign up, then go to **Settings** to set your initial capital (USD + ILS), a default
commission, and your setups. Then start logging trades.

## Deploy to Vercel

1. Push to GitHub; import the repo in Vercel.
2. Add the same environment variables in **Project → Settings → Environment
   Variables** (do **not** prefix the market-data keys with `NEXT_PUBLIC`).
3. Push to `main` → auto-deploy.

## Project structure

```
src/
  lib/
    calculations.ts        # the pure heart — all P&L / tax / R / FX math
    calculations.test.ts   # unit tests (tax shield, gross-vs-net, portfolio…)
    types.ts               # domain types
    format.ts              # money / percent formatting
    data.ts                # server-side Supabase queries (RLS-scoped)
    supabase/              # browser + server clients, session middleware
    market/                # PriceProvider / FxProvider interface + mock + live
  components/              # TimeframeToggle, Scoreboard, EquityCurveChart, …
  app/
    login/                 # email + password auth
    (app)/
      dashboard/           # portfolio, tax line, scoreboard, equity curve
      trades/              # fast add-trade form + filterable list + detail
      setups/              # aggregate verdict + per-setup diagnostic
      settings/            # capital, default commission, setups CRUD
    api/quote, api/fx      # server-side market data (keys never hit the browser)
supabase/migrations/       # SQL schema + RLS
```
