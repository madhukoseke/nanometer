/**
 * Circle’s `payment.transaction` may be a bare 0x hash or an absolute URL to an explorer.
 * Never prefix a second base — that produces a broken href and clicks do nothing useful.
 */
const DEFAULT_TX_BASE = "https://testnet.arcscan.app/tx";

export function txRefToExplorerHref(txRef: string): string {
  const t = txRef.trim();
  if (!t) return "#";
  if (/^https?:\/\//i.test(t)) return t;
  const base =
    (typeof process !== "undefined" && process.env.NEXT_PUBLIC_ARC_EXPLORER_TX_BASE?.replace(/\/+$/, "")) ||
    DEFAULT_TX_BASE;
  return `${base}/${t.replace(/^\/+/, "")}`;
}
