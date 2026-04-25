"use client";

import { useEffect, useState } from "react";
import { ensureApiBaseUrl } from "@/lib/ensureApiBaseUrl";

const SELLER = ensureApiBaseUrl(process.env.NEXT_PUBLIC_SELLER_URL ?? "http://localhost:3001");
const SWARM = ensureApiBaseUrl(process.env.NEXT_PUBLIC_SWARM_URL ?? "http://localhost:3002");

export type SwarmStatus = {
  running: boolean;
  /** True while USDC is being moved wallet → Circle Gateway (on-chain) */
  starting?: boolean;
  agents: number;
  target_rps: number;
  duration_sec: number;
  calls: number;
  errors: number;
  started_at: number | null;
} | null;

/**
 * Poll seller health + swarm /status so the UI can explain “live but no events”.
 */
export function useDemoDiagnostics(pollMs = 1500) {
  const [sellerOk, setSellerOk] = useState<boolean | null>(null);
  const [swarm, setSwarm] = useState<SwarmStatus>(null);
  const [swarmFetchError, setSwarmFetchError] = useState(false);

  useEffect(() => {
    let stopped = false;

    async function tick() {
      try {
        const h = await fetch(`${SELLER}/healthz`, { cache: "no-store" });
        if (!stopped) setSellerOk(h.ok);
      } catch {
        if (!stopped) setSellerOk(false);
      }
      try {
        const s = await fetch(`${SWARM}/status`, { cache: "no-store" });
        if (s.ok) {
          const j = (await s.json()) as SwarmStatus;
          if (!stopped) {
            setSwarm(j);
            setSwarmFetchError(false);
          }
        } else {
          if (!stopped) setSwarmFetchError(true);
        }
      } catch {
        if (!stopped) {
          setSwarm(null);
          setSwarmFetchError(true);
        }
      }
    }

    void tick();
    const id = setInterval(tick, pollMs);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [pollMs]);

  return { sellerUrl: SELLER, swarmUrl: SWARM, sellerOk, swarm, swarmFetchError };
}
