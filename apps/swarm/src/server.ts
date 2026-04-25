/**
 * Swarm controller: a small HTTP server that accepts /start and /stop commands
 * from the dashboard, and orchestrates 5 GatewayClient buyer agents firing
 * paid requests at the seller API in parallel.
 *
 * Architecture:
 *   dashboard --POST /start--> swarm --(N parallel loops)--> seller API
 *                                              |
 *                                              v
 *                                      Circle Gateway batched settlement
 */
import "dotenv/config";
import express from "express";
import cors from "cors";
import type { GatewayClient } from "@circle-fin/x402-batching/client";
import { getSwarmClients, hasAgentKeys, CHAIN } from "./agents.js";
import { ensureGatewayDeposits } from "./ensureGatewayDeposit.js";

// Railway/Render set PORT; local dev may use SWARM_PORT (e.g. 3002).
const SWARM_PORT = Number(process.env.PORT || process.env.SWARM_PORT || 3002);
const SELLER_URL = process.env.SELLER_URL ?? "http://localhost:3001";
const RUN_DURATION_SEC = Number(process.env.RUN_DURATION_SEC ?? 90);
const TARGET_RPS = Number(process.env.TARGET_RPS ?? 12);

if (!hasAgentKeys()) {
  // eslint-disable-next-line no-console
  console.error("[swarm] AGENT_KEYS is empty. Run `npm run bootstrap` first, then fund the wallets.");
  process.exit(1);
}

const clients: { id: string; client: GatewayClient }[] = getSwarmClients();
for (const c of clients) {
  // eslint-disable-next-line no-console
  console.log(`[swarm] ${c.id} -> ${c.client.address}`);
}

const ENDPOINTS = ["/v1/infer", "/v1/search", "/v1/embed"];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let activeRun: { stop: () => void } | null = null;
/** True while on-chain USDC → Gateway deposits run before the pay loop. */
let starting = false;
let stats = { calls: 0, errors: 0, startedAt: 0 };

// ---------------------------------------------------------------------------
// Run loop. Per-agent inter-call delay is computed so the swarm overall
// targets TARGET_RPS, with random jitter to avoid burst alignment.
// ---------------------------------------------------------------------------
function startSwarm(): { stop: () => void } {
  stats = { calls: 0, errors: 0, startedAt: Date.now() };
  const perAgentInterval = (1000 * clients.length) / TARGET_RPS;
  const stopFlags = clients.map(() => ({ stop: false }));

  clients.forEach((agent, idx) => {
    const flag = stopFlags[idx];

    // Stagger the start so all 5 agents don't fire at t=0.
    const stagger = (perAgentInterval / clients.length) * idx;

    setTimeout(() => {
      void runAgent(agent, flag, perAgentInterval);
    }, stagger);
  });

  // Auto-stop after RUN_DURATION_SEC.
  const timeout = setTimeout(() => stopAll(), RUN_DURATION_SEC * 1000);

  function stopAll() {
    clearTimeout(timeout);
    for (const f of stopFlags) f.stop = true;
    activeRun = null;
    const elapsed = (Date.now() - stats.startedAt) / 1000;
    // eslint-disable-next-line no-console
    console.log(
      `[swarm] stopped. ${stats.calls} calls in ${elapsed.toFixed(1)}s ` +
        `(${(stats.calls / elapsed).toFixed(1)} rps), ${stats.errors} errors`
    );
  }

  return { stop: stopAll };
}

async function runAgent(
  agent: { id: string; client: GatewayClient },
  flag: { stop: boolean },
  intervalMs: number
) {
  while (!flag.stop) {
    const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
    const url = `${SELLER_URL}${endpoint}`;
    const body = makeBody(endpoint);

    try {
      const result = await agent.client.pay(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      stats.calls++;
      if (stats.calls % 25 === 0) {
        // eslint-disable-next-line no-console
        console.log(`[swarm] +${stats.calls} calls, latest tx=${result.transaction?.slice(0, 10)}…`);
      }
    } catch (err) {
      stats.errors++;
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn(`[swarm] ${agent.id} error: ${msg.slice(0, 100)}`);
      if (msg.includes("Insufficient")) flag.stop = true;
    }

    // Inter-call delay with ±30% jitter.
    const jitter = intervalMs * (0.7 + Math.random() * 0.6);
    await sleep(jitter);
  }
}

function makeBody(endpoint: string): unknown {
  switch (endpoint) {
    case "/v1/infer":
      return { prompt: pick(["hello", "summarize this", "what is gas"]) };
    case "/v1/search":
      return { q: pick(["arc network", "circle nanopayments", "x402"]) };
    case "/v1/embed":
      return { text: pick(["agentic commerce", "sub-cent payments"]) };
    default:
      return {};
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Control plane
// ---------------------------------------------------------------------------
const app = express();
app.use(cors());
app.use(express.json());

app.get("/healthz", (_req, res) => res.json({ ok: true, agents: clients.length }));

app.get("/status", (_req, res) => {
  res.json({
    running: activeRun !== null,
    starting,
    agents: clients.length,
    target_rps: TARGET_RPS,
    duration_sec: RUN_DURATION_SEC,
    calls: stats.calls,
    errors: stats.errors,
    started_at: stats.startedAt || null
  });
});

app.post("/start", (_req, res) => {
  if (activeRun) {
    return res.status(409).json({ error: "already running" });
  }
  if (starting) {
    return res.status(409).json({ error: "starting — wait for USDC → Gateway deposit step in logs" });
  }
  starting = true;

  // Respond immediately; deposits can take 30s+ per agent on testnet.
  res.json({ started: true, agents: clients.length, message: "Deposits run first; watch the swarm terminal." });

  void (async () => {
    // eslint-disable-next-line no-console
    console.log("[swarm] checking Circle Gateway balance (faucet only fills the wallet)…");
    try {
      await ensureGatewayDeposits(clients);
      activeRun = startSwarm();
      // eslint-disable-next-line no-console
      console.log(`[swarm] pay loop — ${clients.length} agents, ${TARGET_RPS} rps target, ${RUN_DURATION_SEC}s`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[swarm] start failed after deposit step:", e);
    } finally {
      starting = false;
    }
  })();
});

app.post("/stop", (_req, res) => {
  if (!activeRun) {
    return res.status(409).json({ error: "not running" });
  }
  activeRun.stop();
  res.json({ stopped: true });
});

app.listen(SWARM_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[swarm] control plane on :${SWARM_PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[swarm] -> seller at ${SELLER_URL}`);
  // eslint-disable-next-line no-console
  console.log(`[swarm] -> chain ${CHAIN}`);
  // eslint-disable-next-line no-console
  console.log(`[swarm] tip: run "npm run deposit" once after faucet, or use Start and watch logs.`);
});
