"use client";

import { useMemo } from "react";
import type { NanometerEvent } from "@/lib/types";

/**
 * Cohort analytics. For each unique agent address we compute:
 *   - calls       : count of events
 *   - spend       : sum of amount_usdc
 *   - p95         : 95th percentile latency
 *   - successRate : non-error fraction
 *   - cps         : "cost per success" — total spend / successful calls
 *   - cpsZ        : z-score of cps vs the cohort population
 *
 * The z-score is the load-bearing fintech move here: it surfaces agents that
 * are paying more per useful outcome than their peers, which in production
 * would flag fraud, broken retry loops, or cohort segmentation issues.
 */
export function CohortsTab({ events }: { events: NanometerEvent[] }) {
  const cohorts = useMemo(() => buildCohorts(events), [events]);
  const flagged = cohorts.filter(c => c.cpsZ >= 2);
  const topSpender = cohorts[0];
  const medianSpend = median(cohorts.map(c => c.spend));

  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <SummaryCard label="Top spender">
          {topSpender ? (
            <>
              <div className="font-mono text-lg">{topSpender.id}</div>
              <div className="font-mono text-[11px] text-muted">
                ${topSpender.spend.toFixed(4)} · {topSpender.calls} calls
              </div>
            </>
          ) : <Placeholder />}
        </SummaryCard>

        <SummaryCard label="Median spend">
          {cohorts.length > 0 ? (
            <>
              <div className="font-mono text-lg">${medianSpend.toFixed(4)}</div>
              <div className="font-mono text-[11px] text-muted">
                across {cohorts.length} agents
              </div>
            </>
          ) : <Placeholder />}
        </SummaryCard>

        <SummaryCard label="Anomalies" tone={flagged.length > 0 ? "danger" : "neutral"}>
          <div className={`font-mono text-lg ${flagged.length > 0 ? "text-danger" : ""}`}>
            {flagged.length} flagged
          </div>
          <div className="font-mono text-[11px] text-muted">cost-per-success z ≥ 2</div>
        </SummaryCard>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 text-sm font-medium">Agent leaderboard</div>
        <div className="font-mono text-xs">
          <div className="grid grid-cols-[28px_1fr_72px_88px_72px_92px] gap-2 border-b border-border pb-1.5 text-[11px] text-muted">
            <span>#</span>
            <span>address</span>
            <span className="text-right">calls</span>
            <span className="text-right">spend</span>
            <span className="text-right">p95 ms</span>
            <span className="text-right">cps z</span>
          </div>
          {cohorts.length === 0 ? (
            <div className="py-4 text-muted">no agents observed yet — start the swarm</div>
          ) : (
            cohorts.map((c, i) => <CohortRow key={c.id} c={c} rank={i + 1} isLast={i === cohorts.length - 1} />)
          )}
        </div>
      </div>
    </>
  );
}

function CohortRow({
  c, rank, isLast
}: { c: Cohort; rank: number; isLast: boolean }) {
  const flagged = c.cpsZ >= 2;
  const baseRow = "grid grid-cols-[28px_1fr_72px_88px_72px_92px] gap-2 py-2 items-center";
  const flaggedRow = flagged
    ? "rounded-md bg-danger/15 px-2 -mx-2 text-danger"
    : isLast
      ? ""
      : "border-b border-dashed border-border";

  return (
    <div className={`${baseRow} ${flaggedRow}`}>
      <span>{rank}</span>
      <span className="truncate">
        <span>{c.id}</span>
        <span className="ml-2 text-muted">{shortAddr(c.id)}</span>
      </span>
      <span className="text-right">{c.calls}</span>
      <span className="text-right">${c.spend.toFixed(4)}</span>
      <span className="text-right">{c.p95}</span>
      <span className={`text-right ${flagged ? "font-medium" : "text-muted"}`}>
        {fmtZ(c.cpsZ)} {flagged ? "⚠" : ""}
      </span>
    </div>
  );
}

function SummaryCard({
  label, tone = "neutral", children
}: { label: string; tone?: "neutral" | "danger"; children: React.ReactNode }) {
  const bg = tone === "danger" ? "bg-danger/15" : "bg-surface";
  const labelColor = tone === "danger" ? "text-danger" : "text-muted";
  return (
    <div className={`rounded-md ${bg} p-4`}>
      <div className={`text-xs ${labelColor}`}>{label}</div>
      {children}
    </div>
  );
}

function Placeholder() {
  return <div className="font-mono text-lg text-muted">—</div>;
}

interface Cohort {
  id: string;
  calls: number;
  spend: number;
  p95: number;
  successRate: number;
  cps: number;       // cost per success
  cpsZ: number;      // z-score of cps vs the cohort
}

function buildCohorts(events: NanometerEvent[]): Cohort[] {
  if (events.length === 0) return [];

  const byAgent = new Map<string, NanometerEvent[]>();
  for (const e of events) {
    if (!byAgent.has(e.agent_addr)) byAgent.set(e.agent_addr, []);
    byAgent.get(e.agent_addr)!.push(e);
  }

  const rows: Cohort[] = [];
  for (const [addr, calls] of byAgent.entries()) {
    const successes = calls.filter(c => c.status < 400).length;
    const spend     = calls.reduce((s, c) => s + c.amount_usdc, 0);
    const latencies = calls.map(c => c.latency_ms);
    rows.push({
      id: addr,
      calls: calls.length,
      spend,
      p95: percentile(latencies, 95),
      successRate: calls.length === 0 ? 0 : successes / calls.length,
      cps: successes === 0 ? Number.POSITIVE_INFINITY : spend / successes,
      cpsZ: 0
    });
  }

  // Compute z-scores on the cps distribution. Filter out infinities first
  // so a single zero-success agent doesn't poison the population mean.
  const finiteCps = rows.filter(r => Number.isFinite(r.cps)).map(r => r.cps);
  const mu  = mean(finiteCps);
  const sig = stdev(finiteCps, mu);
  for (const r of rows) {
    if (!Number.isFinite(r.cps) || sig === 0) {
      r.cpsZ = 0;
    } else {
      r.cpsZ = (r.cps - mu) / sig;
    }
  }

  // Sort by spend desc, anomalies bubble to view via the flag column not row order.
  rows.sort((a, b) => b.spend - a.spend);
  return rows;
}

// ---------- stats helpers ----------
function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}
function stdev(xs: number[], mu: number): number {
  if (xs.length <= 1) return 0;
  const variance = xs.reduce((s, x) => s + (x - mu) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}
function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]);
}
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
function fmtZ(z: number): string {
  const sign = z >= 0 ? "+" : "";
  return `${sign}${z.toFixed(1)}σ`;
}
function shortAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
