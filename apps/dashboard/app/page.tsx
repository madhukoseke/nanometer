"use client";

import { useMemo, useState } from "react";
import { useNanoStream } from "@/lib/useNanoStream";
import { useDemoDiagnostics } from "@/lib/useDemoDiagnostics";
import { COUNTERFACTUAL_GAS } from "@/lib/types";
import { LiveTab } from "@/components/LiveTab";
import { MarginTab } from "@/components/MarginTab";
import { CohortsTab } from "@/components/CohortsTab";
import { SettlementTab } from "@/components/SettlementTab";
import { DemoDiagnosticsBar } from "@/components/DemoDiagnosticsBar";
import { ensureApiBaseUrl } from "@/lib/ensureApiBaseUrl";

const SWARM_URL = ensureApiBaseUrl(process.env.NEXT_PUBLIC_SWARM_URL ?? "http://localhost:3002");
type Tab = "live" | "margin" | "cohorts" | "settle";

export default function Page() {
  const { events, connected } = useNanoStream(2000);
  const diag = useDemoDiagnostics(1500);
  const [tab, setTab] = useState<Tab>("live");
  const [swarmActionError, setSwarmActionError] = useState<string | null>(null);
  /** True while pay loop runs or USDC is still moving into Gateway. */
  const swarmRunning = Boolean(diag.swarm?.running);
  const swarmStarting = Boolean(diag.swarm?.starting);

  const totals = useMemo(() => {
    const totalCalls = events.length;
    const totalRev = events.reduce((s, e) => s + e.amount_usdc, 0);
    const agents = new Set(events.map(e => e.agent_addr));
    return {
      totalCalls,
      totalRev,
      activeAgents: agents.size,
      counterfactual: {
        arc:  totalCalls * COUNTERFACTUAL_GAS.arc,
        base: totalCalls * COUNTERFACTUAL_GAS.base,
        eth:  totalCalls * COUNTERFACTUAL_GAS.eth
      }
    };
  }, [events]);

  async function toggleSwarm() {
    if (swarmStarting) return;
    setSwarmActionError(null);
    const path = swarmRunning ? "/stop" : "/start";
    try {
      const r = await fetch(`${SWARM_URL}${path}`, { method: "POST" });
      const text = await r.text();
      if (!r.ok) {
        setSwarmActionError(
          `Swarm ${path} → HTTP ${r.status}${text ? `: ${text.slice(0, 200)}` : ""}`
        );
        return;
      }
    } catch {
      setSwarmActionError(
        `Could not reach the swarm at ${SWARM_URL}. ` +
          (SWARM_URL.includes("localhost") || SWARM_URL.includes("127.0.0.1")
            ? "Run the swarm locally (npm run dev:swarm) or set NEXT_PUBLIC_SWARM_URL to your deployed swarm (https://…) in .env.local and restart next dev."
            : "Check the swarm service is up and CORS allows this site.")
      );
    }
  }

  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="mx-auto max-w-6xl px-6 py-6">
        <Header
          connected={connected}
          swarmRunning={swarmRunning}
          swarmStarting={swarmStarting}
          onSwarmToggle={toggleSwarm}
        />
        {swarmActionError && (
          <div className="mb-3 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 font-mono text-xs text-danger">
            {swarmActionError}
          </div>
        )}
        <DemoDiagnosticsBar
          sellerUrl={diag.sellerUrl}
          swarmUrl={diag.swarmUrl}
          sellerOk={diag.sellerOk}
          swarm={diag.swarm}
          swarmFetchError={diag.swarmFetchError}
          eventCount={events.length}
          sseConnected={connected}
        />
        <Tabs current={tab} onChange={setTab} />

        {tab === "live"    && <LiveTab events={events} totals={totals} />}
        {tab === "margin"  && <MarginTab totals={totals} />}
        {tab === "cohorts" && <CohortsTab events={events} />}
        {tab === "settle"  && <SettlementTab events={events} />}
      </div>
    </main>
  );
}

function Header({
  connected, swarmRunning, swarmStarting, onSwarmToggle
}: {
  connected: boolean;
  swarmRunning: boolean;
  swarmStarting: boolean;
  onSwarmToggle: () => void;
}) {
  const btn = swarmRunning ? "stop" : swarmStarting ? "funding gateway…" : "start agent swarm";
  return (
    <header className="mb-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface font-mono text-sm">N</div>
        <div>
          <div className="text-sm font-medium">NanoMeter</div>
          <div className="font-mono text-xs text-muted">arc-testnet · gateway-batched · {connected ? "live" : "reconnecting…"}</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`h-2 w-2 rounded-full ${connected ? "bg-accent" : "bg-warn"}`}
          aria-hidden
        />
        <button
          onClick={onSwarmToggle}
          disabled={swarmStarting}
          className="rounded-md border border-border bg-surface px-3 py-1.5 font-mono text-xs hover:bg-border disabled:cursor-not-allowed disabled:opacity-50"
        >
          {btn}
        </button>
      </div>
    </header>
  );
}

function Tabs({ current, onChange }: { current: Tab; onChange: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "live",    label: "Live" },
    { id: "margin",  label: "Margin" },
    { id: "cohorts", label: "Cohorts" },
    { id: "settle",  label: "Settlement" }
  ];
  return (
    <div className="mb-4 flex gap-1 border-b border-border">
      {tabs.map(t => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`-mb-px border-b-2 px-3.5 py-2 text-sm transition ${
            current === t.id
              ? "border-text text-text"
              : "border-transparent text-muted hover:text-text"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
