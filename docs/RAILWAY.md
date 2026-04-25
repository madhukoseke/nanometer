# Deploy seller + swarm on Railway

## Railpack error (`railpack process exited` / `RAILPACK_SPA_OUTPUT_DIR` hint)

The monorepo includes **Next.js**; Railpack may try to build it as a frontend and fail. Pick **one** fix:

### Option A — Use Docker (most reliable for the seller)

1. Service → **Settings** → set **Builder** to **Dockerfile** (or “Docker” depending on UI).
2. **Dockerfile path:** `Dockerfile.seller` (file lives at the **repo root**).
3. **Root directory** for the service: **/** (repository root) so the build context includes `package.json`, `packages/nanometer`, and `apps/seller-api`.
4. **Start** is the `CMD` in `Dockerfile.seller` (no need to set separately, unless you override). Set **`PORT`** is automatic on Railway; the app reads it.

### Option B — Stay on Railpack, override commands

In the **same** service, add **variables**:

| Variable | Value |
|----------|--------|
| `RAILPACK_BUILD_CMD` | `npm install && npm run build -w @nanometer/seller-api` |
| `RAILPACK_START_CMD` | `node apps/seller-api/dist/index.js` |

Leave the **Build Command** field **empty** in the UI if these env vars are set (so Railpack uses them and does not run only `tsc` or a broken auto-detect).

If builds still fail, set **`RAILPACK_VERBOSE=1`** and read the log for the real error.

---

# Deploy seller + swarm on Railway

The **dashboard** is for Vercel. These steps deploy the **Express** apps from the **monorepo root** so the `nanometer` package resolves for the seller.

## Prep (once)

- GitHub repo connected to Railway.
- **Supabase** project created; `supabase/schema.sql` run in the SQL editor.
- A **SELLER_ADDRESS** (EVM) you control, and (for the swarm) **AGENT_KEYS** in Railway variables (not committed).

---

## Service 1 — Seller API

1. **New project** → **Deploy from GitHub** → select `nanometer` (or your repo name).
2. **Add a new service** from the same repo (or “Empty” then connect repo).
3. **Settings** → **Service** (or “Build / Deploy”):
   - **Root directory:** leave **empty** or `.` = **repository root** (not `apps/seller-api`).  
   - **Builder:** Nixpacks (default) is fine, or use **Docker** if you prefer.
   - **Build command:** leave **empty** so npm uses `package.json`, **or** set **exactly**:
     ```bash
     npm install && npm run build -w @nanometer/seller-api
     ```
     **Do not** set the build command to plain `tsc` — that skips the `nanometer` package. If you ever see only `> tsc` in logs, Railway is ignoring the workspace `build` script.

4. **How the build works:** `apps/seller-api` uses TypeScript **project references** so `tsc -b` compiles `packages/nanometer` first, then the seller. The repo root must include **`packages/nanometer`** (full monorepo checkout). Optional explicit build:

   ```bash
   npm install && npm run build -w @nanometer/seller-api
   ```

   (`@nanometer/seller-api`’s `build` script compiles `nanometer` first, then the seller),    **or** explicitly:

   ```bash
   npm install && npm run build -w nanometer && npm run build -w @nanometer/seller-api
   ```

   **If you must set a TypeScript-only command** (not recommended), from **repo root**:

   ```bash
   cd apps/seller-api && npx tsc -b .
   ```

   Plain `tsc` without `-b` does **not** build project references.

5. **Start command:**

   ```bash
   node apps/seller-api/dist/index.js
   ```

6. **Environment variables** (Variables tab), add at least:

   | Name | Example / notes |
   |------|-----------------|
   | `SELLER_ADDRESS` | `0x…` (your receiver wallet) |
   | `SUPABASE_URL` | `https://xxx.supabase.co` |
   | `SUPABASE_SERVICE_KEY` | **service_role** key (server only) |
   | `NETWORKS` | `eip155:5042002` |
   | `GATEWAY_FACILITATOR_URL` | `https://gateway-api-testnet.circle.com` |
   | (optional) `NODE_VERSION` or use **Settings → Node** = **20** if builds fail |

   Railway sets **`PORT`** — the seller already uses it.

7. **Generate domain:** Settings → **Networking** → **Generate domain** (HTTPS URL).

8. **Check:** open `https://YOUR-URL/healthz` — expect `{"ok":true,…}`.

9. **Copy the base URL** (no path), e.g. `https://seller-production-xxxx.up.railway.app` → use in Vercel as `NEXT_PUBLIC_SELLER_URL` and in the swarm as `SELLER_URL`.

---

## Service 2 — Swarm (second service, same project)

1. In the same Railway project, **+ New** → **GitHub Repo** → same repo.

2. **Root directory:** **repository root** (same as seller).

3. **Build command** (install only; no separate build needed for `tsx`):

   ```bash
   npm install
   ```

4. **Start command:**

   ```bash
   npx tsx apps/swarm/src/server.ts
   ```

5. **Environment variables:**

   | Name | Value |
   |------|--------|
   | `AGENT_KEYS` | `0xabc...,0xdef...,` (5 keys, comma-separated, no spaces) |
   | `SELLER_URL` | `https://YOUR-SELLER-URL` from service 1 (https, no trailing slash) |
   | `CHAIN` | `arcTestnet` |
   | (optional) `TARGET_RPS`, `RUN_DURATION_SEC` | defaults are fine to start |

   **Do not set** `SWARM_PORT` on Railway; **`PORT` is set automatically** and the app listens on it.

6. **Generate domain** for this service and open `https://YOUR-SWARM-URL/status` — expect JSON with `running`, `agents`, etc.

7. Put this base URL in Vercel as `NEXT_PUBLIC_SWARM_URL`, redeploy the dashboard.

---

## Troubleshooting

| Issue | What to try |
|-------|-------------|
| Seller build: cannot find `nanometer` | Root must be **repo root**, and build must include `build -w nanometer` before `seller-api`. |
| Seller crashes on start | Check Variables; missing `SELLER_ADDRESS` or Supabase. Read **Deploy logs**. |
| Swarm: port / connection refused | Swarm now uses `PORT` from Railway; redeploy after latest code. |
| CORS in browser to seller | Server uses `cors({ origin: true })` — if problems persist, set explicit origin to your Vercel URL. |
| Swarm **paid** increases but dashboard **events** stay 0, and `NEXT_PUBLIC_SELLER_URL` already matches `SELLER_URL` | Restart `next dev` / redeploy Vercel so `NEXT_PUBLIC_*` is picked up. Set the **seller** service to **1 replica** (Scale): the live SSE bus is in-memory; if Railway runs 2+ instances, paid calls can hit instance A while `/events` stays on instance B. |

---

## Cost

Railway has a free trial / limited hours; for a hackathon, two small services are usually within free tier. Check [railway.app/pricing](https://railway.app/pricing).
