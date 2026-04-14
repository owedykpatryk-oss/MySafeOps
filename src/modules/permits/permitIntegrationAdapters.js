function nowIso() {
  return new Date().toISOString();
}

export function suggestPermitDescriptionText(draft) {
  const type = String(draft?.type || "general").replace(/_/g, " ");
  const location = String(draft?.location || "specified work area");
  const issuedTo = String(draft?.issuedTo || "assigned team");
  return `Carry out ${type} operations at ${location}. Work party: ${issuedTo}. Follow RAMS and permit controls, maintain exclusion zones, and stop work if conditions change.`;
}

export function queueIntegrationEvent(permit, channel, payload = {}) {
  return {
    id: `int_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    at: nowIso(),
    channel: String(channel || "webhook").toLowerCase(),
    status: "queued",
    payload,
    permitId: permit?.id || "",
  };
}

export function buildIntegrationAdaptersStatus() {
  return [
    { channel: "slack", enabled: false, note: "Adapter placeholder ready." },
    { channel: "teams", enabled: false, note: "Adapter placeholder ready." },
    { channel: "calendar", enabled: false, note: "Adapter placeholder ready." },
    { channel: "webhook", enabled: false, note: "Adapter placeholder ready." },
  ];
}

