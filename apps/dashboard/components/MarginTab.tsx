"use client";

import { COUNTERFACTUAL_GAS } from "@/lib/types";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface Props {
  totals: {
    totalCalls: number;
    totalRev: number;
    counterfactual: { arc: number; base: number; eth: number };
  };
}

export function MarginTab({ totals }: Props) {
  const { totalCalls, totalRev, counterfactual } = totals;
  const rev = totalRev || 0;

  const margin = {
    arc:  rev === 0 ? 0 : ((rev - counterfactual.arc)  / rev) * 100,
    base: rev === 0 ? 0 : ((rev - counterfactual.base) / rev) * 100,
    eth:  rev === 0 ? 0 : ((rev - counterfactual.eth)  / rev) * 100
  };

  const series = buildSeries(totalCalls);

  return (
    <>
      <div className="mb-4 rounded-md bg-surface px-4 py-3 font-mono text-xs text-muted">
        counterfactual: same workload, different settlement layer
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <BigCard
          label="arc + nanopayments"
          margin={margin.arc}
          revenue={rev}
          cost={counterfactual.arc}
          accent="accent"
          highlighted
        />
        <BigCard
          label="base mainnet"
          margin={margin.base}
          revenue={rev}
          cost={counterfactual.base}
          accent="warn"
        />
        <BigCard
          label="ethereum mainnet"
          margin={margin.eth}
          revenue={rev}
          cost={counterfactual.eth}
          accent="danger"
        />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium">Cumulative cost — live workload</span>
          <span className="font-mono text-[11px] text-muted">{totalCalls} calls @ $0.001</span>
        </div>
        <div className="h-52 w-full">
          <ResponsiveContainer>
            <LineChart data={series} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <XAxis dataKey="i" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `${v} calls`} />
              <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `$${(v as number).toFixed(2)}`} />
              <Tooltip
                contentStyle={{ background: "#141414", border: "1px solid #1f1f1f", fontSize: 12 }}
                formatter={(v) => `$${(v as number).toFixed(4)}`} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#71717a" }} />
              <Line type="monotone" dataKey="eth"  stroke="#A32D2D" strokeWidth={1.5} strokeDasharray="6 3" dot={false} name="Ethereum" isAnimationActive={false} />
              <Line type="monotone" dataKey="base" stroke="#BA7517" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Base" isAnimationActive={false} />
              <Line type="monotone" dataKey="arc"  stroke="#1D9E75" strokeWidth={1.5} dot={false} name="Arc" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

function BigCard({
  label, margin, revenue, cost, accent, highlighted
}: {
  label: string;
  margin: number;
  revenue: number;
  cost: number;
  accent: "accent" | "warn" | "danger";
  highlighted?: boolean;
}) {
  const colorMap = { accent: "text-accent", warn: "text-warn", danger: "text-danger" } as const;
  const labelColor = colorMap[accent];
  const ringClass = highlighted ? "border-2 border-accent" : "border border-border";

  return (
    <div className={`rounded-lg ${ringClass} bg-bg p-4`}>
      <div className={`mb-1 font-mono text-[11px] ${labelColor}`}>{label}</div>
      <div className={`font-mono text-3xl ${labelColor}`}>{formatMargin(margin)}</div>
      <div className="text-xs text-muted">net margin</div>
      <div className="mt-3 border-t border-border pt-3 font-mono text-[11px] leading-relaxed text-muted">
        revenue: ${revenue.toFixed(3)}<br />
        cost: ${cost.toFixed(4)}<br />
        per-call gas: {label.startsWith("arc") ? "≈ $0.000000" : `$${(cost / Math.max(1, revenue / 0.001)).toFixed(4)}`}
      </div>
    </div>
  );
}

function formatMargin(m: number): string {
  if (!Number.isFinite(m) || m === 0) return "—";
  const rounded = Math.round(m);
  if (rounded > 0) return `+${rounded}%`;
  return `${rounded}%`;
}

/**
 * Cumulative cost across N calls for each settlement layer. Pre-computed and
 * static so the chart paints instantly when the user lands on the tab.
 */
function buildSeries(currentCalls: number): { i: number; arc: number; base: number; eth: number }[] {
  // Project out to at least 200 points so the line has room to grow during demos.
  const horizon = Math.max(200, currentCalls);
  const out: { i: number; arc: number; base: number; eth: number }[] = [];
  for (let i = 1; i <= horizon; i++) {
    out.push({
      i,
      arc:  i * COUNTERFACTUAL_GAS.arc,
      base: i * COUNTERFACTUAL_GAS.base,
      eth:  i * COUNTERFACTUAL_GAS.eth
    });
  }
  return out;
}
