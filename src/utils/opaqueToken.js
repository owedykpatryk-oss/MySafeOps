/**
 * Capability tokens for share / ack / portal links (CSPRNG when available).
 * Prefer this over Date.now + Math.random for anything that gates access.
 */
export function genOpaqueToken(prefix = "tok") {
  const safePrefix = String(prefix || "tok").replace(/[^a-z0-9_]/gi, "").slice(0, 24) || "tok";
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${safePrefix}_${crypto.randomUUID().replace(/-/g, "")}`;
  }
  // Extremely rare fallback — still longer than Math.random alone
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = (Math.random() * 256) | 0;
  }
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${safePrefix}_${hex}`;
}
