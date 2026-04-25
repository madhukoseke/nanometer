import "dotenv/config";
import express from "express";
import cors from "cors";
import { createGatewayMiddleware } from "@circle-fin/x402-batching/server";
import { nanometer, bus } from "nanometer";
import { mountReplay } from "./replay.js";

const PORT = Number(process.env.PORT ?? 3001);
const SELLER_ADDRESS = requireEnv("SELLER_ADDRESS");
const NETWORKS = (process.env.NETWORKS ?? "eip155:5042002").split(",");

const app = express();
// Reflect any Origin (needed for EventSource to :3000 from the Next app on a different port).
app.use(cors({ origin: true }));
app.use(express.json());

// ---------------------------------------------------------------------------
// 1) Circle's x402 batching middleware. This handles 402 negotiation,
//    EIP-3009 verify, and Gateway settle. We pay it $0.001 per call.
// ---------------------------------------------------------------------------
const FACILITATOR = process.env.GATEWAY_FACILITATOR_URL ?? "https://gateway-api-testnet.circle.com";

const circleMw = createGatewayMiddleware({
  sellerAddress: SELLER_ADDRESS,
  networks: NETWORKS,
  description: "NanoMeter demo seller — paid AI inference endpoints",
  facilitatorUrl: FACILITATOR
});

// ---------------------------------------------------------------------------
// 2) NanoMeter — wraps req.payment + latency + status, fans out to:
//    - in-process EventBus (the SSE stream below)
//    - Supabase tx_events table (durable, cohort analytics)
// ---------------------------------------------------------------------------
const nm = nanometer({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY,
  verbose: true
});

// ---------------------------------------------------------------------------
// 3) Health + identity routes. NOT paid.
// ---------------------------------------------------------------------------
app.get("/healthz", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.get("/", (_req, res) => {
  res.json({
    name: "NanoMeter demo seller",
    paid_endpoints: ["/v1/infer", "/v1/search", "/v1/embed"],
    price: "$0.001"
  });
});

// ---------------------------------------------------------------------------
// 4) SSE — the dashboard's live event feed. Subscribes to the in-process bus.
// ---------------------------------------------------------------------------
app.get("/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no"
  });
  res.flushHeaders();

  // Heartbeat every 15s — keeps the connection alive through proxies.
  const heartbeat = setInterval(() => res.write(`: ping\n\n`), 15_000);

  const unsubscribe = bus.subscribe((event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// ---------------------------------------------------------------------------
// 5) The three paid endpoints. Each one:
//    - requires payment via Circle middleware first
//    - is then observed by nanometer
//    - returns mock data fast (the demo is about throughput, not real inference)
// ---------------------------------------------------------------------------
const PRICE = "$0.001";

app.post("/v1/infer", circleMw.require(PRICE), nm, (req, res) => {
  // Tiny artificial latency to make the dashboard's p95 column meaningful.
  const delay = 60 + Math.random() * 80;
  setTimeout(() => {
    res.json({
      model: "nm-demo-1",
      output: `inference result for ${(req.body?.prompt ?? "default").slice(0, 32)}`,
      tokens: 42
    });
  }, delay);
});

app.post("/v1/search", circleMw.require(PRICE), nm, (req, res) => {
  const delay = 80 + Math.random() * 100;
  setTimeout(() => {
    res.json({
      query: req.body?.q ?? "default",
      results: [
        { title: "result 1", url: "https://example.com/1" },
        { title: "result 2", url: "https://example.com/2" },
        { title: "result 3", url: "https://example.com/3" }
      ]
    });
  }, delay);
});

app.post("/v1/embed", circleMw.require(PRICE), nm, (req, res) => {
  const delay = 40 + Math.random() * 60;
  setTimeout(() => {
    // Fake 8-dim embedding. Real embeddings would be 1024+ dims.
    const vec = Array.from({ length: 8 }, () => Number((Math.random() * 2 - 1).toFixed(4)));
    res.json({ embedding: vec });
  }, delay);
});

// ---------------------------------------------------------------------------
// 6) Replay — demo-day safety net. POST /replay/start to re-stream the last
//    300 events from Supabase if the live testnet path flakes out on stage.
// ---------------------------------------------------------------------------
mountReplay(app);

// ---------------------------------------------------------------------------
// 7) Boot
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[seller] listening on :${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[seller] paid endpoints: /v1/infer  /v1/search  /v1/embed  @ ${PRICE}`);
  // eslint-disable-next-line no-console
  console.log(`[seller] dashboard SSE feed at /events`);
});

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    throw new Error(`missing env var: ${key} (see .env.example)`);
  }
  return v;
}
