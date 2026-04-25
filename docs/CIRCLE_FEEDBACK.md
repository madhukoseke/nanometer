# Circle Product Feedback

## Products Used

- **Arc Testnet** — settlement layer for all NanoMeter transactions
- **Circle Nanopayments** (`@circle-fin/x402-batching`) — both buyer (`GatewayClient`) and seller (`createGatewayMiddleware`, `BatchFacilitatorClient`) sides
- **Circle Gateway** — unified USDC balance, deposit and batched settlement
- **USDC** — denomination of all per-call pricing and revenue accounting
- **x402 protocol (v2)** — HTTP 402 negotiation between agents and the demo seller API
- **Circle Developer Console** — wallet provisioning and faucet access for the 5 simulated agents in the demo swarm

## Why we chose this stack

NanoMeter is an observability and margin-intelligence layer for nanopayment-monetized APIs. The product only makes sense if the underlying settlement layer can actually clear sub-cent payments at high frequency — otherwise we'd be visualizing a market that doesn't exist. We chose Arc + Nanopayments specifically because the batched settlement model was the only candidate that crossed the `g ≪ p` threshold for $0.001 pricing. The choice was structural, not preferential: at p = $0.001 and Ethereum mainnet g ≈ $0.15, the gas term is 150× revenue, so any non-batched layer was disqualified before evaluation began.

x402 was chosen over a custom payment scheme because the standard already encodes the request retry pattern that AI agents use natively. Wrapping `createGatewayMiddleware` meant our middleware (`nanometer()`) could attach to the same `req.payment` object the seller's API was already producing — zero-config integration was the goal, and Circle's middleware API made that achievable in one line.

## What worked well

- **`GatewayClient.pay()` handles the full 402 negotiation in one call.** The auto-retry-with-signed-authorization flow is genuinely clean. We didn't have to write any of it. For our agent-swarm demo, this collapsed an otherwise-multi-step signing flow into a single async call per simulated agent.
- **`req.payment` exposes exactly the right fields for observability.** `verified`, `payer`, `amount`, `network`, `transaction` — those five fields are precisely the per-call telemetry surface NanoMeter needs. We didn't have to introspect signatures or parse EIP-712 payloads to build cohort analytics; the middleware did the unwrapping for us.
- **EIP-3009 + offchain authorization aggregation is the correct architectural choice.** The decision to sign offchain and settle in batches — rather than micro-batch onchain — is what makes the per-call UX feel synchronous to the agent while letting Circle absorb gas at the batch layer. This is the load-bearing design decision in the product, and it's right.
- **Arc's deterministic sub-second finality + dollar-denominated USDC fees made cost modeling tractable.** Our counterfactual gas calculator (the comparison-vs-Ethereum/Base view) only works because Arc's fee model is predictable. On a chain with EIP-1559-style volatile gas, the dashboard would have needed live gas oracles for *its own* settlement layer too — a scope-blowup we didn't have to take.
- **Circle Faucet + Developer Console flow for provisioning the 5 agent wallets was fast.** Going from zero to five funded buyer wallets took under 10 minutes. For a hackathon, this is the make-or-break friction point and Circle nailed it.

## What could be improved

These are the friction points NanoMeter's observability angle made visible — we noticed them precisely because we were instrumenting the SDK from the outside.

### 1. No first-class settlement-batch event stream

The current SDK exposes per-call events at verify/settle time, but there's no subscription primitive for "batch N just settled onchain, here are the K authorizations it included, here is the tx hash." Today we have to either poll the explorer or correlate by inspecting `transaction` fields after the fact. **Suggestion**: a `BatchFacilitatorClient.onBatchSettled(callback)` event handler, or a webhook surface, that fires with `{ batchId, txHash, blockNumber, authorizationIds[], totalValue }`. This is the single most-requested primitive for any developer building margin-aware applications on top of Nanopayments — without it, "batched settlement" is opaque to the very developers it's serving.

### 2. No exposed pending-authorization count between settlements

