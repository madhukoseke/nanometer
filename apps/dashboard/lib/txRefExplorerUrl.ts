/**
 * Build links for `req.payment.transaction` (Circle Gateway settlement field).
 *
 * Flow:
 * 1. Seller records `req.payment.transaction` → SSE `tx_ref` (see `packages/nanometer`).
 * 2. Circle may return a **full explorer URL** → use as-is.
 * 3. Otherwise the value is usually hex:
 *    - **64 hex digits** (32-byte EVM tx hash) → `testnet.arcscan.app/tx/0x…` works when indexed.
 *    - **32 hex digits** (16-byte id) → Circle **Gateway batch / settlement reference**. It is **not**
 *      guaranteed to appear on ArcScan as a transaction or search hit (“0 matching results”).
 *      We **do not** send users to explorer links for these — avoids dead-end searches.
 *
 * ArcScan `/tx/` rejects bad lengths (422). Legacy Circle host `arc-sepolia-explorer.circle.com` is NXDOMAIN.
 */
const DEFAULT_EXPLORER_ORIGIN = "https://testnet.arcscan.app";

function explorerOrigin(): string {
  const override =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_ARC_EXPLORER_TX_BASE
      ? process.env.NEXT_PUBLIC_ARC_EXPLORER_TX_BASE.replace(/\/+$/, "")
      : "";
  if (override) {
    try {
      return new URL(override).origin;
    } catch {
      if (/^https?:\/\//i.test(override)) {
        return override.replace(/\/(tx|search-results|search)\/?$/, "");
      }
    }
  }
  return DEFAULT_EXPLORER_ORIGIN;
}

function normalizeTxRefTo0xHash(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;

  if (/^0x[0-9a-fA-F]{32}$/i.test(t)) return t.toLowerCase();
  if (/^0x[0-9a-fA-F]{64}$/i.test(t)) return t.toLowerCase();

  if (/^0x/i.test(t)) {
    const body = t.slice(2).replace(/[^0-9a-fA-F]/g, "");
    if (body.length === 32 || body.length === 64) {
      return `0x${body.toLowerCase()}`;
    }
  }

  const allHex = t.replace(/[^0-9a-fA-F]/g, "");
  if (allHex.length === 32 || allHex.length === 64) {
    return `0x${allHex.toLowerCase()}`;
  }

  return null;
}

function hexDigitCount(normalized0x: string): number {
  return Math.max(0, normalized0x.length - 2);
}

/**
 * Tooltip for the Settlement row: explains why there may be no explorer link.
 */
export function txRefExplorerTitle(txRef: string | number | unknown): string {
  const raw = String(txRef ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;

  const id = normalizeTxRefTo0xHash(raw);
  if (!id) return raw;

  const digits = hexDigitCount(id);
  if (digits === 64) {
    return `${id} — Arc testnet tx (opens on ArcScan when indexed)`;
  }
  if (digits === 32) {
    return `${id} — Circle Gateway settlement reference (16-byte id). Not the same as a public Arc transaction hash; ArcScan search typically shows no results.`;
  }
  return raw;
}

/**
 * Href for a new tab, or `null` when no reliable explorer destination exists.
 */
export function txRefToExplorerHref(txRef: string | number | unknown): string | null {
  if (txRef == null) return null;
  const t = String(txRef).trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;

  const id = normalizeTxRefTo0xHash(t);
  if (!id) return null;

  const digits = hexDigitCount(id);

  // Only 64-hex is a standard on-chain tx hash path on ArcScan.
  if (digits === 64) {
    return `${explorerOrigin()}/tx/${id}`;
  }

  // 32-hex: Gateway-internal style id — do not link (search returns 0 / misleads users).
  return null;
}
