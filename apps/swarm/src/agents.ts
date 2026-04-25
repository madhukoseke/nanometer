import "dotenv/config";
import { GatewayClient, type SupportedChainName } from "@circle-fin/x402-batching/client";
import type { Hex } from "viem";

export const CHAIN = (process.env.CHAIN ?? "arcTestnet") as SupportedChainName;

const keys = (process.env.AGENT_KEYS ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean) as Hex[];

/**
 * All buyer agents. Call `getSwarmClients()` so server can `process.exit(1)` if keys missing.
 */
export function getSwarmClients(): { id: string; client: GatewayClient }[] {
  return keys.map((pk, i) => {
    const client = new GatewayClient({ chain: CHAIN, privateKey: pk });
    return { id: `agent_${String(i + 1).padStart(2, "0")}`, client };
  });
}

export function hasAgentKeys(): boolean {
  return keys.length > 0;
}
