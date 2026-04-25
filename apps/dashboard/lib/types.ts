/**
 * Shape of a NanometerEvent as it arrives over SSE. Mirrors the shape emitted
 * by `packages/nanometer/src/index.ts` — keep these in sync.
 */
export interface NanometerEvent {
  ts: string;
  agent_addr: string;
  endpoint: string;
  method: string;
  amount_usdc: number;
  latency_ms: number;
  status: number;
  tx_ref?: string;
  network: string;
  verified: boolean;
}

/**
 * Counterfactual gas estimates per ERC-20 USDC transfer (~65,000 gas units),
 * sampled April 2026. Used by the Margin tab. Hardcoded on purpose — live
 * gas oracles flake during demos and we don't need that risk on stage.
 *
 * If you want to update these the morning of the demo, run:
 *   curl -s https://etherscan.io/gastracker | grep gwei
 * and adjust ETH below.
 */
export const COUNTERFACTUAL_GAS = {
  arc:  0.0000006, // batched, per-call effective gas
  base: 0.015,     // Base mainnet, post-Jovian floor
  eth:  0.150      // Ethereum mainnet, calm window
} as const;
