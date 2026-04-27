/**
 * Build an explorer link for `req.payment.transaction` from the seller.
 * - If Circle already returns an absolute https URL, use it as-is.
 * - Otherwise we only link **standard EVM tx hashes** (64 hex digits, optional 0x),
 *   normalized and opened on the **Circle Arc Sepolia** explorer, which matches
 *   Gateway / Arc testnet settlement. Public ArcScan can return 422 for the same
 *   ref if the hash format or indexer differs.
 *
 * @returns `null` if the ref is not a URL and not a linkable 32-byte hash (avoid broken 422s).
 */
const DEFAULT_EXPLORER_TX_BASE = "https://arc-sepolia-explorer.circle.com/tx";

function normalizeEvmTxHashRef(raw: string): string | null {
  const t = raw.trim();
  if (/^0x[0-9a-fA-F]{64}$/i.test(t)) return t.toLowerCase();
  if (/^[0-9a-fA-F]{64}$/i.test(t)) return `0x${t.toLowerCase()}`;
  return null;
}

function explorerBase(): string {
  return (
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_ARC_EXPLORER_TX_BASE?.replace(/\/+$/, "")) ||
    DEFAULT_EXPLORER_TX_BASE
  );
}

/**
 * Href for a new tab, or `null` if we should not pretend this opens a valid explorer row.
 */
export function txRefToExplorerHref(txRef: string): string | null {
  const t = txRef.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  const hash = normalizeEvmTxHashRef(t);
  if (!hash) return null;
  return `${explorerBase()}/${hash}`;
}
