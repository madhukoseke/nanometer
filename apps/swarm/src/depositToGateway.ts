/**
 * One-shot: for each agent, move USDC from wallet into Circle Gateway.
 * Run after testnet USDC is in the wallet (faucet) and with apps/swarm/.env set.
 */
import { getSwarmClients, hasAgentKeys, CHAIN } from "./agents.js";
import { ensureGatewayDeposits } from "./ensureGatewayDeposit.js";

if (!hasAgentKeys()) {
  // eslint-disable-next-line no-console
  console.error("AGENT_KEYS missing — run `npm run bootstrap` and copy keys into .env first.");
  process.exit(1);
}

const clients = getSwarmClients();
for (const a of clients) {
  // eslint-disable-next-line no-console
  console.log(`[deposit] ${a.id} -> ${a.client.address}`);
}
// eslint-disable-next-line no-console
console.log(`[deposit] chain ${CHAIN}, funding Gateway (on-chain)…\n`);

void ensureGatewayDeposits(clients)
  .then(() => {
    // eslint-disable-next-line no-console
    console.log("\n[deposit] done. You can `npm run dev` and start the swarm.");
    process.exit(0);
  })
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  });
