# NanoMeter Runbook

> The exact commands, in order, with what to do when something breaks.
> Open this on your phone during the demo.

## 1. First-time local setup (~30 minutes)

```bash
# Clone & install
git clone https://github.com/madhukoseke/nanometer.git
cd nanometer
npm install                           # installs all workspaces

# Verify the Circle SDK version is current — the package.jsons pin ^0.1.0
# as a placeholder, update if a newer version is published:
npm view @circle-fin/x402-batching version
# Update apps/seller-api/package.json + apps/swarm/package.json if needed.

# Pin viem to a current version too:
npm view viem version
```

## 2. Supabase setup (~10 min)

```bash
# 1. Create project at supabase.com (free tier)
# 2. SQL editor → paste & run supabase/schema.sql
# 3. Project Settings → API → grab:
#    - Project URL  -> SUPABASE_URL
#    - anon key     -> NEXT_PUBLIC_SUPABASE_ANON_KEY
#    - service_role -> SUPABASE_SERVICE_KEY  (server-side only, never ship to dashboard)
```

## 3. Wallet bootstrap (~10 min, do the night before)

```bash
cd apps/swarm
npm run bootstrap
# Prints 5 addresses + private keys. Copy the output.

# For each of the 5 addresses:
#   1. Visit https://faucet.circle.com
#   2. Select Arc testnet
#   3. Request USDC (faucet typically gives 10 USDC; that's plenty for the demo)

# Paste the AGENT_KEYS line from the bootstrap output into apps/swarm/.env
```

The first time the swarm runs, each `GatewayClient` calls `.deposit()` to move
USDC from wallet to Gateway. That's an onchain tx per agent — give the testnet
~30s to confirm all 5. **Do this the night before, not at the venue.**

## 4. Env files

```bash
# apps/seller-api/.env
SELLER_ADDRESS=0x...           # any EVM address you control; receives all USDC
NETWORKS=eip155:5042002        # Arc testnet
SUPABASE_URL=https://...
SUPABASE_SERVICE_KEY=eyJ...
PORT=3001

# apps/swarm/.env
AGENT_KEYS=0x...,0x...,0x...,0x...,0x...    # from bootstrap output
SELLER_URL=http://localhost:3001
CHAIN=arcTestnet
SWARM_PORT=3002
TARGET_RPS=12
RUN_DURATION_SEC=90

# apps/dashboard/.env.local
NEXT_PUBLIC_SELLER_URL=http://localhost:3001
NEXT_PUBLIC_SWARM_URL=http://localhost:3002
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

## 5. Smoke test (THE NIGHT BEFORE — do not skip)

Three terminals:

```bash
# T1 — seller
cd apps/seller-api && npm run dev
# expect: [seller] listening on :3001
#         [seller] paid endpoints: /v1/infer  /v1/search  /v1/embed  @ $0.001

# T2 — swarm
cd apps/swarm && npm run dev
# expect: [swarm] control plane on :3002
#         [swarm] -> seller at http://localhost:3001
#         [swarm] -> chain arcTestnet

# T3 — dashboard
cd apps/dashboard && npm run dev
# open http://localhost:3000
# expect: header dot is green, all 4 tabs render with empty states
```

Then click **start agent swarm** in the dashboard:

- Live tab: Calls/sec climbs, tx feed populates, total counter ticks
- Margin tab: Numbers wake up
- Cohorts tab: 5 agents appear, p95 + z-scores compute
- Settlement tab: After ~30s, the first onchain batch should appear

If any of those don't happen, fix it tonight. **Do not save debugging for tomorrow.**

## 6. Production deploy (~20 min)

```bash
# Dashboard → Vercel (auto from GitHub)
vercel --cwd apps/dashboard
# Set the 4 NEXT_PUBLIC_ env vars in Vercel project settings.

# Seller + Swarm → Railway (or Fly.io)
# Both are simple Node apps; either works. Railway from GitHub:
#   1. New project → Deploy from GitHub
#   2. Set root directory: apps/seller-api  (and again for apps/swarm)
#   3. Set env vars
#   4. Set start command: npm start
```

After deploy, update `apps/dashboard/.env.local` (and Vercel project envs) so
`NEXT_PUBLIC_SELLER_URL` and `NEXT_PUBLIC_SWARM_URL` point at the Railway URLs.

## 7. Demo-day pre-flight (60 min before pitch)

1. **Charge laptop. Bring HDMI + USB-C dongles. Bring a phone hotspot.**
2. Open dashboard URL. Confirm green dot in header.
3. Hit `https://<seller>/healthz` → expect `{"ok":true}`.
4. Hit `https://<swarm>/status` → expect `{"running":false,"agents":5}`.
5. **Do a full dry run of the swarm** — fire it once, watch the dashboard fill, stop it.
6. Open the Loom backup video in a browser tab. Verify it plays.
7. Bookmark `https://arc-sepolia-explorer.circle.com` — judges may ask to see a tx onchain.

## 8. The demo (90 seconds)


| t    | action                                                                            |
| ---- | --------------------------------------------------------------------------------- |
| 0:00 | Open dashboard. Live tab. Empty state. Click **start agent swarm**.               |
| 0:10 | "5 simulated AI agents are now hitting 3 paid API endpoints in parallel."         |
| 0:15 | Counters explode. Point at calls/sec chart.                                       |
| 0:35 | Click **Margin** tab. "This is the comparison."                                   |
| 0:45 | "94% margin on Arc. −1,400% on Base. −14,900% on Ethereum."                       |
| 0:55 | Click **Cohorts**. "Z-score anomaly detection — agent_03 is 3.7σ off the cohort." |
| 1:15 | Click **Settlement**. Click an onchain tx hash → opens Arc explorer.              |
| 1:30 | Land it: "This is not an optimization. It's the only solution to the inequality." |


## 9. When things break

### Live demo fails (testnet flake, network issue, anything)

1. Switch to a backup tab on the dashboard with the **Loom recording playing**.
2. Or hit the seller's `POST /replay/start` endpoint (curl from your terminal).
  The dashboard will fill from Supabase history.

### `authorization_validity_too_short` error

The Circle SDK rejects authorizations with `validBefore` < 3 days. The SDK
should set this correctly by default, but if you see it in logs, check that
the `GatewayClient.pay()` call isn't being shimmed anywhere.

### `insufficient_balance`

An agent ran out of Gateway-deposited USDC. Either re-fund from the faucet or
just let the swarm continue with the remaining 4 agents.

### Dashboard SSE shows "reconnecting..." forever

The seller's CORS headers may be blocking the Vercel origin. Check
`apps/seller-api/src/index.ts` — the `cors()` middleware should be permissive
for the demo.

### Numbers don't move when you click Start

The swarm controller is probably down. `curl https://<swarm>/healthz`. If 502,
restart on Railway.

## 10. Submission

- Submit on lablab.ai before the deadline
- Include `docs/MARGIN_PROOF.md` content in the long description
- Include `docs/CIRCLE_FEEDBACK.md` content as the Circle Product Feedback section
- Mark which tracks: Per-API Monetization Engine + Real-Time Treasury / Ops
- Submit before pitching, not after

