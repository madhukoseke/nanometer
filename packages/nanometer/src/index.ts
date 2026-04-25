import type { Request, Response, NextFunction, RequestHandler } from "express";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * The shape of `req.payment` after Circle's createGatewayMiddleware runs.
 * We don't import Circle's types directly to keep this package framework-agnostic.
 */
interface CirclePaymentInfo {
  verified: boolean;
  payer: string;
  amount: string;        // USDC in smallest units (6 decimals) or a legacy dollar string
  network: string;       // e.g. "eip155:5042002" (Arc testnet)
  transaction?: string;  // settlement tx ref, populated after settle()
}

declare module "express-serve-static-core" {
  interface Request {
    payment?: CirclePaymentInfo;
  }
}

/**
 * A single paid call — one row in the tx_events table, one event in the SSE stream.
 */
export interface NanometerEvent {
  ts: string;                     // ISO timestamp
  agent_addr: string;             // payer address (lowercased)
  endpoint: string;               // request path
  method: string;
  amount_usdc: number;            // parsed dollar amount (0.001, not "0.001")
  latency_ms: number;             // wall-clock time from req start to res finish
  status: number;                 // HTTP status the seller returned
  tx_ref?: string;                // Circle's transaction ref
  network: string;                // chain identifier
  verified: boolean;
}

export interface NanometerOptions {
  /** Supabase project URL. If omitted, events go only to the in-memory bus. */
  supabaseUrl?: string;
  /** Supabase service-role key (server-side only). */
  supabaseKey?: string;
  /** Table name for tx events. Default: tx_events */
  tableName?: string;
  /** Optional callback fired on every paid call — useful for SSE fan-out. */
  onEvent?: (event: NanometerEvent) => void;
  /** Whether to log to console. Default: true */
  verbose?: boolean;
}

/**
 * In-process event bus. The dashboard's SSE route subscribes to this,
 * so calls to a Vercel-hosted dashboard can fan out events without a
 * separate pub/sub broker for the demo.
 *
 * For multi-instance production, swap this for Supabase Realtime or
 * Redis pub/sub — the API surface is the same.
 */
class EventBus {
  private listeners: Set<(e: NanometerEvent) => void> = new Set();
  subscribe(fn: (e: NanometerEvent) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  emit(e: NanometerEvent): void {
    for (const fn of this.listeners) {
      try { fn(e); } catch (err) { /* never let a listener crash the request */ }
    }
  }
}

export const bus = new EventBus();

/**
 * The middleware. Mount AFTER Circle's createGatewayMiddleware().require(price).
 *
 *   app.use(circleMw.require("$0.001"));
 *   app.use(nanometer({ supabaseUrl, supabaseKey }));
 *
 * Captures req.payment + latency + status on response finish, writes to
 * Supabase async (never blocks the response), emits to the in-process bus.
 */
export function nanometer(opts: NanometerOptions = {}): RequestHandler {
  const verbose = opts.verbose ?? true;
  const tableName = opts.tableName ?? "tx_events";

  let supabase: SupabaseClient | null = null;
  if (opts.supabaseUrl && opts.supabaseKey) {
    supabase = createClient(opts.supabaseUrl, opts.supabaseKey, {
      auth: { persistSession: false }
    });
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();

    res.on("finish", () => {
      // Only record paid calls. Free routes pass through silently.
      if (!req.payment) return;

      const event: NanometerEvent = {
        ts: new Date().toISOString(),
        agent_addr: req.payment.payer.toLowerCase(),
        endpoint: req.path,
        method: req.method,
        amount_usdc: parseAmount(req.payment.amount),
        latency_ms: Date.now() - startedAt,
        status: res.statusCode,
        tx_ref: req.payment.transaction,
        network: req.payment.network,
        verified: req.payment.verified
      };

      // Fan out to in-process bus immediately (SSE consumers see this in <10ms).
      bus.emit(event);
      opts.onEvent?.(event);

      if (verbose) {
        const dollars = event.amount_usdc.toFixed(6);
        // eslint-disable-next-line no-console
        console.log(
          `[nanometer] ${event.method} ${event.endpoint} ` +
          `agent=${event.agent_addr.slice(0, 10)}… ` +
          `$${dollars} ${event.latency_ms}ms ${event.status}`
        );
      }

      // Async write to Supabase. Errors are logged but never thrown —
      // the user's request has already returned.
      if (supabase) {
        supabase
          .from(tableName)
          .insert({
            ts: event.ts,
            agent_addr: event.agent_addr,
            endpoint: event.endpoint,
            method: event.method,
            amount_usdc: event.amount_usdc,
            latency_ms: event.latency_ms,
            status: event.status,
            tx_ref: event.tx_ref,
            network: event.network,
            verified: event.verified
          })
          .then(({ error }) => {
            if (error && verbose) {
              // eslint-disable-next-line no-console
              console.error("[nanometer] supabase write failed:", error.message);
            }
          });
      }
    });

    next();
  };
}

/**
 * Parse Circle's amount into USDC (decimal dollars).
 * v3+ Gateway middleware may attach 6-decimal atomic units (integer string);
 * older paths used dollar strings like "0.001".
 */
function parseAmount(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/^\$/, "").trim();
  if (/^\d+$/.test(cleaned)) {
    try {
      return Number(BigInt(cleaned)) / 1_000_000;
    } catch {
      return 0;
    }
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export type { CirclePaymentInfo };
