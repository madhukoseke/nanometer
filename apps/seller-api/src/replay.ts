/**
 * Replay endpoint — reads historical tx_events from Supabase and re-emits them
 * over the in-process EventBus, paced to mimic real-time. This is the demo-day
 * safety net: if the live swarm + Circle testnet path fails on stage, hit
 * `/replay/start` and the dashboard fills with a previously-recorded run.
 *
 * Wire this up in the seller-api index.ts AFTER the bus is imported:
 *
 *   import { mountReplay } from "./replay.js";
 *   mountReplay(app);
 */
import type { Express, Request, Response } from "express";
import { createClient } from "@supabase/supabase-js";
import { bus, type NanometerEvent } from "nanometer";

let activeReplay: { stop: () => void } | null = null;

export function mountReplay(app: Express): void {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.warn("[replay] disabled — SUPABASE_URL / SUPABASE_SERVICE_KEY not set");
    return;
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  app.post("/replay/start", async (req: Request, res: Response) => {
    if (activeReplay) {
      return res.status(409).json({ error: "replay already running" });
    }

    // Pull the most recent run. For a hackathon, "the last 300 events" is fine —
    // for production you'd parameterize by run_id or time window.
    const { data, error } = await supabase
      .from("tx_events")
      .select("*")
      .order("ts", { ascending: true })
      .limit(300);

    if (error || !data || data.length === 0) {
      return res.status(503).json({ error: error?.message ?? "no events to replay" });
    }

    const speedup = Number(req.query.speedup ?? 1); // 1x = real-time, 4x = 4× faster
    activeReplay = playback(data as NanometerEvent[], speedup);
    return res.json({ started: true, count: data.length, speedup });
  });

  app.post("/replay/stop", (_req, res) => {
    if (!activeReplay) return res.status(409).json({ error: "no replay running" });
    activeReplay.stop();
    activeReplay = null;
    res.json({ stopped: true });
  });
}

function playback(rows: NanometerEvent[], speedup: number): { stop: () => void } {
  const sorted = [...rows].sort((a, b) => a.ts.localeCompare(b.ts));
  const t0 = new Date(sorted[0].ts).getTime();
  const startedAt = Date.now();
  let stopped = false;
  const handles: NodeJS.Timeout[] = [];

  for (const ev of sorted) {
    const offset = (new Date(ev.ts).getTime() - t0) / speedup;
    const handle = setTimeout(() => {
      if (stopped) return;
      // Re-emit with current timestamp so the dashboard's rolling-window math works.
      bus.emit({ ...ev, ts: new Date().toISOString() });
    }, offset);
    handles.push(handle);
  }

  const finishAt = (new Date(sorted[sorted.length - 1].ts).getTime() - t0) / speedup;
  setTimeout(() => {
    activeReplay = null;
    console.log(`[replay] finished after ${(Date.now() - startedAt) / 1000}s`);
  }, finishAt + 100);

  return {
    stop: () => {
      stopped = true;
      for (const h of handles) clearTimeout(h);
    }
  };
}
