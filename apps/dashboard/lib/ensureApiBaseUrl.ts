/**
 * Env URLs are often pasted without a scheme. Without `https://`, `fetch("host/status")`
 * is treated as a path on the current origin and fails. Localhost keeps `http://`.
 */
export function ensureApiBaseUrl(raw: string): string {
  let t = raw.trim();
  if (!t) return t;
  t = t.replace(/\/+$/, "");
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith("//")) return `https:${t}`;
  const isLocal =
    /^localhost(:\d+)?$/i.test(t) ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/.test(t) ||
    /^\[::1\](:\d+)?$/i.test(t);
  return `${isLocal ? "http" : "https"}://${t}`;
}
