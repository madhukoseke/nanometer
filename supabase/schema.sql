-- NanoMeter — Supabase schema
-- Run this in the SQL editor of a fresh Supabase project before booting the seller.

-- =============================================================================
-- tx_events — one row per paid call observed by the nanometer() middleware.
-- =============================================================================
create table if not exists public.tx_events (
  id          bigserial primary key,
  ts          timestamptz not null default now(),
  agent_addr  text        not null,
  endpoint    text        not null,
  method      text        not null,
  amount_usdc numeric(18, 6) not null,
  latency_ms  integer     not null,
  status      integer     not null,
  tx_ref      text,                  -- Circle Gateway settlement reference, null while pending
  network     text        not null,  -- e.g. eip155:5042002
  verified    boolean     not null default true
);

comment on table  public.tx_events is 'NanoMeter — one row per paid API call observed by the middleware';
comment on column public.tx_events.tx_ref is 'Circle Gateway settlement transaction reference. NULL while authorization is pending batched settlement.';

-- Hot indexes the dashboard queries hit:
--  1) recent events (ts desc) — Live tab fallback when SSE is disconnected
--  2) per-agent rollups — Cohorts tab
--  3) per-batch grouping — Settlement tab
create index if not exists tx_events_ts_idx        on public.tx_events (ts desc);
create index if not exists tx_events_agent_idx     on public.tx_events (agent_addr, ts desc);
create index if not exists tx_events_tx_ref_idx    on public.tx_events (tx_ref) where tx_ref is not null;

-- =============================================================================
-- Read-only views the dashboard hits via the anon key. Computing the rollups
-- in SQL keeps the dashboard fast even when the table grows past a million rows.
-- =============================================================================

create or replace view public.v_cohort_rollup as
select
  agent_addr,
  count(*)                                              as calls,
  sum(amount_usdc)                                      as spend,
  sum(case when status < 400 then 1 else 0 end)         as successes,
  percentile_cont(0.95) within group (order by latency_ms) as p95_latency_ms,
  min(ts)                                               as first_seen,
  max(ts)                                               as last_seen
from public.tx_events
group by agent_addr;

comment on view public.v_cohort_rollup is 'Per-agent rollups for the Cohorts tab. cps z-score is computed client-side.';

create or replace view public.v_settlement_batches as
select
  tx_ref,
  count(*)                       as batch_size,
  sum(amount_usdc)               as value_usdc,
  min(ts)                        as first_authz_ts,
  max(ts)                        as last_authz_ts
from public.tx_events
where tx_ref is not null
group by tx_ref
order by last_authz_ts desc;

comment on view public.v_settlement_batches is 'Onchain settlement batches inferred from tx_ref grouping. Powers the Settlement tab.';

-- =============================================================================
-- RLS — anonymous read access for the dashboard, server-side writes only.
-- The seller API uses the SERVICE_ROLE key (which bypasses RLS); the dashboard
-- uses the ANON key (which sees only what RLS allows).
-- =============================================================================
alter table public.tx_events enable row level security;

drop policy if exists "anon read tx_events" on public.tx_events;
create policy "anon read tx_events"
  on public.tx_events for select
  to anon
  using (true);

-- The views inherit RLS from the underlying table, so no separate policies needed.
