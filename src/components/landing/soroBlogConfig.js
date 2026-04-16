/** Default MySafeOps blog embed (TrySoro). */
export const DEFAULT_SORO_EMBED_SRC = "https://app.trysoro.com/api/embed/d73f0529-f458-4b0d-843e-91bafda573b0";

/** @param {Record<string, string | undefined>} [env] */
export function getSoroEmbedSrc(env) {
  const fromEnv = String(env?.VITE_SORO_EMBED_URL || "").trim();
  return fromEnv || DEFAULT_SORO_EMBED_SRC;
}
