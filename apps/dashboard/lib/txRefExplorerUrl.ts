/**
 * Build an explorer link for `req.payment.transaction` from the seller.
 * - If Circle already returns an absolute https URL, use it as-is.
 * - Otherwise we normalize a hex ref and use the **Circle Arc Sepolia** explorer
 *   (default), which lines up with Gateway settlement. Public ArcScan can 422
 *   the same value if the format/indexer does not match.
 *
 * Circle / Gateway can emit **32 hex chars** (16-byte id) *or* **64** (32-byte
 * EVM transaction hash) with or without `0x` — both are linkable; the old UI
 * only accepted 64-hex, so 32-hex refs showed as plain text with no link.
 */
const DEFAULT_EXPLORER_TX_BASE = "https://arc-sepolia-explorer.circle.com/tx";

function normalizeEvmTxHashRef(raw: string): string | null {
  const u = raw.trim().replace(/\s+/g, "");
  if (!u) return null;

  // 32 or 64 hex digits (0x-optional) — on-chain or Gateway batch / tx id
  if (/^0x[0-9a-fA-F]{32}$/i.test(u)) return u.toLowerCase();
  if (/^[0-9a-fA-F]{32}$/i.test(u)) return `0x${u.toLowerCase()}`;
  if (/^0x[0-9a-fA-F]{64}$/i.test(u)) return u.toLowerCase();
  if (/^[0-9a-fA-F]{64}$/i.test(u)) return `0x${u.toLowerCase()}`;

  return null;
}

function explorerBase(): string {
  return (
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_ARC_EXPLORER_TX_BASE?.replace(/\/+$/, "")) ||
    DEFAULT_EXPLORER_TX_BASE
  );
}

/**
 * Href for a new tab, or `null` if the ref is not a URL and not a linkable hex id.
 */
export function txRefToExplorerHref(txRef: string): string | null {
  const t = txRef.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  const hash = normalizeEvmTxHashRef(t);
  if (!hash) return null;
  return `${explorerBase()}/${hash}`;
}
