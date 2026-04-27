/**
 * Build an explorer link for `req.payment.transaction` from the seller.
 * - If Circle already returns an absolute https URL, use it as-is.
 * - Otherwise we normalize a hex id and use the Circle Arc Sepolia explorer
 *   (default, overridable via NEXT_PUBLIC_ARC_EXPLORER_TX_BASE).
 *
 * Important: **never** strip a whole `0x…` string to hex by removing `x` only —
 * the leading `0` in `0x` is a valid hex character, so you get 65 digit strings
 * and 32/64 length checks (and hyperlinks) fail. Always **slice off `0x` first**,
 * then read hex from the body (or strip non-hex for UUIDs / no-prefix refs).
 */
const DEFAULT_EXPLORER_TX_BASE = "https://arc-sepolia-explorer.circle.com/tx";

function explorerBase(): string {
  return (
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_ARC_EXPLORER_TX_BASE?.replace(/\/+$/, "")) ||
    DEFAULT_EXPLORER_TX_BASE
  );
}

/**
 * @returns A normalized `0x…` hash, or `null` if we cannot form one.
 */
function normalizeTxRefTo0xHash(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;

  // 1) Strict 0x + body (avoids 65-digit bug from global non-hex strip on "0x" + 64-hex)
  if (/^0x[0-9a-fA-F]{32}$/i.test(t)) return t.toLowerCase();
  if (/^0x[0-9a-fA-F]{64}$/i.test(t)) return t.toLowerCase();

  // 2) 0x + body with possible separators in the body (dashes, spaces) — e.g. UUID-like
  if (/^0x/i.test(t)) {
    const body = t.slice(2).replace(/[^0-9a-fA-F]/g, "");
    if (body.length === 32 || body.length === 64) {
      return `0x${body.toLowerCase()}`;
    }
  }

  // 3) No 0x: plain 32 / 64 hex, or 32-hex with dashes (UUID), etc.
  const allHex = t.replace(/[^0-9a-fA-F]/g, "");
  if (allHex.length === 32 || allHex.length === 64) {
    return `0x${allHex.toLowerCase()}`;
  }

  return null;
}

/**
 * Href for a new tab, or `null` if the ref is not a URL and not a linkable id.
 */
export function txRefToExplorerHref(txRef: string | number | unknown): string | null {
  if (txRef == null) return null;
  const t = String(txRef).trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  const hash = normalizeTxRefTo0xHash(t);
  if (!hash) return null;
  return `${explorerBase()}/${hash}`;
}
