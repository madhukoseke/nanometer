/**
 * Build links for `req.payment.transaction` (Circle Gateway settlement field).
 * - If Circle returns an **absolute https URL**, use it as-is.
 * - Otherwise we normalize a hex value.
 *
 * **Arc testnet (`testnet.arcscan.app`) `/tx/0x…` only accepts a full 32-byte
 * (64-hex) on-chain transaction hash. Gateway often emits a **32-hex (16-byte)**
 * id; pointing `/tx/` at that value yields **422** “mistyped hash”. For those we
 * use the explorer’s **search** page instead of `/tx/`.
 *
 * (Legacy `arc-sepolia-explorer.circle.com` is gone — DNS NXDOMAIN.)
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
      // allow plain origin without /tx
      if (/^https?:\/\//i.test(override)) {
        return override.replace(/\/(tx|search)\/?$/, "");
      }
    }
  }
  return DEFAULT_EXPLORER_ORIGIN;
}

/**
 * @returns A normalized `0x…` lowercase id, or `null`.
 */
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

/**
 * 64 hex digits after 0x = 32 bytes — standard on-chain `tx` hash.
 * 32 hex digits = 16 bytes — not valid for ArcScan `/tx/`; use `search` instead.
 */
function hexDigitCount(normalized0x: string): number {
  return Math.max(0, normalized0x.length - 2);
}

/**
 * Href for a new tab, or `null` if the ref is not a URL and not a linkable id.
 */
export function txRefToExplorerHref(txRef: string | number | unknown): string | null {
  if (txRef == null) return null;
  const t = String(txRef).trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;

  const id = normalizeTxRefTo0xHash(t);
  if (!id) return null;

  const origin = explorerOrigin();
  const digits = hexDigitCount(id);

  if (digits === 64) {
    return `${origin}/tx/${id}`;
  }
  if (digits === 32) {
    // Blockscout-style search — avoids 422 on /tx/ for non–tx-length ids
    return `${origin}/search?q=${encodeURIComponent(id)}`;
  }

  return null;
}