Buyers have visibility into their Gateway balance via `getBalances()` (returning `total / available / withdrawing / withdrawable`). But sellers — the side actually depending on settlement cadence for revenue recognition — have no equivalent way to see "how many of my received authorizations are still pending settlement vs. already onchain." For NanoMeter's settlement-tab UI we ended up reconstructing this state by accumulating `req.payment` events and decrementing on detected onchain settlements. **Suggestion**: a seller-side `getPendingAuthorizations()` or analogous balance projection (`pending / settling / settled / withdrawable`), mirroring the buyer surface.

### 3. `waitForSettlement(txHash)` would close the demo-day loop

Echoing prior hackathon feedback (Arc Merchant noted the same gap with `waitForTransaction`): the SDK lacks a Promise-returning helper that resolves when a specific authorization has been included in an onchain batch. For demos and tests we want to call `await client.waitForSettlement(authzId)` and have it resolve with the settlement tx hash. Today we work around this with explorer polling. This is a small ergonomic addition that would meaningfully improve the developer experience in test suites and reference implementations.

### 4. Error code `unexpected_error` is too coarse

The Gateway API documents 14 specific error codes (good — `amount_mismatch`, `nonce_already_used`, etc. are actionable), but `unexpected_error` is a catch-all that surfaces during transient infra issues with no further context. **Suggestion**: even an opaque correlation ID returned alongside `unexpected_error` would let developers file actionable support tickets. Currently a developer hitting this in a demo has no way to triage whether to retry, escalate, or restructure their flow.

### 5. The 3-day minimum `validBefore` window is right, but underdocumented

The `authorization_validity_too_short` error (validity < 3 days) is the single most likely footgun for a developer building an agent-swarm demo on a deadline. We hit it. The reasoning is sound — settlement batches need a window to clear — but the docs frame this as a generic constraint rather than a load-bearing system property. **Suggestion**: a callout in the Quickstart that explicitly says "set `validBefore` to at least `Date.now() + 3 days` for all production payments, because batched settlement requires this window." A one-line `defaultValidity` constant exposed from the SDK would be even better.

### 6. Counterfactual cost transparency would help adoption

This is a product suggestion, not a bug: every developer evaluating Nanopayments needs to do the same math we did in our margin proof — "how much would this workload cost on Ethereum / Base / Arbitrum?" Today this requires assembling gas figures from three different explorers. **Suggestion**: an official Circle calculator or `estimateCounterfactualGas(txCount, network)` SDK utility. NanoMeter is essentially a developer-facing implementation of this idea; we built it because it didn't exist as a primitive. If Circle shipped this natively, every Nanopayments adoption pitch becomes self-serve.

### 7. Agent-cohort metadata field on `PaymentRequirements`

For sellers running agent marketplaces, knowing *which* agent (vs which wallet address) is calling is operationally important — wallet rotation, multi-wallet agents, and agent-as-a-service patterns all mean `payer` address ≠ agent identity. **Suggestion**: an optional `extra.agentId` or `extra.metadata` field that buyers can include in their EIP-712 signed payload and sellers can read off `req.payment`. This would let observability tools like NanoMeter, and reputation systems built on top of Nanopayments, key cohort analytics on durable identity rather than rotating wallets.

## Summary

Circle Nanopayments + Arc is the only stack we evaluated where sub-cent agentic commerce mathematically penciled. The integration was fast — under 10 minutes to first paid request, and the `req.payment` surface gave us exactly the telemetry we needed to build the observability layer in less than a day. The improvement areas above are observability-flavored because that's our product's vantage point: we noticed them precisely because we were instrumenting the SDK from the outside. We'd be glad to contribute back any of #1–#3 as PRs to `@circle-fin/x402-batching` if it's helpful.

---

*Submitted by Madhu Koseke for the Agentic Economy on Arc hackathon, April 25–26, 2026. Project: NanoMeter — observability and margin intelligence for the agentic economy.*
