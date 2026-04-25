/**
 * Bootstrap: generate 5 agent wallets, print their addresses + private keys.
 *
 * Run once before the demo. Then:
 *   1) Fund each ADDRESS with Arc testnet USDC from faucet.circle.com
 *   2) Paste the private keys into apps/swarm/.env as AGENT_KEYS
 *   3) Run `npm run dev:swarm` — the swarm will deposit each wallet's USDC
 *      into Gateway on first run.
 */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const COUNT = 5;

console.log(`\nNanometer demo agent wallets (${COUNT})\n`);
console.log("─".repeat(80));

const keys: string[] = [];
for (let i = 0; i < COUNT; i++) {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  keys.push(pk);
  console.log(`agent_${String(i + 1).padStart(2, "0")}`);
  console.log(`  address: ${account.address}`);
  console.log(`  privkey: ${pk}`);
  console.log("");
}

console.log("─".repeat(80));
console.log("\nNext steps:");
console.log("  1. Fund each ADDRESS above with Arc testnet USDC (faucet.circle.com)");
console.log("  2. Paste this line into apps/swarm/.env:\n");
console.log(`     AGENT_KEYS=${keys.join(",")}\n`);
console.log("  3. Run `npm run dev:swarm` — first run will deposit each wallet's");
console.log("     USDC into Circle Gateway automatically.\n");
