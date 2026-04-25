import { formatUnits, parseUnits } from "viem";
import type { GatewayClient } from "@circle-fin/x402-batching/client";

const DECIMALS = 6;
const MIN_GATEWAY = parseUnits("0.5", DECIMALS);
const MAX_DEPOSIT = parseUnits("5", DECIMALS);

/**
 * Move USDC from the agent’s wallet into Circle Gateway. `pay()` spends Gateway balance, not
 * the ERC-20 balance in the wallet (faucet only fills the wallet).
 */
export async function ensureGatewayDeposits(
  clients: { id: string; client: GatewayClient }[]
): Promise<void> {
  for (const a of clients) {
    try {
      const b = await a.client.getBalances();
      if (b.gateway.available >= MIN_GATEWAY) {
        // eslint-disable-next-line no-console
        console.log(`[swarm] ${a.id} gateway has ${b.gateway.formattedAvailable} USDC available — no deposit needed`);
        continue;
      }
      if (b.wallet.balance === 0n) {
        // eslint-disable-next-line no-console
        console.error(
          `[swarm] ${a.id} has no testnet USDC. Fund this address on Arc: ${a.client.address} ` +
            `(https://faucet.circle.com) then re-run "npm run deposit" or start the swarm again.`
        );
        continue;
      }
      const toDeposit = b.wallet.balance < MAX_DEPOSIT ? b.wallet.balance : MAX_DEPOSIT;
      const amountStr = formatUnits(toDeposit, DECIMALS);
      // eslint-disable-next-line no-console
      console.log(`[swarm] ${a.id} moving ${amountStr} USDC from wallet → Circle Gateway…`);
      const r = await a.client.deposit(amountStr);
      // eslint-disable-next-line no-console
      console.log(
        `[swarm] ${a.id} deposit ok — ${String(r.depositTxHash).slice(0, 14)}… (confirm on Arc if needed)`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.error(`[swarm] ${a.id} ensureGatewayDeposits: ${msg.slice(0, 400)}`);
    }
  }
}
