# NanoMeter

> Margin intelligence for the agentic economy. One line of Express middleware.
> Real-time per-call P&L, cohort analytics, and a counterfactual gas calculator
> for any API monetized via Circle Nanopayments.

Built for the Agentic Economy on Arc hackathon, April 25–26, 2026.

**Repository:** [github.com/madhukoseke/nanometer](https://github.com/madhukoseke/nanometer)

```ts
import { nanometer } from "nanometer";
app.use(nanometer({ supabaseUrl, supabaseKey }));
// every paid call now flows into your dashboard
```

## What it does

NanoMeter wraps Circle's `@circle-fin/x402-batching` middleware and emits a
structured per-call event for every paid request. Those events power a live
dashboard with four views:

- **Live** — calls/sec, total revenue, active agents, real-time tx feed
- **Margin** — counterfactual cost on Ethereum / Base / Arc (the kill shot)
- **Cohorts** — per-agent LTV, p95 latency, z-score anomaly detection
- **Settlement** — onchain batch events with explorer links

## Why it exists

Batched settlement makes sub-cent payments economically viable, but
settlements are aggregated and delayed — so developers can no longer observe
per-call profit. NanoMeter is the observability layer that closes that gap.
See `docs/MARGIN_PROOF.md` for the math.

## Repo structure

```
apps/
  seller-api/    Express + Circle middleware + nanometer() + 3 paid endpoints
  swarm/         Node script that runs 5 GatewayClient agents in parallel
  dashboard/     Next.js 14 dashboard with SSE live updates
packages/
  nanometer/     The middleware itself (the "product")
docs/
  MARGIN_PROOF.md     The math
  CIRCLE_FEEDBACK.md  Submission feedback section
```

## Build

- `npm run build:libs` — TypeScript only (`nanometer` + `seller-api`), a few seconds.
- `npm run build` — includes `next build` for the dashboard (~10–20s on a warm cache).

If a tool or CI step aborts at ~30s, raise the timeout: the dashboard step needs most of the wall time, not a hang.

## Quick start (local)

```bash
# 1. Install
npm install

# 2. Set up env (see .env.example in each app)
cp apps/seller-api/.env.example apps/seller-api/.env
cp apps/swarm/.env.example apps/swarm/.env
cp apps/dashboard/.env.example apps/dashboard/.env.local

# 3. Get Arc testnet USDC, deposit into Gateway via the swarm bootstrap
cd apps/swarm && npm run bootstrap  # provisions and funds 5 agent wallets

# 4. Run the three apps in three terminals
npm run dev:api          # http://localhost:3001
npm run dev:dashboard    # http://localhost:3000
# (don't start the swarm yet — the dashboard fires it via the Start Swarm button)
```

## Demo

Click **start agent swarm** on the dashboard. 5 agent wallets fire paid
requests at the seller API at ~10–25 calls/sec for 90 seconds. Watch the
counters climb past 200 transactions, then switch to the Margin tab to see
the kill shot.

## License

MIT