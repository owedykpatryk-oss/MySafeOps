/** Follow the server policy even when an old return URL still asks for live billing. */
export function billingStripeMode(diagnostics, returnMode) {
  if (diagnostics?.activeMode === "test") return "test";
  if (returnMode === "test") return "test";
  return diagnostics?.activeMode === "live" ? "live" : "test";
}

/** New servers report active readiness; older deployments only report live readiness. */
export function billingStripeReady(diagnostics) {
  if (typeof diagnostics?.activeReady === "boolean") return diagnostics.activeReady;
  return diagnostics?.liveReady;
}
