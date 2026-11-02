const key = (scope) => `mysafeops_ai_rams_prefill_v2:${encodeURIComponent(scope)}`;
export function writeAiRamsPrefill(scope, data) {
  if (!scope) throw new Error("Sign in and select a workspace before using this draft.");
  sessionStorage.setItem(key(scope), JSON.stringify({ scope, data }));
}
export function consumeAiRamsPrefill(scope) {
  if (!scope) return null;
  try {
    const envelope = JSON.parse(sessionStorage.getItem(key(scope)));
    if (envelope?.scope !== scope || !envelope.data || typeof envelope.data !== "object") return null;
    sessionStorage.removeItem(key(scope));
    return envelope.data;
  } catch { return null; }
}
