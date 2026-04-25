"use client";

import { useMemo, useState } from "react";
import { useNanoStream } from "@/lib/useNanoStream";
import { COUNTERFACTUAL_GAS } from "@/lib/types";
import { LiveTab } from "@/components/LiveTab";
import { MarginTab } from "@/components/MarginTab";
import { CohortsTab } from "@/components/CohortsTab";
import { SettlementTab } from "@/components/SettlementTab";

const SWARM_URL = process.env.NEXT_PUBLIC_SWARM_URL ?? "http://localhost:3002";
type Tab = "live" | "margin" | "cohorts" | "settle";

export default function Page() {
  const { events, connected } = useNanoStream(2000);
  const [tab, setTab] = useState<Tab>("live");
  const [swarmRunning, setSwarmRunning] = useState(false);

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
    const path = swarmRunning ? "/stop" : "/start";
    try {
      const r = await fetch(`${SWARM_URL}${path}`, { method: "POST" });
      if (r.ok) setSwarmRunning(!swarmRunning);
    } catch {
      // swarm not reachable — keep button enabled, surface error in console
      // eslint-disable-next-line no-console
      console.error("swarm controller not reachable at", SWARM_URL);
    }
  }

  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="mx-auto max-w-6xl px-6 py-6">
        <Header
          connected={connected}
          swarmRunning={swarmRunning}
          onSwarmToggle={toggleSwarm}
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
  connected, swarmRunning, onSwarmToggle
}: { connected: boolean; swarmRunning: boolean; onSwarmToggle: () => void }) {
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
          className="rounded-md border border-border bg-surface px-3 py-1.5 font-mono text-xs hover:bg-border"
        >
          {swarmRunning ? "stop" : "start agent swarm"}
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
