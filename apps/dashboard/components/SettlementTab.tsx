"use client";

import { useMemo } from "react";
import type { NanometerEvent } from "@/lib/types";

// Arc testnet block explorer. Update if Arc rebrands the explorer URL.
const ARC_EXPLORER = "https://arc-sepolia-explorer.circle.com/tx";

/**
 * Settlement view — groups events by tx_ref (the Circle Gateway settlement
 * transaction reference) so each row represents one onchain batch.
 *
 * Pending authorizations = events that haven't received a tx_ref yet.
 */
export function SettlementTab({ events }: { events: NanometerEvent[] }) {
  const { batches, pending, totalSettled } = useMemo(() => {
    const byTx = new Map<string, { batchSize: number; value: number; latestTs: string }>();
    let pendingCount = 0;

    for (const e of events) {
      if (!e.tx_ref) {
        pendingCount++;
        continue;
      }
      if (!byTx.has(e.tx_ref)) {
        byTx.set(e.tx_ref, { batchSize: 0, value: 0, latestTs: e.ts });
      }
      const b = byTx.get(e.tx_ref)!;
      b.batchSize++;
      b.value += e.amount_usdc;
      if (e.ts > b.latestTs) b.latestTs = e.ts;
    }

    const batchList = Array.from(byTx.entries())
      .map(([tx_ref, b]) => ({ tx_ref, ...b }))
      .sort((a, b) => b.latestTs.localeCompare(a.latestTs));

    const settled = batchList.reduce((s, b) => s + b.value, 0);
    return { batches: batchList, pending: pendingCount, totalSettled: settled };
  }, [events]);

  const lastBatch = batches[0];
  const lastBatchAge = lastBatch ? formatAge(lastBatch.latestTs) : "—";

  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Metric label="Pending authz" sub="offchain · signed" value={String(pending)} />
        <Metric
          label="Last batch"
          sub={lastBatch ? `${lastBatch.batchSize} tx merged` : "no batches yet"}
          value={lastBatchAge}
        />
        <Metric
          label="Settled total"
          sub={`${batches.length} onchain batch${batches.length === 1 ? "" : "es"}`}
          value={`$${totalSettled.toFixed(4)}`}
        />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 text-sm font-medium">Onchain settlement events</div>
        <div className="font-mono text-xs">
          <div className="grid grid-cols-[110px_1fr_88px_72px] gap-2 border-b border-border pb-1.5 text-[11px] text-muted">
            <span>time</span>
            <span>tx ref</span>
            <span className="text-right">batch size</span>
            <span className="text-right">value</span>
          </div>

          {batches.length === 0 ? (
            <div className="py-4 text-muted">
              {pending > 0
                ? `${pending} authorization${pending === 1 ? "" : "s"} pending — Gateway batches every ~30s`
                : "no settlements yet — start the swarm"}
            </div>
          ) : (
            batches.slice(0, 10).map((b, i) => (
              <div
                key={b.tx_ref}
                className={`grid grid-cols-[110px_1fr_88px_72px] gap-2 py-2 items-center ${
                  i === Math.min(9, batches.length - 1) ? "" : "border-b border-dashed border-border"
                }`}
              >
                <span className="text-muted">{b.latestTs.slice(11, 19)}</span>
                <a
                  href={`${ARC_EXPLORER}/${b.tx_ref}`}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sky-400 hover:underline"
                >
                  {shortTx(b.tx_ref)}
                </a>
                <span className="text-right">{b.batchSize}</span>
                <span className="text-right">${b.value.toFixed(4)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-md bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="font-mono text-2xl">{value}</div>
      <div className="font-mono text-[11px] text-muted">{sub}</div>
    </div>
  );
}

function shortTx(tx: string): string {
  if (tx.length <= 14) return tx;
  return `${tx.slice(0, 8)}…${tx.slice(-6)}`;
}

function formatAge(ts: string): string {
  const ageMs = Date.now() - new Date(ts).getTime();
  if (ageMs < 1000) return "now";
  if (ageMs < 60_000) return `${Math.round(ageMs / 1000)}s ago`;
  if (ageMs < 3600_000) return `${Math.round(ageMs / 60_000)}m ago`;
  return `${Math.round(ageMs / 3600_000)}h ago`;
}
