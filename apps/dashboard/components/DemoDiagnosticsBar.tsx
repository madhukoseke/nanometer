"use client";

import type { SwarmStatus } from "@/lib/useDemoDiagnostics";

type Props = {
  sellerUrl: string;
  swarmUrl: string;
  sellerOk: boolean | null;
  swarm: SwarmStatus;
  swarmFetchError: boolean;
  eventCount: number;
  sseConnected: boolean;
};

/**
 * Explains when “live” (SSE) works but the tx feed is empty: usually
 * no successful paid calls yet, or seller URL mismatch between browser and swarm.
 */
export function DemoDiagnosticsBar({
  sellerUrl, swarmUrl, sellerOk, swarm, swarmFetchError, eventCount, sseConnected
}: Props) {
  const calls = swarm?.calls ?? 0;
  const err = swarm?.errors ?? 0;
  const running = swarm?.running ?? false;
  const fundGateway = Boolean(swarm?.starting);

  const mismatch =
    sseConnected && calls > 0 && eventCount === 0;

  return (
    <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 font-mono text-[11px] leading-relaxed text-muted">
      <div className="mb-1 text-[10px] uppercase tracking-wide text-zinc-500">demo health</div>
      <div className="grid gap-1 sm:grid-cols-2">
        <div>
          <span className="text-zinc-600">Seller </span>
          {sellerOk === null ? "…" : sellerOk ? <span className="text-accent">ok</span> : <span className="text-danger">unreachable</span>}
          <span className="text-zinc-600"> — observe </span>
          <span className="text-text">{sellerUrl}/events</span>
        </div>
        <div>
          <span className="text-zinc-600">Swarm </span>
          {swarmFetchError ? (
            <span className="text-danger">unreachable at {swarmUrl}</span>
          ) : (
            <>
              {fundGateway ? (
                <span className="text-warn">funding gateway (wallet → Circle) — check swarm terminal</span>
              ) : running ? (
                <span className="text-accent">running</span>
              ) : (
                <span>idle</span>
              )}
              <span className="text-zinc-600"> · paid </span>
              <span className="text-text">{calls}</span>
              <span className="text-zinc-600"> · err </span>
              <span className={err > 0 ? "text-warn" : "text-text"}>{err}</span>
            </>
          )}
        </div>
      </div>
      <div className="mt-2 border-t border-border pt-2">
        <span className="text-zinc-600">SSE </span>
        {sseConnected ? <span className="text-accent">connected</span> : <span className="text-warn">reconnecting</span>}
        <span className="text-zinc-600"> · events in buffer </span>
        <span className="text-text">{eventCount}</span>
      </div>
      {mismatch && (
        <p className="mt-2 text-danger">
          Swarm shows successful pays, but the dashboard has no events. Use the <strong>same</strong> host in{" "}
          <code className="text-warn">NEXT_PUBLIC_SELLER_URL</code> as in the swarm’s{" "}
          <code className="text-warn">SELLER_URL</code> (both <code>localhost:3001</code> or both <code>127.0.0.1:3001</code>).
          Restart <code>next dev</code> after changing <code>.env.local</code>.
        </p>
      )}
      {!mismatch && running && calls === 0 && err > 0 && (
        <p className="mt-2 text-warn">
          Payments are still failing. Faucet only tops up the <strong>wallet</strong> — you need USDC inside{" "}
          <strong>Circle Gateway</strong> to pay. From <code>apps/swarm</code> run{" "}
          <code className="text-text">npm run deposit</code> (after faucet), or use Start and read the swarm logs for
          &quot;moving … USDC from wallet → Gateway&quot;. If the wallet is empty, fund each agent address on Arc at
          faucet.circle.com.
        </p>
      )}
      {!mismatch && running && calls === 0 && err === 0 && !fundGateway && (
        <p className="mt-2 text-zinc-500">
          Swarm is running; first successful pays can take a few seconds after the deposit step. If this stays 0, confirm
          the seller URL matches: <code className="text-text">{sellerUrl}</code>.
        </p>
      )}
      {fundGateway && (
        <p className="mt-2 text-zinc-500">
          Deposits are on-chain; first start after a fresh faucet can take 1–2 minutes for five agents. Watch the swarm
          terminal, then <strong>paid</strong> should begin ticking.
        </p>
      )}
    </div>
  );
}
