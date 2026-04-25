"use client";

import { useEffect, useMemo, useState } from "react";
import type { NanometerEvent } from "@/lib/types";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

interface Totals {
  totalCalls: number;
  totalRev: number;
  activeAgents: number;
}

export function LiveTab({ events, totals }: { events: NanometerEvent[]; totals: Totals }) {
  const rps = useRpsSeries(events, 60); // last 60 seconds

  return (
    <>
      <MetricStrip totals={totals} currentRps={rps[rps.length - 1]?.rps ?? 0} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_1fr]">
        <Card title="Calls per second" subtitle="last 60s">
          <div className="h-44 w-full">
            <ResponsiveContainer>
              <LineChart data={rps} margin={{ top: 4, right: 8, bottom: 4, left: -16 }}>
                <XAxis dataKey="t" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} interval={9} />
                <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ background: "#141414", border: "1px solid #1f1f1f", fontSize: 12 }} />
                <Line type="monotone" dataKey="rps" stroke="#1D9E75" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Tx feed" subtitle="x402 verified">
          <ul className="h-44 overflow-hidden font-mono text-[11px] leading-6">
            {events.slice(0, 14).map((e, i) => (
              <li key={`${e.ts}-${i}`} className={e.status >= 400 ? "text-danger" : ""}>
                <span className="text-zinc-600">{e.ts.slice(11, 19)}</span>{" "}
                <span>{shortAddr(e.agent_addr)}</span>{" "}
                <span>{e.endpoint}</span>{" "}
                <span className="text-muted">{e.latency_ms}ms</span>{" "}
                <span>{e.status}</span>{" "}
                <span className="text-muted">${e.amount_usdc.toFixed(3)}</span>
              </li>
            ))}
            {events.length === 0 && (
              <li className="text-muted">awaiting traffic…</li>
            )}
          </ul>
        </Card>
      </div>
    </>
  );
}

function MetricStrip({ totals, currentRps }: { totals: Totals; currentRps: number }) {
  return (
    <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
      <Metric label="Calls / sec" value={String(currentRps)} />
      <Metric label="Total calls" value={totals.totalCalls.toLocaleString()} />
      <Metric label="Revenue (USDC)" value={totals.totalRev.toFixed(6)} />
      <Metric label="Active agents" value={String(totals.activeAgents)} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-mono text-2xl">{value}</div>
    </div>
  );
}

export function Card({
  title, subtitle, children
}: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        {subtitle && <span className="font-mono text-[11px] text-muted">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

function shortAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

/**
 * Build a 60-second rolling window of calls/sec from the event buffer.
 * Driven off a 1Hz tick — independent of event arrival cadence — so the
 * chart still updates smoothly when traffic momentarily pauses.
 */
function useRpsSeries(events: NanometerEvent[], windowSec: number): { t: number; rps: number }[] {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    const now = Date.now();
    const buckets = new Array(windowSec).fill(0);
    for (const e of events) {
      const ageSec = Math.floor((now - new Date(e.ts).getTime()) / 1000);
      if (ageSec >= 0 && ageSec < windowSec) buckets[windowSec - 1 - ageSec]++;
    }
    return buckets.map((rps, i) => ({ t: i - (windowSec - 1), rps }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, tick, windowSec]);
}
